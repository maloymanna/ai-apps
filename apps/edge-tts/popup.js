const ICONS = {
  play: `
    <svg width="16" height="16" viewBox="0 0 16 16">
      <polygon points="0,0 16,8 0,16" fill="black"/>
    </svg>
  `,
  pause: `
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect x="0" y="0" width="5" height="16" fill="black"/>
      <rect x="11" y="0" width="5" height="16" fill="black"/>
    </svg>
  `,
  stop: `
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect width="16" height="16" fill="black"/>
    </svg>
  `
};

let isPlaying = false;
let isPaused = false;

// Inject + send command
async function sendCommand(command) {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });

  chrome.tabs.sendMessage(tab.id, { command });
}

// UI update
function updateUI() {
  const toggleBtn = document.getElementById("toggleBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (!isPlaying) {
    toggleBtn.innerHTML = ICONS.play;
    stopBtn.innerHTML = ICONS.stop;
    stopBtn.disabled = true;
  } else if (isPaused) {
    toggleBtn.innerHTML = ICONS.play; // Resume shows same play icon
    stopBtn.innerHTML = ICONS.stop;
    stopBtn.disabled = false;
  } else {
    toggleBtn.innerHTML = ICONS.pause;
    stopBtn.innerHTML = ICONS.stop;
    stopBtn.disabled = false;
  }
}

// Toggle logic
async function handleToggle() {
  if (!isPlaying) {
    await sendCommand("start");
    isPlaying = true;
    isPaused = false;
  } else if (isPaused) {
    await sendCommand("resume");
    isPaused = false;
  } else {
    await sendCommand("pause");
    isPaused = true;
  }

  updateUI();
}

// Stop logic
async function handleStop() {
  await sendCommand("stop");
  isPlaying = false;
  isPaused = false;
  updateUI();
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "finished") {
    // Reading finished naturally
    isPlaying = false;
    isPaused = false;
    updateUI();
  }
});

// Init
document.getElementById("toggleBtn").addEventListener("click", handleToggle);
document.getElementById("stopBtn").addEventListener("click", handleStop);

updateUI();