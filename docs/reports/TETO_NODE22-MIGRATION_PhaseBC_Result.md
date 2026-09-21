# Teto Pizza Game — Node.js 20 → 22 Migration Phase B/C: Result

Issue: [#161](https://github.com/perusonao/teto-pizza-game/issues/161)
Fresh Audit SSOT: `docs/reports/TETO_NODE22-MIGRATION_Fresh-Audit.md` (Phase B/C, §11).
Phase A Result: `docs/reports/TETO_NODE22-MIGRATION_PhaseA_Result.md` (PR #164, merged).

## Audited main SHA

`e4e5c03c7903fd1d7d5dd7943915257717d04992` — PR #164 (Phase A) merge commit, fetched fresh via
`git fetch origin && git rev-parse origin/main` at the start of this session. This branch
(`claude/node22-migration-phase-bc-uuop7n`) was verified to contain this SHA as an ancestor before
implementation (`git merge-base --is-ancestor origin/main HEAD`), i.e. built directly on the latest
`main`, not a stale base.

## Duplicate Gate #1

Fresh GitHub search (`Node 22 OR Node22 OR engines.node OR node-version OR esbuild node22`) against
open issues/PRs returned only Issue #161 itself (this task's own issue) and the unrelated SSOT
Issue #22. **No existing open PR implements Phase B/C** — confirmed via `list_pull_requests`
(open, 6 results, none touching `functions/package.json`,
`.github/workflows/firebase-production-deploy.yml`, or any Node-22-migration branch/title).
Issue #157 (Lunch Rush RESULT → HOME, tracked via open PR #158, branch
`claude/lunch-rush-result-home-ln82nn`) touches `MissionResultOverlay`/`App.tsx`
navigation/CSS/tests — zero file overlap with this task's scope. **No conflict.**

## Changed files

- `functions/package.json`
- `.github/workflows/firebase-production-deploy.yml`

`functions/package-lock.json` was **not** changed — `npm ci` inside `functions/` produced zero
lockfile diff after the `engines.node` bump (confirmed via `git status`/`git diff --stat` before
and after), so no `engines` metadata update was required. No other files were touched.

## Before / After

### Functions runtime (`functions/package.json`)

| Field | Before | After |
|---|---|---|
| `engines.node` | `"20"` | `"22"` |
| `scripts.build` esbuild `--target` | `node20` | `node22` |

### Functions esbuild target

Same as above — bundled in the same PR/file per the Fresh Audit's Phase B scope (§4/§11), no other
esbuild option changed, no dependency version changed.

### Firebase deploy runner (`.github/workflows/firebase-production-deploy.yml`)

| Field | Before | After |
|---|---|---|
| `actions/setup-node@v4` `node-version` | `20` | `22` |

No other line in this workflow changed. `workflow_dispatch`, the `production` Environment gate,
WIF (`google-github-actions/auth@v2`), the manual reviewer approval, `FIREBASE_PROJECT_ID`
hardcode, `target` selection (`functions`/`firestore`/`all`/`verify`), `permissions:`,
`FIREBASE_TOOLS_VERSION: "15.26.0"` pin, and the JDK 21 Firestore-emulator setup are all byte-
identical to before (confirmed by the diff below).

```diff
--- a/.github/workflows/firebase-production-deploy.yml
+++ b/.github/workflows/firebase-production-deploy.yml
@@ -55,7 +55,7 @@ jobs:

       - uses: actions/setup-node@v4
         with:
-          node-version: 20
+          node-version: 22
           cache: npm
```

## Node 22 environment

- `node --version`: `v22.22.2`
- `npm --version`: `10.9.7`

Native install, not emulated/switched — same environment used throughout this session for every
verification step below.

## Functions verification (all under Node 22)

- **`npm ci`** (`functions/`, after `rm -rf node_modules`): succeeded, 287 packages installed, 0
  lockfile diff (`git status`/`git diff --stat functions/package-lock.json` both clean before and
  after).
- **`npm run typecheck`** (`tsc --noEmit -p tsconfig.json`): clean, zero errors. (First attempt
  failed with `Cannot find module 'vitest'` for the three `../src/shared/*.test.ts` files
  `functions/tsconfig.json` includes — root-level `node_modules` was not yet installed at that
  point; root `npm ci` below resolved it. Not a Node-22-specific issue.)
- **`npm run lint`** (`oxlint src`): clean, zero findings.
- **`npm test`** (`vitest run`): **72/72 tests passed**, 3 test files
  (`src/periodIds.test.ts`, `src/setDisplayName.test.ts`, `src/submitLunchRushScore.test.ts`),
  431ms. `setDisplayName`/`submitLunchRushScore` test suites both confirmed present and green.
- **`npm run build`** (esbuild, `--target=node22`, after `rm -rf lib`): succeeded,
  `lib/index.js` 13.3kb, "Done in 5ms". Output generated correctly under the new Node 22 esbuild
  target.

## Root regression (all under Node 22)

- **`npm ci`** (root, after confirming `node_modules` was absent): succeeded, 210 packages
  installed, 0 vulnerabilities, 0 lockfile diff.
- **`npx vitest run src/shared`** (focused shared-contract regression — the code
  `functions/` actually imports at build time, per `firebase-production-deploy.yml`'s own
  `root -- src/shared scoped test` step): **56/56 tests passed**, 3 test files
  (`displayNameValidation.test.ts`, `lunchRushPeriodIds.test.ts`, `lunchRushScoring.test.ts`).
- **`npm run lint`** (`oxlint`): clean, zero findings.
- **`npm test`** (full Vitest suite): **2088/2088 tests passed**, 112/112 test files, ~64s. (The
  repeated `Not implemented: HTMLCanvasElement's getContext()` jsdom console lines are pre-existing
  jsdom environment noise, unrelated to Node version — the same behavior Phase A's Result report
  documented, not a regression.)
- **`npm run build`** (`tsc -b && vite build`): succeeded, zero typecheck errors, `dist/` produced,
  130 modules transformed, built in ~1.17s. Same pre-existing "chunk larger than 500 kB" advisory
  warning as Phase A, unrelated to this migration.
- **`npm run test:e2e`** (Playwright): **30/30 tests passed** across both configured viewport
  projects (`iphone-390x844`, `iphone-360x800`), ~48s, using the pre-installed Chromium.

## Firestore Rules emulator

Run exactly as `firebase-production-deploy.yml`'s own `firestore -- rules emulator test` step does
(same command, same pinned `firebase-tools@15.26.0`, same Java version):

- **Java**: OpenJDK 21.0.10 (`openjdk version "21.0.10"`) — matches the workflow's own
  `actions/setup-java@v4` `java-version: "21"` pin, per the repo's existing policy (§11 of the
  original task).
- **Command**: `npx firebase-tools@15.26.0 emulators:exec --only firestore --project
  teto-pizza-game "npx vitest run --config vitest.rules.config.ts"`.
- **Result**: **22/22 tests passed** in 4.42s. `firebase projects:list`/production auth calls were
  never reached — this command only starts the local Firestore emulator (downloaded
  `cloud-firestore-emulator-v1.22.0.jar`) and runs rules tests against it; the CLI's own
  "not currently authenticated" warning is expected and harmless for local-emulator-only use, since
  no production Firebase project was contacted, read, or written to at any point.
- `firestore-debug.log` (gitignored, `*.log` in `.gitignore`) was generated locally and removed
  after the run — never staged/committed.

## Workflow invariants (static verification)

Confirmed unchanged by direct diff inspection of
`.github/workflows/firebase-production-deploy.yml` (see the Before/After diff above — the *only*
changed line is `node-version: 20` → `22`):

- `workflow_dispatch` (with its `target` choice input `functions`/`firestore`/`all`/`verify`):
  unchanged.
- `production` Environment gate (`environment: production`): unchanged.
- WIF (`google-github-actions/auth@v2`, `workload_identity_provider`/`service_account` from repo
  vars, no long-lived credential): unchanged.
- Manual reviewer approval: unchanged (governed by the `production` Environment's own GitHub
  settings, not touched by this diff).
- `FIREBASE_PROJECT_ID: teto-pizza-game` hardcode + non-`workflow_dispatch`-input guard: unchanged.
- Target selection (`functions`/`firestore`/`all`/`verify` conditional steps): unchanged.
- Functions verification steps (`typecheck`/`lint`/`test`/`build`) and Firestore verification step
  (JDK 21 setup + rules emulator test): unchanged.
- `FIREBASE_TOOLS_VERSION: "15.26.0"` pin: unchanged.
- Project-id guard preflight (`firebase projects:list --project "$FIREBASE_PROJECT_ID"`): unchanged.
- `permissions:` block (`contents: read`, `id-token: write`): unchanged.
- IAM/WIF provider/service-account configuration itself (repo/org-level `vars`): not touched by
  this PR at all (this workflow only *references* those vars, never defines them).

## Firebase production mutation

**NONE.** No `firebase deploy`, `gcloud functions deploy`, `gcloud run deploy`, production
Firestore write, IAM change, WIF change, production Environment change, or Cloud Run traffic change
was performed at any point in this session. `firebase-production-deploy.yml` was not dispatched.
The only Firebase CLI interaction in this session was the local-only Firestore rules emulator run
above (§ Firestore Rules emulator), which never authenticates against or contacts the real
`teto-pizza-game` production project.

## Human Verification

**N/A.** Per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`: this is a Node runtime/config
migration only — `functions/package.json` (`engines.node`, esbuild `--target`) and
`.github/workflows/firebase-production-deploy.yml` (`setup-node` pin). Zero changes to
`src/**` (frontend game code), Firestore schema/rules/indexes, or any player-visible gameplay/UI
behavior — confirmed by the diff itself (2 files, both non-`src/` config) and by the full local
Vitest/Playwright regression suites passing byte-identically to their pre-change baseline
(2088/2088, 30/30, matching Phase A's own counts).

## Scope Guard confirmation

No changes were made to: Firebase application code (`functions/src/**` is untouched —
`setDisplayName`/`submitLunchRushScore` handler logic, Firestore schema, Firestore rules/indexes,
IAM, WIF, production Environment settings, ranking/score/player-profile semantics, Lunch Rush
gameplay, CUT, economy, recipe data, or any UI/CSS. Dependency versions in both `package.json`
files are unchanged (only `engines.node` and the esbuild `--target` string changed — no
`dependencies`/`devDependencies` version bump).

## Duplicate Gate #2

Immediately before finalizing: `git fetch origin` re-run, `origin/main` confirmed unchanged at
`e4e5c03c7903fd1d7d5dd7943915257717d04992` (no new commits landed during this session — this
branch's base is still the current `main` HEAD, `git merge-base --is-ancestor origin/main HEAD`
still true). A fresh PR/issue search
(`Node 22 OR Node22 OR engines.node OR node-version OR esbuild node22`) confirmed no other open PR
implements this same Phase B/C change. **PASS.**

## Phase D/E remaining work

Not started in this session, per this task's own explicit "production Firebase deployを絶対に実行
しない" guard. Per the Fresh Audit's Phase plan (§11):

- **Phase D** — manual, gated `workflow_dispatch` of `firebase-production-deploy.yml` against
  `main` (`target: functions` first, not `all`) through the existing `production` Environment + WIF
  reviewer gate, unchanged by this migration. This is the phase that actually redeploys
  `setDisplayName`/`submitLunchRushScore` onto the Node 22 runtime in production.
- **Phase E** — production smoke test confirming both Functions respond correctly on the new
  runtime and the deployed Cloud Run revision reports `nodejs22`.

Both phases require this PR to first be Fresh-Reviewed and merged to `main` by the user/ChatGPT, per
this task's own explicit instruction — **not performed or implied complete by this session.**
