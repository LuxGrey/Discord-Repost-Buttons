document.getElementById('settingsButton').addEventListener('click', () => {
    // open the options page of the extension
    browser.runtime.openOptionsPage();
});