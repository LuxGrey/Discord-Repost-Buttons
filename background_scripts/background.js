// handle message from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // determine which type of media is to be reposted
    switch (message.action) {
        case 'repost_reddit':
            repostReddit(message.params);
            break;
    }
});

/**
 * Sends a request to the configured API endpoint for reposting reddit posts,
 * prompting the service to repost the specified post on a Discord server
 * 
 * @param {Object} params
 * @returns {void}
 */
async function repostReddit(params) {
    const postUrl = params.postUrl;
    if (!postUrl) {
        console.error('repost_reddit: no postUrl provided');
        return;
    }

    let embedUrl;
    try {
        embedUrl = await getRedditPostEmbedUrl(postUrl);
    } catch (error) {
        console.error('Error while fetching JSON data of reddit post: ', error);
        return;
    }

    let settings;
    try {
        settings = await getSettings();
    } catch (error) {
        console.error('Error while loading settings: ', error);
        return;
    }

    if (!settings.repostServerRedditUrl) {
        console.warn('Settings are missing repost server reddit URL');
        return;
    }
    if (!settings.authToken) {
        console.warn('Settings are missing auth token');
        return;
    }

    try {
        await fetch(settings.repostServerRedditUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.authToken}`,
            },
            body: JSON.stringify({
                postUrl: postUrl,
                embedUrl: embedUrl,
            })
        });

        console.log('Successfully reposted reddit post ' + postUrl);
    } catch (error) {
        console.error('Error while trying to repost reddit post: ', error);
    }
}

/**
 * @returns {Object} the extension settings that were set by the user
 */
async function getSettings() {
    const settings = await browser.storage.sync.get(['repostServerRedditUrl', 'authToken']);
    return settings;
}

/**
 * @param {string} postUrl the URL of a reddit post
 * @returns {string|null} the external URL of an embed used in the reddit post or null
 */
async function getRedditPostEmbedUrl(postUrl) {
    // fetch JSON data for reddit post
    const postJsonUrl = postUrl.slice(0, postUrl.length - 1) + '.json';
    const response = await fetch(postJsonUrl);
    const json = await response.json();

    // grab relevant data from JSON post data
    const postData = json[0].data.children[0].data;
    const media = postData.media || postData.secure_media;
    // return URL of embed from external source if applicable
    return media?.oembed?.provider_name
        ? (media.oembed.url || postData.url)
        : null;
}