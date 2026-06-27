import { handleRedditClipboardMessage, handleRedditRepostMessage } from './reddit.js';

// handle message from content script
browser.runtime.onMessage.addListener(handleMessage);

// ==============================
// ==== function definitions ====
// ==============================

/**
 * @param {object} message the received message
 * @returns {Promise<{success: boolean}>} a Promise containing the result of the handled message
 */
function handleMessage(message) {
    // determine which type of media is to be reposted
    switch (message.action) {
        case 'clipboard_reddit':
            return handleRedditClipboardMessage(message.params);
        case 'repost_reddit':
            return handleRedditRepostMessage(message.params);
        default:
            console.error('Unrecognized action: %s', message.action);
            return Promise.resolve({ success: false });
    }
}