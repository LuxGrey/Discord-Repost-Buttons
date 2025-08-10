browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'repost_reddit':
            repostReddit(message.params);
            break;
    }
});

async function repostReddit(params) {
    const postUrl = params?.postUrl;
    if (!postUrl) {
        console.error('repost_reddit: no postUrl provided');
    }

    let embedUrl;
    try {
        embedUrl = await getRedditPostEmbedUrl(postUrl);
    } catch (error) {
        console.error('Error while fetching JSON data of reddit post: ', error);
        return;
    }

    // TODO dynamically determine URL for repost prompt
    try {
        await fetch('repost-server-url', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
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

async function getRedditPostEmbedUrl(postUrl) {
    // fetch JSON data for post
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