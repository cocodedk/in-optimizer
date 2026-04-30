---
description: Use when the user wants to translate a fresh @IntCyberDigest tweet (or any cybersecurity tweet) into a Danish LinkedIn post. Drives the discover → fetch → translate → /humanizer-da × 2 → confirm → post loop. Treats every cycle as one tweet at a time. Posting is gated behind explicit user confirmation. Self-arms a 2-hour cron on first invocation so the loop continues without a separate /loop call.
---

# Cyber-news → LinkedIn (Danish)

Goal: turn cybersecurity news from `@IntCyberDigest` (or another handle) into a humanized Danish LinkedIn post, severity-shaped, with the original images, posted slowly through Playwright.

## Step 0 — self-arm the 2-hour cron (every invocation)

Before doing anything else, ensure a recurring cron is scheduled so the loop continues without the user calling `/loop` separately.

1. Call `CronList`.
2. If any existing job's prompt starts with `/in-optimize:cyber-news`, **skip** — already armed.
3. Otherwise call `CronCreate` with:
   - `cron="0 */2 * * *"` (every 2 hours, on the hour, UTC by the local cron runner)
   - `prompt="/in-optimize:cyber-news"`
   - `recurring=true`
   - `durable=true` (persists to `.claude/scheduled_tasks.json` so it survives Claude restarts on the same machine)
4. Confirm to the user in one line: cron armed / cron already armed.

The cron only fires while a Claude REPL is running on this project. If the user closes Claude entirely, the loop stops. That's intentional — destructive posting needs a human at the confirm gate.

## Step 0.5 — daily-cap check (every invocation, before fetching)

Run `npm run cyber-news -- status --json` and read `postedToday` and `dailyCap`. If `postedToday >= dailyCap` (default 3), **stop the cycle**. Print one line: `daily cap reached (N/cap) — skipping this tick`. Do nothing else; the cron will fire again later, and tomorrow the count resets.

This avoids burning a discover/fetch quota on a cycle that can't post anyway. The CLI's `post` subcommand also enforces the cap at runtime (so a manual post or `--auto-post` cron tick can't bypass it without `--force`), but checking here saves the work.

## Cycle (one tweet)

1. **Discover** — `npm run cyber-news -- discover --json` lists IDs newer than the high-water mark in `state/cybernews/posted.json`.
2. **Pick one** — default = oldest of the new (FIFO). Skip retweets if `selfAuthored === false`.
3. **Fetch** — `npm run cyber-news -- fetch --id=<ID> --media-out=state/cybernews/media/<ID>` writes media to disk and prints text + classification + hashtags.
4. **Read & decide — strict curator rubric.** A tweet is worth a slot if **all three must-haves** hold:
   - **Novelty.** Not "another phishing campaign", not a vendor announcement, not a re-write of an older story you've already covered. Compare against the last 7 days of `state/cybernews/log.jsonl` to check.
   - **Audience fit.** A Danish dev, security lead, or IT manager would care. Generic US-only consumer-tech news doesn't pass.
   - **Teachable angle.** The post can land a concrete lesson, action, or root-cause insight — not just a headline paraphrase. If the best Danish version you can write is "X happened", skip.

   **Bonus signals** (push borderline candidates over the line): AI/ML-related, supply-chain, scales to many companies, has a memorable story hook (the goblin debugging post is a good example), or is a CVSS 9+ that affects tooling your audience uses.

   **Auto-skip** any of: vendor PR, routine vuln-of-the-week with no Danish-business angle, duplicate angle to the last 3 posts, marketing/conference/CFP announcements.

   If the tweet doesn't pass: don't write a draft; mark `skipped` with the reason in the log (`reason: "not-novel"`, `"audience-miss"`, `"no-teachable-angle"`, `"duplicate-angle"`, `"vendor-pr"`) via `state.markPosted(id, { outcome: "skipped", reason: ... })` and try the next candidate, OR end the cycle if no candidate qualifies.

5. **Translate to simple Danish** — write a draft sized by severity (see *Severity shapes* below). Use `docs/cybernews-glossary.md` for term choices. Save as `state/cybernews/drafts/<ID>.md`.
6. **Run `/humanizer-da` twice** — invoke the slash command on the draft file, twice in sequence. Each pass is independent; do not skip the second one.
7. **Append hashtags** — at the bottom of the post body, append the hashtags from step 3 (already includes `#cybersikkerhed`).
8. **Append source link** — bottom line: "Kilde: <tweet URL>".
9. **Confirm** — print the final draft + media list to the user. Wait for explicit "ja" / "go" / "post". Until v0.2 there is no auto-post.
10. **Post via Playwright** — drives logged-in Chromium, attaches images, paces with `humanCursor`.
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
- Pauses at the confirmation gate. Type `go` (or `y` / `yes` / `ja`) to submit. Anything else, including pressing ENTER alone or closing the terminal, aborts and records `skipped`.
- Captures the resulting LinkedIn post URL from the success toast (or first-post permalink) into `posted.json`.
- `--auto-post` skips the confirmation gate (use only after a clean dry-run on the same draft).
- `--dry-run` prints the body + media list and records `dryrun` outcome without opening the browser.
- `--daily-cap=N` overrides the 3-per-day cap (use `--daily-cap=0` to disable entirely).
- `--force` bypasses the daily cap for one run (one-off emergencies — say, a genuine zero-day on a day you've already used your slots).

Pacing rules:
- **Daily cap: 3 posts per local day** (enforced by both the skill at Step 0.5 and the CLI at runtime).
- **Inter-post pacing: ≥ 2 hours apart.** Self-armed by Step 0's cron. Closer than that and LinkedIn's burst-detection notices.

The 2-hour cron and the daily cap together mean at most 12 ticks per day, of which up to 3 land posts. The other 9 ticks become low-cost no-ops — they hit Step 0.5, see the cap is full or no novel candidates exist, and exit.

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
- **"loop hourly" / "every 2 hours"** → already self-armed by Step 0. To change cadence, edit the cron in `.claude/scheduled_tasks.json` or run `CronList` + `CronDelete` then `CronCreate` with the new expression.
- **"stop the loop"** → `CronList` to find the job ID, then `CronDelete` it. The skill itself doesn't auto-stop.
- **"selectors broke"** → after poster.ts is wired, triage the diagnostic bundle in `state/cybernews/diagnostics/`.
