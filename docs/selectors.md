# LinkedIn DOM reference

Source-of-truth for selectors used by `src/selectors.ts`. Update this file
together with `src/selectors.ts` and `test/fixtures/comments.html` whenever
LinkedIn breaks something.

> **Last verified live:** 2026-04-28 (a destructive run failed with
> `trigger-missing` until the trigger selector was updated; see "..." section).

## Page entry point

`https://www.linkedin.com/in/me/recent-activity/comments/`

`/in/me/` resolves to the logged-in user's profile, so this URL works for
any account without needing a handle.

## Comment card

```css
article.comments-comment-entity,
[data-id^="urn:li:fsd_comment:"],
[data-urn^="urn:li:comment:"]
```

LinkedIn has used at least two URN attributes (`data-urn`,
`data-id`) and at least two URN flavors (`urn:li:comment:` legacy,
`urn:li:fsd_comment:` newer-graph). The detector accepts all three so a
schema flip on either dimension doesn't kill enumeration in one go.

## Comment body

```css
.comments-comment-item__main-content,
.comments-comment-item-content-body
```

The activity-comments page renders cards with a long author header (full
name + connection-degree badge + profile title + relative time). Pulling
`textContent` of the whole card and truncating wastes the snippet on the
header and leaves only a few characters of actual comment. The detector
prefers the inner body element above; if it's absent it falls back to the
whole card. Snippet is capped at 280 chars (vs. the original 140) so longer
comment bodies still show enough to judge.

Verified live: 2026-04-28 — the header-eats-snippet bug was visible on a
real run; switching to the body element + 280-char cap produced readable
snippets.

## Authorship filter ("• You")

The activity-comments page also surfaces other people's replies in the
same threads — not only the user's own comments. To filter to just the
user's, we look for `• You` in the card text (LinkedIn's connection-degree
badge for self). Other commenters carry `• 1st`, `• 2nd`, `• 3rd+`, or
`Author`. Filter is text-based; if LinkedIn ever swaps the badge string
this needs updating.

## "..." trigger button (per-comment menu)

```css
.comment-options-trigger button.artdeco-dropdown__trigger,
.comment-options-trigger button,
button:has(svg[aria-label*="options" i][aria-label*="comment" i]),
button[aria-label*="options" i][aria-label*="comment" i],
button[aria-label*="ction" i][aria-label*="omment" i],
button[aria-label="Open options"],
button[aria-label*="Open control"]
```

**2026-04-28 — what broke.** The button itself is now unlabelled; LinkedIn
moved its aria-label onto a nested `<svg aria-label="Open options for …
comment">`. The legacy `button[aria-label*="ction" i][aria-label*="omment"
i]` (intended for "More actions on this comment") matches nothing live —
it's also wrong on the new aria text ("Open options for …"). Six attempts
failed with `trigger-missing` before the live HTML was inspected.

**Stable handle.** The button sits inside
`<div class="comment-options-trigger comments-comment-meta__options">`,
itself a child of the comment card. We scope via that wrapper, then
require either the `artdeco-dropdown__trigger` class or an
`aria-expanded` attribute so we don't match unrelated buttons that may
appear inside the wrapper (e.g., a "Message author" link surfaced in
some comment variants — we hit this on 2026-04-28: a bare
`.comment-options-trigger button` selector matched it on one comment and
the click navigated to `/messaging/thread/…` instead of opening the
dropdown).

The `:has(svg[aria-label*=...])` and direct aria-label fallbacks cover
prior DOM revisions and the test fixture.

## Opened menu / menu items

```css
[role="menu"], .artdeco-dropdown__content--is-open
[role="menuitem"], .artdeco-dropdown__item
```

LinkedIn's `artdeco` design system is the underlying component library;
`.artdeco-dropdown__*` classes have been stable for years. `role="menu"` /
`role="menuitem"` are accessibility-mandated and unlikely to disappear.

The "Delete" item is matched by text (`/delete/i`), not by a specific class
or testid.

## Confirm dialog

```css
[role="dialog"][aria-modal="true"],
.artdeco-modal,
.comments-delete-comment-modal
```

The live dialog has `role="dialog"` but **no `aria-modal="true"`** — the
first selector misses; `.artdeco-modal` is the actual stable handle, with
`.comments-delete-comment-modal` as an even-more-specific fallback.

## Confirm button (primary action)

```css
.artdeco-modal__actionbar button.artdeco-button--primary
```

The action bar renders `<button …--secondary>Cancel</button> <button …
--primary>Delete</button>`, so the primary class uniquely identifies the
destructive action. A whitespace-tolerant `/^\s*delete\s*$/i` text match
is kept as a fallback.

**2026-04-28 — what broke.** The previous code used
`dialog.locator("button", { hasText: /^delete$/i })`. Live LinkedIn wraps
the button text in `<!----><span class="artdeco-button__text">  Delete  </span>`,
which gives a textContent like `"\n    Delete\n"` — the anchored regex
never matches. Three attempts failed with `confirm-button-missing` before
the structural primary-button selector was added.

## Logged-out URLs

Treat any of these as "session expired, abort":

- `*/login*`
- `*/uas/login*`
- `*/checkpoint/*`

The checkpoint flow is LinkedIn's "is this you?" / 2FA wall. We can't
solve it programmatically; the user has to clear it manually.

## Verification checklist (run on first live dry-run)

1. `npm run probe` — saved profile is still logged in.
2. `npm run run:cleaner -- --dry-run --max=5` — detector finds 5 comments.
3. If detector finds 0: open DevTools on the activity-comments page, grep
   the DOM for `urn:li:comment` and `urn:li:fsd_comment`. Whichever exists
   is the new canonical attribute — update the `card` selector here and in
   `src/selectors.ts`.
4. If detector finds comments but the trigger click does nothing: hover
   the "…" button manually, copy its `aria-label`, and add it to the
   `trigger` selector here and in `src/selectors.ts`.
