# Contributing to in-optimizer

## Local Setup

1. Install Node.js ≥ 20 and npm.
2. Clone the repo, then:
   ```sh
   npm install
   npx playwright install chromium
   ```
3. Install the git hooks once:
   ```sh
   ./scripts/install-hooks.sh
   ```

## Local Git Setup (recommended, run once)

```sh
git config pull.rebase true
git config core.autocrlf input          # use 'true' on Windows
git config push.autoSetupRemote true
git config init.defaultBranch main
```

## Build, Test, Lint

```sh
npm run typecheck   # TypeScript strict-mode check
npm test            # Vitest unit + integration tests
```

The pre-commit hook runs both. If something fails, fix it; never bypass with `--no-verify`.

## Coding Style

- Strict TypeScript ESM. `noUncheckedIndexedAccess` is on.
- **200-line maximum per source file.** Split into helpers when approaching the limit.
- No selector strings inline in `runner.ts` / `delete.ts` — they live in `src/selectors.ts` with a doc-paired entry in `docs/selectors.md`.
- See [CLAUDE.md](CLAUDE.md) for the full architectural conventions.

## Branch Naming

Branches use kebab-case with a Conventional-Commit-aligned prefix:

| Prefix | Commit type | Example |
|---|---|---|
| `feature/` | `feat:` | `feature/post-cleaner` |
| `fix/` | `fix:` | `fix/stale-trigger-selector` |
| `chore/` | `chore:` | `chore/update-deps` |
| `docs/` | `docs:` | `docs/selectors-update` |
| `refactor/` | `refactor:` | `refactor/extract-locate-card` |
| `ci/` | `ci:` | `ci/add-dependabot` |

Never commit directly to `main` — always open a PR.

## Commit Messages

Conventional Commits is enforced by `.githooks/commit-msg`:

```
<type>(<optional scope>): <description>
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `ci`, `build`, `perf`, `revert`.

## PR Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] If a selector changed: `src/selectors.ts`, `docs/selectors.md`, and `test/fixtures/comments.html` updated together.
- [ ] No file exceeds 200 lines.
- [ ] Manual dry-run on a real account if a DOM-facing module changed (`runner.ts`, `delete.ts`, `commentDetector.ts`, `scroll.ts`).
- [ ] Updated docs if behavior changed.
