console.log("Content script loaded.");

// Create a button to trigger screenshot selection
let button = document.createElement('button');
button.id = 'screenshot-button';
button.innerText = 'Select Area';
button.style.position = 'fixed';
button.style.top = '10px';
button.style.right = '10px';
button.style.zIndex = '999999';
document.body.appendChild(button);

console.log("Screenshot button added.");

// Variables to store selection start and end points
let startX, startY, endX, endY;
let isSelecting = false;

// Function to create the selection overlay
function createOverlay() {
  console.log("Creating overlay...");
  let overlay = document.createElement('div');
  overlay.id = 'screenshot-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.25)';
  overlay.style.cursor = 'crosshair';
  overlay.style.zIndex = '999999';
  document.body.appendChild(overlay);

  // visual box to show selection
  let selectionBox = document.createElement('div');
  selectionBox.id = 'screenshot-selection-box';
  selectionBox.style.position = 'fixed';
  selectionBox.style.border = '2px dashed #fff';
  selectionBox.style.backgroundColor = 'rgba(255,255,255,0.05)';
  selectionBox.style.zIndex = '1000000';
  document.body.appendChild(selectionBox);

  // Capture the start coordinates on mousedown
  overlay.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    endX = startX;
    endY = startY;
    isSelecting = true;
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
    console.log("Selection started at:", startX, startY);
  });

  // Track the mouse movement and update selection area
  overlay.addEventListener('mousemove', (e) => {
    if (isSelecting) {
      endX = e.clientX;
      endY = e.clientY;
      updateOverlay(selectionBox);
    }
  });

  // Capture the end coordinates on mouseup and finish selection
  overlay.addEventListener('mouseup', () => {
    isSelecting = false;
    console.log("Selection completed from:", startX, startY, "to", endX, endY);
    // remove overlay and selectionBox
    overlay.remove();
    selectionBox.remove();
    captureSelection();
  });

  // If the user presses Escape, cancel selection
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      isSelecting = false;
      if (document.getElementById('screenshot-overlay')) document.getElementById('screenshot-overlay').remove();
      if (document.getElementById('screenshot-selection-box')) document.getElementById('screenshot-selection-box').remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// Function to update the selection area visually
function updateOverlay(box) {
  if (!box) box = document.getElementById('screenshot-selection-box');
  if (box) {
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(startX - endX);
    const height = Math.abs(startY - endY);
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
  }
}

// Function to remove the overlay and send the capture message to background.js
function captureSelection() {
  // normalize rectangle
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(startX - endX);
  const height = Math.abs(startY - endY);

  // send DPR and scroll offsets so background can crop correctly
  chrome.runtime.sendMessage({
    action: 'capture',
    coordinates: { left, top, width, height },
    devicePixelRatio: window.devicePixelRatio || 1,
    scroll: { x: window.scrollX || 0, y: window.scrollY || 0 }
  });
}

// Add event listener to the button to trigger overlay creation
button.addEventListener('click', createOverlay);

// Listen for messages from background (capture completion)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.action === 'captureDone') {
    console.log('Received captureDone message from background:', msg);
    if (msg.success) {
      showToast('Capture saved: ' + (msg.filename || ''));
    } else {
      showToast('Capture failed: ' + (msg.error || 'unknown error'));
    }
  }
});

function showToast(text) {
  try {
    let t = document.getElementById('revise-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'revise-toast';
      t.style.position = 'fixed';
      t.style.right = '16px';
      t.style.bottom = '16px';
      t.style.background = 'rgba(0,0,0,0.85)';
      t.style.color = '#fff';
      t.style.padding = '8px 12px';
      t.style.borderRadius = '4px';
      t.style.zIndex = '10000001';
      t.style.fontSize = '13px';
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.style.opacity = '1';
    setTimeout(() => {
      if (t) t.style.opacity = '0';
    }, 3000);
  } catch (e) {
    console.warn('Failed to show toast:', e);
  }
}
