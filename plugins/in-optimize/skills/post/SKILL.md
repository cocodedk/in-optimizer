---
description: Use when the user wants to design, scaffold, or extend a LinkedIn *post* cleaner that mirrors the comment cleaner's architecture. The src/ code for this surface does not yet exist — this skill is design notes and the slot layout for adding it.
---

# Post cleaner (design)

Status: **not implemented in `src/` yet.** This skill describes the slot layout to add it.

## Surface

URL: `linkedin.com/in/me/recent-activity/all/` (own activity → posts/reposts/reactions).

Confirm with the user *before* writing code:
1. Target scope — own posts only? reposts? reactions on others' posts?
2. Time window — all-time, or a `--since=<date>` filter?
3. Rate-limit posture — posts are higher-signal to LinkedIn than comments. Default: tighter than comment-cleaner pacing, not looser.

## Module slots (one file per slice, ≤200 LOC each)

- `src/postDetector.ts` — DOM extraction, returns `{ id, urn, kind: 'post'|'repost'|'reaction', text }`.
- `src/postDelete.ts` — clicks menu → "Delete post" → confirms. Different DOM from comments.
- `src/selectors.ts` — add a `posts` block alongside the existing `comments` block. Document in `docs/selectors.md`.
- `src/runner.ts` — extend, don't fork. Add `--target=posts|comments` dispatch on top of the existing loop. Reuse `pace`, `scheduler`, `state`.
- `state/processed.json` — namespace ids: `post:<id>`, `comment:<id>` to avoid collision.

## Test fixture

`test/fixtures/posts.html` — capture live, commit alongside the detector. Integration test loads it into Chromium and asserts the detector's output.

## Don't start until

- The user confirms the scope questions above.
- A real capture of the activity page exists locally — selector design without a captured DOM is guesswork; LinkedIn class names rotate weekly.
