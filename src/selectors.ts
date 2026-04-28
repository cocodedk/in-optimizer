/**
 * LinkedIn DOM selectors for the "Your activity → Comments" page.
 *
 * Source-of-truth: docs/selectors.md. Last verified live: 2026-04-28.
 */
export const SELECTORS = {
  /** Each comment card on the activity feed. */
  card: 'article.comments-comment-entity, [data-id^="urn:li:fsd_comment:"], [data-urn^="urn:li:comment:"]',
  /**
   * Trigger button that opens the per-comment "..." menu.
   *
   * 2026-04-28 update: LinkedIn moved the aria-label off the button onto an
   * inner <svg>. The button itself is unlabelled, so the legacy
   * `button[aria-label*=...]` selectors miss everything. We now lead with the
   * stable wrapper class `.comment-options-trigger` and keep older selectors
   * as fallbacks for the test fixture and prior DOM revisions.
   */
  trigger:
    '.comment-options-trigger button.artdeco-dropdown__trigger, ' +
    '.comment-options-trigger button[aria-expanded], ' +
    'button:has(svg[aria-label*="options" i][aria-label*="comment" i]), ' +
    'button[aria-label*="options" i][aria-label*="comment" i], ' +
    'button[aria-label*="ction" i][aria-label*="omment" i], ' +
    'button[aria-label="Open options"], ' +
    'button[aria-label*="Open control"]',
  /** Opened menu container. */
  menu: '[role="menu"], .artdeco-dropdown__content--is-open',
  /** Items inside the opened menu. */
  menuitem: '[role="menuitem"], .artdeco-dropdown__item',
  /** Modal confirmation dialog (after picking Delete). */
  confirmDialog: '[role="dialog"][aria-modal="true"], .artdeco-modal, .comments-delete-comment-modal',
  /**
   * Primary confirm button inside the modal's action bar. LinkedIn renders
   * `<div class="artdeco-modal__actionbar"> <Cancel> <Delete> </div>`, where
   * Delete is the only `artdeco-button--primary`. Structural selector first;
   * text-based fallback below.
   */
  confirmButton: '.artdeco-modal__actionbar button.artdeco-button--primary',
  /**
   * Text fallback for the confirm button. Whitespace-tolerant: the live
   * button's textContent is "\\n    Delete\\n", so an anchored `/^delete$/i`
   * misses. We allow surrounding whitespace.
   */
  confirmText: /^\s*delete\s*$/i,
} as const;

export const URL_PATTERNS = {
  login: "/login",
  uasLogin: "/uas/login",
  checkpoint: "/checkpoint/",
} as const;

export function isLoggedOutUrl(url: string): boolean {
  return (
    url.includes(URL_PATTERNS.login) ||
    url.includes(URL_PATTERNS.uasLogin) ||
    url.includes(URL_PATTERNS.checkpoint)
  );
}

/**
 * Activity-comments URL. `/in/me/` resolves to the logged-in user's profile,
 * which is the canonical entry point for "delete all my comments".
 */
export const ACTIVITY_COMMENTS_URL =
  "https://www.linkedin.com/in/me/recent-activity/comments/";
