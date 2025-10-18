const DISCORD_SHARE_BUTTON_CLASS = 'discord-share-button';

/**
 * Stores last location that the scripts has run for,
 * used to track location changes
 * 
 * @type {string}
 */
let lastLocationUrl;

/**
 * Used to unregister event listeners after a location change
 * 
 * @type {AbortController}
 */
let abortController;

/**
 * Cached template for repost button that can be cloned
 * 
 * @type {Node}
 */
let repostButtonTemplate;

init();

// ==============================
// ==== function definitions ====
// ==============================

/**
 * Initialize the persistent content script and ensure the logic for adding repost buttons is re-run from the start
 * every time the window location changes
 */
function init() {
  // store initial location URL
  lastLocationUrl = window.location.href;
  abortController = new AbortController();

  // run code to add repost buttons every time a location change is detected,
  // which is done by comparing the current location to the last known value whenever the body mutates
  const observer = new MutationObserver(() => {
    if (lastLocationUrl !== window.location.href) {
      // update last location and add buttons
      lastLocationUrl = window.location.href;
      addButtons();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // explicitly run addButtons for initial location
  addButtons();
}

/**
 * This function should be called once after a new location has been navigated to, in order to start adding
 * repost buttons to all posts in the current view
 */
function addButtons() {
  // unregister all event listeners and observers from previous function call and create fresh AbortController instance
  abortController.abort();
  abortController = new AbortController();

  const posts = document.querySelectorAll('shreddit-post');

  if (posts.length === 1) {
    // active view shows a single post
    addButtonsToSinglePost();

    // use MutationObserver to ensure that script keeps trying to add buttons when body mutates,
    // as the DOM nodes that the logic depends on may take a moment to appear
    const observer = new MutationObserver(addButtonsToSinglePost);
    observer.observe(document.body, { childList: true, subtree: true });

    // ensure that once location is changed and the MutationObserver instance becomes obsolete, it is disconnected
    abortController.signal.addEventListener('abort', () => observer.disconnect(), { once: true })
  } else if (posts.length > 1) {
    // active view shows multiple posts
    addButtonsToPostsList();

    // use MutationObserver so that buttons keep being added to new posts that are loaded in as the user scrolls
    const observer = new MutationObserver(addButtonsToPostsList);
    observer.observe(document.body, { childList: true, subtree: true });

    // ensure that once location is changed and the MutationObserver instance becomes obsolete, it is disconnected
    abortController.signal.addEventListener('abort', () => observer.disconnect(), { once: true })
  } else {
    console.log('No posts found on page');
  }
}

/**
 * Adds buttons to a post in a single post with comments view
 * 
 * @param {MutationRecord[]|undefined} mutationRecords unused array of mutation records that may be passed by a
 *                                                     MutationObserver instance that called this function
 * @param {MutationObserver|undefined} mutationObserver may be a MutationObserver instance that called this function
 */
function addButtonsToSinglePost(mutationRecords, mutationObserver) {
  const post = document.querySelector('shreddit-post');

  // get share button container for relative positioning of repost button
  const shareButtonContainer = post.shadowRoot?.querySelector('slot[name="share-button"]');
  if (!shareButtonContainer) {
    console.error('Could not find share button container for post');
    return;
  }

  // get share button for style imitation
  const shareButton = post.querySelector('faceplate-dropdown-menu')?.querySelector('button');
  if (!shareButton) {
    console.error('Could not find share button for post');
    return;
  }

  // create the repost button
  const repostButton = createRepostButton();
  // add reddit's styling from share button
  repostButton.className += ' ' + shareButton.className;
  repostButton.style.cssText = shareButton.style.cssText;
  // register onclick-function
  repostButton.onclick = async () => {
    // since the active tab shows a single post, the current location is the post's URL
    const postUrl = window.location.href;
    sendRepostMessageToBackground(postUrl);
  };

  // insert the repost button directly after the share button
  shareButtonContainer.insertAdjacentElement('afterend', repostButton);
  // now that all buttons have been added, this function does not need to re-run,
  // meaning that the mutation observer can be disconnected
  mutationObserver?.disconnect();
}

/**
 * Adds buttons to posts in a posts list view
 */
function addButtonsToPostsList() {
  // query post elements anew on each function call, as new posts might have been loaded in
  const posts = document.querySelectorAll('shreddit-post');

  posts.forEach(post => {
    const actionRow = post?.shadowRoot?.querySelector('div[data-testid="action-row"]');
    if (!actionRow) {
      console.error('Could not find action row for post');
      return;
    }

    // avoid duplicating the repost button when iterating over the same post again
    if (actionRow.querySelector(`.${DISCORD_SHARE_BUTTON_CLASS}`)) {
      return;
    }

    // get share button container for relative positioning of repost button
    const shareButtonContainer = actionRow.querySelector('slot[name="share-button"]')
    if (!shareButtonContainer) {
      console.error('Could not find share button container for post');
      return;
    }

    // get share button for style imitation
    const shareButton = shareButtonContainer
      ?.querySelector('shreddit-post-share-button')
      ?.shadowRoot
      ?.querySelector('button');
    if (!shareButton) {
      console.error('Could not find share button for post');
      return;
    }

    // create the repost button
    const repostButton = createRepostButton();
    // add reddit's styling from share button
    repostButton.className += ' ' + shareButton.className;
    // register onclick-function
    repostButton.onclick = async () => {
      // grab relative URL to post
      const postLink = post.querySelector('a[slot="full-post-link"]')
        || post.querySelector('a[slot="title"]');

      if (!postLink) {
        console.error("Could not find post URL");
        return;
      }

      // build full URL to post
      const fullPostUrl = new URL(postLink.href, window.location.origin).href;

      sendRepostMessageToBackground(fullPostUrl);
    };

    // insert the repost button directly after the share button
    shareButtonContainer.insertAdjacentElement('afterend', repostButton);
  });
}

/**
 * Creates a new repost button instance based on a cached template
 * 
 * @returns {Node}
 */
function createRepostButton() {
  return getRepostButtonTemplate().cloneNode(true);
}

/**
 * Returns the cached repost button template
 * Creates the template if it has not yet been cached
 * 
 * @returns {Node}
 */
function getRepostButtonTemplate() {
  if (!this.repostButtonTemplate) {
    // template has to be created

    // create the repost button
    const repostButton = document.createElement('button');
    // add class for identifying buttons that have already been placed by the script
    repostButton.className = DISCORD_SHARE_BUTTON_CLASS;
    repostButton.setAttribute('type', 'button');
    repostButton.setAttribute('title', 'Repost on Discord');

    // use extension icon as button label
    const iconUrl = browser.runtime.getURL('icons/icon_16.png');
    const iconImage = document.createElement('img');
    iconImage.setAttribute('src', iconUrl);
    iconImage.setAttribute('alt', 'Discord');
    repostButton.appendChild(iconImage);

    this.repostButtonTemplate = repostButton;
  }

  return this.repostButtonTemplate;
}

/**
 * Signals to the background script that a reddit post should be reposted in Discord
 * 
 * @param {string} postUrl the URL of the reddit post that should be reposted
 */
function sendRepostMessageToBackground(postUrl) {
  browser.runtime.sendMessage({
    action: 'repost_reddit',
    params: {
      postUrl: postUrl,
    }
  });
}