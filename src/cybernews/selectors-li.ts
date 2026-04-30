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
   * Trigger that opens the post composer at the top of /feed/.
   *
   * 2026-04-30 update: LinkedIn shipped a redesign that:
   *   1. moved the trigger from a <button> to a <div role="button"> (or
   *      sometimes a bare <div>),
   *   2. dropped the legacy `share-box-*` class anchors,
   *   3. switched to opaque hashed CSS classes,
   *   4. removed the `data-test-id` attribute.
   * The only stable anchor we found is the aria-label. Match without the
   * tag prefix and prefer exact-match locales before case-insensitive
   * partial fallbacks.
   */
  startPostTrigger:
    '[data-view-name="share-sharebox-focus"], ' +
    '[role="button"]:has([aria-label="Start a post"]), ' +
    '[role="button"]:has([aria-label="Create a post"]), ' +
    '[role="button"]:has([aria-label="Opret et opslag"]), ' +
    '[role="button"]:has([aria-label*="Start a post" i]), ' +
    '[role="button"]:has([aria-label*="Opret et opslag" i]), ' +
    'button.share-box-feed-entry__trigger, ' +
    'button.share-box__open, ' +
    '[data-test-id="share-box-feed-entry__trigger"]',

  /** The composer modal that opens after clicking the trigger. */
  composerDialog:
    '[role="dialog"][aria-labelledby*="share" i], ' +
    '[role="dialog"][aria-labelledby*="post" i], ' +
    '.share-box-modal, ' +
    '.share-creation-state__container',

  /**
   * The contenteditable surface for the post body.
   *
   * 2026-04-30 update: the composer is now rendered inside an interop
   * shadow root (host: `<div id="interop-outlet" class="theme--light">`).
   * Playwright's CSS engine still pierces this when given the `css=`
   * prefix, but role/aria-label scoping is the most reliable anchor.
   * The combination `[contenteditable="true"][role="textbox"]` excludes
   * the page's `<input>` search field (which has role=textbox but is
   * not contenteditable).
   */
  bodyEditor:
    '[contenteditable="true"][role="textbox"][aria-label*="ext editor" i], ' +
    '[contenteditable="true"][role="textbox"][placeholder*="hare your" i], ' +
    '[contenteditable="true"][role="textbox"][placeholder*="el dine tanker" i], ' +
    '[contenteditable="true"][role="textbox"], ' +
    '.ql-editor[contenteditable="true"]',

  /**
   * The media-attach button inside the composer.
   *
   * 2026-04-30 update: redesign collapsed Photo / Video / Document into a
   * single "Add media" trigger. Aria-label matters; class is opaque.
   */
  addMediaButton:
    'button[aria-label="Add media"], ' +
    'button[aria-label="Tilføj medier"], ' +
    'button[aria-label*="Add media" i], ' +
    'button[aria-label*="Add a photo" i], ' +
    'button[aria-label*="Tilføj" i]',

  /**
   * Hidden file input the media button reveals. With the new composer,
   * clicking Add media usually opens a native file chooser. We prefer
   * `page.waitForEvent('filechooser')` over targeting this input
   * directly, but keep the selector as a fallback.
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
