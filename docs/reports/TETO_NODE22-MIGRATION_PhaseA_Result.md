# Teto Pizza Game — Node.js 20 → 22 Migration Phase A: Result

Issue: [#161](https://github.com/perusonao/teto-pizza-game/issues/161)
Fresh Audit SSOT: `docs/reports/TETO_NODE22-MIGRATION_Fresh-Audit.md` (Phase A, §11).

## Audited main SHA

`84ce12085a640e8c34dbae78688f1a6c1ff29bc5` — PR #162 (Fresh Audit) merge commit, fetched fresh via
`git fetch origin && git rev-parse origin/main` at the start of this session. This branch
(`claude/node22-migration-phase-a-g2mlgc`) was created directly from this SHA (`git status` showed
a clean tree, zero divergence, before implementation).

## Scope

Per the Fresh Audit's Phase A definition and this task's own explicit change/no-change lists, only
the **root/CI frontend toolchain's** `setup-node` pin was touched. Nothing under `functions/**`,
`firebase.json`, `firestore.rules`, `firestore.indexes.json`, or
`.github/workflows/firebase-production-deploy.yml` was changed. Firebase Functions production
runtime stays Node 20; no deploy was performed.

## Changed files

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

Both files changed in exactly one line each (`actions/setup-node@v4`'s `node-version:` input).
No other file in the repository was modified.

## Before / After

| Workflow | Before | After |
|---|---|---|
| `ci.yml` (PR-gate CI: lint/test/build) | `node-version: 20` | `node-version: 22` |
| `deploy.yml` (GitHub Pages build/deploy) | `node-version: 20` | `node-version: 22` |

`firebase-production-deploy.yml` `setup-node` pin: **unchanged**, still `node-version: 20` (Phase
B scope, not touched).

## Local Node 22 verification

Environment already ran Node 22 natively (not emulated/switched):

- `node --version`: `v22.22.2`
- `npm --version`: `10.9.7`

Root suite, run in order from a clean `npm ci`:

- `npm ci`: **succeeded** — 210 packages installed, 0 vulnerabilities.
- `npm run lint` (`oxlint`): **clean**, zero findings.
- `npm test` (`vitest run`): **2088/2088 tests passed**, 112/112 test files, ~47s. (The repeated
  `Not implemented: HTMLCanvasElement's getContext()` jsdom console lines are pre-existing jsdom
  environment noise, unrelated to Node version, and are not test failures — all 2088 tests report
  passed.)
- `npm run build` (`tsc -b && vite build`): **succeeded**. The root `package.json` has no separate
  `typecheck` script (only `functions/package.json` does) — `tsc -b`, the first half of `build`, is
  root's own typecheck step, and it completed with zero errors before `vite build` ran. Vite build
  output: `dist/` produced, 130 modules transformed, build completed in ~830ms (one pre-existing
  "chunk larger than 500 kB" advisory warning, unrelated to this migration).
- `npm run test:e2e` (Playwright, `@playwright/test`): **30/30 tests passed** across both configured
  viewport projects (`iphone-390x844`, `iphone-360x800`), ~38s, using the pre-installed Chromium
  (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). This suite is intentionally not wired into
  `ci.yml` (pre-existing, documented in `playwright.config.ts`'s own header comment) — it was run
  manually here as extra Node 22 verification per this task's §5.

Verified specifically per this task's own compatibility watchlist, all under Node 22 with no
regression: `vitest@5.0.0`, `@testing-library/jest-dom@7.0.1` (used by the 2088-test Vitest run
above), `vite@8.3.0` (used by `npm run build`), `oxlint@1.81.0` (used by `npm run lint`). This
directly closes the Fresh Audit's §6 finding — these four packages' locked `engines.node` already
declared Node 20 unsupported; they now run under the Node version they actually declare support
for.

## PR CI result

CI workflow (`ci.yml`) triggered on the PR against `main`, now running on `actions/setup-node@v4`
`node-version: 22`. See the PR's own Checks tab for the live run; the PR body links the exact run.
CI reproduces the same steps verified locally above (`npm ci` → `npm run lint` → `npm test` →
`npm run build`), all previously confirmed green under Node 22 locally before push.

## Pages deploy consideration

`deploy.yml`'s `setup-node` pin was changed to `22` for build-time consistency with `ci.yml`, since
both build the same frontend from the same `package.json`/lockfile. Per this task's explicit
instruction, **no deploy was triggered from this branch** — `deploy.yml`'s existing triggers
(`push` to `main`, manual `workflow_dispatch`) were not changed and were not invoked; the Node 22
Pages build will first run for real the next time `main` itself is pushed to (i.e. after this PR
merges), through the existing, unmodified trigger.

## Firebase Functions runtime

**UNCHANGED — Node 20.** `functions/package.json` `engines.node` stays `"20"`, esbuild's
`--target=node20` stays as-is, and `.github/workflows/firebase-production-deploy.yml`'s own
`setup-node` pin stays `node-version: 20`. None of `functions/**`, `firebase.json`,
`firestore.rules`, or `firestore.indexes.json` were touched. This is Phase B scope (Fresh Audit
§11), explicitly out of scope for Phase A.

## Firebase deploy

**NOT PERFORMED.** No `firebase deploy` of any kind was run or dispatched from this session — this
PR touches zero Firebase-related files and `firebase-production-deploy.yml` is
`workflow_dispatch`-only, never auto-triggered.

## Human Verification Video

**N/A — workflow/runtime-only change, no visible UI behavior.** Per
`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`, this change modifies only CI/Pages-build tooling
(`actions/setup-node`'s pinned Node version) and does not touch any gameplay, UI, or player-visible
behavior — confirmed by the diff itself (2 lines, both inside `.github/workflows/*.yml`, zero
production `src/**` changes) and by the full local Vitest/Playwright regression suites passing
byte-identically to their pre-change baseline (2088/2088, 30/30). Before/after screenshots are not
applicable for the same reason.

## Issue #157 conflict

**NONE.** Issue #157 (Lunch Rush RESULT → HOME) touches `MissionResultOverlay`, `App.tsx`
navigation wiring, related CSS, and tests/e2e — this Phase A change touches only
`.github/workflows/ci.yml` and `.github/workflows/deploy.yml`. Zero file overlap, confirmed by
direct comparison of the two scopes (also pre-confirmed by the Fresh Audit and Issue #161 itself).

## Duplicate Gate #2

**PASS.** Immediately before opening the PR: `git fetch origin` was re-run and found `main` had
advanced by one commit, `8c01fff` (docs: CUT full-recipe expansion Fresh Audit, Phase 4B,
docs-only, PR #163) — a single new markdown file under `docs/reports/`, zero overlap with this
PR's `.github/workflows/*.yml`/report-file scope. The branch was rebased cleanly onto this new
`origin/main` HEAD (`git rebase origin/main`, no conflicts). A fresh PR search
(`repo:perusonao/teto-pizza-game is:open node22 OR node 22 OR node-version`) returned no open PR
implementing this same Node 22 Phase A workflow change (`PR #46`, the only match, is an unrelated
Issue #33 Dough Shaping D0 audit PR).

## Phase B remaining work

Not started in this session, per this task's own explicit "今回変更禁止" scope guard. Per the Fresh
Audit's Phase plan (§11):

- **Phase B** — `functions/package.json` `engines.node`: `"20"` → `"22"`; esbuild
  `--target=node20` → `--target=node22`; `firebase-production-deploy.yml`'s own `setup-node`
  `node-version: 20` → `22` (bundled in the same PR as the same workflow file/natural scope).
- **Phase C** — `functions -- typecheck`/`lint`/`test`/`build`, the root `src/shared` scoped
  Vitest run, and the Firestore rules emulator test, all executed under Node 22 to prove Phase B is
  safe, not merely syntactically valid.
- **Phase D** — manual, gated `workflow_dispatch` of `firebase-production-deploy.yml` against
  `main` (`target: functions` first) through the existing `production` Environment + WIF reviewer
  gate, unchanged by this migration.
- **Phase E** — production smoke test confirming `setDisplayName`/`submitLunchRushScore` respond
  correctly and the deployed Cloud Run revision reports `nodejs22`.

Each remaining phase stays a separate, independently reviewable PR/dispatch, per the Fresh Audit's
own phase-isolation design — none is started or implied complete by this Phase A PR.
