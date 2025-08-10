const DISCORD_SHARE_BUTTON_CLASS = 'discord-share-button';

function addButtonToPosts() {
  const posts = document.querySelectorAll('shreddit-post');

  posts.forEach(post => {
    const actionRow = post.shadowRoot.querySelector('div[data-testid="action-row"]');
    if (!actionRow) {
      return;
    }

    // avoid duplicating the button when iterating over the same post again
    if (actionRow.querySelector(`.${DISCORD_SHARE_BUTTON_CLASS}`)) {
      return;
    }

    // get share button for style imitation
    const shareButton = actionRow
      .querySelector('shreddit-post-share-button')
      ?.shadowRoot
      ?.querySelector('button');
    if (!shareButton) {
      return;
    }

    // create the custom button
    const discordShareButton = document.createElement('button');
    // copy Reddit styling of share button
    // also add class for identifying buttons that have already been placed by the script
    discordShareButton.className = shareButton.className + ' ' + DISCORD_SHARE_BUTTON_CLASS;
    discordShareButton.setAttribute('type', 'button');
    discordShareButton.textContent = 'Discord';
    discordShareButton.style.marginLeft = '4px';

    discordShareButton.onclick = async () => {
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

    // insert Discord share button at the end of the action row
    actionRow.appendChild(discordShareButton);
  });
}

// use MutationObserver for infinite scroll
const observer = new MutationObserver(addButtonToPosts);
observer.observe(document.body, { childList: true, subtree: true });

// initial run
addButtonToPosts();