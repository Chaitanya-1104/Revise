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
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  overlay.style.cursor = 'crosshair';
  overlay.style.zIndex = '999999';
  document.body.appendChild(overlay);

  // Capture the start coordinates on mousedown
  overlay.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    isSelecting = true;
    console.log("Selection started at:", startX, startY);
  });

  // Track the mouse movement and update selection area
  overlay.addEventListener('mousemove', (e) => {
    if (isSelecting) {
      endX = e.clientX;
      endY = e.clientY;
      updateOverlay();
    }
  });

  // Capture the end coordinates on mouseup and finish selection
  overlay.addEventListener('mouseup', () => {
    isSelecting = false;
    console.log("Selection completed from:", startX, startY, "to", endX, endY);
    captureSelection();
  });
}

// Function to update the selection area visually
function updateOverlay() {
  let overlay = document.getElementById('screenshot-overlay');
  if (overlay) {
    overlay.style.left = `${Math.min(startX, endX)}px`;
    overlay.style.top = `${Math.min(startY, endY)}px`;
    overlay.style.width = `${Math.abs(startX - endX)}px`;
    overlay.style.height = `${Math.abs(startY - endY)}px`;
  }
}

// Function to remove the overlay and send the capture message to background.js
function captureSelection() {
  document.getElementById('screenshot-overlay').remove();
  console.log("Sending capture message with coordinates...");
  chrome.runtime.sendMessage({
    action: 'capture',
    coordinates: { startX, startY, endX, endY }
  });
}

// Add event listener to the button to trigger overlay creation
button.addEventListener('click', createOverlay);
