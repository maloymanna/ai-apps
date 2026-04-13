const SERVER = 'http://localhost:5000';
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_MS = 15 * 60 * 1000;

// Absolute URL required in MV3 service workers for notifications
const ICON_URL = chrome.runtime.getURL('icon.png');

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action !== 'summarize') return;
  handleSummarize(msg.videoId).then(sendResponse);
  return true;
});

// Resume polling if the service worker was killed mid-job
chrome.storage.local.get(['job'], ({ job }) => {
  if (job?.status === 'running' && job?.videoId) {
    poll(job.videoId, job.startedAt || Date.now());
  }
});

async function handleSummarize(videoId) {
  try {
    const health = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(4000) });
    if (!health.ok) throw new Error('not ok');
  } catch {
    return { error: 'Server unreachable. Run ./start_server.sh first.' };
  }

  const now = Date.now();
  await chrome.storage.local.set({
    job: { status: 'running', message: 'Starting…', videoId, startedAt: now }
  });

  try {
    const res = await fetch(`${SERVER}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.status === 'error') {
      await setJobError(data.message);
      return { error: data.message };
    }
  } catch (e) {
    await setJobError('Failed to contact server: ' + e.message);
    return { error: e.message };
  }

  poll(videoId, now);
  return { ok: true };
}

function poll(videoId, startedAt) {
  const tick = async () => {
    if (Date.now() - startedAt > MAX_POLL_MS) {
      await setJobError('Timed out after 15 minutes.');
      return;
    }

    let data;
    try {
      const res = await fetch(`${SERVER}/status?video_id=${videoId}`, {
        signal: AbortSignal.timeout(5000)
      });
      data = await res.json();
    } catch {
      setTimeout(tick, POLL_INTERVAL_MS);
      return;
    }

    if (data.status === 'running') {
      await chrome.storage.local.set({
        job: { status: 'running', message: data.message || 'Working…', videoId, startedAt }
      });
      setTimeout(tick, POLL_INTERVAL_MS);
    } else if (data.status === 'done') {
      await chrome.storage.local.set({
        job: { status: 'done', videoId, outputPath: data.output_path }
      });
      chrome.notifications.create('yt-summary-done', {
        type: 'basic',
        iconUrl: ICON_URL,
        title: 'Summary complete',
        message: 'Saved to: ' + data.output_path,
      });
    } else if (data.status === 'error') {
      await setJobError(data.message);
    } else if (Date.now() - startedAt < 30000) {
      setTimeout(tick, POLL_INTERVAL_MS);
    }
  };
  setTimeout(tick, POLL_INTERVAL_MS);
}

async function setJobError(message) {
  await chrome.storage.local.set({ job: { status: 'error', message } });
  chrome.notifications.create('yt-summary-error', {
    type: 'basic',
    iconUrl: ICON_URL,
    title: 'Summarizer error',
    message,
  });
}
