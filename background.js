console.log('Background service worker initialized.');

// Load JSZip in service worker context for DOCX generation
importScripts('jszip.min.js');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'capture') {
    console.log('Received capture message from content script.');
    const coords = message.coordinates || { left: 0, top: 0, width: 0, height: 0 };
    const dpr = message.devicePixelRatio || 1;
    const scroll = message.scroll || { x: 0, y: 0 };
    console.log('Raw coords:', coords, 'dpr:', dpr, 'scroll:', scroll);

    chrome.tabs.captureVisibleTab(null, { format: 'png' }, async (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Error capturing screenshot:', chrome.runtime.lastError);
        // notify page if possible
        if (sender && sender.tab && sender.tab.id) {
          chrome.tabs.sendMessage(sender.tab.id, { action: 'captureDone', success: false, error: chrome.runtime.lastError.message });
        }
        return;
      }

      try {
        // convert dataURL -> blob
        const res = await fetch(dataUrl);
        const blob = await res.blob();

        // create image bitmap (works in worker)
        const imgBitmap = await createImageBitmap(blob);
        console.log('Captured image bitmap size:', imgBitmap.width, 'x', imgBitmap.height);

        // compute scaled crop rectangle (coordinates reported are viewport-relative)
        const sx = Math.round((coords.left + scroll.x) * dpr);
        const sy = Math.round((coords.top + scroll.y) * dpr);
        const sw = Math.round(coords.width * dpr);
        const sh = Math.round(coords.height * dpr);
        console.log('Scaled crop rect:', { sx, sy, sw, sh });

        // clamp
        const cropX = Math.max(0, Math.min(sx, imgBitmap.width));
        const cropY = Math.max(0, Math.min(sy, imgBitmap.height));
        const cropW = Math.max(1, Math.min(sw, imgBitmap.width - cropX));
        const cropH = Math.max(1, Math.min(sh, imgBitmap.height - cropY));
        console.log('Clamped crop rect:', { cropX, cropY, cropW, cropH });

        // OffscreenCanvas to crop
        const off = new OffscreenCanvas(cropW, cropH);
        const ctx = off.getContext('2d');
        ctx.drawImage(imgBitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // convert cropped canvas to blob (png)
        const croppedBlob = await off.convertToBlob({ type: 'image/png' });
        const croppedDataUrl = await blobToDataURL(croppedBlob);

        // Save to chrome.storage.local under a stacks structure keyed by date
        const dateKey = new Date().toISOString().slice(0, 10); // e.g. 2026-08-17
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // use in filename
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
              console.error('Error saving stack to storage:', chrome.runtime.lastError);
            } else {
              console.log('Saved capture and updated stacks for date:', dateKey, 'entry id:', entry.id);

              // For easier debugging, log stored count for the date
              const count = stacks[dateKey].length;
              console.log(`Stack ${dateKey} now has ${count} item(s).`);

              // notify the page (content script) that capture completed successfully
              if (sender && sender.tab && sender.tab.id) {
                chrome.tabs.sendMessage(sender.tab.id, { action: 'captureDone', success: true, filename, id: entry.id, date: dateKey });
              }
            }
          });
        });

        // Trigger download (puts file under Downloads/Revise/<date>/)
        // In a service worker context, URL.createObjectURL may not be available; use data URL instead
        chrome.downloads.download({
          url: croppedDataUrl,
          filename: filename,
          conflictAction: 'uniquify',
          saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error('Download error:', chrome.runtime.lastError);
          } else {
            console.log('Download started, id:', downloadId);
          }
        });

      } catch (err) {
        console.error('Error processing capture:', err);
        if (sender && sender.tab && sender.tab.id) {
          chrome.tabs.sendMessage(sender.tab.id, { action: 'captureDone', success: false, error: err.message || String(err) });
        }
      }
    });
  }

  if (message.action === 'buildDocx') {
    (async () => {
      try {
        const stacks = await new Promise((resolve) => {
          chrome.storage.local.get({ stacks: {} }, (r) => resolve(r.stacks || {}));
        });
        const images = collectDocxImages(stacks, message.selected);
        if (images.length === 0) {
          sendResponse({ ok: false, error: 'No images to include.' });
          return;
        }

        console.log('Building DOCX with', images.length, 'images...');
        const blob = await buildDocxZip(images);
        const filename = 'Revise_' + new Date().toISOString().slice(0, 10) + '.docx';
        const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        const rawDataUrl = await blobToDataURL(blob);
        // Embed correct MIME type into data URL so Chrome uses the right extension
        const dataUrl = 'data:' + mimeType + ';base64,' + rawDataUrl.split('base64,').pop();
        chrome.downloads.download(
          { url: dataUrl, filename, conflictAction: 'uniquify', saveAs: true },
          (id) => {
            if (chrome.runtime.lastError) {
              console.error('Download error:', chrome.runtime.lastError);
              sendResponse({ ok: false, error: chrome.runtime.lastError.message });
            } else {
              console.log('Download started, id:', id, 'format:', 'DOCX');
              sendResponse({ ok: true });
            }
          }
        );
      } catch (e) {
        console.error('Error building document:', e);
        sendResponse({ ok: false, error: e.message || String(e) });
      }
    })();
    return true; // keep channel open for async sendResponse
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

// helper: base64 dataURL -> Uint8Array (stable in service worker)
function uint8FromBase64(dataURL) {
  const base64 = dataURL.split(',')[1];
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

// helper: collect images from stacks respecting selection
// selected can be either { date: Set(...) } or { date: ['id1','id2'] }
function collectDocxImages(stacks, selected) {
  const images = [];
  const dateKeys = Object.keys(stacks).sort((a, b) => b.localeCompare(a));
  const hasSelection = selected && Object.keys(selected).length > 0;
  for (const dateKey of dateKeys) {
    const sel = selected && selected[dateKey];
    for (const entry of stacks[dateKey]) {
      if (!hasSelection) {
        images.push(entry);
      } else if (sel) {
        if (sel.has ? sel.has(entry.id) : sel.includes(entry.id)) {
          images.push(entry);
        }
      }
    }
  }
  return images;
}

// Build a minimal DOCX zip blob from image entries
async function buildDocxZip(images) {
  const ZipCtor = typeof JSZip === 'function' ? JSZip : (JSZip && JSZip.default);
  if (!ZipCtor) throw new Error('JSZip not loaded in service worker');
  const zip = new ZipCtor();

  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
    '  <Default Extension="xml" ContentType="application/xml"/>\n' +
    '  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n' +
    '</Types>');

  zip.folder('_rels').file('.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n' +
    '</Relationships>');

  // A4 page: usable width ~16cm = 5669280 EMUs
  // 1 inch = 914400 EMUs, A4 = 210mm, margins 1cm each side => ~16cm usable
  const maxImgEMUs = 5669280;
  let docXmlInner = '';
  let relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const imgId = i + 1;
    const relId = 'rId' + imgId;

    const uint8 = uint8FromBase64(img.dataUrl);
    zip.file('word/media/image' + imgId + '.png', uint8);

    relsXml += '  <Relationship Id="' + relId +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ' +
      'Target="media/image' + imgId + '.png"/>\n';

    // Get image dimensions from the data URL
    const bitmap = await createImageBitmap(
      await (await fetch(img.dataUrl)).blob()
    );
    const imgW = bitmap.width;
    const imgH = bitmap.height;
    bitmap.close();

    // Scale to page width, keeping aspect ratio
    // 1 px at 96dpi = 914400/96 EMUs
    const emuPerPx = 914400 / 96;
    const imgCx = imgW * emuPerPx;
    const imgCy = imgH * emuPerPx;
    const scaledCx = Math.min(imgCx, maxImgEMUs);
    const scale = scaledCx / imgCx;
    const scaledCy = Math.round(imgCy * scale);

    // Add spacing paragraph before each image
    docXmlInner += buildSpacingParagraph();
    docXmlInner += buildPictureXml(imgId, relId, scaledCx, scaledCy);

    await new Promise(r => setTimeout(r, 0));
  }

  relsXml += '</Relationships>';

  const docXml = docHeader() + docXmlInner + docFooter();

  zip.folder('word').file('_rels/document.xml.rels', relsXml);
  zip.folder('word').file('document.xml', docXml);

  return await zip.generateAsync({ type: 'blob' });
}

// XML helper: spacing paragraph between images
function buildSpacingParagraph() {
  return '     <w:p>\n' +
    '       <w:pPr>\n' +
    '         <w:spacing w:before="360" w:after="360"/>\n' +
    '       </w:pPr>\n' +
    '     </w:p>';
}

// XML helper: one picture paragraph
function buildPictureXml(imgId, relId, cx, cy) {
  return '     <w:p>\n' +
    '       <w:r>\n' +
    '         <w:drawing>\n' +
    '           <wp:inline distT="0" distB="0" distL="0" distR="0">\n' +
    '             <wp:extent cx="' + cx + '" cy="' + cy + '"/>\n' +
    '             <wp:effectExtent l="0" t="0" r="0" b="0"/>\n' +
    '             <wp:docPr id="' + imgId + '" name="Picture ' + imgId + '"/>\n' +
    '             <a:graphic>\n' +
    '               <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">\n' +
    '                 <pic:pic>\n' +
    '                   <pic:nvPicPr>\n' +
    '                     <pic:cNvPr id="' + imgId + '" name="Picture ' + imgId + '"/>\n' +
    '                     <pic:cNvPicPr/>\n' +
    '                   </pic:nvPicPr>\n' +
    '                   <pic:blipFill>\n' +
    '                     <a:blip r:embed="' + relId + '"/>\n' +
    '                     <a:stretch><a:fillRect/></a:stretch>\n' +
    '                   </pic:blipFill>\n' +
    '                   <pic:spPr>\n' +
    '                     <a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>\n' +
    '                     <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>\n' +
    '                   </pic:spPr>\n' +
    '                 </pic:pic>\n' +
    '               </a:graphicData>\n' +
    '             </a:graphic>\n' +
    '           </wp:inline>\n' +
    '         </w:drawing>\n' +
    '       </w:r>\n' +
    '     </w:p>';
}

// XML helper: document.xml header
function docHeader() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"\n' +
    '  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"\n' +
    '  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"\n' +
    '  xmlns:rpr="http://schemas.openxmlformats.org/officeDocument/2006/relationships"\n' +
    '  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"\n' +
    '  xmlns:wsp="http://schemas.microsoft.com/office/word/2003/wordml/sp2"\n' +
    '  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"\n' +
    '  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"\n' +
    '  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"\n' +
    '  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">\n' +
    '  <w:body>';
}

// XML helper: document.xml footer
function docFooter() {
  return '\n' +
    '    <w:sectPr>\n' +
    '      <w:pgSz w:w="11906" w:h="16838"/>\n' +
    '    </w:sectPr>\n' +
    '  </w:body>\n' +
    '</w:document>';
}
