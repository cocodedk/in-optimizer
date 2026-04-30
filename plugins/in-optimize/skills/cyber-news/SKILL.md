---
description: Use when the user wants to translate a fresh @IntCyberDigest tweet (or any cybersecurity tweet) into a Danish LinkedIn post. Drives the discover → fetch → translate → /humanizer-da × 2 → confirm → post loop. Treats every cycle as one tweet at a time. Posting is gated behind explicit user confirmation.
---

# Cyber-news → LinkedIn (Danish)

Goal: turn cybersecurity news from `@IntCyberDigest` (or another handle) into a humanized Danish LinkedIn post, severity-shaped, with the original images, posted slowly through Playwright.

Trigger model: user runs the skill in a session. Each invocation = one batch of tweets (up to `--limit`, default 1). Cadence (one post per 2 hours) is the user's responsibility, either by re-invoking, or by `/loop` / `CronCreate` wrapping the skill.

## Cycle (one tweet)

1. **Discover** — `npm run cyber-news -- discover --json` lists IDs newer than the high-water mark in `state/cybernews/posted.json`.
2. **Pick one** — default = oldest of the new (FIFO). Skip retweets if `selfAuthored === false`.
3. **Fetch** — `npm run cyber-news -- fetch --id=<ID> --media-out=state/cybernews/media/<ID>` writes media to disk and prints text + classification + hashtags.
4. **Read & decide** — apply your judgment: is it worth posting at all? If not, mark `skipped` and move on.
5. **Translate to simple Danish** — write a draft sized by severity (see *Severity shapes* below). Use `docs/cybernews-glossary.md` for term choices. Save as `state/cybernews/drafts/<ID>.md`.
6. **Run `/humanizer-da` twice** — invoke the slash command on the draft file, twice in sequence. Each pass is independent; do not skip the second one.
7. **Append hashtags** — at the bottom of the post body, append the hashtags from step 3 (already includes `#cybersikkerhed`).
8. **Append source link** — bottom line: "Kilde: <tweet URL>".
9. **Confirm** — print the final draft + media list to the user. Wait for explicit "ja" / "go" / "post". Until v0.2 there is no auto-post.
10. **Post via Playwright** *(see "Posting" below — once wired)* — drives logged-in Chromium, attaches images, paces with `humanCursor`.
11. **Record** — call the state writer with `outcome: "posted"` and the LinkedIn URL.

## Severity shapes

The classifier in `src/cybernews/severity.ts` returns one of `info | notable | critical | zero-day`. Match the LinkedIn shape to it:

- **zero-day** — short and urgent. 1-line headline. 2 bullets (what / who's affected). 1 line CTA ("Patch i dag hvis du kører X."). Hashtags. Link.
- **critical** — 1 headline + 3-4 sentence summary + 1 line "hvad det betyder" + hashtags + link.
- **notable** — 4-6 sentence framing. Title-style first line + context + Danish-business-relevance + hashtags + link.
- **info** — longer educational tone: 6-10 sentences, what & why, action this week, hashtags, link.

Across all four: no em dashes, no " - " as a pause marker (humanizer-da hard rule).

## Posting (Playwright)

Wired. Lives in `src/cybernews/poster.ts` + `src/cybernews/selectors-li.ts` + `src/cybernews/post-flow.ts`. Drives the same `.profile/` user-data dir as the comment cleaner (one manual login covers both surfaces).

Invoke via:
```
npm run cyber-news -- post --id=<TWEETID> --draft=state/cybernews/drafts/<TWEETID>.md \
  --media-dir=state/cybernews/media/<TWEETID> --severity=<info|notable|critical|zero-day>
```

Default behavior:
- Mouse motion via `src/humanCursor.ts` (bezier path, jitter).
- Per-char keydown delay 35-95ms (jittered) for the body.
- Image/video attached from `state/cybernews/media/<ID>/` (sorted by filename).
- Pauses at the `press ENTER to submit` gate — the destructive click only happens after you confirm. Type `no` to abort and record `skipped`.
- Captures the resulting LinkedIn post URL from the success toast (or first-post permalink) into `posted.json`.
- `--auto-post` skips the gate (use only after a clean dry-run on the same draft).
- `--dry-run` prints the body + media list and records `dryrun` outcome without opening the browser.

Pacing rule (your responsibility, not the script's): cap 1 post / 2 hours, daily cap 8. The skill itself processes one tweet per invocation; the cadence comes from how often you re-trigger.

## State

`state/cybernews/`:
- `posted.json` — `{ id: { outcome, postedAt, severity, liUrl?, reason? } }`. Atomic flush on each step.
- `log.jsonl` — append-only audit.
- `media/<ID>/<ID>-N.<ext>` — downloaded images / videos.
- `drafts/<ID>.md` — intermediate draft (pre & post humanizer).

Outcomes: `posted` and `skipped` are terminal; `failed` is retryable; `dryrun` records preview-only runs.

## Files

```
src/cybernews/
  state.ts          ← posted.json + log.jsonl, BigInt high-water mark
  fetch.ts          ← syndication API, parser, media downloader
  discover.ts       ← timeline-profile parser (rate-limited)
  severity.ts       ← zero-day | critical | notable | info classifier
  hashtags.ts       ← #cybersikkerhed + signal/keyword tags, capped at 5
  poster.ts         ← (not yet) Playwright LinkedIn composer
  selectors-li.ts   ← (not yet) LinkedIn post composer selectors
src/cli-cybernews.ts ← thin CLI: discover | fetch | status
docs/cybernews-glossary.md ← Danish vocab + tone notes
```

All files ≤ 200 LOC.

## Safety rules

- The post step is destructive (visible to thousands of LinkedIn connections). **Never auto-post in v0.1.** Always confirm with the user before clicking Submit.
- Do not loosen the 1-post-per-2-hours cap without a stated reason. LinkedIn flags burst posting fast.
- Do not commit `state/cybernews/`. It contains drafts and downloaded media.
- Do not automate password / login. Reuse the same `.profile/` dir as the comment cleaner.
- Image rights: only repost images from public tweets, attribute via "Kilde: <url>".

## When the user says…

- **"check for new"** → run discover, print count + IDs.
- **"do the next one"** → full cycle on the oldest unprocessed ID, stop at the confirm gate.
- **"skip this"** → mark `skipped` with the reason, move to next.
- **"loop hourly" / "every 2 hours"** → wrap the skill in `/loop` or `CronCreate`. Don't auto-post; the loop still goes through the confirm gate. (Or wait until poster.ts is wired and add `--auto-post` then.)
- **"selectors broke"** → after poster.ts is wired, triage the diagnostic bundle in `state/cybernews/diagnostics/`.
