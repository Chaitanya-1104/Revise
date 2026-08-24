document.addEventListener('DOMContentLoaded', function () {
    const listEl = document.getElementById('screenshot-list');
    const downloadBtn = document.getElementById('download-docx');
    let selected = {}; // map date -> array of selected ids; if empty, select all

    const hasJSZip = typeof JSZip !== 'undefined';
    if (!hasJSZip) {
        // Disable DOCX button if JSZip isn't available to avoid runtime errors
        downloadBtn.disabled = true;
        downloadBtn.title = 'DOCX export unavailable: JSZip not loaded in the extension. Contact the developer or enable bundled JSZip.';
    }

    function renderStacks(stacks) {
        listEl.innerHTML = '';
        const dates = Object.keys(stacks).sort((a,b) => b.localeCompare(a));
        dates.forEach(dateKey => {
            const hdr = document.createElement('div');
            hdr.className = 'stack-date';
            hdr.textContent = dateKey;
            listEl.appendChild(hdr);

            const row = document.createElement('div');
            row.className = 'thumb-row';

            stacks[dateKey].forEach(entry => {
                const img = document.createElement('img');
                img.src = entry.dataUrl;
                img.title = entry.filename;
                img.dataset.date = dateKey;
                img.dataset.id = entry.id;
                img.addEventListener('click', () => {
                    img.classList.toggle('selected');
                    const key = img.dataset.date;
                    const id = img.dataset.id;
                    selected[key] = selected[key] || new Set();
                    if (img.classList.contains('selected')) selected[key].add(id); else selected[key].delete(id);
                });
                row.appendChild(img);
            });

            listEl.appendChild(row);
        });
    }

    // load stacks from storage
    chrome.storage.local.get({ stacks: {} }, (result) => {
        renderStacks(result.stacks || {});
    });

    // helper: convert dataURL to Uint8Array
    function dataURLtoUint8Array(dataURL) {
        const base64 = dataURL.split(',')[1];
        const raw = atob(base64);
        const uint8 = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);
        return uint8;
    }

    // Build a minimal DOCX with images using JSZip
    async function buildDocx(stacks) {
        if (typeof JSZip === 'undefined') throw new Error('JSZip not available');
        const zip = new JSZip();

        // [Content_Types].xml
        const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
        zip.file('[Content_Types].xml', contentTypes);

        // _rels/.rels
        const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="/word/document.xml"/>
</Relationships>`;
        zip.folder('_rels').file('.rels', rels);

        // word/_rels/document.xml.rels (we'll add image relationships later)
        const docRelsFolder = zip.folder('word').folder('_rels');

        // word/document.xml header; we'll inject images as <w:p><w:r><w:drawing> via simple <w:altChunk> is not supported widely; build simple paragraphs with image placeholders
        let docXmlStart = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
`;
        let docXmlInner = '';
        let relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
`;

        // Flatten selected images: if selected map empty -> include all
        const images = [];
        const dateKeys = Object.keys(stacks).sort((a,b)=>b.localeCompare(a));
        dateKeys.forEach(dateKey => {
            stacks[dateKey].forEach(entry => {
                const shouldInclude = !(selected && Object.keys(selected).length>0) || (selected[dateKey] && selected[dateKey].size>0 ? selected[dateKey].has(entry.id) : true);
                if (shouldInclude) images.push(entry);
            });
        });

        // Add each image into word/media and a relationship
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const imgId = i + 1;
            const filename = `word/media/image${imgId}.png`;
            const relId = `rId${imgId}`;
            // add image file
            const uint8 = dataURLtoUint8Array(img.dataUrl);
            zip.file(filename, uint8);

            // add relationship entry
            relsXml += `    <Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${imgId}.png"/>
`;

            // Add simple run that references the image
            // Use wp:inline with fixed extents (EMU). Set width to 6 inches (~9144000 EMU) but to keep file small use 4inches=3657600
            const cx = 3657600; // width in EMU
            const cy = 2743200; // height in EMU (approx 3in)

            const picXml = `    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${cx}" cy="${cy}"/>
            <wp:docPr id="${imgId}" name="Picture ${imgId}"/>
            <a:graphic>
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic>
                  <pic:nvPicPr>
                    <pic:cNvPr id="${imgId}" name="image${imgId}.png"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="${relId}"/>
                    <a:stretch>
                      <a:fillRect/>
                    </a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="${cx}" cy="${cy}"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect">
                      <a:avLst/>
                    </a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
`;
            docXmlInner += picXml;
        }

        relsXml += `</Relationships>`;

        const docXmlEnd = `    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
    </w:sectPr>
  </w:body>
</w:document>`;

        // write files
        zip.folder('word').file('_rels/document.xml.rels', relsXml);
        zip.folder('word').file('document.xml', docXmlStart + docXmlInner + docXmlEnd);

        // finalize zip
        const blob = await zip.generateAsync({ type: 'blob' });
        return blob;
    }

    downloadBtn.addEventListener('click', async () => {
        if (typeof JSZip === 'undefined') {
            alert('DOCX export unavailable: JSZip is not loaded in this extension. Please install or enable bundled JSZip.');
            return;
        }
        chrome.storage.local.get({ stacks: {} }, async (result) => {
            const stacks = result.stacks || {};
            const any = Object.keys(stacks).length > 0;
            if (!any) {
                alert('No captures to include in DOCX.');
                return;
            }
            downloadBtn.disabled = true;
            downloadBtn.textContent = 'Preparing...';
            try {
                const docxBlob = await buildDocx(stacks);
                const url = URL.createObjectURL(docxBlob);
                const filename = `Revise_${new Date().toISOString().slice(0,10)}.docx`;
                chrome.downloads.download({ url, filename, conflictAction: 'uniquify', saveAs: true }, (id) => {
                    if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
                    setTimeout(() => URL.revokeObjectURL(url), 20000);
                });
            } catch (e) {
                console.error('Error building DOCX:', e);
                alert('Failed to build DOCX. See console for details.');
            } finally {
                downloadBtn.disabled = false;
                downloadBtn.textContent = 'Download selected as DOCX';
            }
        });
    });

});
