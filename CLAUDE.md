# CLAUDE.md — conventions for this repo

## What this is

Local Playwright tool that deletes the user's own LinkedIn comments by
driving a logged-in Chromium against
`https://www.linkedin.com/in/me/recent-activity/comments/`. Sister project
to `x-cleaner` (does the same for X/Twitter). The architecture mirrors it
deliberately — when in doubt, look at how `x-cleaner` solves the equivalent
problem.

## Stack

- TypeScript ESM (Node ≥20), strict mode + `noUncheckedIndexedAccess`.
- `tsx` to run, `vitest` to test, `playwright` to drive Chromium.
- No `.env` file. All config = CLI flags + inlined defaults in `src/cli.ts`.

## Module size

**Hard limit: 200 LOC per source file.** If a module is approaching it,
split. Existing slices: pure-logic (`pace`, `scheduler`, `errors`, `state`),
DOM-facing (`commentDetector`, `delete`, `scroll`), orchestration (`runner`,
`cli`), infra (`browser`, `humanCursor`, `diagnose`).

## Selectors

LinkedIn renames classes and shifts DOM frequently. Two rules:

1. Every LinkedIn selector lives in `src/selectors.ts`. No selector strings
   inline in `runner.ts` / `delete.ts`.
2. `docs/selectors.md` is the source-of-truth comment for *why* each
   selector was chosen and *when* it was last verified live. Update both
   files together.

When a selector breaks at runtime, the diagnostic bundle in
`state/diagnostics/<ts>-<reason>/` has `page.html` + `comment.html` +
`screenshot.png` — open those, grep for stable attributes, update
`selectors.ts` and the fixture, then re-run tests.

## State and resumability

- `state/log.jsonl` is append-only. One JSON object per line. Never edit by
  hand.
- `state/processed.json` is the resume map: `id → outcome`. Atomic-flushed
  after every action.
- Outcomes: `deleted` | `not-found` | `skipped` are terminal; `error` is
  retryable.
- `MAX_ATTEMPTS_PER_ID = 3` — after that, the id is marked `skipped`.

## Pacing

Defaults are deliberately conservative for LinkedIn: ~1 delete / 5–8s,
hourly cap 200, daily cap 500. Don't loosen these without reason; LinkedIn
is stricter than X/Twitter and rate-limit signatures are subtler.

## Testing

- **Unit** — `pace`, `scheduler`, `errors`, `state`. Pure logic, no I/O.
- **Integration** — `commentDetector` against `test/fixtures/comments.html`
  loaded into a real Chromium via Playwright. No network.
- **No live e2e.** The destructive path is never run from tests. Dry-run is
  the integration check on a real account; the user runs it themselves.

## Don't

- **Don't** run the destructive command (`npm run run:cleaner` without
  `--dry-run`) from Claude. The user runs that themselves.
- **Don't** commit the `.profile/` directory or the `state/` directory.
  Both are gitignored.
- **Don't** add a CAPTCHA solver, headless-stealth shim, or proxy rotator.
  Out of scope.
- **Don't** automate the password flow. Manual login is intentional.

## When working in this repo

1. Read `x-cleaner/src/<equivalent>.ts` first if you need a reference for
   how a sub-problem was solved before.
2. If you change a selector, update `docs/selectors.md` *and*
   `test/fixtures/comments.html` in the same change.
3. Keep `summary.deleted` count visible in CLI output — it's the user's
   primary trust signal.
