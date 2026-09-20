# Firebase Production Connection / Deploy -- Result Report

Issue #87's production-connection follow-up. This is independent of, and does not touch, the
concurrently-running Progression Tuning 1 (PR #120) or the stopped Recipe Cooking Steps / Pizza
Cutting sessions -- no progression/economy/gameplay/scoring/recipe/save-schema file was read for
editing, only Firebase wiring and its own docs/report.

## PR Gate Check #1 (before work)

- `git fetch origin main` -> `origin/main` tip: `01d0176bf1ed84af9f41fa4f1bb03d527bebfc87` --
  matches this task's own reference SHA exactly (main had not moved).
- `list_pull_requests` (open, all): 6 open PRs found. Only one touches Firebase at all --
  none of them is a Firebase Production Connection PR:
  - #120 "Progression Tuning 1: fix star3-hard-cap permanent unlock block" (branch
    `claude/teto-progression-tuning-1-0wzz0f`) -- unrelated files (progression/gates), confirmed
    no overlap with this PR's changed files.
  - #105 (draft automation), #72 (docs sync), #46 (Dough Shaping D0 audit), #34 (ingredient
    visuals), #3 (docs) -- none Firebase-related.
- `search_pull_requests` for `firebase production` in title: 0 results.
- `git branch -a` / `git log --all --oneline` search for firebase-production-named branches:
  only this task's own designated branch (`claude/teto-pizza-firebase-production-wwo9di`)
  existed, at the same commit as `main` (0 commits ahead) -- no prior work to reuse or duplicate.
- **Audited main SHA: `01d0176bf1ed84af9f41fa4f1bb03d527bebfc87`.**

## Firebase project

- Project ID: `teto-pizza-game` (manually created, per this task's own description -- not
  created by this PR; no second project was created).
- Firestore: Native mode, database id `(default)`, region **`asia-northeast1` (Tokyo)**,
  Production mode, Blaze plan -- all manually configured, unchanged by this PR.
- Firebase Hosting: **not enabled** (confirmed not touched) -- production web hosting remains
  GitHub Pages (`https://perusonao.github.io/teto-pizza-game/`), per `firebase.json` (no
  `hosting` key) and this task's own instruction.

## Phase A: fresh audit findings

Fresh-read (not trusted from prior reports) `.github/workflows/deploy.yml`, `.env.example`,
`.firebaserc.example`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`,
`functions/src/*`, `src/firebase/*`, `src/shared/lunchRushScoring.ts`, `src/shared/
lunchRushPeriodIds.ts`, the setup doc, and the three prior Firebase result reports. Findings:

1. **Cloud Function region was unset** -- `functions/src/index.ts`'s `onCall(async (request) =>
   ...)` took no options, so the 2nd-gen Cloud Functions default (`us-central1`) applied. With
   Firestore now permanently in `asia-northeast1`, every submission would cross regions between
   the Function and its own Firestore writes. **Fixed** (see "Files changed" below).
2. **Client's `getFunctions()` call also had no region** -- `src/firebase/
   submitLunchRushScore.ts` called `getFunctions(app)` with no second argument, which targets
   the Functions SDK's own default region (`us-central1`). The Functions client SDK does not
   infer a callable's deployed region from its name; a client requesting the wrong region would
   fail to invoke a Function deployed to a different one. **Fixed to `asia-northeast1`**,
   matching the Function's own new deployed region.
3. **`deploy.yml`'s build step set no `VITE_FIREBASE_*` env** -- Phase 1A/1B explicitly deferred
   this exact wiring until "a production Firebase project exists" (setup doc section 6). It now
   does. **Fixed** (see Phase B below).
4. **`firebase.json`/`firestore.rules`/`firestore.indexes.json`**: audited, no change needed.
   `firebase.json` already has no `hosting` key (Hosting correctly never enabled) and the
   existing `functions`/`firestore`/`emulators` blocks are already correct for this project
   shape. `firestore.rules`' existing posture (client can never write `runs/*` or
   `leaderboards/*/entries/*`; only `weekly_*` reads are open) is unchanged and still correct --
   this task does not touch Phase 2A's access-control scope. `firestore.indexes.json`'s existing
   composite index already covers the weekly TOP10 query (Phase 2A's own section 25 finding,
   re-verified below), no new index needed.
5. **`.env.example` / `.firebaserc.example`**: both already correct templates; no change needed.
6. **Authorized domain**: not yet something this repo's code can verify (Console-only setting) --
   see "Firebase manual configuration required" below.

## Phase B: GitHub Pages Firebase config

`.github/workflows/deploy.yml`'s build step (`npm run build`) now reads four `env:` entries from
GitHub Actions repository secrets: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
`VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. No value is hard-coded into any source file
-- the workflow only references `${{ secrets.* }}`, which resolves to an empty string if a
secret is not yet created, and `src/firebase/config.ts`'s existing `getFirebaseConfig()` already
treats any-of-four-missing as "fully unconfigured" (verified: `npm run build` still succeeds
with no Firebase env set at all, exactly as before this PR -- see Test results below).

**GitHub repository settings the owner must create** (Settings -> Secrets and variables ->
Actions -> New repository secret), all four required together:

| Secret name | Value source |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console -> Project settings -> General -> Your apps -> Web app -> SDK config `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | same panel, `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | same panel, `projectId` (expected: `teto-pizza-game`) |
| `VITE_FIREBASE_APP_ID` | same panel, `appId` |

These are the public Web SDK config values (not Admin SDK/service-account credentials) -- see
`.env.example`'s own comment for why an `apiKey` is safe in a public bundle; they are stored as
Actions secrets purely to preserve this project's existing "no Firebase value hard-coded into
source" convention, not because the value itself is confidential.

## Phase C: Firebase deploy readiness

`firebase.json`'s existing architecture (functions + firestore rules/indexes + emulators, no
hosting) was reused as-is -- no restructuring needed. `.firebaserc` stays gitignored and
uncommitted (existing, intentional architecture -- see `.gitignore`'s own comment); a real
production mapping was deliberately **not** committed, to avoid reversing that established
per-environment-only pattern. Exact one-time setup command for whoever deploys, documented in
the setup doc's new section 27:

```bash
cp .firebaserc.example .firebaserc   # then set "default" to "teto-pizza-game"
# -- or, equivalently --
npx firebase-tools use --add   # interactively pick teto-pizza-game, alias "default"
```

No service-account JSON, private key, Firebase CLI token, or Admin SDK credential was created,
requested, or committed anywhere in this change.

## Commands run (local verification)

All run from a clean `npm ci`/`npm ci` (root, then `functions/`) against this PR's changes:

| Command | Result |
|---|---|
| `npm run lint` (root, oxlint) | pass, no output |
| `npm test` (root, vitest) | **1792/1792 tests passed**, 93 files (was 1791 before this PR's one new region-assertion test) |
| `npx tsc --noEmit -p .` (root) | pass, no output |
| `npm run build` (root, `tsc -b && vite build`) | pass -- succeeds with **no** `VITE_FIREBASE_*` env set (unconfigured-build safety net, re-verified unchanged) |
| `npm run typecheck` (functions) | pass, no output |
| `npm run lint` (functions, oxlint) | pass, no output |
| `npm test` (functions, vitest) | **32/32 tests passed** |
| `npm run build` (functions, esbuild) | pass -- built `lib/index.js` confirmed to contain `onCall({ region: "asia-northeast1" }, ...)` |
| `npm install --no-save @firebase/rules-unit-testing && npx firebase-tools emulators:exec --only firestore "npx vitest run --config vitest.rules.config.ts"` | **14/14 Firestore rules-emulator tests passed** (real emulator, Java 21 available in this environment) -- no rule was weakened; all existing scenarios (deny-all `runs`, `weekly_*`-only read, `monthly_*`/`all_all` still denied, all writes denied) still pass unchanged |

No test was skipped, disabled, or weakened to reach these results.

## Files changed

- `functions/src/index.ts` -- `onCall` now takes `{ region: "asia-northeast1" }`.
- `src/firebase/submitLunchRushScore.ts` -- `getFunctions(app)` -> `getFunctions(app,
  "asia-northeast1")` (a new `FUNCTIONS_REGION` constant), matching the Function's region.
- `src/firebase/submitLunchRushScore.test.ts` -- mock signature updated to accept/assert the
  region argument; one new test (`getFunctions` called with `(fakeApp, "asia-northeast1")`).
- `.github/workflows/deploy.yml` -- build step now passes the four `VITE_FIREBASE_*` values from
  `${{ secrets.* }}`.
- `docs/design/TETO_FIREBASE-RANKING_SETUP.md` -- new section 27 ("Phase 3A: real production
  connection") documenting the region decision, required GitHub secrets, `.firebaserc` setup
  command, CLI auth requirement, and the Authorized-domain requirement/exact Console path.
- `docs/reports/TETO_FIREBASE-PRODUCTION-CONNECTION_Result.md` -- this report (new file).

No progression/economy/gameplay/scoring/recipe/save-schema file was changed. No Recipe Cooking
Steps or Pizza Cutting file was touched.

## Cloud Function region: before / after

| | Before | After |
|---|---|---|
| `functions/src/index.ts` `onCall(...)` | no options -> 2nd-gen default `us-central1` | `{ region: "asia-northeast1" }` |
| `src/firebase/submitLunchRushScore.ts` `getFunctions(app)` | no region -> SDK default `us-central1` | `getFunctions(app, "asia-northeast1")` |
| Firestore (manually created, unchanged) | `asia-northeast1` | `asia-northeast1` (unchanged) |

## Firebase deploy results (Phase D)

**Not performed.** `npx firebase-tools login:list` in this environment reports "No authorized
accounts, run \"firebase login\"" -- no Firebase CLI session, no `GOOGLE_APPLICATION_CREDENTIALS`,
no `gcloud`/`firebase` config directory, and no CI token were present anywhere in this
environment (checked `env`, `~/.config/firebase`, `~/.config/gcloud` -- none exist). Per this
task's own instruction, this is the exact point to **stop** rather than improvise credentials.

**Exact one-time action the owner must perform**, from a machine/CI runner with real deploy
authority, once the four GitHub secrets above are also in place:

```bash
git fetch origin claude/teto-pizza-firebase-production-wwo9di
git checkout claude/teto-pizza-firebase-production-wwo9di
cp .firebaserc.example .firebaserc   # set "default": "teto-pizza-game"
npx firebase-tools login             # interactive human login (or a CI token/service account
                                      # via GOOGLE_APPLICATION_CREDENTIALS -- never committed)
npx firebase-tools use               # confirm the active project prints exactly "teto-pizza-game"
npx firebase-tools deploy --only firestore:rules,firestore:indexes,functions
```

After that authentication/deploy step, **continue the same Claude Code session** (this one) --
do not open a replacement session -- so Phase E's production verification can proceed against
the newly-deployed backend.

## Pages deploy result

Not performed by this PR -- `deploy.yml` deploys automatically on every push to `main`
(`on: push: branches: [main]`), and this PR does not push to `main` (never merges itself, per
this task's own "never auto-merge" instruction). Once this PR is merged (by the repo owner) with
the four GitHub secrets already in place, the very next Pages deploy will pick up the real
Firebase config automatically -- no further workflow change is needed.

## Production smoke-test result

Not performed -- blocked by the same Phase D gap (no live callable Function/Firestore backend is
reachable from this session yet, since nothing has been deployed to the real project). None of
items 1-11 in this task's own Phase E checklist (Pages loads, Firebase initializes, Anonymous
Auth succeeds, offline gameplay unaffected, Lunch Rush completes, `submitLunchRushScore` reaches
the deployed Function, server accepts a valid run, Firestore writes the authoritative entry,
weekly TOP 10 reads it back, no direct client score-write path, monthly/all-time reads stay
closed) could be exercised against production infrastructure that does not yet exist. Item 4
(offline gameplay unaffected) is indirectly covered by this PR's own full local test suite
passing unchanged (1792/1792) -- Firebase's client-side code paths were not touched in any way
that could affect the offline game loop.

## Security verification

- No service-account JSON, private key, Firebase CLI refresh/login token, or Admin SDK
  credential appears anywhere in this diff, this report, or any command output captured above
  (`git diff` scanned for `apiKey=<value>`, `private_key`, `BEGIN ... PRIVATE`,
  `service_account`, and a Firebase Web API key literal pattern -- none found; the only matches
  were this report's own prose mentioning "service-account" as a concept, not a value).
- `firestore.rules`' security posture is unchanged: `runs/*` stays fully read/write-denied to
  every client; `leaderboards/*/entries/*` stays write-denied to every client (the only trusted
  writer remains `submitLunchRushScore`'s Admin SDK path); only `weekly_*` reads are open,
  `monthly_*`/`all_all` stay closed -- re-verified against the real Firestore emulator (14/14
  tests passed, see Commands run).
- The browser still never gains authoritative Firestore score-write permission -- no
  `firebase/firestore` write call was added anywhere in `src/`, and `src/firebase/
  getWeeklyLeaderboard.ts` remains the only file importing `firebase/firestore` (read-only).
  `submitLunchRushScore.ts` still only invokes the Callable Function, unchanged except for its
  region argument.
- App Check was **not** configured (correctly deferred to a later Firebase Phase 3 task, per
  this task's own instruction).
- No second Firebase project was created; Firebase Hosting was not enabled.

## Remaining manual actions (owner)

1. Create the four GitHub Actions repository secrets listed in Phase B.
2. Add `perusonao.github.io` (bare hostname, no scheme, no path) to Firebase Console ->
   `teto-pizza-game` -> Authentication -> Settings -> Authorized domains. This is required for
   `signInAnonymously()` to succeed from the production GitHub Pages origin -- a custom domain is
   never auto-authorized the way a project's own `*.firebaseapp.com`/`*.web.app` domains are.
3. Authenticate a Firebase CLI session (human `firebase login` or a CI service-account/token) and
   run the exact deploy commands in "Firebase deploy results" above, confirming the active
   project is exactly `teto-pizza-game` before deploying.
4. After that deploy, and after this PR is merged (with the GitHub secrets already in place),
   perform Phase E's production smoke test manually or ask this session to continue it.

## Exact blockers

- **Blocker 1 (Phase D)**: no authenticated Firebase CLI session, GCP service-account, or CI
  token exists in this environment -- a real `firestore:rules`/`firestore:indexes`/`functions`
  deploy cannot be performed from here. Resolved by owner action #3 above.
- **Blocker 2 (Phase E)**: production smoke-testing depends on Blocker 1's deploy having
  happened first, plus the GitHub secrets (owner action #1) and Pages redeploy (automatic on
  merge) both being in place.

Both blockers are pre-existing environment/credential facts, not something introduced by this
PR's code changes -- all local, credential-free verification (lint/typecheck/test/build/rules
emulator, both root and `functions/`) passed cleanly.

## FINAL VERDICT: B. READY -- OWNER ACTION REQUIRED

All code/config changes needed for production connection are made, tested, and documented. Real
backend deployment and the GitHub secret/Authorized-domain setup are the remaining, unavoidably
manual/credentialed steps (Phase D/E) -- once those are done, production connection is complete
with no further code change expected.
