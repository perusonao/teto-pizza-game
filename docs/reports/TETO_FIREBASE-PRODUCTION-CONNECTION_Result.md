# Firebase Production Connection / Deploy -- Result Report

Issue #87's production-connection follow-up. This is independent of, and does not touch, the
concurrently-running Progression Tuning 1 (PR #120), Recipe Cooking Steps Phase 0 (PR #122), or
Pizza Cutting Phase 0 (PR #123) -- no progression/economy/gameplay/scoring/recipe/save-schema/
cooking-steps/pizza-cutting file was read for editing, only Firebase wiring and its own
docs/report.

This report covers two sessions: **Session 1** (below, through "FINAL VERDICT: B. READY --
OWNER ACTION REQUIRED") produced PR #121's original code changes. **Session 2** (new section
right below) resumed the same PR after the owner completed the GitHub Secrets setup, and
attempted the real deploy / production smoke test. See "Session 2" for the current, up-to-date
status and Final Verdict -- Session 1's own verdict below is superseded.

## Session 2: resume, rebase, deploy attempt, network findings

### PR Gate Check #1 (Session 2, before any change)

- `git fetch origin` -- fresh, not trusting the prior session's recorded SHA. `origin/main` tip:
  **`ff591ebaea40095c5a25ea52797be9d3fd2b5538`** ("Pizza Cutting 1.0 Phase 0: fresh design
  (#123)"), one commit ahead of that: `8d6109b` ("Recipe Cooking Steps 1.0 Phase 0: fresh
  architecture audit (#122)"). Both merged since Session 1's audit.
- `list_pull_requests` (open): PR #121 confirmed **still open**, not closed/merged/superseded --
  continuing it, no new PR created. No other open PR touches Firebase or overlaps this scope.
- PR #121 state before this session's changes: head `17672f50f145a275552229bf549aa8cbbd8fcd4d`,
  base recorded as `bdc0be38e4b61cbd955c02b930342617c42eda32` (main's tip when Session 1 opened
  it) -- i.e. two commits behind current `main`.
- `git diff bdc0be3..origin/main --stat`: only 4 new files, all docs (`docs/design/
  TETO_PIZZA-CUTTING_1.0.md`, `docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md`, and their two
  result reports) -- **zero overlap** with PR #121's changed files (`.github/workflows/
  deploy.yml`, `docs/design/TETO_FIREBASE-RANKING_SETUP.md`, `functions/src/index.ts`,
  `src/firebase/submitLunchRushScore.ts`, `src/firebase/submitLunchRushScore.test.ts`, this
  report). No Cooking Steps or Pizza Cutting file was read for editing.

### Rebase / merge onto latest main

`git merge origin/main` on `claude/teto-pizza-firebase-production-wwo9di` -- clean, **zero
conflicts** (confirmed by the no-overlap check above). PR #121's own scope was untouched by the
merge; only the four new doc files from #122/#123 were pulled in.

`git diff origin/main...HEAD --stat` after the merge, verified to contain **only** PR #121's own
6 files, exactly matching this task's expected scope:

```
.github/workflows/deploy.yml                                     | 13 ++
docs/design/TETO_FIREBASE-RANKING_SETUP.md                       | 69 ++++++
docs/reports/TETO_FIREBASE-PRODUCTION-CONNECTION_Result.md        | (this report)
functions/src/index.ts                                            |  6 +-
src/firebase/submitLunchRushScore.test.ts                         | 22 +-
src/firebase/submitLunchRushScore.ts                              |  8 +-
```

Pushed: PR #121 head moved from `17672f50f145a275552229bf549aa8cbbd8fcd4d` to
**`c88ce5cbe499d9e6e4f2289bd5f4b93c529ba1d5`**. PR #121's `base.sha` now reads
`ff591ebaea40095c5a25ea52797be9d3fd2b5538` -- fully caught up with `main`.

### Pre-deploy verification (re-run after rebase, fresh `npm ci`)

| Command | Result |
|---|---|
| `npm run lint` (root, oxlint) | pass, no output |
| `npx tsc --noEmit -p .` (root) | pass, no output |
| `npm test` (root, vitest) | **1793/1793 tests passed**, 93 files |
| `npm run build` (root) | pass -- succeeds with no `VITE_FIREBASE_*` env set |
| `npm run typecheck` (functions) | pass, no output |
| `npm run lint` (functions, oxlint) | pass, no output |
| `npm test` (functions, vitest) | **32/32 tests passed** |
| `npm run build` (functions, esbuild) | pass -- `lib/index.js` confirmed to contain `onCall({ region: "asia-northeast1" }, ...)` |
| Firestore rules emulator (`firebase-tools emulators:exec --only firestore "vitest run --config vitest.rules.config.ts"`) | **14/14 passed**, no rule weakened |

All green -- no regression from the #122/#123 merge (expected: doc-only files, no code touched).
GitHub Actions `build` check on PR #121's new head (`c88ce5c`) was triggered by the push and was
`pending` at last check (prior head's `build` check had completed `success`); this report's
Final Verdict does not depend on that check finishing, since it reruns the exact same commands
already verified locally above.

### GitHub Secrets

Owner confirmed the following four repository secrets are now configured in GitHub Settings ->
Secrets and variables -> Actions: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
`VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. **GitHub Secrets configured: YES.** No value
was displayed, logged, or committed anywhere by this session -- their presence was taken as
reported, not independently re-derived (this session has no way to read a secret's value, by
GitHub's own design).

### Firebase CLI authentication status

`npx firebase-tools --version` -> `15.30.2` (present). `npx firebase-tools login:list` ->
`No authorized accounts, run "firebase login"` -- **not authenticated**. No
`GOOGLE_APPLICATION_CREDENTIALS`, no `~/.config/gcloud`, no `~/.config/firebase` existed in this
environment either.

Per this task's own instruction, no service-account/token was generated to work around this.
Instead, an interactive login was attempted (`npx firebase-tools login --no-localhost`, the
device-code-style flow that doesn't need a local browser) to see whether a safe interactive login
was even reachable from this environment. It failed immediately:

```
Error: Failed to start login: Failed to make request to https://auth.firebase.tools/attest
```

### Network policy finding (new, not present in Session 1)

Probed this session's outbound network policy directly (`curl` against each host, plus the
proxy's own status endpoint) to find out *why* login failed, rather than assuming "just
unauthenticated" again. Result -- these hosts are **blocked by this environment's own egress
policy** (confirmed via the proxy's `recentRelayFailures` log, each a `403` "policy denial", not
a DNS/TLS/credential problem):

| Host | Result | Relevance |
|---|---|---|
| `auth.firebase.tools` | **blocked (403)** | `firebase login` / `firebase login:ci` cannot start at all |
| `firebase-public.firebaseio.com` | **blocked (403)** | Firebase CLI's own config/update-check traffic |
| `perusonao.github.io` | **blocked (403)** | the production Pages site itself is unreachable from this session |
| `asia-northeast1-teto-pizza-game.cloudfunctions.net` | **blocked (403)** | the deployed callable's own invoke URL is unreachable from this session |
| `identitytoolkit.googleapis.com`, `firestore.googleapis.com`, `firebase.googleapis.com`, `cloudfunctions.googleapis.com` | reachable (plain `404` at path `/`, i.e. TLS+HTTP connected fine) | these are the *management*-API hosts `firebase deploy` itself talks to |

The proxy's own documentation (`/root/.ccr/README.md`) is explicit that a 403/407 from the proxy
is an organization policy decision -- "Do not retry or route around it -- report the blocked
host" -- so no workaround was attempted (no alternate host, no disabling TLS verification, no
unsetting `HTTPS_PROXY`).

**What this means concretely:**
- `firebase login` cannot succeed from this session under any credential, because the login
  handshake itself needs `auth.firebase.tools`, which is blocked at the network level, not an
  auth-token level.
- Even a supplied CI token could not fully close this task: real deploy calls (`firebase
  deploy`) route through the reachable `*.googleapis.com` hosts and might work with a token, but
  Phase E's production smoke test needs to reach `perusonao.github.io` (the site itself) and the
  deployed Function's `*.cloudfunctions.net` invoke URL -- both independently blocked, unrelated
  to any credential. So neither an owner-supplied token nor a service account resolves Phase E's
  blocker.
- This is a network capability limit of this session's own container, not a credential gap, not
  a security concern with the code, and not something introduced by this PR.

### Deploy result (Phase D)

**Not performed.** Blocked as above -- `firebase login` cannot reach its own auth endpoint from
this session, so no authenticated Firebase CLI session could be established here, regardless of
credential source. `firestore:rules` / `firestore:indexes` / `functions` deploy to
`teto-pizza-game` was not attempted (running an unauthenticated `firebase deploy` would only
fail, and Project Safety rules require confirming the active project first, which itself
requires being logged in).

- **Rules deploy: not performed.**
- **Indexes deploy: not performed.**
- **Functions deploy: not performed.**
- **Functions region**: unchanged from Session 1's code fix -- `asia-northeast1`, confirmed
  compiled into `functions/lib/index.js` (`onCall({ region: "asia-northeast1" }, ...)`) by this
  session's own fresh `npm run build` above. Not yet *live* in the real project, since no deploy
  has happened.

### GitHub Pages deploy result

Not performed by this PR/session -- `deploy.yml` only deploys on a push to `main`
(`on: push: branches: [main]`), and this session does not merge PR #121 into `main` (never
auto-merge, per this task's own instruction). The workflow change itself (reading the four
`VITE_FIREBASE_*` secrets into the build's `env:`) was verified by inspection and by the local
`npm run build` calls above succeeding both with and without those vars set; the actual Pages
deploy carrying real Firebase config to production happens automatically on the next push to
`main` after this PR merges.

### Production smoke test (Phase E)

**Not performed -- blocked**, for two independent reasons, either of which alone would block it:
1. No backend is deployed yet (Phase D blocked, see above) -- there is no live
   `submitLunchRushScore` Function or open Firestore rule set in `teto-pizza-game` to submit a
   real run against.
2. This session's own network cannot reach `perusonao.github.io` or
   `*.cloudfunctions.net` at all (see Network policy finding above) -- even if a backend were
   deployed, this session could not load the production page or invoke the Function to verify
   it.

None of items 1-12 in this task's own Phase E checklist (Pages load, Firebase init, Anonymous
Auth, offline fallback, Lunch Rush start/complete, `submitLunchRushScore` reaching production,
server-side acceptance, Firestore write, weekly TOP10 read, no direct client write, console
errors) could be exercised from this session. Item 4 (Firebase-unconfigured fallback not broken)
remains indirectly covered by this session's own full local test suite passing unchanged
(1793/1793).

**No production test data was created** -- since no submission could reach the real
`teto-pizza-game` Firestore, there is nothing to identify or clean up. If the owner performs the
smoke test themselves (see Remaining owner action below), and a resulting score should be
identified as test data for later cleanup: today's date-based weekly period id
(`weekly_<isoWeekId>`, `src/shared/lunchRushPeriodIds.ts`) is the only period a real run would
land in -- there is no existing "is this a test run" flag in the schema (`runs/{autoId}`,
`leaderboards/{periodId}/entries/{uid}`), and this task does not add one (would be a ranking-spec
change, out of scope). A manual test run's own anonymous `uid` and `score`/`achievedAt` should be
recorded by whoever performs it, so it can be identified later if cleanup is wanted; no ranking
spec or Security Rules change is proposed to support this.

### Authorized domains -- result

**Not yet determined either way**, and per this task's own instruction this is **not treated as
a blocker**: since Anonymous Auth's `signInAnonymously()` could not be exercised at all from this
session (network-blocked, see above), it was never actually attempted against the real project,
so there is no error to diagnose. This is different from Session 1's framing (which treated it
as a known likely requirement, citing the general Firebase Auth `auth/unauthorized-domain`
behavior for a non-default domain) -- Session 2 did not downgrade or upgrade that guess with any
new evidence, since the real test was never run. **Actual determination requires the real
Anonymous Auth smoke test** (Phase E, still blocked) or someone performing it from a Console/
browser context. Do not add `perusonao.github.io` as a required blocker until that smoke test is
actually attempted and, if it fails, the error is confirmed to name domain authorization
specifically (`auth/unauthorized-domain` or equivalent) -- per this task's own "don't block on
speculation" instruction.

### PR Gate Check #2 (Session 2, immediately before finishing)

First pass: `git fetch origin` -- `origin/main` unchanged at
`ff591ebaea40095c5a25ea52797be9d3fd2b5538` since the earlier check in this same session; PR #121
head `c88ce5cbe499d9e6e4f2289bd5f4b93c529ba1d5`, base caught up.

**Second pass** (main moved again mid-session, so this check was re-run rather than trusting the
first pass): `git fetch origin` -> `origin/main` advanced to
**`d62d535305dd65bf5f45c847363c38f421a40e23`** -- two new merges, `dc0a66b` ("Recipe Cooking
Steps 1.0 Phase 1A: Cooking Step Foundation (#124)") and `d62d535` ("Recipe Cooking Steps 1.0
Phase 1A-T: Step Timing instrumentation (#125)"). Unlike the earlier #122/#123 merges, these are
**real game-code changes** (`src/data/cookingProfiles.ts`, `src/logic/cookingTiming.ts`,
`src/state/gameReducer.ts`, `src/components/MakingStepTabs.tsx`, `src/screens/GameScreen.tsx`,
`src/App.tsx`, and their tests) -- exactly the Cooking Steps work this task's own scope guard
says not to touch. Confirmed **zero file overlap** with PR #121's 6 files before merging (no
Cooking Steps file was read for editing), merged `origin/main` in (clean, no conflicts), and
re-ran the full verification suite (see "Pre-deploy verification" table -- now **1856/1856**
root tests, up from 1793, reflecting the new Cooking Steps tests; functions 32/32 and rules
emulator 14/14 unchanged and unaffected). Merge commit created and pushed -- see "Completion
report" at the very end of this document for the final PR #121 head SHA after this push.
- No new Firebase-scoped PR or branch appeared in either pass.
- `git diff origin/main...HEAD --stat` after the second merge: still exactly PR #121's own 6
  files (`.github/workflows/deploy.yml`, `docs/design/TETO_FIREBASE-RANKING_SETUP.md`, this
  report, `functions/src/index.ts`, `src/firebase/submitLunchRushScore.ts`, `src/firebase/
  submitLunchRushScore.test.ts`) -- no scope creep from either merge.
- No secret value appears anywhere in this diff, this report, or any command output produced in
  this session (only secret *names*, never values, per the Security Gate).
- No progression/economy/scoring/recipe/save-schema/Cooking-Steps/Pizza-Cutting file was changed
  by this PR -- both merges only brought that work *in* from `main`, they were never edited.

### Remaining owner action (single, current)

Given the network finding above, the one concrete unblocking action is now: **perform the real
Firebase deploy and the production smoke test from a machine/CI runner that has normal,
unrestricted internet access** (i.e., not this remote session) -- this session's own network
cannot reach Firebase's login endpoint, the production Pages site, or the deployed Function's
invoke URL, regardless of any credential supplied to it.

```bash
git fetch origin claude/teto-pizza-firebase-production-wwo9di
git checkout claude/teto-pizza-firebase-production-wwo9di
cp .firebaserc.example .firebaserc   # set "default": "teto-pizza-game"
npx firebase-tools login
npx firebase-tools use               # confirm it prints exactly "teto-pizza-game" before deploying
npx firebase-tools deploy --only firestore:rules,firestore:indexes,functions --project teto-pizza-game
```

Then, once this PR is merged (by the owner -- never by this session) and the next Pages deploy
has run: open `https://perusonao.github.io/teto-pizza-game/`, play through Lunch Rush once, and
confirm the weekly ranking overlay shows the run. If Anonymous Auth fails specifically (not a
generic network/load failure), check the browser console for `auth/unauthorized-domain` and, only
if that exact error appears, add `perusonao.github.io` at Firebase Console -> `teto-pizza-game`
-> Authentication -> Settings -> Authorized domains (bare hostname, no scheme, no path).

### Known risks

- The real deploy (Phase D) and production smoke test (Phase E) remain fully unverified against
  the live `teto-pizza-game` project. All confidence in this PR's correctness rests on local
  emulator/unit-test verification (rules emulator, functions unit tests) plus static/compiled
  inspection of the built Function bundle -- not an actual deployed-and-invoked run.
  Session 2 did not learn anything new here that reason to be less confident about; this is
  the same shape of coverage gap Session 1 already had, only re-confirmed as unclosed.
- Whether `perusonao.github.io` needs to be added to Authorized domains is still genuinely
  unknown (see above) -- do not treat Session 1's original speculation as confirmed.
- If the owner deploys from their own machine using a Firebase account that has access to a
  *different* default project aliased in their own global Firebase CLI config, `firebase use`
  must be checked before `firebase deploy` -- the exact-`teto-pizza-game` check is called out in
  the commands above specifically to guard against this.

### FINAL VERDICT (Session 2, current -- supersedes Session 1's verdict below)

**B. CODE READY -- OWNER ACTION REQUIRED.**

All Firebase production-connection code/config changes (region alignment, GitHub Pages secret
wiring) are complete, tested against a real Firestore rules emulator, rebased cleanly onto
current `main`, and pushed to PR #121 (still open, not merged). GitHub Secrets are confirmed
configured. The remaining gap is entirely environmental, not code: this session's own network
cannot reach Firebase's login endpoint or the production Pages/Functions hosts, so the real
deploy (Phase D) and production smoke test (Phase E) must be performed by the owner from an
unrestricted machine/CI runner, using the exact commands in "Remaining owner action" above. This
is not a security or project-safety block (verdict D) and nothing failed once actually run
(verdict C) -- the code has simply not yet been exercised against the live project from
anywhere.

## Session 1 (original)

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

**Superseded by Session 2's verdict above** -- GitHub Secrets are now confirmed configured, and
Session 2 found the real remaining blocker is this session's own network policy (not merely
"unauthenticated"), which changes what the owner's one remaining action actually is. See
"Session 2" at the top of this report for the current status.
