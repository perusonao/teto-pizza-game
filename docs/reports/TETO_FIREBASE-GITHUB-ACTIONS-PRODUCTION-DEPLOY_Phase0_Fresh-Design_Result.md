# Firebase Production Deploy via GitHub Actions -- Phase 0 Fresh Design / Audit -- Result

Docs-only. This session designed (but did not implement) a future GitHub Actions workflow for
Firebase production deploys, per the task's own explicit stop conditions: no workflow created
or changed, no Firebase deploy performed, no secret created or changed, PR #132/#133 not
touched or merged, this PR opened and left OPEN.

## Fresh Sync (section 0)

- `git fetch origin` -- fresh, not trusting any prior session's recorded state.
- **Audited `origin/main` SHA: `fbac50da7b3a6da8e31c3399b8986e5d692e2f7b`** ("Merge pull request
  #131 from perusonao/claude/player-profile-phase-1a-aibr5v").
- Open PRs (fresh `list_pull_requests`, state=open): #133 (Player Profile 1.0 Phase 1B), #132
  (Pizza Cutting 1.0 Phase 3), plus five unrelated older open PRs (#105, #72, #46, #34, #3).
  **#132 and #133 both confirmed open, both based on the exact same `main` tip
  (`fbac50da...`), neither merged nor touched by this session.**
- Repository confirmed **public** (`visibility: "public"`, fresh `search_repositories` call) --
  this directly gates section 3/12's GitHub Environment feasibility finding below.
- Fresh-read (this session, not trusted from any prior report): `.github/workflows/ci.yml`,
  `.github/workflows/deploy.yml`, `firebase.json`, `.firebaserc.example`, `firestore.rules`,
  `firestore.indexes.json`, `functions/package.json`, `functions/src/index.ts`,
  `functions/src/` directory listing, root `package.json`, `.env.example`,
  `docs/design/TETO_FIREBASE-RANKING_SETUP.md` (full), `docs/reports/
  TETO_FIREBASE-PRODUCTION-CONNECTION_Result.md` (full, all 3 sessions), `docs/reports/
  TETO_PLAYER-PROFILE_Phase1A_Result.md` (deployment section).
- **`.github/workflows/deploy.yml` detailed audit**: GitHub Pages only (`actions/
  configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`), triggered on push
  to `main` + `workflow_dispatch`. Its build step reads four `VITE_FIREBASE_*` **client**
  secrets (Web SDK config). **No Firebase CLI invocation, no `firebase deploy`, no Firestore/
  Functions step exists in this file or anywhere else in `.github/workflows/`.** This session's
  design does not modify this file, and confirms (by inspection) that nothing in Phase 0
  touches or risks the existing Pages deploy pipeline.

## Duplicate Gate (section 1)

- `search_issues` (query: "Firebase GitHub Actions production deploy workflow_dispatch service
  account OIDC", scoped to this repo): **0 results.**
- `.github/workflows/` directory listing: exactly `ci.yml` and `deploy.yml` -- no Firebase
  deploy workflow, no manual-Firebase-deploy workflow, no `workflow_dispatch`-based Firebase
  deploy file, under any name.
- No `.firebaserc` (gitignored, does not exist), no service-account JSON, no WIF pool
  configuration file anywhere in the repo tree.
- **Conclusion: no duplicate exists. This is genuinely new design work, not a re-design of
  something already built.**

## Fresh research performed (sections 3/4/5/12 -- not designed from memory)

Per this task's own explicit "推測で設計しない" (do not design from guesses) instruction, the
following was verified via live web search/fetch during this session, not asserted from
training-data recall alone:

1. **GitHub Environments required reviewers on public repos, Free plan**: confirmed available
   (searched; cross-checked against this repo's own confirmed `"private": false` /
   `"visibility": "public"` API response). Private repos would need GitHub Enterprise for the
   same feature -- explicitly not this repo's situation.
2. **`workflow_dispatch` requires repository write access to trigger**: confirmed -- this is
   what makes fork PRs structurally unable to trigger a future Firebase-deploy workflow, cited
   in the design doc's threat model (section 17).
3. **GitHub Environment "required reviewers" self-approval default, and the "Prevent
   self-review" setting**: confirmed a required reviewer can approve their own triggered run by
   default, and that this is a real, named opt-in setting to change -- documented honestly in
   the design doc (section 12) as a trade-off for a single-owner repo, not glossed over.
4. **GitHub OIDC + Workload Identity Federation compatibility with `firebase-tools`**:
   confirmed via `google-github-actions/auth`'s own documentation (the ADC-credentials-file
   mode, not the ID-token mode, is what downstream tools like `firebase-tools` consume) --
   *and* a specific historical gap was found and verified, not glossed over: `firebase-tools`
   issue #3926 documented `GOOGLE_APPLICATION_CREDENTIALS` pointing at a WIF/`external_account`
   credential file failing outright (`"does not contain a client_email field"`); a third-party
   action built to work around this states native support was added **as of November 12,
   2024**. The design doc (section 4) treats this as "should work now, but Phase 1's own exit
   criteria is a real dry-run proving it against the exact pinned `firebase-tools` version" --
   deliberately not asserted as unconditionally true.
5. **IAM least-privilege roles for Cloud Functions (2nd gen) and Firestore rules/indexes
   deploy**: cross-checked against Firebase's own IAM permissions reference and Cloud Functions
   IAM docs (`roles/cloudfunctions.admin` documented as the CI-deployer minimum;
   `roles/iam.serviceAccountUser` documented as required for Gen 2's Cloud Build/Cloud Run
   plumbing; `roles/firebaserules.admin` / `roles/datastore.indexAdmin` for Firestore rules/
   indexes). The design doc (section 5) is explicit that Gen 2 deploys have a documented
   tendency to need additional roles depending on project history, and that Phase 1's exit
   criteria (a real dry-run) is what actually settles this, rather than this report asserting a
   final, guaranteed-complete role list from documentation alone.

`firebase.google.com` itself was unreachable from this session's network egress policy
(`EGRESS_BLOCKED`, confirmed via the proxy's own error) -- Firebase's own IAM permissions page
could not be fetched directly; the IAM role findings above instead rely on Google Cloud's own
`docs.cloud.google.com` IAM/Cloud Functions/Cloud Run reference pages (reachable) and a
cross-check against a real, current third-party WIF-based Functions-deploy action's own
documented minimal-role setup, which independently corroborates the same two functions-side
roles. This gap (Firebase's own IAM doc page unreachable) is disclosed here rather than papered
over, and is exactly why the design doc treats the IAM role list as a verified *starting point*
for Phase 1's real dry-run, not a guaranteed-final list.

## Key decisions (full rationale in the design doc)

1. **Trigger strategy: `workflow_dispatch` + GitHub Environment `production` with a required
   reviewer** (design doc section 3) -- the task's own first-candidate design, confirmed
   feasible as-is on this public repo's Free plan; no fallback needed.
2. **Authentication strategy: GitHub OIDC + Workload Identity Federation**, no long-lived
   secret (design doc section 4) -- the task's own first-candidate design, confirmed compatible
   with current `firebase-tools`, with the one real historical caveat (issue #3926, resolved
   ~Nov 2024) surfaced rather than hidden.
3. **IAM**: four named predefined roles, scoped to the `teto-pizza-game` project only, each
   with a stated reason (design doc section 5) -- no "just grant Firebase Admin."
4. **Project-ID guard**: a hardcoded workflow-level constant + explicit `--project` flag on
   every CLI call + IAM itself scoped to one project, deliberately not relying on `.firebaserc`
   (which doesn't even exist in CI) at all (design doc section 8).
5. **`all` target is explicitly non-atomic**, two separate steps, surfaced in the job summary,
   never a single combined `firebase deploy --only functions,firestore:...` call (design doc
   sections 6/9/10).
6. **Rollback is git-revert-and-redeploy through the same reviewed gate**, never an
   arbitrary-SHA redeploy path (design doc section 11) -- keeps the "only reviewed `main`"
   invariant intact during rollback too.
7. **iPhone feasibility is split honestly**: day-to-day deploy is fully iPhone-only once
   Phases 1-2 ship; the one-time GCP-side WIF setup in Phase 1 realistically still needs a PC
   (design doc section 14) -- not claimed away.
8. **Player Profile 1A/1B handoff**: Phase 1A's `setDisplayName`/`users/{uid}` rule is merged
   to `main` but confirmed **not yet deployed** to production (fresh-read from
   `TETO_PLAYER-PROFILE_Phase1A_Result.md` section 14, "Not deployed" -- not assumed either
   way); design doc section 15 states this explicitly and does not assume a functions-only
   deploy would be sufficient once Phase 1B merges, without first confirming the Firestore
   rules' live-production state.

## Verification performed

### Duplicate Gate -- pass 1 (scope / architecture / security / dependency)

- Confirmed no existing Firebase deploy workflow, manual-deploy workflow, service-account/WIF
  setup, or equivalent Issue/PR exists (see "Duplicate Gate" above).
- Confirmed this design touches none of PR #132's files (Pizza Cutting Phase 3: `ResultPanel`,
  `CutDebugPanel`, `gameReducer`, `App.tsx` cut-flow tests) or PR #133's files
  (`functions/src/submitLunchRushScore.ts`, `src/firebase/getWeeklyLeaderboard.ts`,
  `WeeklyRankingOverlay.tsx`) -- this design doc *references* both PRs' stated scope (read via
  `pull_request_read`) but edits neither PR's branch, neither PR's files, and does not merge
  either.
- Confirmed no gameplay/economy/progression/scoring/recipe/save-schema file was read for
  editing -- only Firebase/CI-adjacent config files and docs were read, and only two new doc
  files were written.

### Duplicate Gate -- pass 2 (git diff / changed files / no secret / no production change)

- `git status --short` immediately before finishing: exactly the two new files below, nothing
  else untracked or modified.
- `git diff` / new-file contents scanned for a private key (`BEGIN ... PRIVATE`),
  `service_account`, a literal Firebase Web API key value, or any secret-shaped string -- none
  found; every secret name mentioned (e.g. `VITE_FIREBASE_API_KEY`) appears only as a *name*,
  never a value, matching this repo's own established convention.
- `.github/workflows/` directory re-confirmed unchanged (still exactly `ci.yml` + `deploy.yml`,
  byte-identical to the fresh-audited state above) -- **no GitHub Actions production workflow
  was implemented**, per the stop condition.
- No Firebase CLI command that could mutate production state (`firebase deploy`, `firebase
  use`, etc.) was run by this session -- only local file reads and one deploy-readiness reading
  of already-committed config (`firebase.json`, `firestore.rules`) for design purposes.
- No GitHub Secret, GitHub Environment, GCP service account, or WIF pool was created.
- PR #132 and PR #133 re-confirmed still open, not merged, not commented on, not modified by
  this session.

## Changed files

| File | Change |
|---|---|
| `docs/design/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_1.0.md` | new |
| `docs/reports/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_Phase0_Fresh-Design_Result.md` | new (this file) |

No other file changed. No `.github/workflows/*` file created or modified. No `firebase.json`/
`firestore.rules`/`firestore.indexes.json`/`functions/*`/`src/*` file changed.

## Recommendations summary (full detail in the design doc)

- **Trigger**: `workflow_dispatch` + GitHub Environment `production`, required reviewer,
  deployment-branch-policy restricted to `main`.
- **Authentication**: GitHub OIDC + Workload Identity Federation via
  `google-github-actions/auth` (ADC-credentials-file mode). **No long-lived secret.**
- **IAM**: `roles/cloudfunctions.admin` + `roles/iam.serviceAccountUser` (functions),
  `roles/firebaserules.admin` + `roles/datastore.indexAdmin` (firestore), all scoped to the
  `teto-pizza-game` project only. No broader role granted speculatively.
- **GitHub Environment usage**: yes -- `production` Environment with required reviewer +
  branch-policy restriction; Environment-scoped variables (not secrets, since WIF identifiers
  aren't sensitive) rather than repository-wide.
- **iPhone daily-deploy feasibility**: yes, fully, once Phases 1-2 ship.
- **iPhone initial-setup feasibility**: no, not realistically -- Phase 1's GCP-side WIF setup
  is a one-time PC task; GitHub-side Environment setup alone would be iPhone-feasible.
- **Required owner manual setup** (future, not this PR): create the WIF pool/provider/
  attribute-condition and the deploy service account in GCP (Phase 1); create the `production`
  GitHub Environment with its required reviewer and branch policy (Phase 1); review/merge the
  eventual workflow-file PR (Phase 2); approve each real deploy dispatch (Phase 3 onward).
- **Project-ID guard**: hardcoded workflow constant + explicit `--project` flag + IAM scoped to
  one project -- never dependent on `.firebaserc` (which does not exist in this repo's CI at
  all).
- **Pre-deploy gates**: `functions` typecheck/lint/test/build, Firestore rules emulator test,
  a scoped `src/shared` root-test run -- **not** the full 2000+ root suite (deliberately scoped
  out; unrelated to a backend-only deploy, already covered by `ci.yml`/`deploy.yml` on every
  PR/push).
- **Rollback strategy**: revert-on-`main`-and-redeploy through the same reviewed gate, never an
  arbitrary-SHA redeploy; Firestore data rollback explicitly named as a separate, unaddressed
  problem.
- **Partial-deploy handling**: `all` is two independent steps, non-atomic, explicitly surfaced
  in the job summary; a `firestore`-only re-dispatch is the documented recovery path if
  `functions` already succeeded.
- **Phase 1A/1B production handoff**: Phase 1A (`setDisplayName`/`users/{uid}` rule) merged to
  `main` but confirmed not yet deployed; Phase 1B (open PR #133) makes no further rules change.
  A functions-only deploy after Phase 1B merges is **not** assumed sufficient without first
  confirming Phase 1A's Firestore rules are actually live -- stated explicitly, not glossed
  over.
- **Implementation phases**: 0 (this PR, done) -> 1 (GCP/GitHub auth foundation, small-medium,
  PC needed once) -> 2 (workflow file, medium) -> 3 (dry run short of a real deploy, small) ->
  4 (first real production deploy, small) -> 5 (iPhone-only operational smoke, owner-only). See
  design doc section 18 for the full table (scope / effort / owner action / rollback / exit
  criteria per phase).
- **Security verdict**: sound as designed. No long-lived secret, no fork-PR path to production,
  no arbitrary-branch deploy path, least-privilege IAM scoped to one project, non-atomic
  partial-deploy state always surfaced rather than hidden. The one open, explicitly-flagged
  risk is the "Prevent self-review" trade-off for a single-owner repo (design doc section 12) --
  not a gap in this design, a real limit of having only one maintainer account, documented
  rather than hidden.

## Design doc path

`docs/design/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_1.0.md`

## Result Report path

`docs/reports/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_Phase0_Fresh-Design_Result.md`
(this file)

## STOP CONDITIONS -- confirmed honored

- Docs-only: confirmed (Changed files table above -- two new `.md` files, nothing else).
- No production workflow implemented: confirmed (`.github/workflows/` unchanged).
- No Firebase deploy performed: confirmed (no `firebase deploy`/`firebase use` command run).
- No secret created or changed: confirmed (no GitHub Secret, Environment, GCP SA, or WIF pool
  created).
- PR #132 / #133 not merged: confirmed (both re-checked open, untouched, immediately before
  finishing).
- This PR opened and left OPEN, no auto-merge: confirmed by construction (see PR description).
