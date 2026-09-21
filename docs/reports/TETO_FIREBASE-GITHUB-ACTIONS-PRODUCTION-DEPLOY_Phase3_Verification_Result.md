# Firebase Production Deploy via GitHub Actions -- Phase 3 Verification Result Report

Continues `docs/reports/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_Phase1-2_Result.md`
(unmodified, kept as-is per this task's own instruction) after PR #140 merged to `main`
(`f88a653bd74153def3b91e2debf2dcdf774df8d7`). This report covers three sessions. **Session 1**
(below, mostly unchanged) built PR #142 (the `target: verify` addition) but could not dispatch it
(`workflow_dispatch` requires the workflow file on the default branch). **Session 2** dispatched
`target: verify` on `main` after PR #142 merged, and the run sat waiting for the `production`
Environment's required-reviewer approval -- stopped there per this task's own instruction.
**Session 3 ("Live verification run", near the bottom -- the current, authoritative status)**
resumed after the owner approved that run, confirmed **WIF VERIFIED** from the run's actual
logs, and re-audits the production-vs-`main` diff fresh before proposing a Phase 4 plan. See
"Live verification run" for the current final verdict -- Session 1's own verdict further below
is superseded on the WIF-result/production-mutation questions specifically (nothing else in
Session 1 changed).

**No Firebase production deploy has been performed by any session in this report. No `firebase
deploy`, `gcloud functions deploy`, or Firestore rules/indexes deploy command was run.**

## Fresh sync (before any change)

- `git fetch origin main` -- `origin/main` tip: **`f88a653bd74153def3b91e2debf2dcdf774df8d7`**
  (matches the merged SHA given in the task; PR #140's own squash-merge commit).
- `.github/workflows/firebase-production-deploy.yml` confirmed present on `main` at this SHA
  (`git show origin/main:.github/workflows/firebase-production-deploy.yml`), byte-consistent
  with what PR #140 added.
- `gh pr view 140`: `state: MERGED`, `mergeCommit.oid: f88a653b...`, `baseRefName: main` --
  confirmed, not assumed.
- GitHub `production` Environment (`gh api repos/perusonao/teto-pizza-game/environments/production`):
  still exists, unchanged from Phase 1-2 --
  - Required reviewer: `perusonao` (unchanged)
  - `deployment_branch_policy`: `protected_branches: false`, `custom_branch_policies: true`,
    one custom policy, branch `main` (unchanged)
  - Environment variables: `FIREBASE_WIF_PROVIDER` =
    `projects/1030600909020/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider`,
    `FIREBASE_DEPLOY_SA_EMAIL` = `github-actions-deploy@teto-pizza-game.iam.gserviceaccount.com`
    (both unchanged, read back again this session)
- GCP WIF Pool/Provider (`gcloud iam workload-identity-pools describe` /
  `... providers describe`): both `state: ACTIVE`, unchanged --
  - Provider `attributeCondition`: `assertion.repository == 'perusonao/teto-pizza-game'`
    (unchanged)
  - Provider `attributeMapping`: `google.subject`/`attribute.repository`/
    `attribute.repository_owner`/`attribute.ref` (unchanged)
- Service account `github-actions-deploy@teto-pizza-game.iam.gserviceaccount.com`:
  - `get-iam-policy` (impersonation binding): exactly one binding,
    `roles/iam.workloadIdentityUser` for the `attribute.repository/perusonao/teto-pizza-game`
    `principalSet` -- unchanged, still repository-scoped (not pool-wide).
  - Project-level roles (`gcloud projects get-iam-policy`, filtered to this SA): exactly
    `roles/cloudfunctions.admin`, `roles/datastore.indexAdmin`, `roles/firebaserules.admin`,
    `roles/iam.serviceAccountUser` -- unchanged, still no `editor`/`owner`/Firebase-Admin role.
- **Conclusion: Phase 1-2's entire GCP/GitHub infrastructure is confirmed present and unchanged
  since the last session.** No duplicate, no drift, no manual tampering found.

## Current Firebase production state (read-only, fresh-checked)

- `gcloud functions list --project teto-pizza-game --regions=asia-northeast1`: **exactly one
  function is live**: `submitLunchRushScore` (`ACTIVE`, last updated `2026-09-20T17:17:40Z`).
  **`setDisplayName` (Player Profile 1.0 Phase 1A, merged to `main` via PR #131) is confirmed
  still NOT deployed** -- empirically confirmed via a live, read-only `gcloud functions list`
  call this session, not merely carried forward from the Phase 1-2 report's own prior claim.
- `gcloud firestore indexes composite list --project teto-pizza-game`: one composite index,
  `state: READY` -- matches `firestore.indexes.json` on `main` (the single `entries`
  `score DESC, achievedAt ASC` index). No index drift.
- **Firestore Security Rules content was not independently re-fetched live this session** (no
  read-only `gcloud`/`firebase` command exists to dump the currently-deployed ruleset without
  either the Firebase Console UI or an authenticated Firebase Rules API call requiring a raw
  access token -- and this session deliberately did not attempt to print/use a raw access token
  locally, consistent with the same constraint noted in the Phase 1-2 report). Based on
  documented history instead: PR #121 (merged, owner-deployed) shipped the pre-Phase-1A ruleset
  (`runs`/`leaderboards` only); the Phase 1A `users/{uid}` rule merged to `main` afterward via
  PR #131 and was explicitly recorded as **not yet deployed**
  (`TETO_FIREBASE-PRODUCTION-CONNECTION_Result.md`, and reaffirmed in the Phase 0 design doc
  section 15); no `firestore` deploy has happened since (this session's own Phase 1-2 report
  confirms no deploy was performed, and this session has not performed one either). **Inference,
  not a live re-fetch: the deployed ruleset almost certainly still lacks the `users/{uid}` rule.**
  This should be confirmed via the Firebase Console (or a real `firestore` deploy dispatch, which
  is idempotent/safe to re-apply) before or during the first real `firestore`/`all` deploy --
  flagged here rather than asserted as fact.

## Duplicate/conflict gate

- Open PRs (fresh `gh pr list`): #139 (unrelated, Recipe Select UI), #141 (unrelated, opened by
  someone else between sessions -- not inspected further, confirmed to not touch
  `.github/workflows/`, `firebase.json`, `functions/`, or any GCP/WIF-related file by its own
  file list), plus older unrelated PRs. **No duplicate WIF-verification or Firebase-deploy PR in
  flight.**
- No existing `.github/workflows/` file already provided a read-only/verify-only Firebase auth
  check -- confirmed by reading `firebase-production-deploy.yml`'s full content fresh
  (17 steps, all deploy/build/test steps behind an explicit `functions`/`firestore`/`all`
  allow-list, nothing else in `.github/workflows/`).

## Verification approach chosen: Option A (extend the existing workflow)

Per this task's own recommended-order instruction (A before B before C), Option A was evaluated
first and found sufficient: the existing workflow's build/test/deploy steps are already gated
with an explicit **allow-list** (`inputs.target == 'functions' || inputs.target == 'all'`, or
`'firestore' || 'all'`) rather than a deny-list. Adding a fourth choice value, `verify`, to the
`target` input therefore causes every one of those steps to evaluate to `false` and be skipped
**automatically**, with no change needed to their own conditions. Only the "Authenticate to
Google Cloud (WIF)" step and the existing "Project-ID guard (preflight)" step
(`firebase projects:list --project teto-pizza-game`, already read-only) are reachable --
`firebase deploy` does not appear anywhere reachable when `target: verify` is selected. This is
the smallest possible change (18 insertions, 4 deletions, entirely inside the one existing
workflow file) and keeps everything -- the `production` Environment gate, the required
reviewer, the `main`-only branch policy -- identical to a real deploy dispatch, so the
verification exercises the *same* trust path a real deploy would use, not a parallel/weaker one.

Options B (a separate new workflow file) and C (a non-GitHub-Actions verification path) were not
needed once A was confirmed sufficient and minimal.

## PR

**#142** -- <https://github.com/perusonao/teto-pizza-game/pull/142>
Branch: `claude/firebase-wif-verify-target`
**Exact HEAD: `ae262feb99b7da432652fd9875edf761cd11e9fc`**
State: **OPEN**, not merged, no auto-merge requested (`gh pr view --json autoMergeRequest`: `null`).

### Changed files

| File | Change |
|---|---|
| `.github/workflows/firebase-production-deploy.yml` | `+18 / -4` lines -- adds `verify` to the `target` choice list, one `if:` guard on the now-skippable root `npm ci` step, one job-summary message block, and doc comments. No new step, no new permission, no IAM/WIF/Environment change. |
| `docs/reports/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_Phase3_Verification_Result.md` | new (this file) |

No `firestore.rules`, `firestore.indexes.json`, `functions/*`, `src/*`, `ci.yml`, or `deploy.yml`
file was touched.

### Security checks

- `git diff` scanned for `private_key`, `BEGIN ... PRIVATE`, `service_account` (as a value), and
  Firebase Web API key literal patterns -- none found (identical clean result to Phase 1-2).
- No secret, token, or credential value is printed by the `verify` path -- it runs
  `firebase projects:list --project teto-pizza-game` only, whose own output is a project list,
  not a credential.
- YAML re-validated with `python`+`PyYAML` (`yaml.safe_load`) -- parses cleanly; confirmed by
  direct inspection that all 6 steps reachable under `target: verify` (guard, checkout,
  setup-node, auth, install-cli, project-ID-guard) contain no deploy/write command, and that
  every other step's `if:` condition still excludes `verify`.
- No IAM role was widened, no new principal was granted access, no new WIF trust boundary was
  created -- this PR only adds a new *input value* that causes fewer steps to run, never more
  capability.

## WIF result

**Not yet performed.** Dispatching `target: verify` requires PR #142 to be reviewed and merged
first (the same `workflow_dispatch`-must-exist-on-default-branch constraint documented and
empirically confirmed in the Phase 1-2 report applies here too -- not re-tested again this
session since the underlying platform behavior is already confirmed, not in question). Per this
task's own explicit stop condition ("このverification workflowをmainに入れる必要があるならPRを
作成してSTOP"), this session stops here, with the PR open for review.

## Service Account impersonation result

Not yet live-tested this session, for the same reason as above. Statically re-confirmed via
fresh IAM read-back (see "Fresh sync" above): the impersonation binding (`roles/iam.workloadIdentityUser`
on the exact `attribute.repository/perusonao/teto-pizza-game` `principalSet`) is present and
unchanged.

## Firebase project read result

Not yet live-tested this session (same reason). `gcloud`-level read-only checks (functions list,
Firestore composite indexes list) **were** performed this session, successfully, using this
session's own `gcloud` operator credentials (the human owner's account, not the WIF-derived
service account) -- these confirm the *current production state* to diff against, not the WIF
path itself.

## Production mutation

**NONE.** No `firebase deploy`, `gcloud functions deploy`, `gcloud functions delete`, Firestore
rules deploy, or Firestore index deploy/delete command was run by this session. Every GCP/GitHub
command run this session was read-only (`describe`, `list`, `get-iam-policy`) except the new
PR's own `git`/`gh` commands (branch, commit, push, PR create), which touch only this
repository's own Git history and a new open PR -- never Firebase/GCP state.

## Secrets exposed

**NONE.** No credential, access token, private key, or service-account key value was printed,
logged, or written to any file, report, or commit by this session.

## Remaining production diff (main vs. currently deployed)

| Resource | On `main` | Currently deployed | Diff |
|---|---|---|---|
| Cloud Function `submitLunchRushScore` | present, region `asia-northeast1` | **live**, `ACTIVE` | none (already matches) |
| Cloud Function `setDisplayName` | present (Player Profile 1.0 Phase 1A, PR #131), region `asia-northeast1` | **not deployed** | `main` has it, production does not -- a `functions`/`all` deploy would add it |
| Firestore composite index (`entries`, `score DESC, achievedAt ASC`) | present, `firestore.indexes.json` | **live**, `READY` | none (already matches) |
| Firestore rule `runs/{runId}` (deny-all) | present | presumed live (from PR #121) | none expected |
| Firestore rule `leaderboards/{periodId}/entries/{uid}` (`weekly_*` read only) | present | presumed live (from PR #121) | none expected |
| Firestore rule `users/{uid}` (owner-read-only, Player Profile 1.0 Phase 1A, PR #131) | present | **presumed NOT live** (inferred, not live-refetched -- see "Current Firebase production state" above) | `main` has it, production presumed not to -- a `firestore`/`all` deploy would add it; **recommend confirming via Firebase Console before the first real deploy, not just trusting this inference** |
| `submitLunchRushScore`'s `displayName` denormalization (Player Profile 1.0 Phase 1B, PR #133) | present (merged to `main`) | **not live** (bundled inside the not-yet-deployed function code path above) | same `functions`/`all` deploy that adds `setDisplayName` would also bring this live, since it's the same function's code |

**Summary**: the next real production deploy (out of scope for this session) would need
**`target: all`** (or `firestore` first, then `functions`, or vice versa) to bring both the
`setDisplayName` Function and the `users/{uid}` Firestore rule live together -- a `functions`-only
deploy without first confirming the Firestore rule is live would risk `setDisplayName` (which
writes to `users/{uid}` via the Admin SDK, bypassing rules) working while a client-side read of
the same collection remains rules-denied, an inconsistent-but-not-unsafe partial state (the
design doc's own section 15 already flagged this exact coordination risk).

## Next deploy target (recommendation only -- not executed this session)

1. Merge PR #142.
2. Dispatch `target: verify`, approve the `production` Environment gate, confirm the
   "Project-ID guard (preflight)" step succeeds -- this is the actual "WIF VERIFIED" proof.
3. Only after that: dispatch `target: firestore` first (smallest, idempotent re-apply of an
   already-partially-live ruleset plus the new `users/{uid}` rule -- safe to redeploy since
   `runs`/`leaderboards` rules are unchanged), confirm via Firebase Console that `users/{uid}` is
   now present in the live ruleset, **then** dispatch `target: functions` to bring
   `setDisplayName` (and the Phase 1B `displayName` denormalization) live.
4. Both of those real deploys are Phase 4 (design doc section 18) -- explicitly out of this
   session's scope.

## Blockers

- `workflow_dispatch` cannot be triggered for a workflow that exists only on a non-default
  branch (platform constraint, already empirically confirmed in Phase 1-2) -- PR #142 must merge
  before `target: verify` can actually run. Not a defect in this session's work; a GitHub
  platform behavior.
- Firestore Security Rules' live content could not be independently re-fetched without either
  the Firebase Console or a raw access token (deliberately not attempted locally) -- the
  `users/{uid}` rule's live-vs-`main` status above is a documented inference, not a fresh
  empirical read, and is flagged for confirmation at deploy time rather than asserted as settled
  fact.

## Final verdict (Session 1 -- superseded on the WIF-result/production-mutation points, see below)

**Infrastructure confirmed intact and unchanged. A minimal, reviewed-diff PR (#142) adds the
read-only verification path this task asked for, using the smallest possible change to the
existing workflow (Option A). The actual live "WIF VERIFIED" proof requires PR #142 to be merged
first** (a confirmed platform constraint, not a choice) **-- this session stops here, with #142
open for review, per this task's explicit instruction not to proceed past PR creation.** No
Firebase production resource was read via any credential other than the human owner's own
already-authenticated `gcloud` session (for the read-only production-state diff above); the WIF
service account itself has not yet been exercised by an actual GitHub Actions run.

---

## Session 2: dispatch, waiting for approval

PR #142 merged to `main` (`d7cc370c627d2d5327b0a140cc749f312b01b883`, confirmed via `gh pr view
142`: `state: MERGED`). Fresh `git fetch origin main` confirmed `origin/main` at this same SHA;
`git show origin/main:.github/workflows/firebase-production-deploy.yml` confirmed the `verify`
choice present on `main`.

Dispatched via `gh workflow run firebase-production-deploy.yml --ref main -f target=verify` ->
run `https://github.com/perusonao/teto-pizza-game/actions/runs/35570430953`. `gh api
.../pending_deployments` confirmed the run was sitting at the `production` Environment's
required-reviewer gate (`reviewers: [perusonao]`, `current_user_can_approve: true` for the
authenticated `gh` session -- **deliberately not used to self-approve**, per this task's own
instruction to stop and let the human owner approve). Reported the run URL and the exact
UI steps needed, then stopped -- no further action taken until the owner confirmed approval.

## Session 3 (current): Live verification run -- **WIF VERIFIED**

The owner approved the run in GitHub's UI (confirmed: run status shown as `Success`). This
session fetched the run's actual result and per-step logs via `gh api
repos/perusonao/teto-pizza-game/actions/runs/35570430953` and
`.../actions/runs/35570430953/jobs` -- not assumed from the UI screenshot alone.

### Run identity

- Run: `https://github.com/perusonao/teto-pizza-game/actions/runs/35570430953`
- `event`: `workflow_dispatch`
- `head_branch`: `main`
- `head_sha`: `d7cc370c627d2d5327b0a140cc749f312b01b883` (the exact `main` tip at dispatch time,
  matching the SHA PR #142 merged to)
- `status`: `completed`, `conclusion`: `success`

### Per-step results (fetched via the Jobs API, not inferred from the summary UI)

| Step | Conclusion |
|---|---|
| Set up job | success |
| **Guard against non-main ref** | **success** |
| Run actions/checkout@v4 | success |
| Run actions/setup-node@v4 | success |
| **Authenticate to Google Cloud (Workload Identity Federation)** | **success** |
| **Install firebase-tools** | **success** |
| **Project-ID guard (preflight)** | **success** |
| npm ci (root) | skipped |
| functions -- npm ci | skipped |
| functions -- typecheck | skipped |
| functions -- lint | skipped |
| functions -- test | skipped |
| functions -- build | skipped |
| root -- src/shared scoped test | skipped |
| firestore -- rules emulator test | skipped |
| **Deploy -- functions** | **skipped** |
| **Deploy -- firestore (rules + indexes)** | **skipped** |
| Job summary | success |
| Post Authenticate to Google Cloud (WIF) | success |
| Post Run actions/setup-node@v4 | success |
| Post Run actions/checkout@v4 | success |
| Complete job | success |

### Authentication step detail (from the run's own log, `gh run view --log`)

The "Authenticate to Google Cloud (Workload Identity Federation)" step's logged `with:` inputs
confirm the exact resources this task specified, not placeholders or something else:

```
workload_identity_provider: projects/1030600909020/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
service_account: github-actions-deploy@teto-pizza-game.iam.gserviceaccount.com
create_credentials_file: true
export_environment_variables: true
```

followed by `Created credentials file at "/home/runner/.../gha-creds-8974cbd0422c219e.json"` --
this is a short-lived `external_account` (WIF) credential file the action generates fresh for
this one run; **only its file path is logged, never its content**, and this report does not
reproduce its content either.

### `firebase projects:list` output (read-only, from the "Project-ID guard (preflight)" step log)

```
┌──────────────────────┬───────────────────────────┬────────────────┬──────────────────────┐
│ Project Display Name │ Project ID                │ Project Number │ Resource Location ID │
├──────────────────────┼───────────────────────────┼────────────────┼──────────────────────┤
│ teto-pizza-game      │ teto-pizza-game (current) │ 1030600909020  │ [Not specified]       │
└──────────────────────┴───────────────────────────┴────────────────┴──────────────────────┘
1 project(s) total.
```

Project ID and project number match this repo's GCP audit exactly (`teto-pizza-game` /
`1030600909020`) -- this is the empirical proof that the WIF-derived credential can
**authenticate and read**, and only that one project, nothing broader.

### Verification checklist (all nine, all satisfied)

1. ref/SHA confirmed: `main` / `d7cc370c627d2d5327b0a140cc749f312b01b883` -- yes
2. `Guard against non-main ref` = success -- yes
3. `Authenticate to Google Cloud (Workload Identity Federation)` = success -- yes
4. `Install firebase-tools` = success -- yes
5. `Project-ID guard (preflight)` = success -- yes
6. `firebase projects:list` succeeded against `teto-pizza-game` -- yes (see output above)
7. Functions build/test/deploy -- all `skipped` -- yes
8. Firestore test/deploy -- all `skipped` -- yes
9. Production mutation -- **NONE**: both `Deploy -- functions` and `Deploy -- firestore (rules +
   indexes)` steps show `skipped`; the run's own log contains no `firebase deploy` invocation
   anywhere -- yes

**All nine criteria satisfied. WIF VERIFIED.**

### WIF result (supersedes Session 1's "Not yet performed")

**Confirmed, live, from a real `main`-branch GitHub Actions run.** GitHub OIDC ->
`token.actions.githubusercontent.com` -> the `github-actions-pool`/`github-actions-provider` WIF
provider -> `google-github-actions/auth@v2` -> impersonation of
`github-actions-deploy@teto-pizza-game.iam.gserviceaccount.com` -> `firebase projects:list
--project teto-pizza-game` all succeeded end-to-end, gated behind the `production` Environment's
required-reviewer approval exactly as designed.

### Service Account impersonation result (supersedes Session 1)

**Confirmed live** (not just statically re-audited): the credentials file `google-github-actions/auth`
created was accepted by `firebase-tools` for a real API call, meaning the SA's own IAM roles
(section 5's four roles) were sufficient for `firebase projects:list` regardless of the raw
token itself never being inspected by this session -- the functional proof is stronger than the
static IAM read-back alone.

### Firebase project read result (supersedes Session 1)

**Confirmed live**: `firebase projects:list --project teto-pizza-game` returned exactly the one
expected project (see output above), using the WIF-derived service-account identity, not the
human owner's own `gcloud` session this time.

### Production mutation (reaffirms Session 1: still NONE)

**NONE.** Both deploy steps report `skipped` in the run's own Jobs API response; the full run
log (`gh run view --log`) contains no `firebase deploy` command anywhere. No GCP/Firebase
resource was created, modified, or deleted by this run.

### Secrets exposed (reaffirms Session 1: still NONE)

**NONE.** The run log shows the WIF credential file's *path* (a per-run temp file on the
ephemeral GitHub-hosted runner, already deleted when the runner is torn down --
`cleanup_credentials: true` is `google-github-actions/auth`'s own default) but never its
contents. No access token, private key, or credential value appears in the run log, this report,
or any command this session executed.

## Fresh re-audit before Phase 4 planning (Session 3)

Re-run immediately before writing the Phase 4 plan below, not reused from Session 1:

- `git fetch origin main` -- `origin/main` unchanged at `d7cc370c627d2d5327b0a140cc749f312b01b883`
  since Session 1/2 (no new merge landed in between).
- `git show origin/main:functions/src/index.ts` -- still exports exactly `submitLunchRushScore`
  and `setDisplayName`, unchanged.
- `gcloud functions list --project teto-pizza-game --regions=asia-northeast1`: still **exactly
  one function live** -- `submitLunchRushScore` (`ACTIVE`, unchanged `updateTime`). `setDisplayName`
  still **not deployed**.
- `gcloud firestore indexes composite list --project teto-pizza-game`: still one composite index,
  `READY`, unchanged, still matching `firestore.indexes.json` on `main`.
- **Conclusion: the production-vs-`main` diff documented in Session 1's "Remaining production
  diff" table above is unchanged and still accurate.** No new commit, deploy, or manual change
  occurred on either side between Session 1 and this fresh re-check.

## Phase 4 plan (proposed only -- NOT executed this session)

Per this task's explicit instruction, the first-candidate order is **Firestore rules/indexes,
then Functions** -- evaluated against the actual current diff (above) rather than assumed, and
found to still be the right order for the reason already documented in Session 1's "Remaining
production diff" summary: `setDisplayName` writes to `users/{uid}` via the Admin SDK (which
bypasses rules), so deploying the Function before the rule would create a window where the
Function works but no client can read what it wrote (rules-denied) -- not unsafe, but an
avoidable inconsistency. Deploying the rule first closes that window before the Function goes
live. **`target: all` is deliberately not used for either step**, per this task's explicit
instruction -- each dispatch is its own separate, independently-approved run.

| Step | Dispatch | What it brings live | Pre-existing safety | Verification after |
|---|---|---|---|---|
| **4a** | `workflow_dispatch`, `ref: main`, `target: firestore` | The `users/{uid}` rule (Player Profile 1.0 Phase 1A) -- `runs`/`leaderboards` rules are unchanged text, so this is a safe, idempotent re-apply of what's already live plus the one new rule. Also re-applies the one Firestore composite index (already `READY` -- a no-op). | Firestore rules emulator test runs first (design doc section 7 gate) -- this is the one gate that actually exercises the new rule text before it goes live. `firebase deploy --only firestore:rules,firestore:indexes` never touches Functions. | Confirm via Firebase Console (Firestore -> Rules) that `users/{uid}` now appears in the live ruleset -- do not assume from a green run alone, since this session could not independently re-fetch live rule content (Session 1's own disclosed limitation). |
| **4b** | `workflow_dispatch`, `ref: main`, `target: functions` | `setDisplayName` (now reads/writes `users/{uid}`, rules already live from 4a) and the Phase 1B `displayName` denormalization inside `submitLunchRushScore` (same function redeploy, code already merged to `main`). | `functions` typecheck/lint/test/build gate runs first; `submitLunchRushScore` is redeployed too (unavoidable -- both functions share one `firebase deploy --only functions` call and one `codebase: default`), but its code/behavior is unchanged since its last live deploy, so this is expected to be a no-op redeploy for that function specifically. | Confirm via Firebase Console (Functions) that `setDisplayName` now shows as deployed/`ACTIVE`; a manual or scripted smoke test of `setDisplayName` (out of this report's scope to design) would be the real functional confirmation. |

**Both 4a and 4b require the same `production` Environment approval gate as the `verify` run
did** -- no different or weaker gate for a real deploy.

**This session does not execute either 4a or 4b.** Per this task's explicit stop condition, this
report stops at the plan.

## Final verdict (Session 3, current, authoritative)

**WIF VERIFIED.** A real `workflow_dispatch` run on `main`
(`https://github.com/perusonao/teto-pizza-game/actions/runs/35570430953`,
`head_sha: d7cc370c627d2d5327b0a140cc749f312b01b883`), approved through the `production`
Environment's required-reviewer gate by the human owner, proved GitHub OIDC -> Workload Identity
Federation -> `google-github-actions/auth` -> the `github-actions-deploy` service account can
authenticate and read `teto-pizza-game` end-to-end, with **zero** build/test/deploy steps
reachable and **zero** production mutation -- confirmed from the run's own Jobs API response and
full log, not inferred from the UI's green checkmark alone. The production-vs-`main` diff is
unchanged since Session 1 (only `setDisplayName` and the `users/{uid}` Firestore rule remain
undeployed). A Phase 4 plan (Firestore first, then Functions, two separate approved dispatches,
`target: all` deliberately not used) is proposed above but **not executed** -- this report stops
here, per this task's explicit instruction not to perform a production deploy this session.
