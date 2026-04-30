/**
 * LinkedIn composer selectors for posting from /feed/.
 *
 * Source-of-truth: docs/cybernews-selectors-li.md.
 * Last verified live: 2026-04-30.
 *
 * Strategy: prefer structural selectors with stable classes
 * (`share-box-*`, `share-creation-state-*`); fall back to ARIA / text where
 * a class was unstable in past observations.
 */

export const FEED_URL = "https://www.linkedin.com/feed/";

export const LI_SELECTORS = {
  /**
   * Trigger that opens the post composer at the top of /feed/. LinkedIn
   * renders this as a button with the "Start a post" placeholder text.
   * The class names rotate, so we lead with text-based locators.
   */
  startPostTrigger:
    'button.share-box-feed-entry__trigger, ' +
    'button.share-box__open, ' +
    'button[aria-label*="Start a post" i], ' +
    'button[aria-label*="Create a post" i], ' +
    'button[aria-label*="Opret et opslag" i], ' +
    '[data-test-id="share-box-feed-entry__trigger"]',

  /** The composer modal that opens after clicking the trigger. */
  composerDialog:
    '[role="dialog"][aria-labelledby*="share" i], ' +
    '[role="dialog"][aria-labelledby*="post" i], ' +
    '.share-box-modal, ' +
    '.share-creation-state__container',

  /**
   * The contenteditable surface for the post body. LinkedIn's composer
   * runs Quill, so we match its `.ql-editor` first and the generic
   * contenteditable role second.
   */
  bodyEditor:
    '.ql-editor[contenteditable="true"], ' +
    '[role="dialog"] [role="textbox"][contenteditable="true"], ' +
    '[role="dialog"] [contenteditable="true"][data-placeholder]',

  /** The "Add a photo" / media-attach button inside the composer. */
  addMediaButton:
    'button[aria-label*="Add a photo" i], ' +
    'button[aria-label*="Add media" i], ' +
    'button[aria-label*="Tilføj et foto" i], ' +
    'button.share-promoted-detour-button[aria-label*="photo" i]',

  /**
   * Hidden file input the media button reveals. We `setInputFiles` directly
   * rather than going through the OS picker.
   */
  fileInput:
    'input[type="file"][accept*="image"], ' +
    'input[type="file"][accept*="video"], ' +
    'input[type="file"][name*="upload" i]',

  /** Once images are uploading, LinkedIn renders preview thumbnails. */
  mediaThumbnails:
    '.share-images__image, ' +
    '.image-detour-container, ' +
    '[data-test-id*="media-thumb" i]',

  /** "Done" / "Next" button after attaching media (multi-step flow). */
  mediaDoneButton:
    'button[aria-label="Done" i], ' +
    'button[aria-label="Næste" i], ' +
    'button[aria-label="Færdig" i], ' +
    'button.share-box-footer__primary-btn, ' +
    'button[data-test-id="media-detour-back-to-share-box-btn"]',

  /**
   * Primary "Post" submit button at the bottom of the composer footer.
   * Disabled until body is non-empty.
   */
  postSubmitButton:
    'button.share-actions__primary-action, ' +
    'button[aria-label*="Post" i][data-test-id*="share" i], ' +
    '[role="dialog"] button.artdeco-button--primary:has-text("Post"), ' +
    '[role="dialog"] button.artdeco-button--primary:has-text("Slå op"), ' +
    '[role="dialog"] button.artdeco-button--primary:has-text("Indlæg")',

  /**
   * After submit, the composer dialog closes and a toast may appear at the
   * bottom of the feed. We capture the new post URL via the toast link.
   */
  postedToast:
    '.artdeco-toasts a[href*="/feed/update/urn:li:activity:"], ' +
    '[role="status"] a[href*="/feed/update/urn:li:activity:"]',

  /**
   * As a fallback, the new post appears at the top of the user's feed with
   * a permalink anchor inside the post header.
   */
  feedFirstPostPermalink:
    'main [data-urn^="urn:li:activity:"] a[href*="/feed/update/urn:li:activity:"]',
} as const;
