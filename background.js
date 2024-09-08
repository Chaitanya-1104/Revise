chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError) {
            console.error("Error capturing screenshot:", chrome.runtime.lastError);
        } else if (dataUrl) {
            console.log("Screenshot captured:", dataUrl);  // Log the base64 string of the screenshot

            // Store the screenshot in local storage
            chrome.storage.local.set({ screenshot: dataUrl }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error saving screenshot to storage:", chrome.runtime.lastError);
                } else {
                    console.log("Screenshot saved successfully!");
                }
            });
        } else {
            console.log("No dataUrl captured.");
        }
    });
});
