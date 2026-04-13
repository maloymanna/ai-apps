const btn = document.getElementById('summarize-btn');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset-btn');
const urlSection = document.getElementById('url-section');
const urlInput = document.getElementById('url-input');
const detectedEl = document.getElementById('detected-video');

let detectedVideoId = null;

function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
  } catch {}
  return null;
}

function setStatus(msg, type = '') {
  statusEl.className = type;
  statusEl.innerHTML = msg;
}

function setLoading(loading) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Summarizing…' : 'Summarize';
}

function showReset(show) {
  resetBtn.style.display = show ? 'inline-block' : 'none';
}

resetBtn.addEventListener('click', () => {
  chrome.storage.local.remove('job');
  setStatus('');
  showReset(false);
  sessionStorage.setItem('cleared', '1');
});

function renderJob(job) {
  if (!job) return;
  if (job.status === 'running') {
    setLoading(true);
    showReset(false);
    setStatus('<span class="spinner"></span>' + (job.message || 'Working…'));
    sessionStorage.removeItem('cleared');
  } else if (job.status === 'done') {
    setLoading(false);
    if (!sessionStorage.getItem('cleared')) {
      setStatus('✓ Saved to: <small>' + job.outputPath + '</small>', 'success');
      showReset(true);
    }
  } else if (job.status === 'error') {
    setLoading(false);
    if (!sessionStorage.getItem('cleared')) {
      setStatus(job.message, 'error');
      showReset(true);   // ← show clear on errors too
    }
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const vid = tab?.url ? extractVideoId(tab.url) : null;
  if (vid) {
    detectedVideoId = vid;
    detectedEl.textContent = 'Video: ' + vid;
  } else {
    urlSection.style.display = 'block';
    detectedEl.textContent = 'No YouTube video detected — enter URL:';
  }
});

chrome.storage.local.get(['job'], ({ job }) => {
  if (!job) return;
  if (job.status === 'running') { renderJob(job); return; }
  if (!sessionStorage.getItem('cleared')) renderJob(job);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.job) renderJob(changes.job.newValue);
});

btn.addEventListener('click', () => {
  let videoId = detectedVideoId;
  if (!videoId) {
    videoId = extractVideoId(urlInput.value.trim());
    if (!videoId) { setStatus('Invalid YouTube URL.', 'error'); return; }
  }
  sessionStorage.removeItem('cleared');
  setLoading(true);
  showReset(false);
  setStatus('<span class="spinner"></span>Contacting server…');

  chrome.runtime.sendMessage({ action: 'summarize', videoId }, (res) => {
    if (chrome.runtime.lastError) {
      setStatus('Extension error: ' + chrome.runtime.lastError.message, 'error');
      setLoading(false);
      showReset(true);
      return;
    }
    if (res?.error) {
      setStatus(res.error, 'error');
      setLoading(false);
      showReset(true);
    }
  });
});
