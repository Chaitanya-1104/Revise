document.addEventListener('DOMContentLoaded', function () {
    console.log("Popup loaded. Retrieving screenshot from storage...");
    chrome.storage.local.get('screenshot', function (data) {
      if (chrome.runtime.lastError) {
        console.error("Error retrieving screenshot from storage:", chrome.runtime.lastError);
        document.getElementById('screenshot').alt = 'Error retrieving screenshot';
        return;
      }
  
      if (data.screenshot) {
        console.log("Screenshot retrieved from storage.");
        document.getElementById('screenshot').src = data.screenshot;
      } else {
        console.log("No screenshot found in storage.");
        document.getElementById('screenshot').alt = 'No screenshot found';
      }
    });
  });
  