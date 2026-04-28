---
description: Use when the user wants to audit or edit a LinkedIn company profile they admin (linkedin.com/company/<slug>/admin/). Requires admin rights on the active Chromium session. The src/ code for this surface does not yet exist.
---

# Company profile (design)

Status: **not implemented in `src/` yet.** Admin UI differs from the member UI — selectors and flows are distinct from personal-profile.

## Pre-flight (always)

1. Ask the user which company `<slug>`. There is no `/me` equivalent for companies.
2. Confirm the active `.profile/` Chromium session is signed in as an admin of that page. If not, bail and ask the user to switch.

## Audit (default, read-only)

Sections:
- Tagline, About, Specialties, Website, Industry, Company size
- Logo + cover image present
- Featured posts (last 5)

Flag:
- Stale dates, broken links, missing fields
- AI-tells in About copy — run through the `humanizer` skill
- Contradictions with the user's *personal* profile positioning if both belong to this user

## Edit (only on explicit request)

- Reuse `src/browser.ts` — don't spin a second browser config.
- Admin-UI DOM differs from member-UI. Add a `company` block in `src/selectors.ts` (separate from a personal `profile` block). Document in `docs/selectors.md`.
- One field per run. Show the diff. Wait for confirmation.
- Use `humanCursor.ts` for click sequencing — the admin UI has more hover-revealed controls.

## State / safety

- Same `state/diagnostics/<ts>-company-<reason>/` bundle pattern on selector miss.
- Audit any diagnostic bundle before sharing — admin pages can leak company financials, employee data, or unpublished posts.
