chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'capture') {
        const coords = message.coordinates || { left:0, top:0, width:0, height:0 };
        const dpr = message.devicePixelRatio || 1;
        const scroll = message.scroll || { x:0, y:0 };

        chrome.tabs.captureVisibleTab(null, { format: 'png' }, async (dataUrl) => {
            if (chrome.runtime.lastError) {
                console.error("Error capturing screenshot:", chrome.runtime.lastError);
                return;
            }
            try {
                // convert dataURL -> blob
                const res = await fetch(dataUrl);
                const blob = await res.blob();

                // create image bitmap (works in worker)
                const imgBitmap = await createImageBitmap(blob);

                // compute scaled crop rectangle (coordinates reported are viewport-relative)
                const sx = Math.round((coords.left + scroll.x) * dpr);
                const sy = Math.round((coords.top + scroll.y) * dpr);
                const sw = Math.round(coords.width * dpr);
                const sh = Math.round(coords.height * dpr);

                // clamp
                const cropX = Math.max(0, Math.min(sx, imgBitmap.width));
                const cropY = Math.max(0, Math.min(sy, imgBitmap.height));
                const cropW = Math.max(1, Math.min(sw, imgBitmap.width - cropX));
                const cropH = Math.max(1, Math.min(sh, imgBitmap.height - cropY));

                // OffscreenCanvas to crop
                const off = new OffscreenCanvas(cropW, cropH);
                const ctx = off.getContext('2d');
                ctx.drawImage(imgBitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

                // convert cropped canvas to blob (png)
                const croppedBlob = await off.convertToBlob({ type: 'image/png' });
                const croppedDataUrl = await blobToDataURL(croppedBlob);

                // Save to chrome.storage.local under a stacks structure keyed by date
                const dateKey = new Date().toISOString().slice(0,10); // e.g. 2026-08-17
                const timestamp = new Date().toISOString().replace(/[:.]/g,'-'); // use in filename
                const filename = `Revise/${dateKey}/${timestamp}.png`;

                // Persist screenshot in storage (thumbnail or full dataUrl) and metadata
                chrome.storage.local.get({ stacks: {} }, (result) => {
                  const stacks = result.stacks || {};
                  const entry = {
                    id: timestamp,
                    filename,
                    dataUrl: croppedDataUrl,
                    createdAt: new Date().toISOString()
                  };
                  if (!stacks[dateKey]) stacks[dateKey] = [];
                  stacks[dateKey].push(entry);
                  chrome.storage.local.set({ stacks }, () => {
                    if (chrome.runtime.lastError) {
                      console.error("Error saving stack to storage:", chrome.runtime.lastError);
                    } else {
                      console.log("Saved capture and updated stacks.");
                    }
                  });
                });

                // Trigger download (puts file under Downloads/Revise/<date>/)
                const objectUrl = URL.createObjectURL(croppedBlob);
                chrome.downloads.download({
                  url: objectUrl,
                  filename: filename,
                  conflictAction: 'uniquify',
                  saveAs: false
                }, (downloadId) => {
                  if (chrome.runtime.lastError) {
                    console.error("Download error:", chrome.runtime.lastError);
                    URL.revokeObjectURL(objectUrl);
                  } else {
                    console.log("Download started, id:", downloadId);
                    // revoke after a delay to ensure download reads the object
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
                  }
                });

            } catch (err) {
                console.error("Error processing capture:", err);
            }
        });
    }
});

// helper: blob -> dataURL
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
