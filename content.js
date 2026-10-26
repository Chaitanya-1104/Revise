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
  // SVG chevron icon
  collapseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7L9 11" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  collapseBtn.style.width = '26px';
  collapseBtn.style.height = '26px';
  collapseBtn.style.borderRadius = '8px';
  collapseBtn.style.border = '1px solid rgba(99, 102, 241, 0.2)';
  collapseBtn.style.background = 'rgba(255,255,255,0.97)';
  collapseBtn.style.color = '#6366f1';
  collapseBtn.style.cursor = 'pointer';
  collapseBtn.style.display = 'grid';
  collapseBtn.style.placeItems = 'center';
  collapseBtn.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.15)';
  collapseBtn.style.padding = '0';
  collapseBtn.style.outline = 'none';
  collapseBtn.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease, background 0.15s ease';
  collapseBtn.addEventListener('mouseenter', () => {
    collapseBtn.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.25)';
    collapseBtn.style.background = '#eef2ff';
  });
  collapseBtn.addEventListener('mouseleave', () => {
    collapseBtn.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.15)';
    collapseBtn.style.background = 'rgba(255,255,255,0.97)';
  });

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
    // Rotate the chevron: 0deg = left (hide), 180deg = right (show)
    collapseBtn.style.transform = collapsed ? 'rotate(180deg)' : 'rotate(0deg)';
    collapseBtn.title = collapsed ? 'Show capture controls' : 'Hide capture controls';
    if (collapsed) {
      button.style.display = 'none';
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
    const collapsed = !captureToolbar.classList.contains('revise-collapsed');
    captureToolbar.classList.toggle('revise-collapsed', collapsed);
    // Rotate chevron: 0deg = left (hide), 180deg = right (show)
    collapseButton.style.transform = collapsed ? 'rotate(180deg)' : 'rotate(0deg)';
    collapseButton.title = collapsed ? 'Show capture controls' : 'Hide capture controls';
    if (collapsed) {
      if (button) button.style.display = 'none';
      captureToolbar.style.right = '12px';
      captureToolbar.style.left = 'auto';
    } else {
      if (button) button.style.display = 'inline-flex';
      captureToolbar.style.right = '12px';
      captureToolbar.style.left = 'auto';
    }
  });
}

let startX, startY, endX, endY;
let isSelecting = false;

// Global references to current handlers so we can always clean them up
let _currentMouseMove = null;
let _currentMouseUp = null;
let _currentEscHandler = null;

function cleanupOverlay() {
  // Remove any leftover handlers
  if (_currentMouseMove) {
    document.removeEventListener('mousemove', _currentMouseMove, true);
    _currentMouseMove = null;
  }
  if (_currentMouseUp) {
    document.removeEventListener('mouseup', _currentMouseUp, true);
    _currentMouseUp = null;
  }
  if (_currentEscHandler) {
    document.removeEventListener('keydown', _currentEscHandler);
    _currentEscHandler = null;
  }
  // Remove any leftover DOM elements
  isSelecting = false;
  const o = document.getElementById('screenshot-overlay');
  const b = document.getElementById('screenshot-selection-box');
  if (o) o.remove();
  if (b) b.remove();
}

function createOverlay() {
  // First clean up any previous overlay/handlers
  cleanupOverlay();
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

  // Use document-level handlers with capture:true so they fire before any element steals them
  const onMouseMove = (e) => {
    if (!isSelecting) return;
    endX = e.clientX;
    endY = e.clientY;
    updateOverlay(selectionBox);
  };

  const finishSelection = () => {
    if (!isSelecting) return;
    // Only capture if area is meaningful (>10px in both dimensions)
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);
    console.log('Selection completed from:', startX, startY, 'to', endX, endY, 'size:', w, 'x', h);
    // Clean up handlers and DOM
    cleanupOverlay();
    if (w > 10 && h > 10) {
      captureSelection();
    }
  };

  const onMouseUp = () => {
    finishSelection();
  };

  // Store refs globally so cleanupOverlay can remove them
  _currentMouseMove = onMouseMove;
  _currentMouseUp = onMouseUp;

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      finishSelection();
    }
  };
  _currentEscHandler = escHandler;

  // Capture phase so no element can prevent this from firing
  document.addEventListener('mousemove', _currentMouseMove, true);
  document.addEventListener('mouseup', _currentMouseUp, true);
  document.addEventListener('keydown', _currentEscHandler);
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
