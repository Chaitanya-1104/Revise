chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'capture') {
        console.log("Received capture message with coordinates:", message.coordinates);

        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                console.error("Error capturing screenshot:", chrome.runtime.lastError);
                return;
            }

            if (dataUrl) {
                console.log("Screenshot captured successfully.");
                chrome.storage.local.set({ screenshot: dataUrl }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Error saving screenshot:", chrome.runtime.lastError);
                    } else {
                        console.log("Screenshot saved in storage.");
                    }
                });
            } else {
                console.log("No screenshot captured.");
            }
        });
    }
});
