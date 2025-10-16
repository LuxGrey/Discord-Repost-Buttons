import { repostReddit } from './reddit.js';

// handle message from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // determine which type of media is to be reposted
    switch (message.action) {
        case 'repost_reddit':
            repostReddit(message.params);
            break;
    }
});