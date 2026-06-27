const BUTTONS_CONTAINER_CLASS = 'drb-buttons-container';

/**
 * Used to unregister event listeners after a location change
 * 
 * @type {AbortController}
 */
let abortController;

/**
 * Cached template for buttons container that can be cloned
 * 
 * @type {HTMLDivElement}
 */
let buttonsContainerTemplate;

/**
 * Cached template for clipboard button that can be cloned
 * 
 * @type {HTMLButtonElement}
 */
let clipboardButtonTemplate;

/**
 * Cached template for repost button that can be cloned
 * 
 * @type {HTMLButtonElement}
 */
let repostButtonTemplate;

init();

// ==============================
// ==== function definitions ====
// ==============================

/**
 * Initialize the persistent content script and ensure the logic for injecting buttons is re-run from the start
 * every time a new page has been navigated to
 */
function init() {
  abortController = new AbortController();

  // run code to add repost buttons every time a navigation succeeded
  navigation.addEventListener('navigatesuccess', () => {
    injectForPage();
  });

  // explicitly run element injection code for initial location
  injectForPage();
}

/**
 * This function determines which kind of page is currently active and kicks off the appropriate injection logic
 * Should be called when a new page has been navigated to
 */
function injectForPage() {
  // unregister all event listeners and observers from previous function call and create fresh AbortController instance
  abortController.abort();
  abortController = new AbortController();

  const posts = document.querySelectorAll('shreddit-post');

  // determine which kind of page is active and run appropriate injection logic
  if (posts.length === 1) {
    // active page shows a single post
    initInjectionForSinglePost();
  } else if (posts.length > 1) {
    // active page shows multiple posts
    initInjectionForPostsList();
  } else {
    console.log('No posts found on page');
  }
}

/**
 * Initializes logic for trying to add buttons to a single post, which is reattempted every time the DOM mutates,
 * until the injection succeeded
 */
function initInjectionForSinglePost() {
  addButtonsToSinglePost();

  // use MutationObserver to ensure that script keeps trying to add buttons when body mutates,
  // as the DOM nodes that the logic depends on may take a moment to appear
  const observer = new MutationObserver(addButtonsToSinglePost);
  observer.observe(document.body, { childList: true, subtree: true });

  // ensure that once location is changed and the MutationObserver instance becomes obsolete, it is disconnected
  abortController.signal.addEventListener('abort', () => observer.disconnect(), { once: true })
}

/**
 * Initializes logic for trying to add buttons to posts in a list, which is repeated every time
 * additional posts are suspected to have been loaded
 */
function initInjectionForPostsList() {
  addButtonsToPostsList();

  // use MutationObserver so that buttons keep being added to new posts that are loaded in as the user scrolls
  const observer = new MutationObserver(addButtonsToPostsList);
  observer.observe(document.body, { childList: true, subtree: true });

  // ensure that once location is changed and the MutationObserver instance becomes obsolete, it is disconnected
  abortController.signal.addEventListener('abort', () => observer.disconnect(), { once: true })
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
  const postShadowRoot = post.shadowRoot;

  // do not add any buttons and unregister mutation observer if repost buttons already exist
  if (postShadowRoot?.querySelector(`.${BUTTONS_CONTAINER_CLASS}`)) {
    mutationObserver?.disconnect();
    return;
  }

  // get share button container for relative positioning of repost buttons
  const shareButtonContainer = postShadowRoot?.querySelector('slot[name="share-button"]');
  if (!shareButtonContainer) {
    console.error('Could not find share button container for post');
    return;
  }

  // get share button for style imitation
  const shareButton = post.querySelector('.share-dropdown-menu button');
  if (!shareButton) {
    console.error('Could not find share button for post');
    return;
  }

  // create buttons container
  const buttonsContainer = createButtonsContainer();
  // since the active tab shows a single post, the current location is the post's URL
  const postUrl = window.location.href;

  // create clipboard button
  const clipboardButton = createClipboardButton();
  // add reddit's styling from share button
  clipboardButton.className += ' ' + shareButton.className;
  clipboardButton.style.cssText = shareButton.style.cssText;
  // register onclick-function
  clipboardButton.onclick = async () => {
    handleClipboardButtonClick(postUrl, clipboardButton);
  };
  buttonsContainer.appendChild(clipboardButton);

  // create repost button
  const repostButton = createRepostButton();
  // add reddit's styling from share button
  repostButton.className += ' ' + shareButton.className;
  repostButton.style.cssText = shareButton.style.cssText;
  // register onclick-function
  repostButton.onclick = async () => {
    handleRepostButtonClick(postUrl, repostButton);
  };
  buttonsContainer.appendChild(repostButton);

  // insert the buttons container directly after the share button
  shareButtonContainer.insertAdjacentElement('afterend', buttonsContainer);
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

    // avoid duplicating buttons when iterating over the same post again
    if (actionRow.querySelector(`.${BUTTONS_CONTAINER_CLASS}`)) {
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

    // create buttons container
    const buttonsContainer = createButtonsContainer();

    // grab relative URL to post
    const postLink = post.querySelector('a[slot="full-post-link"]')
      || post.querySelector('a[slot="title"]');

    if (!postLink) {
      console.error("Could not find post URL");
      return;
    }

    // build full URL to post
    const fullPostUrl = new URL(postLink.href, window.location.origin).href;

    // create clipboard button
    const clipboardButton = createClipboardButton();
    // add reddit's styling from share button
    clipboardButton.className += ' ' + shareButton.className;
    // register onclick-function
    clipboardButton.onclick = async () => {
      handleClipboardButtonClick(fullPostUrl, clipboardButton);
    };
    buttonsContainer.appendChild(clipboardButton);

    // create the repost button
    const repostButton = createRepostButton();
    // add reddit's styling from share button
    repostButton.className += ' ' + shareButton.className;
    // register onclick-function
    repostButton.onclick = async () => {
      handleRepostButtonClick(fullPostUrl, repostButton);
    };
    buttonsContainer.appendChild(repostButton);

    // insert the repost button directly after the share button
    shareButtonContainer.insertAdjacentElement('afterend', buttonsContainer);
  });
}

/**
 * Creates a container node that houses all buttons for a single post
 * 
 * @return {HTMLDivElement}
 */
function createButtonsContainer() {
  if (!this.buttonsContainerTemplate) {
    // template has to be created

    const buttonsContainer = document.createElement('div');
    // add class for identification purposes
    buttonsContainer.className = BUTTONS_CONTAINER_CLASS;
    // add styling for container
    buttonsContainer.style.cssText = `
      position: relative;
      display: flex;
      gap: 0.75rem;
    `;

    this.buttonsContainerTemplate = buttonsContainer;
  }

  return this.buttonsContainerTemplate.cloneNode(true);
}

/**
 * Creates a new clipboard button instance based on a cached template
 */
function createClipboardButton() {
  if (!this.clipboardButtonTemplate) {
    // template has to be created

    const clipboardButton = document.createElement('button');
    clipboardButton.setAttribute('type', 'button');
    clipboardButton.setAttribute('title', 'Copy repost message text to clipboard');
    clipboardButton.textContent = '📋';

    this.clipboardButtonTemplate = clipboardButton;
  }

  return this.clipboardButtonTemplate.cloneNode(true);
}

/**
 * Creates a new repost button instance based on a cached template
 * 
 * @returns {HTMLButtonElement}
 */
function createRepostButton() {
  if (!this.repostButtonTemplate) {
    // template has to be created

    const repostButton = document.createElement('button');
    repostButton.setAttribute('type', 'button');
    repostButton.setAttribute('title', 'Repost on Discord');

    // use extension icon as button label
    const iconUrl = browser.runtime.getURL('images/icon.svg');
    const iconImage = document.createElement('img');
    iconImage.setAttribute('src', iconUrl);
    iconImage.setAttribute('alt', 'Discord');
    iconImage.style.cssText = `
      height: 16px;
      width: 16px;
    `;

    repostButton.appendChild(iconImage);

    this.repostButtonTemplate = repostButton;
  }

  return this.repostButtonTemplate.cloneNode(true);
}

/**
 * Prompts the background script to write repost text that can be pasted in Discord to the user's clipboard
 * Displays the success or failure of that prompt as a toast next to the button
 * 
 * @param {string} postUrl the URL of the reddit post that should be reposted
 * @param {HTMLButtonElement} clipboardButton the clipboard button that was clicked
 */
function handleClipboardButtonClick(postUrl, clipboardButton) {
  const sending = browser.runtime.sendMessage({
    action: 'clipboard_reddit',
    params: {
      postUrl: postUrl,
    }
  });

  sending.then((result) => {
    displayToast(
      result.success,
      result.success ? 'Copied' : 'Failed to copy',
      clipboardButton
    );
  });
}

/**
 * Prompts the background script to repost the provided post URL
 * Displays the success or failure of that prompt as a toast next to the button
 * 
 * @param {string} postUrl the URL of the reddit post that should be reposted
 * @param {HTMLButtonElement} repostButton the repost button that was clicked
 */
function handleRepostButtonClick(postUrl, repostButton) {
  const sending = browser.runtime.sendMessage({
    action: 'repost_reddit',
    params: {
      postUrl: postUrl,
    }
  });

  sending.then((result) => {
    displayToast(
      result.success,
      result.success ? 'Reposted' : 'Failed to repost',
      repostButton
    );
  });
}

/**
 * Displays a temporary toast above the provided anchorElement that informs of success or failure, depending on
 * the value of success.
 * 
 * @param {boolean} success indicate if a positive success toast or a negative failure post should be displayed
 * @param {string} text the text content of the toast
 * @param {Node} container defines the element that the toast should be displayed relative to
 */
function displayToast(success, text, container) {
  const toast = document.createElement('div');
  toast.textContent = text;

  // since the toast is usually located inside a shadow root, it cannot be easily styled with global CSS rules
  // from a CSS file; instead directly set the style attribute on the toast
  toast.style.cssText = `
    position: absolute;
    bottom: 2.1rem;
    padding: 0.5rem;
    white-space: nowrap;
    border-radius: 0.5rem;
    background-color: ${success ? 'green' : 'red'};
    color: white;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  // insert toast into container
  container.appendChild(toast);

  // fade in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
  });

  // remove toast after 2 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.addEventListener('transitionend', () => toast.remove(), { once: true })
  }, 2000);
}