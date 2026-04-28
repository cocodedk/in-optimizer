---
description: Use when the user is iterating on the LinkedIn comment cleaner — debugging stale selectors, triaging a diagnostic bundle in state/diagnostics/, summarizing a dry-run, or extending the detector/delete logic. Provides the architectural map and the dry-run-only safety rule for the linkedin.com/in/me/recent-activity/comments/ surface.
---

# Comment cleaner

The destructive surface is `linkedin.com/in/me/recent-activity/comments/`. The Playwright driver lives in `src/`; this skill is the map for editing it correctly.

## Common user intents

- **"the cleaner is broken / a selector is stale"** → triage the latest `state/diagnostics/<ts>-*/` bundle (`page.html`, `comment.html`, `screenshot.png`), propose a `selectors.ts` + `docs/selectors.md` + `test/fixtures/comments.html` patch in one change.
- **"summarize the last dry-run"** → ask for the run output or point at `state/log.jsonl`; report deleted/not-found/skipped/error counts and any pacing signals.
- **"extend the cleaner"** → consult the architecture map below; keep slices ≤200 LOC.

## Architecture (200-LOC slices)

Pure logic — no I/O:
- `pace.ts` — token-bucket + jitter, hourly/daily caps
- `scheduler.ts` — picks the next id from `processed.json`
- `errors.ts` — typed errors, retry classification
- `state.ts` — atomic flush of `processed.json`, append to `log.jsonl`

DOM-facing — Playwright handles only:
- `commentDetector.ts` — extracts `{ id, urn, permalink, text }` per visible comment
- `delete.ts` — clicks the menu, confirms, verifies removal
- `scroll.ts` — incremental load + virtualization-aware

Orchestration:
- `runner.ts` — main loop, dispatches detector → delete → state
- `cli.ts` — flag parsing, mode selection (`run | login | probe`)

Infra:
- `browser.ts` — launches Chromium against `.profile/` user-data dir (manual login)
- `humanCursor.ts` — bezier-path mouse moves, jitter
- `diagnose.ts` — drops `state/diagnostics/<ts>-<reason>/` bundle on selector miss

## Selector protocol

Every LinkedIn selector lives in `src/selectors.ts`. Three co-changes are mandatory:
1. Update `src/selectors.ts` (preserve the per-surface object structure).
2. Update `docs/selectors.md` with *why* the selector was chosen and the date verified live.
3. Refresh `test/fixtures/comments.html` from a real captured DOM if the comment shape changed.

Prefer stable attributes (`data-*`, `aria-*`, role-based). Avoid class names — LinkedIn rotates them.

## State files

- `state/log.jsonl` — append-only, one JSON per line. Never edit by hand.
- `state/processed.json` — `id → outcome` resume map. Atomic-flushed per action.
- Outcomes: `deleted` | `not-found` | `skipped` (terminal); `error` (retryable).
- `MAX_ATTEMPTS_PER_ID = 3` — after that, id is marked `skipped`.

## Pacing

Defaults: ~1 delete / 5–8s, hourly cap 200, daily cap 500. Don't loosen without a stated reason — LinkedIn's rate-limit signatures are subtler than X/Twitter's, and the cap also bounds blast radius if a detector regression deletes the wrong items.

## Safety rules

- **Never** invoke `npm run run:cleaner` (with or without `--dry-run`) from this session. The user runs the destructive path themselves; manual login is intentional.
- **Never** commit `.profile/` or `state/`.
- **Don't** add a CAPTCHA solver, headless-stealth shim, or proxy rotator — out of scope.
