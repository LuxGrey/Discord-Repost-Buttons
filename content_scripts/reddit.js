const DISCORD_SHARE_BUTTON_CLASS = 'discord-share-button';

function addButtonToPosts() {
  const posts = document.querySelectorAll('shreddit-post');

  posts.forEach(post => {
    const actionRow = post?.shadowRoot?.querySelector('div[data-testid="action-row"]');
    if (!actionRow) {
      return;
    }

    // avoid duplicating the button when iterating over the same post again
    if (actionRow.querySelector(`.${DISCORD_SHARE_BUTTON_CLASS}`)) {
      return;
    }

    // get share button for style imitation
    const shareButtonContainer = actionRow.querySelector('slot[name="share-button"]')
    const shareButton = shareButtonContainer
      ?.querySelector('shreddit-post-share-button')
      ?.shadowRoot
      ?.querySelector('button');
    if (!shareButton) {
      return;
    }

    // create the repost button
    const discordRepostButton = document.createElement('button');
    // copy reddit's styling from share button
    // also add class for identifying buttons that have already been placed by the script
    discordRepostButton.className = shareButton.className + ' ' + DISCORD_SHARE_BUTTON_CLASS;
    discordRepostButton.setAttribute('type', 'button');
    discordRepostButton.setAttribute('title', 'Repost on Discord');
    // use extension icon as button label
    const iconUrl = browser.runtime.getURL('icons/icon_16.png');
    const iconImage = document.createElement('img');
    iconImage.setAttribute('src', iconUrl);
    iconImage.setAttribute('alt', 'Discord');
    discordRepostButton.appendChild(iconImage);

    discordRepostButton.onclick = async () => {
      // grab URL for post
      const postLink = post.querySelector('a[slot="full-post-link"]')
        || post.querySelector('a[slot="title"]');

      if (!postLink) {
        console.warn("Post link not found.");
        return;
      }

      // build full URL to reddit post
      const fullPostUrl = new URL(postLink.href, window.location.origin).href;

      console.log('Trying to repost reddit post...');

      browser.runtime.sendMessage({
        action: 'repost_reddit',
        params: {
          postUrl: fullPostUrl,
        }
      });
    };

    // insert the Discord repost button directly after the share button
    shareButtonContainer.insertAdjacentElement('afterend', discordRepostButton);
  });
}

// use MutationObserver for infinite scroll
const observer = new MutationObserver(addButtonToPosts);
observer.observe(document.body, { childList: true, subtree: true });

// initial run
addButtonToPosts();