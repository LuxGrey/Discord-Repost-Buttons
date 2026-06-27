import { sendServerRequest } from './repost.js';

/**
 * Executes logic for building Discord message contents and writes them to the user's clipboard
 * Returns a response object that informs of whether the message contents were successfully written to the clipboard
 * 
 * @param {object} messageParams message parameters received from the content script
 * @return {Promise<{success: boolean}>} an object that contains info about the success of the clipboard write
 */
export async function handleRedditClipboardMessage(messageParams) {
    let success;

    try {
        success = await buildAndCopyTextToClipboard(messageParams);
    } catch (error) {
        console.error(error);
        success = false;
    }

    return { success };
}

/**
 * Executes logic for reposting a reddit post
 * Returns a response object that informs of whether reposting was successful
 * 
 * @param {object} messageParams message parameters received from the content script
 * @return {Promise<{success: boolean}>} an object that contains info about the success of the repost
 */
export async function handleRedditRepostMessage(messageParams) {
    let success;

    try {
        success = await repost(messageParams);
    } catch (error) {
        console.error(error);
        success = false;
    }

    return { success };
}

/**
 * Builds Discord message contents and writes them to the user's clipboard
 * 
 * @param {object} params parameters regarding the content that should be reposted
 * @returns {Promise<boolean>} true on success, otherwise false
 */
async function buildAndCopyTextToClipboard(params) {
    const postUrl = params.postUrl;
    if (!postUrl) {
        console.error('No postUrl provided');
        return false;
    }

    let postData;
    try {
        postData = await getPostData(postUrl);
    } catch (error) {
        console.error('Error while fetching JSON data of reddit post: ', error);
        return false;
    }

    const embedUrls = await getEmbedUrls(postData);
    const clipboardText = buildClipboardText(postUrl, postData.title, embedUrls);

    try {
        await navigator.clipboard.writeText(clipboardText);

        console.log(`Successfully wrote repost message for reddit post ${postUrl} to clipboard`);
    } catch (error) {
        console.error('Error while trying to write repost message to clipboard: ', error);
        return false;
    }

    return true;
}

/**
 * Builds Discord message contents for the clipboard
 * 
 * @param {string} postUrl the URL for the reddit post
 * @param {string} postTitle the title of the reddit post
 * @param {string[]} embedUrls the embed URLs for the media of the reddit post
 * @return {string} the built message
 */
function buildClipboardText(postUrl, postTitle, embedUrls) {
    const lines = [`<${postUrl}>`, `${postTitle}`];

    const formattedEmbedUrls = [];
    for (let i = 0; i < embedUrls.length; i++) {
        // build Markdown-style link with custom link text
        formattedEmbedUrls.push(`[${i + 1}](${embedUrls[i]})`);
    }

    if (formattedEmbedUrls.length > 0) {
        lines.push(formattedEmbedUrls.join(' '));
    }

    return lines.join('\n');
}

/**
 * Sends a request to the configured API endpoint for reposting reddit posts,
 * prompting the service to repost the specified post on a Discord server
 * 
 * @param {object} params parameters regarding the content that should be reposted
 * @returns {Promise<boolean>} true if the repost succeeded, otherwise false
 */
async function repost(params) {
    const postUrl = params.postUrl;
    if (!postUrl) {
        console.error('repost_reddit: no postUrl provided');
        return false;
    }

    let postData;
    try {
        postData = await getPostData(postUrl);
    } catch (error) {
        console.error('Error while fetching JSON data of reddit post: ', error);
        return false;
    }

    const embedUrls = await getEmbedUrls(postData);

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
        postTitle: postData.title,
    };

    if (embedUrls?.length) {
        requestBody.embedUrls = embedUrls;
    }

    try {
        await sendServerRequest(settings.repostServerRedditUrl, requestBody, settings.authToken);

        console.log(`Successfully reposted reddit post ${postUrl}`);
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
 * Fetches the JSON data for the given reddit post URL.
 * Returns only a relevant section of the JSON data.
 * 
 * @param {string} postUrl the URL of a reddit post
 * @returns {Promise<Object>} the post data
 */
async function getPostData(postUrl) {
    // fetch JSON data for reddit post
    const postJsonUrl = postUrl.slice(0, postUrl.length - 1) + '.json';
    const response = await fetch(postJsonUrl);
    const json = await response.json();

    // grab relevant section from JSON post data
    return json[0].data.children[0].data;
}

/**
 * Determines a list of embed URLs for the provided reddit post
 * 
 * @param {Object} postData the relevant data of a reddit post that the embed URLs should be extracted from
 * @returns {Promise<string[]>} a list of URLs that produce embeds for the media of the reddit post
 */
async function getEmbedUrls(postData) {
    // if post is a cross-post, use data of parent post
    postData = postData.crosspost_parent_list?.[0] || postData;

    if (postData.post_hint === 'image') {
        // post is a single image post
        return [postData.url];
    }

    if (postData.is_gallery) {
        // post is a gallery post
        return getGalleryEmbedUrls(postData);
    }

    if (postData.is_video) {
        // post is a video post
        const videoUrl = postData.media.reddit_video.fallback_url
            || postData.secure_media.reddit_video.fallback_url;
        return [videoUrl];
    }

    const oembed = postData.media?.oembed || postData.secure_media?.oembed;
    if (oembed) {
        // post embeds content from a third-party site via OEmbed
        const embedUrl = oembed.url || postData.url;
        return embedUrl ? [embedUrl] : null;
    }

    // post does not require any additional embed URLs
    return [];
}

/**
 * Extracts embed URLs for the gallery media from the post data
 * 
 * @param {object} postData reddit post data from which the embed URLs should be extracted
 * @return {string[]}
 */
function getGalleryEmbedUrls(postData) {
    // maps media ID to preview URL
    const mediaUrlMap = new Map();

    // iterate over the gallery element data in media_metadata and extract one URL from each
    Object.values(postData.media_metadata).forEach((mediaItem) => {
        // extract the preview URL
        // it is assumed to have the format 'https://preview.redd.it/<id>.<fileExtension>?<queryParameters>'
        const previewUrl = mediaItem.p[0].u;
        // transform the preview URL so that it is suitable for embedding in Discord
        // do this by removing the query parameters and changing the domain to 'i.redd.it'
        const adjustedUrl = previewUrl.substring(0, previewUrl.indexOf('?')).replace('preview', 'i');

        mediaUrlMap.set(mediaItem.id, adjustedUrl);
    });

    // use media IDs in gallery_data to get gallery elements in correct order
    return Object.values(postData.gallery_data.items).map((galleryItem) => {
        return mediaUrlMap.get(galleryItem.media_id);
    });
}