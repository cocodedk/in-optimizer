# LinkedIn composer selectors (cyber-news)

Source-of-truth for `src/cybernews/selectors-li.ts`. When a selector breaks, update both files in the same change and bump the "last verified" date.

**Last verified live: 2026-04-30** (full destructive flow — opened composer, attached 2 photos, typed Danish body, clicked Post. Tweet `2049618125709263240` posted successfully.)

## Lessons from the first live run

Several things that broke or surprised:

- **Trigger is now a `<div role="button" tabindex="0">`**, not a `<button>`. Aria-label `"Start a post"` lives on an *inner* div; the click target is the outer wrapper. Use `[role="button"]:has([aria-label="Start a post"])`.
- **Composer is rendered inside an open Shadow DOM** (host: `<div id="interop-outlet" class="theme--light">`). Playwright's CSS engine pierces this with `css=` prefix or default locator — but raw `document.querySelectorAll` in `page.evaluate` does not. Stick to Playwright locators, not page-side DOM queries.
- **`button[aria-label="Add media"]` is the photo trigger** in the new composer. Old `share-promoted-detour-button[aria-label*="photo" i]` is a fallback.
- **The Add media button is removed from the DOM once the editor has substantial content** — LinkedIn collapses the secondary toolbar to make room for "Rewrite with AI" and the Post button. The poster therefore attaches media *before* typing the body.
- **`Escape` after typing `#` closes the composer modal**, not just the hashtag autocomplete. We removed that. Hashtag suggestions don't auto-commit; just type past them.
- **`button[aria-label="Open Emoji Keyboard"]` and `Schedule post`** sit alongside Add media in the toolbar — useful future hooks.
- **`button.share-actions__primary-action`** still works for the Post submit (legacy class survived the redesign, even though most other classes are now opaque hashes).

## Why selectors are split per surface

The comment-cleaner uses `src/selectors.ts` (delete flow on `/in/me/recent-activity/comments/`). The post-composer uses `src/cybernews/selectors-li.ts` (compose flow on `/feed/`). Both surfaces re-render when LinkedIn reskins the feed — but on different cadences, so keeping them in separate files means a feed-side change doesn't blast through comment-cleaner tests.

## Selector inventory

### `startPostTrigger`
Top-of-feed button that opens the composer modal.

```text
button.share-box-feed-entry__trigger,
button.share-box__open,
button[aria-label*="Start a post" i],
button[aria-label*="Create a post" i],
button[aria-label*="Opret et opslag" i],
[data-test-id="share-box-feed-entry__trigger"]
```

History:
- 2026-04-30 — initial. Class `share-box-feed-entry__trigger` is the most stable. The aria-label localizes (English / Danish / others), so we cover both. The `data-test-id` is internal but has been stable since 2024.

### `composerDialog`
Modal wrapper. We use this as a scope for the body editor and submit button so we don't accidentally match the wrong contenteditable on the page (e.g. an inline reply box).

```text
[role="dialog"][aria-labelledby*="share" i],
[role="dialog"][aria-labelledby*="post" i],
.share-box-modal,
.share-creation-state__container
```

### `bodyEditor`
The contenteditable for the post body. LinkedIn runs Quill, which gives us `.ql-editor`. The role+contenteditable selector is the structural fallback.

```text
.ql-editor[contenteditable="true"],
[role="dialog"] [role="textbox"][contenteditable="true"],
[role="dialog"] [contenteditable="true"][data-placeholder]
```

### `addMediaButton` + `fileInput`
The visible button reveals a hidden `<input type="file">`. We click the button (for cosmetic mouse motion) but `setInputFiles` directly — going through the OS picker is brittle and triggers the headless detection.

### `mediaThumbnails` + `mediaDoneButton`
After upload, LinkedIn shows preview thumbs. Some flows then have a "Next" / "Done" step before the final post button is enabled. The Danish locale uses "Næste" or "Færdig" — both covered.

### `postSubmitButton`
Final submit. Disabled until body is non-empty. Localized text covers `Post` (en), `Slå op` and `Indlæg` (da).

```text
button.share-actions__primary-action,
button[aria-label*="Post" i][data-test-id*="share" i],
[role="dialog"] button.artdeco-button--primary:has-text("Post"),
[role="dialog"] button.artdeco-button--primary:has-text("Slå op"),
[role="dialog"] button.artdeco-button--primary:has-text("Indlæg")
```

The structural class is the most reliable. Text-based fallbacks survive class renames but fail on locale changes.

### `postedToast` + `feedFirstPostPermalink`
After submit, LinkedIn shows a toast with a "View post" link. We capture the post URL from there. As a fallback, we read the permalink from the new top-of-feed post.

The URN format is `urn:li:activity:<id>`; the canonical permalink is `https://www.linkedin.com/feed/update/urn:li:activity:<id>/`.

## Triage when a selector breaks

1. **Capture the live DOM.** Open DevTools, screenshot, and save the relevant subtree as HTML. Drop it under `state/cybernews/diagnostics/<ts>-<reason>/` (mirrors the comment-cleaner pattern).
2. **Find a stable attribute.** Prefer in this order: `data-test-id` → `aria-label` → role + structural position → text content (last resort, breaks on locale).
3. **Update both files.** `src/cybernews/selectors-li.ts` gets the new selector; this doc gets the date and a one-line "what changed".
4. **Re-test against the live composer.** No fixture-based unit test for the poster (LinkedIn's React tree is too deep to fixture cleanly). The integration test is your next dry-run.

## Localization notes

LinkedIn reads the browser profile language. Danish locale strings used:
- "Opret et opslag" — start a post
- "Tilføj et foto" — add a photo
- "Næste" / "Færdig" — next / done
- "Slå op" / "Indlæg" — post (verb / noun)

If you switch profile language, re-verify the localized text matchers.
