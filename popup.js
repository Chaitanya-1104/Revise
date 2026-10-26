document.addEventListener('DOMContentLoaded', function () {
    const listEl = document.getElementById('screenshot-list');
    const downloadBtn = document.getElementById('download-docx');
    const countEl = document.getElementById('selection-count');
    let selected = {};

    // --------------- render thumbnails ---------------
    function renderStacks(stacks) {
        listEl.innerHTML = '';
        const dates = Object.keys(stacks).sort((a, b) => b.localeCompare(a));

        if (dates.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="3" stroke="#9ca3af" stroke-width="1.5"/>
                        <circle cx="8.5" cy="8.5" r="1.5" fill="#9ca3af"/>
                        <path d="M21 15l-5-5L5 21" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <p>No captures yet.<br/>Click "Select Area" on any page to start.</p>
                </div>`;
            countEl.textContent = '';
            downloadBtn.disabled = true;
            return;
        }

        downloadBtn.disabled = false;

        dates.forEach(dateKey => {
            const group = stacks[dateKey];
            const count = group.length;

            const hdr = document.createElement('div');
            hdr.className = 'stack-date';
            hdr.innerHTML = `${dateKey} <span class="count">${count}</span>`;
            listEl.appendChild(hdr);

            const row = document.createElement('div');
            row.className = 'thumb-row';

            group.forEach(entry => {
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
                    if (img.classList.contains('selected')) {
                        selected[key].add(id);
                    } else {
                        selected[key].delete(id);
                        if (selected[key].size === 0) delete selected[key];
                    }
                    updateCount();
                });
                row.appendChild(img);
            });

            listEl.appendChild(row);
        });

        updateCount();
    }

    // --------------- selection counter ---------------
    function updateCount() {
        const activeDates = Object.keys(selected).filter(k => selected[k].size > 0);
        const activeCount = activeDates.reduce((sum, k) => sum + selected[k].size, 0);
        if (activeCount === 0) {
            countEl.innerHTML = 'Tip: Click images to select them for export';
        } else {
            countEl.innerHTML = `<span>${activeCount}</span> capture${activeCount > 1 ? 's' : ''} selected`;
        }
    }

    // load stacks from storage
    chrome.storage.local.get({ stacks: {} }, (result) => {
        renderStacks(result.stacks || {});
    });

    // --------------- download button — delegate to background worker ---------------
    downloadBtn.addEventListener('click', () => {
        chrome.storage.local.get({ stacks: {} }, (result) => {
            const stacks = result.stacks || {};
            if (Object.keys(stacks).length === 0) return;

            // Count how many images will be included
            const dateKeys = Object.keys(stacks).sort((a, b) => b.localeCompare(a));
            const hasSelection = Object.keys(selected).some(k => selected[k].size > 0);
            let count = 0;
            for (const dk of dateKeys) {
                for (const entry of stacks[dk]) {
                    if (!hasSelection || (selected[dk] && selected[dk].has(entry.id))) count++;
                }
            }
            if (count === 0) return;

            downloadBtn.disabled = true;
            downloadBtn.textContent = 'Building…';
            downloadBtn.classList.add('building');

            // Build a serializable copy of the selected map (Set -> array)
            const selectedForBg = {};
            for (const key of Object.keys(selected)) {
                if (selected[key] && selected[key].size > 0) {
                    selectedForBg[key] = Array.from(selected[key]);
                }
            }

            chrome.runtime.sendMessage(
                { action: 'buildDocx', selected: selectedForBg },
                (response) => {
                    downloadBtn.classList.remove('building');
                    downloadBtn.disabled = false;
                    if (chrome.runtime.lastError) {
                        console.error('Message error:', chrome.runtime.lastError);
                    } else if (response && response.error) {
                        console.error('Background error:', response.error);
                    } else if (response && response.ok) {
                        downloadBtn.textContent = '✓ Downloaded';
                        setTimeout(() => { downloadBtn.textContent = 'Export as Document'; }, 2500);
                    }
                    if (!downloadBtn.textContent.includes('Downloaded')) {
                        downloadBtn.textContent = 'Export as Document';
                    }
                }
            );
        });
    });

});
