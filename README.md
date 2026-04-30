# in-optimizer

Local LinkedIn surface tools. Your browser, your account. No API tokens, no
third-party server, no password automation.

Two surfaces, both deliberately slow and human-paced:

- **Comment cleaner** — delete your own old LinkedIn comments at ~1 every 5-8 s,
  with hourly and daily caps. Drives the activity-comments page.
- **Cyber-news poster (Danish)** — fetch cybersecurity tweets from a public X
  handle (default `@IntCyberDigest`), classify severity, translate to simple
  Danish, run `/humanizer-da` twice, post to your LinkedIn feed with images.
  One post per invocation; you control the cadence.

Sister project: [`x-cleaner`](../x-cleaner) (same approach for X/Twitter
replies). The architecture and conventions mirror it deliberately.

## Website

- [English](https://cocodedk.github.io/in-optimizer/)
- [فارسی (Persian)](https://cocodedk.github.io/in-optimizer/fa/)

## Status

- Comment-cleaner selectors verified live 2026-04-28 (`docs/selectors.md`).
  Includes `--collect=<path>` to dump the queue to JSON and `--only-ids=<path>`
  to act on an approved subset.
- Cyber-news poster verified live 2026-04-30 (`docs/cybernews-selectors-li.md`).
  First post landed on the author's feed; selectors anchored to ARIA / shadow-
  DOM-piercing locators.

## What's in the box

```
src/
  pace.ts             jittered delays, seeded RNG, long-break logic
  scheduler.ts        hourly/daily caps + abort-on-anomaly
  errors.ts           signal → action classifier (continue/retry/backoff/abort)
  state.ts            jsonl log + processed-set + atomic flush
  selectors.ts        central LinkedIn DOM selector constants
  commentDetector.ts  enumerate own comments on the activity page
  scroll.ts           infinite-scroll + "Show more results" helper
  delete.ts           open … menu → click Delete → confirm in modal
  diagnose.ts         screenshot + DOM + a11y dump on error
  humanCursor.ts      Bezier-smoothed mouse moves, jittered click points
  browser.ts          persistent-profile Chromium launcher
  runner.ts           glues scheduler + detector + delete + state + diagnose
  cli.ts              cleaner CLI: login | probe | run
  cybernews/          cyber-news poster slice (≤200 LOC each)
    state.ts          posted.json + log.jsonl, BigInt high-water mark
    fetch.ts          X syndication API parser + media downloader
    discover.ts       timeline-profile parser + newSince filter
    severity.ts       info | notable | critical | zero-day classifier
    hashtags.ts       #cybersikkerhed + signal/keyword tags
    selectors-li.ts   LinkedIn composer selectors (en + da)
    poster.ts         Playwright compose + attach + submit
    post-flow.ts      browser lifecycle + ENTER-to-submit gate
  cli-cybernews.ts    cyber-news CLI: discover | fetch | post | status
test/                 unit + Playwright fixture-HTML integration tests
docs/                 selectors.md, cybernews-selectors-li.md, cybernews-glossary.md
```

Every source file is under 200 LOC.

## Install

```sh
npm install
npx playwright install chromium
```

Requires Node 20+.

## First-time login

```sh
npm run login
```

This opens Chromium against `linkedin.com/login`. Sign in **manually** in the
browser window (handle 2FA / "is this you?" prompts as a human). Cookies and
localStorage land in `./.profile/`. The script auto-closes when you reach the
feed.

Verify the saved login is still good:

```sh
npm run probe
```

## Dry run (always do this first)

```sh
npm run run:cleaner -- --dry-run --max=20
```

Prints which comment ids it would delete, plus a 140-char snippet of each.
No clicks happen. Use this to:

1. Confirm the saved login is still working.
2. Confirm the comment-card selector still finds the right elements.
3. Sanity-check the URN format hasn't changed.

If any of those fail, fix `src/selectors.ts` and re-run before going live.

## Real run

```sh
npm run run:cleaner -- --max=50
```

Watch the visible Chromium window. Hit `Ctrl-C` to stop at any point — state
is flushed after every action, so resume is just running the same command
again (already-processed ids are skipped automatically).

End of run prints a summary; `state/log.jsonl` has the per-action history.

`--limit=N` is accepted as an alias for `--max=N`.

## When something goes wrong

On any error the runner saves a diagnostic bundle to
`state/diagnostics/<ts>-<reason>/`:

- `screenshot.png` — full-page capture
- `page.html` — full DOM at the moment of failure
- `comment.html` — outerHTML of the targeted comment card (if any)
- `snapshot.txt` — accessibility tree
- `meta.json` — reason, URL, timestamps

Open the bundle, find the selector that broke, update `src/selectors.ts`,
`docs/selectors.md`, and `test/fixtures/comments.html`, re-run tests, then
resume.

## Tests

```sh
npm test         # full suite (unit + Playwright fixture-HTML)
npm run typecheck
```

The detector test loads a static fixture HTML with mock LinkedIn DOM into a
real Chromium and asserts comment IDs are extracted correctly. No network.

## Rate-limit defaults

| Knob               | Default     |
|--------------------|-------------|
| Inter-deletion     | 3.6–8.4 s   |
| Long break every   | 20 deletes  |
| Long-break length  | 30–90 s     |
| Hourly cap         | 200         |
| Daily cap          | 500         |
| Errors → 30m pause | 3           |
| Errors → abort     | 10          |

LinkedIn is stricter than X/Twitter, so defaults are noticeably more
conservative than `x-cleaner`. Tune via the `Scheduler` config in
`src/cli.ts` if you need to.

## Cyber-news poster (Danish)

Drive the cyber-news pipeline from the same persistent profile (one login covers
both surfaces).

```sh
# discover IDs newer than the high-water mark
npm run cyber-news -- discover --handle=IntCyberDigest

# fetch one tweet (text + classification + Danish hashtags + media)
npm run cyber-news -- fetch --id=<TWEETID> \
  --media-out=state/cybernews/media/<TWEETID>

# post one (after writing the Danish draft to state/cybernews/drafts/<TWEETID>.md)
npm run cyber-news -- post --id=<TWEETID> \
  --draft=state/cybernews/drafts/<TWEETID>.md \
  --media-dir=state/cybernews/media/<TWEETID> \
  --severity=zero-day
```

Defaults to a confirmation gate before clicking Post (type `go` to submit,
anything else aborts and records `skipped`). Pass `--auto-post` to skip the
gate.

The full loop, including translation and `/humanizer-da` passes, lives in the
[`/in-optimize:cyber-news`](plugins/in-optimize/skills/cyber-news/SKILL.md)
plugin skill. Pacing rule: 1 post / 2 hours, daily cap 8.

## Caveats

- Browser automation of your own account for content deletion sits in a grey
  area of LinkedIn's terms of service. Use a real account at your own risk.
- Selectors are an **initial best-guess**, not yet live-verified. First
  dry-run will tell you whether the comment-card selector still finds your
  comments — fix and update `docs/selectors.md` accordingly.
- No CAPTCHA solving, no proxy rotation, no headless-stealth tricks. If
  LinkedIn challenges you, the run aborts and you handle it as a human.
- LinkedIn's "Your activity → Comments" page only surfaces comments you've
  posted as the *commenter*. Replies to your own posts that you wrote
  yourself appear here too; replies *by others* on your posts do not (and
  this tool can't delete those).

## Docs

- [`docs/selectors.md`](docs/selectors.md) — comment-cleaner DOM reference (live-verified 2026-04-28)
- [`docs/cybernews-selectors-li.md`](docs/cybernews-selectors-li.md) — composer DOM reference (live-verified 2026-04-30)
- [`docs/cybernews-glossary.md`](docs/cybernews-glossary.md) — Danish cyber vocab + tone notes
- [`CLAUDE.md`](CLAUDE.md) — conventions for Claude when working in this repo
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — local setup, hooks, branch naming, PR checklist
- [`SECURITY.md`](SECURITY.md) — vulnerability reporting

## Author

**Babak Bandpey** — [cocode.dk](https://cocode.dk) | [LinkedIn](https://linkedin.com/in/babakbandpey) | [GitHub](https://github.com/cocodedk)

## License

Apache-2.0 | © 2026 [Cocode](https://cocode.dk) | Created by [Babak Bandpey](https://linkedin.com/in/babakbandpey)
