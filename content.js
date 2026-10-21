console.log("Content script loaded.");

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function ensureCaptureToolbar() {
  let toolbar = document.getElementById('revise-capture-toolbar');
  if (toolbar) return toolbar;

  toolbar = document.createElement('div');
  toolbar.id = 'revise-capture-toolbar';
  toolbar.style.position = 'fixed';
  toolbar.style.top = '12px';
  toolbar.style.right = '12px';
  toolbar.style.zIndex = '2147483647';
  toolbar.style.display = 'flex';
  toolbar.style.alignItems = 'center';
  toolbar.style.gap = '8px';
  toolbar.style.userSelect = 'none';
  toolbar.style.pointerEvents = 'auto';
  toolbar.style.filter = 'drop-shadow(0 10px 20px rgba(15, 23, 42, 0.18))';
  toolbar.style.transition = 'transform 0.15s ease, opacity 0.15s ease';

  const button = document.createElement('button');
  button.id = 'screenshot-button';
  button.type = 'button';
  button.innerText = 'Select Area';
  button.title = 'Select a region to capture';
  button.style.position = 'relative';
  button.style.padding = '9px 15px';
  button.style.border = '1px solid rgba(79, 70, 229, 0.35)';
  button.style.borderRadius = '999px';
  button.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
  button.style.color = '#ffffff';
  button.style.fontSize = '13px';
  button.style.fontWeight = '700';
  button.style.cursor = 'grab';
  button.style.whiteSpace = 'nowrap';
  button.style.lineHeight = '1.2';
  button.style.boxShadow = '0 8px 22px rgba(79, 70, 229, 0.26)';
  button.style.outline = 'none';
  button.style.transition = 'transform 0.12s ease, box-shadow 0.12s ease';
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-1px)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
  });

  const collapseBtn = document.createElement('button');
  collapseBtn.id = 'revise-collapse-button';
  collapseBtn.type = 'button';
  collapseBtn.title = 'Hide capture controls';
  collapseBtn.textContent = '◀';
  collapseBtn.style.width = '28px';
  collapseBtn.style.height = '28px';
  collapseBtn.style.borderRadius = '50%';
  collapseBtn.style.border = '1px solid rgba(15, 23, 42, 0.12)';
  collapseBtn.style.background = 'rgba(255,255,255,0.96)';
  collapseBtn.style.color = '#1f2937';
  collapseBtn.style.cursor = 'pointer';
  collapseBtn.style.fontSize = '12px';
  collapseBtn.style.display = 'grid';
  collapseBtn.style.placeItems = 'center';
  collapseBtn.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.08)';
  collapseBtn.style.padding = '0';
  collapseBtn.style.outline = 'none';

  toolbar.appendChild(button);
  toolbar.appendChild(collapseBtn);
  document.body.appendChild(toolbar);

  let dragState = null;

  const updatePosition = () => {
    const rect = toolbar.getBoundingClientRect();
    const maxX = Math.max(12, window.innerWidth - rect.width - 12);
    const maxY = Math.max(12, window.innerHeight - rect.height - 12);

    const left = clamp(parseFloat(toolbar.style.left || rect.left), 12, maxX);
    const top = clamp(parseFloat(toolbar.style.top || rect.top), 12, maxY);

    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
    toolbar.style.right = 'auto';
  };

  const startDrag = (event) => {
    if (toolbar.classList.contains('revise-collapsed')) return;
    const rect = toolbar.getBoundingClientRect();
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top
    };
    button.style.cursor = 'grabbing';
    toolbar.style.transition = 'none';
  };

  const onMove = (event) => {
    if (!dragState) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    const nextX = clamp(dragState.left + dx, 12, Math.max(12, window.innerWidth - toolbar.offsetWidth - 12));
    const nextY = clamp(dragState.top + dy, 12, Math.max(12, window.innerHeight - toolbar.offsetHeight - 12));
    toolbar.style.left = `${nextX}px`;
    toolbar.style.top = `${nextY}px`;
    toolbar.style.right = 'auto';
  };

  const stopDrag = () => {
    if (!dragState) return;
    dragState = null;
    button.style.cursor = 'grab';
    toolbar.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
  };

  button.addEventListener('pointerdown', startDrag);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', stopDrag);
  window.addEventListener('pointercancel', stopDrag);
  window.addEventListener('resize', updatePosition);

  const setCollapsed = (collapsed) => {
    toolbar.classList.toggle('revise-collapsed', collapsed);
    if (collapsed) {
      button.style.display = 'none';
      collapseBtn.textContent = '⟩';
      collapseBtn.title = 'Show capture controls';
      toolbar.style.gap = '0';
      toolbar.style.width = '30px';
      toolbar.style.height = '30px';
      toolbar.style.minWidth = '30px';
      toolbar.style.padding = '0';
      toolbar.style.right = '12px';
      toolbar.style.top = toolbar.style.top || '12px';
      toolbar.style.left = 'auto';
    } else {
      button.style.display = 'inline-flex';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
      collapseBtn.textContent = '◀';
      collapseBtn.title = 'Hide capture controls';
      toolbar.style.gap = '8px';
      toolbar.style.width = 'auto';
      toolbar.style.height = 'auto';
      toolbar.style.minWidth = '0';
      toolbar.style.padding = '0';
      toolbar.style.right = '12px';
      toolbar.style.left = 'auto';
    }
  };

  collapseBtn.addEventListener('click', () => {
    setCollapsed(!toolbar.classList.contains('revise-collapsed'));
  });

  button.addEventListener('click', () => {
    if (!toolbar.classList.contains('revise-collapsed')) {
      createOverlay();
    }
  });

  setCollapsed(false);
  return toolbar;
}

const captureToolbar = ensureCaptureToolbar();
const button = document.getElementById('screenshot-button');
const collapseButton = document.getElementById('revise-collapse-button');

if (button) {
  button.addEventListener('click', () => {
    if (!captureToolbar.classList.contains('revise-collapsed')) {
      createOverlay();
    }
  });
}

if (collapseButton) {
  collapseButton.addEventListener('click', () => {
    const expanded = !captureToolbar.classList.contains('revise-collapsed');
    captureToolbar.classList.toggle('revise-collapsed', expanded);
    if (expanded) {
      if (button) button.style.display = 'none';
      collapseButton.textContent = '⟩';
      collapseButton.title = 'Show capture controls';
      captureToolbar.style.right = '12px';
      captureToolbar.style.left = 'auto';
    } else {
      if (button) button.style.display = 'inline-flex';
      collapseButton.textContent = '◀';
      collapseButton.title = 'Hide capture controls';
      captureToolbar.style.right = '12px';
      captureToolbar.style.left = 'auto';
    }
  });
}

let startX, startY, endX, endY;
let isSelecting = false;

function createOverlay() {
  console.log('Creating overlay...');
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
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
    console.log('Selection started at:', startX, startY);
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
    console.log('Selection completed from:', startX, startY, 'to', endX, endY);
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
