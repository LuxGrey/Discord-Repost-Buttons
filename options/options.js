const repostServerRedditUrlInput = document.getElementById('repostServerRedditUrl');
const authTokenInput = document.getElementById('authToken');
const toggleButton = document.getElementById('toggleAuthTokenVisibility');
const saveButton = document.getElementById('save');
const saveMessage = document.getElementById('saveMessage');

// toggle visibility of value in authToken input field when clicking button
toggleButton.addEventListener('click', () => {
    const isPassword = authTokenInput.type === 'password';
    authTokenInput.type = isPassword ? 'text' : 'password';
    toggleButton.textContent = isPassword ? '🙈' : '👁️';
    toggleButton.setAttribute('aria-label', isPassword ? 'Hide token' : 'Show token');
});

saveButton.addEventListener('click', () => {
    const repostServerRedditUrl = repostServerRedditUrlInput.value;
    const authToken = authTokenInput.value;
    browser.storage.sync.set({ repostServerRedditUrl, authToken }).then(() => {
        saveMessage.textContent = "✅ Settings saved";
        saveMessage.classList.remove('hidden');

        setTimeout(() => {
            saveMessage.classList.add('hidden');
        }, 3000);
    });
});

// load stored values into form
browser.storage.sync.get(['repostServerRedditUrl', 'authToken']).then((result) => {
    if (result.repostServerRedditUrl) {
        repostServerRedditUrlInput.value = result.repostServerRedditUrl;
    }
    if (result.authToken) {
        authTokenInput.value = result.authToken;
    }
});