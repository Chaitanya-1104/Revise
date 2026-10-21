console.log("Content script loaded.");

// Create a floating, draggable capture toolbar
function ensureCaptureToolbar() {
  let tool = document.getElementById('revise-capture-toolbar');
  if (tool) return tool;

  tool = document.createElement('div');
  tool.id = 'revise-capture-toolbar';
  tool.style.position = 'fixed';
  tool.style.top = '12px';
  tool.style.right = '12px';
  tool.style.zIndex = '2147483647';
  tool.style.display = 'flex';
  tool.style.alignItems = 'center';
  tool.style.gap = '8px';
  tool.style.userSelect = 'none';
  tool.style.pointerEvents = 'auto';
  tool.style.transition = 'transform 0.15s ease, opacity 0.15s ease';

  const button = document.createElement('button');
  button.id = 'screenshot-button';
  button.type = 'button';
  button.innerText = 'Select Area';
  button.title = 'Select a region to capture';
  button.style.position = 'relative';
  button.style.padding = '8px 14px';
  button.style.border = '1px solid rgba(0,0,0,0.18)';
  button.style.borderRadius = '999px';
  button.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
  button.style.color = '#fff';
  button.style.fontSize = '13px';
  button.style.fontWeight = '600';
  button.style.cursor = 'grab';
  button.style.boxShadow = '0 8px 20px rgba(79, 70, 229, 0.25)';
  button.style.whiteSpace = 'nowrap';
  button.style.lineHeight = '1.2';

  const collapseBtn = document.createElement('button');
  collapseBtn.id = 'revise-collapse-button';
  collapseBtn.type = 'button';
  collapseBtn.title = 'Hide capture button';
  collapseBtn.textContent = '◀';
  collapseBtn.style.width = '26px';
  collapseBtn.style.height = '26px';
  collapseBtn.style.borderRadius = '50%';
  collapseBtn.style.border = '1px solid rgba(15,23,42,0.15)';
  collapseBtn.style.background = 'rgba(255,255,255,0.92)';
  collapseBtn.style.color = '#1f2937';
  collapseBtn.style.cursor = 'pointer';
  collapseBtn.style.fontSize = '12px';
  collapseBtn.style.display = 'grid';
  collapseBtn.style.placeItems = 'center';
  collapseBtn.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.12)';

  tool.appendChild(button);
  tool.appendChild(collapseBtn);
  document.body.appendChild(tool);

  // Make the tool draggable by grabbing the main button area
  let dragState = null;
  const clampToViewport = (x, y) => {
    const maxX = Math.max(12, window.innerWidth - tool.offsetWidth - 12);
    const maxY = Math.max(12, window.innerHeight - tool.offsetHeight - 12);
    return {
      x: Math.min(Math.max(x, 12), maxX),
      y: Math.min(Math.max(y, 12), maxY)
    };
  };

  const startDrag = (event) => {
    if (tool.classList.contains('revise-collapsed')) return;
    if (event.target.closest('#revise-collapse-button')) return;

    const currentLeft = parseFloat(tool.style.left || tool.getBoundingClientRect().left);
    const currentTop = parseFloat(tool.style.top || tool.getBoundingClientRect().top);

    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      left: currentLeft,
      top: currentTop
    };

    button.style.cursor = 'grabbing';
    tool.style.transition = 'none';
  };

  const onMove = (event) => {
    if (!dragState) return;

    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    const nextLeft = clampToViewport(dragState.left + dx, dragState.top + dy).x;
    const nextTop = clampToViewport(dragState.left + dx, dragState.top + dy).y;

    tool.style.left = `${nextLeft}px`;
    tool.style.top = `${nextTop}px`;
    tool.style.right = 'auto';
  };

  const stopDrag = () => {
    if (!dragState) return;
    dragState = null;
    button.style.cursor = 'grab';
    tool.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
  };

  button.addEventListener('pointerdown', startDrag);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', stopDrag);
  window.addEventListener('pointercancel', stopDrag);

  const setCollapsed = (collapsed) => {
    tool.classList.toggle('revise-collapsed', collapsed);
    if (collapsed) {
      button.style.display = 'none';
      collapseBtn.textContent = '▶';
      collapseBtn.title = 'Show capture button';
      tool.style.gap = '0px';
      tool.style.padding = '0';
      tool.style.minWidth = '26px';
      tool.style.width = '26px';
      tool.style.height = '26px';
    } else {
      button.style.display = 'inline-flex';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
      collapseBtn.textContent = '◀';
      collapseBtn.title = 'Hide capture button';
      tool.style.gap = '8px';
      tool.style.minWidth = '0';
      tool.style.width = 'auto';
      tool.style.height = 'auto';
    }
  };

  collapseBtn.addEventListener('click', () => {
    const collapsed = !tool.classList.contains('revise-collapsed');
    setCollapsed(collapsed);
  });

  setCollapsed(false);
  return tool;
}

const captureTool = ensureCaptureToolbar();
const button = document.getElementById('screenshot-button');
const collapseButton = document.getElementById('revise-collapse-button');

if (button) {
  button.addEventListener('click', () => {
    if (!captureTool.classList.contains('revise-collapsed')) {
      createOverlay();
    }
  });
}

if (collapseButton) {
  collapseButton.addEventListener('click', () => {
    const collapsed = captureTool.classList.contains('revise-collapsed');
    captureTool.classList.toggle('revise-collapsed', !collapsed);
  });
}

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

  overlay.addEventListener('mousemove', (e) => {
    if (isSelecting) {
      endX = e.clientX;
      endY = e.clientY;
      updateOverlay(selectionBox);
    }
  });

  overlay.addEventListener('mouseup', () => {
    isSelecting = false;
    console.log("Selection completed from:", startX, startY, "to", endX, endY);
    overlay.remove();
    selectionBox.remove();
    captureSelection();
  });

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
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(startX - endX);
  const height = Math.abs(startY - endY);

  chrome.runtime.sendMessage({
    action: 'capture',
    coordinates: { left, top, width, height },
    devicePixelRatio: window.devicePixelRatio || 1,
    scroll: { x: window.scrollX || 0, y: window.scrollY || 0 }
  });
}

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
