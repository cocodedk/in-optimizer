---
description: Use when the user wants to audit or edit their own LinkedIn profile (linkedin.com/in/me/). Default mode is read-only audit; editing only on explicit request and via the linkedin-profile-editor skill. The src/ code for this surface does not yet exist.
---

# Personal profile (design)

Status: **not implemented in `src/` yet.** Audits run by reading the page; edits delegate to the `linkedin-profile-editor` skill.

## Audit (default, read-only)

Sections to check:
- Headline — length, AI-tells, alignment with stated goals
- About — long-form; run through the `humanizer` skill first
- Experience — current + last 2 entries; check dates and descriptions
- Skills — top 5
- Open-to-work toggle state
- Featured items

For each: present? · length · AI-tells (em-dashes, "leverage/utilize", three-part lists) · gaps vs. the user's stated positioning.

## Edit (only on explicit request)

- Use the `linkedin-profile-editor` skill — LinkedIn is a React SPA with quirks that break standard Playwright patterns. Don't reinvent.
- One section per run. Show the diff. Wait for confirmation before submitting.
- Manual login is intentional — never automate the password flow.

## When to add `src/profileAudit.ts`

If the user asks to script the audit (read-only) so it runs end-to-end without Claude in the loop, add it as a slice mirroring `commentDetector.ts`:
- Pure DOM extraction, no edit actions
- Output JSON to `state/profile-<ts>.json`
- Reuse `browser.ts` and the `.profile/` user-data dir
- Profile selectors live in `src/selectors.ts` under a new `profile` block; document in `docs/selectors.md`.

## State / safety

- Reuse `.profile/` Chromium user-data dir (already gitignored).
- Selector misses → drop a diagnostic bundle under `state/diagnostics/<ts>-profile-<reason>/` matching the cleaner's pattern.
