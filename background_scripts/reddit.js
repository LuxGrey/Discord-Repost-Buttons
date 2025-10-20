import { sendServerRequest } from './repost.js';

/**
 * Executes logic for reposting a reddit post and returns a response object that informs of whether
 * reposting was successful.
 * 
 * @param {object} messageParams message parameters received from the content script
 * @return {Promise<{success: boolean}>} an object that contains info about the success of the repost
 */
export async function handleRedditMessage(messageParams) {
    let success;

    try {
        success = await repostReddit(messageParams);
    } catch (error) {
        success = false;
    }

    return { success };
}

/**
 * Sends a request to the configured API endpoint for reposting reddit posts,
 * prompting the service to repost the specified post on a Discord server
 * 
 * @param {object} params parameters regarding the content that should be reposted
 * @returns {Promise<boolean>} true if the repost succeeded, otherwise false
 */
async function repostReddit(params) {
    const postUrl = params.postUrl;
    if (!postUrl) {
        console.error('repost_reddit: no postUrl provided');
        return false;
    }

    let embedUrls;
    try {
        embedUrls = await getEmbedUrls(postUrl);
    } catch (error) {
        console.error('Error while fetching JSON data of reddit post: ', error);
        return false;
    }

    // load and validate required parameters from user settings
    let settings;
    try {
        settings = await getSettings();
    } catch (error) {
        console.error('Error while loading settings: ', error);
        return false;
    }

    if (!settings.repostServerRedditUrl) {
        console.error('Settings are missing repost server reddit URL');
        return false;
    }

    // build request body
    const requestBody = {
        postUrl: postUrl,
    };

    if (embedUrls?.length) {
        requestBody.embedUrls = embedUrls;
    }

    try {
        await sendServerRequest(settings.repostServerRedditUrl, requestBody, settings.authToken);

        console.log('Successfully reposted reddit post ' + postUrl);
    } catch (error) {
        console.error('Error while trying to repost reddit post: ', error);
        return false;
    }

    return true;
}

/**
 * Loads relevant extension settings from browser storage
 * 
 * @returns {Promise<Object>} the extension settings that were set by the user
 */
async function getSettings() {
    const settings = await browser.storage.sync.get(['repostServerRedditUrl', 'authToken']);
    return settings;
}

/**
 * Determines a list of additional embed URLs for the provided reddit post if the post URL alone is expected
 * to produce no viable embed in Discord
 * 
 * @param {string} postUrl the URL of a reddit post
 * @returns {Promise<string[]|null>} the external URL of an embed used in the reddit post or null
 */
async function getEmbedUrls(postUrl) {
    // fetch JSON data for reddit post
    const postJsonUrl = postUrl.slice(0, postUrl.length - 1) + '.json';
    const response = await fetch(postJsonUrl);
    const json = await response.json();

    // grab relevant data from JSON post data
    const postData = json[0].data.children[0].data;

    if (postData.is_gallery) {
        // post is a gallery post
        return getGalleryEmbedUrls(postData);
    }

    const oembed = postData.media?.oembed || postData.secure_media?.oembed;
    if (oembed) {
        // post embeds content from a third-party site via OEmbed
        const embedUrl = oembed.url || postData.url;
        return embedUrl ? [embedUrl] : null;
    }

    // post does not require any additional embed URLs
    return null;
}

/**
 * Extracts embed URLs for the gallery media from the post data
 * 
 * @param {object} postData relevant portion of the reddit post's data from which the embed URLs should be extracted
 * @return {string[]}
 */
function getGalleryEmbedUrls(postData) {
    // iterate over the gallery element data in media_metadata and extract one URL from each
    return Object.values(postData.media_metadata).map((galleryElement) => {
        // extract the preview URL
        // it is assumed to have the format 'https://preview.redd.it/<id>.<fileExtension>?<queryParameters>'
        const previewUrl = galleryElement.p[0].u;
        // transform the preview URL so that it is suitable for embedding in Discord
        // do this by removing the query parameters and changing the domain to 'i.redd.it'
        return previewUrl.substring(0, previewUrl.indexOf('?')).replace('preview', 'i');
    });
}