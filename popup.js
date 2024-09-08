document.addEventListener('DOMContentLoaded', function () {
    chrome.storage.local.get('screenshot', function (data) {
        if (data.screenshot) {
            console.log("Screenshot retrieved from storage:", data.screenshot);
            document.getElementById('screenshot').src = data.screenshot;
        } else {
            console.log("Nobbbbbbbbbb screenshot found in storage.");
        }
    });
});
