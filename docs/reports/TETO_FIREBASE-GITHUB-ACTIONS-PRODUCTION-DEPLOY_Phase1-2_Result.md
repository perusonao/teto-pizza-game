# Firebase Production Deploy via GitHub Actions -- Phase 1-2 Result Report

Builds the GCP/GitHub infrastructure and the workflow file designed in
`docs/design/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_1.0.md` (Phase 0, merged to `main`
via #135). **No production Firebase deploy has been performed by this session.** This report
covers design-doc Phases 1 and 2 (GCP/GitHub auth foundation, Workload Identity Federation, the
workflow file) plus as much of Phase 3's verification as is possible without merging to `main`.

## Fresh sync (before any change)

Per this task's own instruction, all of the following was fresh-audited at session start, not
taken from any prior chat/session memory:

- `git fetch origin` -- `origin/main` tip at session start: `4bb065caaaf647f932d79977f98b5b13b633b677`
  (matches the SHA given in the task). Re-fetched again immediately before branching (see below).
- **Discrepancy found and corrected**: the session's working branch
  (`claude/teto-pizza-firebase-production-wwo9di`, an unrelated, already owner-confirmed-deployed
  "Firebase Production Connection" branch) was 17 commits behind `origin/main` and did **not**
  contain the Phase 0 design doc or its Result Report at all -- both exist only on `origin/main`
  (confirmed via `git ls-tree origin/main`, then read via `git show origin/main:<path>`). The
  design doc and Phase 0 report given in the task prompt were real and merged, but not reachable
  from the branch this session initially had checked out. This session did **not** continue that
  branch; a fresh dedicated branch was created from `origin/main` instead (see below), per this
  task's own "latest origin/mainから専用branchを作る" instruction.
- Open PRs (fresh, `gh pr list`): #139, #105, #72, #46, #34, #3 -- none touch Firebase, CI
  workflows, GCP, or WIF. No duplicate in flight.
- `.github/workflows/`: exactly `ci.yml` (PR-only lint+test+build) and `deploy.yml` (GitHub Pages
  only, push-to-main + `workflow_dispatch`, four `VITE_FIREBASE_*` **client** config secrets, no
  Firebase CLI anywhere) -- byte-consistent with the Phase 0 report's own audit. No Firebase
  deploy workflow existed before this session.
- `firebase.json`: `functions` (codebase `default`, predeploy `npm --prefix functions run
  build`) + `firestore` (`rules`/`indexes`) + `emulators`. No `hosting` key.
- `.firebaserc`: gitignored, does not exist in the repo or in any CI checkout; only
  `.firebaserc.example` (placeholder) is committed. The new workflow never relies on it.
- `functions/package.json`: `typecheck` / `lint` (oxlint) / `test` (vitest) / `build` (esbuild)
  scripts all present, matching the gate table in design doc section 7. **No `firebase-tools`
  devDependency exists anywhere in this repo** -- the design doc's section 4 assumed one would be
  pinned in `functions/package.json`; this was fresh-checked and found not to be true. The
  workflow installs a pinned `firebase-tools` globally instead (see "Workflow implementation"
  below) rather than assuming a project dependency that does not exist.
- `firestore.rules` / `firestore.indexes.json`: current production rule set (Firebase Ranking
  1.0 `runs`/`leaderboards` deny-by-default-except-`weekly_*`-read, Player Profile 1.0
  `users/{uid}` owner-read-only) -- read for context, not modified by this session.
- `docs/reports/TETO_FIREBASE-PRODUCTION-CONNECTION_Result.md` (current production state, fresh
  read): `submitLunchRushScore` (region `asia-northeast1`) and `firestore.rules`/
  `firestore.indexes.json` are **already live in production**, owner-confirmed-deployed from
  their own machine. `setDisplayName` (Player Profile 1.0 Phase 1A, merged via #131) is **not
  yet deployed** to production -- this session did not deploy it either; the first real
  `functions`/`all` dispatch through the new workflow (a future, owner-driven step) will need to
  account for that.
- GCP fresh audit (`gcloud`, project `teto-pizza-game`, project number `1030600909020`):
  - Enabled APIs: `iam.googleapis.com`, `iamcredentials.googleapis.com`,
    `cloudresourcemanager.googleapis.com`, `serviceusage.googleapis.com` already enabled.
    `sts.googleapis.com` was **not** enabled -- the one gap, enabled by this session (see below).
  - Existing service accounts: default compute SA, App Engine default SA, `firebase-adminsdk-fbsvc`
    -- **no GitHub Actions / CI deploy service account existed**.
  - Existing Workload Identity Pools: **0** (`gcloud iam workload-identity-pools list`).
  - Project IAM bindings: only GCP-managed service agents plus `roles/owner` for the human owner
    account. No pre-existing WIF-related or CI-related binding of any kind.
  - **Conclusion: no duplicate GCP infrastructure existed. This is genuinely new setup, not a
    re-creation of something already built.**
- GitHub fresh audit: `gh auth status` confirmed authenticated as `perusonao` (the repo owner)
  with `admin: true` repo permission. GitHub Environments: only `github-pages` existed --
  **no `production` Environment existed**. Repository secrets: the four pre-existing
  `VITE_FIREBASE_*` client-config secrets only, nothing deploy-related.

## Local state -- not touched

- `.worktrees/` (untracked) -- left untouched, not committed, not inspected further.
- `stash@{0}` (`temp-before-firebase-121`, on `codex/phase-4a-1b-physical-interaction`) -- left
  untouched, not popped/applied/dropped.
- The original working branch `claude/teto-pizza-firebase-production-wwo9di` -- left as-is, not
  built on. This session's work lives entirely on a new, separate branch (below).

## Branch

`claude/firebase-github-actions-deploy-workflow`, created from a freshly re-fetched `origin/main`
immediately before branching (`f14217b3db1be69308769838e2510773dd7b2b46` -- one commit ahead of
the task's own cited SHA, `#139` Recipe Select 2.0A UI work, confirmed zero overlap with this
session's scope via `git diff --stat`). **Exact HEAD after this session's work:
`a434b99` (see PR for the full SHA).**

Commit history on this branch (temporary test commit intentionally added then removed -- net
diff against `main` is exactly 3 files, see "Changed files" below):

1. `chore: temporary WIF dry-run test workflow (Phase 1 exit criteria)` -- added
2. `chore: remove temporary WIF dry-run test workflow` -- removed, after confirming it could not
   be dispatched pre-merge (see "Phase 1 exit criteria" below)
3. `feat: Firebase production deploy via GitHub Actions (Issue #134)` -- the real, permanent
   workflow + supporting dependency change

## GCP Project

- Project ID: `teto-pizza-game`
- Project Number: `1030600909020`
- Lifecycle state: `ACTIVE`

## Phase 1 -- GCP authentication foundation

### APIs enabled

Only the one missing API was enabled; the other four candidates were already active (confirmed
by listing before enabling anything):

| API | State before this session | Action |
|---|---|---|
| `iam.googleapis.com` | already enabled | none |
| `iamcredentials.googleapis.com` | already enabled | none |
| `sts.googleapis.com` | **not enabled** | **enabled** (`gcloud services enable sts.googleapis.com --project teto-pizza-game`) |
| `cloudresourcemanager.googleapis.com` | already enabled | none |
| `serviceusage.googleapis.com` | already enabled | none |

### Service Account

- Name: `github-actions-deploy`
- Email: `github-actions-deploy@teto-pizza-game.iam.gserviceaccount.com`
- Display name: "GitHub Actions Firebase Deploy"
- No new service account already existed with this or an equivalent purpose (confirmed in the
  fresh-sync audit above) -- created new, not reused, since reuse was not possible.

### IAM roles granted (read back and verified -- exactly these four, nothing broader)

| Role | Scope |
|---|---|
| `roles/cloudfunctions.admin` | project `teto-pizza-game` only |
| `roles/iam.serviceAccountUser` | project `teto-pizza-game` only |
| `roles/firebaserules.admin` | project `teto-pizza-game` only |
| `roles/datastore.indexAdmin` | project `teto-pizza-game` only |

`gcloud projects get-iam-policy teto-pizza-game` was read back after granting and filtered to
this service account's bindings: exactly these four roles appear, nothing else. No
`roles/editor`, `roles/owner`, or "Firebase Admin" role was ever granted to this service account.

## Phase 2 -- Workload Identity Federation

### Pool

- Name: `github-actions-pool`
- Full resource name: `projects/1030600909020/locations/global/workloadIdentityPools/github-actions-pool`
- State: `ACTIVE` (read back via `gcloud iam workload-identity-pools describe`)

### Provider

- Name: `github-actions-provider`
- Full resource name:
  `projects/1030600909020/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider`
- Issuer: `https://token.actions.githubusercontent.com`
- Attribute mapping:
  - `google.subject = assertion.sub`
  - `attribute.repository = assertion.repository`
  - `attribute.repository_owner = assertion.repository_owner`
  - `attribute.ref = assertion.ref`
- **Attribute condition**: `assertion.repository == 'perusonao/teto-pizza-game'` -- restricts to
  this exact repository, not merely the repository owner, per this task's explicit instruction.
- State: `ACTIVE` (read back via `gcloud iam workload-identity-pools providers describe`)

### Service account impersonation binding

Bound at the **service account** resource level (`roles/iam.workloadIdentityUser`), to a
`principalSet` scoped to the `attribute.repository` value, not the whole pool wildcard --
defense in depth on top of the provider's own attribute condition (two independent layers must
both match: the provider only *mints* a token for this exact repo, and the service account only
*accepts* impersonation from a principal carrying this exact repo attribute):

```
principalSet://iam.googleapis.com/projects/1030600909020/locations/global/workloadIdentityPools/github-actions-pool/attribute.repository/perusonao/teto-pizza-game
```

Read back via `gcloud iam service-accounts get-iam-policy` immediately after binding: exactly
this one binding exists, nothing broader (no pool-wide wildcard, no `repository_owner`-only
binding).

## Phase 3 -- GitHub Actions workflow

### Workflow file

`.github/workflows/firebase-production-deploy.yml` (new).

- Trigger: `workflow_dispatch` only, with a `target` choice input (`functions` / `firestore` /
  `all`, default `functions`).
- `permissions: contents: read, id-token: write` (the latter required for OIDC/WIF).
- `concurrency: group: firebase-production-deploy, cancel-in-progress: false` -- a second
  dispatch queues rather than cancels an in-flight deploy.
- `environment: production` -- gates on the required reviewer and the `main`-only branch policy
  (below).
- Belt-and-suspenders `github.ref != 'refs/heads/main'` guard as an explicit first step, on top
  of (not instead of) the Environment's own branch-policy restriction.
- `FIREBASE_PROJECT_ID: teto-pizza-game` is a hardcoded workflow-level `env:`, never a
  `workflow_dispatch` input; every `firebase` CLI call passes `--project
  "$FIREBASE_PROJECT_ID"` explicitly; a `firebase projects:list --project
  "$FIREBASE_PROJECT_ID"` preflight step runs before any install/build/deploy step and fails
  loudly if the WIF identity cannot see that exact project.
- Authentication: `google-github-actions/auth@v2` (`create_credentials_file: true`,
  `export_environment_variables: true` -- the ADC-credentials-file mode `firebase-tools` reads,
  per design doc section 4), reading the WIF provider resource name and service-account email
  from `production`-Environment-scoped **variables** (not secrets -- they are identifiers, see
  "Secret inventory" below), never hardcoded in the workflow file itself.
- `firebase-tools` is installed globally, **pinned to an exact version** (`15.26.0` -- the same
  version already confirmed working for this project's prior owner-run production deploys, per
  `TETO_FIREBASE-PRODUCTION-CONNECTION_Result.md`, and already installed locally on the owner's
  machine), not `npx firebase-tools@latest` -- an unpinned CI-deploy CLI version was judged an
  unacceptable, silent moving target for a production pipeline. This is a deliberate
  implementation decision this session made, since the design doc's assumption that
  `firebase-tools` was already a pinned `functions/package.json` devDependency turned out (fresh
  audit above) not to be true.
- Predeploy gates, exactly matching design doc section 7's table, each conditioned on
  `inputs.target`:
  - `functions` / `all`: `npm ci` (functions), `npm run typecheck`, `npm run lint`, `npm test`,
    `npm run build` (all inside `functions/`).
  - `functions` / `all`: `npx vitest run src/shared` at repo root (the one root-level dependency
    a backend-only deploy needs -- not the full ~2000-test root suite, deliberately, per the
    design doc's own "必要十分なgateに絞り" instruction).
  - `firestore` / `all`: a real Firestore rules emulator test
    (`npx firebase-tools emulators:exec --only firestore --project "$FIREBASE_PROJECT_ID" "npx
    vitest run --config vitest.rules.config.ts"`).
  - A root `npm ci` runs unconditionally (every `target` value needs it for one of the two
    reasons above).
- Deploy steps: `firebase deploy --only functions ...` and `firebase deploy --only
  firestore:rules,firestore:indexes ...`, each independently gated on `inputs.target`, run as two
  separate steps never combined into one `--only` call -- `all` is explicitly non-atomic (design
  doc section 10); if the functions step fails, the firestore step is skipped entirely (default
  GitHub Actions step-failure behavior); a `$GITHUB_STEP_SUMMARY` step (`if: always()`) reports
  which target(s) were attempted and their outcome, and explicitly calls out the non-atomic
  `all` case with the documented recovery path (re-dispatch `target: firestore` alone).
- Firebase Hosting is never referenced anywhere in this file.

### Supporting dependency change

`@firebase/rules-unit-testing@^5.0.2` added as a pinned root `devDependency` (and
`package-lock.json` updated accordingly, 13 lines added, `npm install --save-dev
@firebase/rules-unit-testing@5.0.2`). This package was previously installed ad-hoc
(`npm install --no-save ...`) by prior manual sessions (see
`TETO_FIREBASE-PRODUCTION-CONNECTION_Result.md`) rather than pinned -- the new workflow's
Firestore-rules-emulator gate needs a reproducible, lockfile-pinned install (`npm ci`), so this
session added it properly. Confirmed **not** to affect the normal `npm test` run: `vitest.config.ts`
only includes `src/**/*.test.ts`/`src/**/*.test.tsx`, and `firestore.rules.test.ts` lives at the
repo root (outside `src/`), picked up only by the separate `vitest.rules.config.ts` -- matching
that file's own header comment, unchanged in intent.

## GitHub Environment

`production` (new -- did not exist before this session). Created and configured entirely via the
GitHub REST API (`gh api`), since the authenticated `gh` session already has `admin: true` on this
repository -- **no browser action was required or requested from the user for this part.**

| Setting | Value |
|---|---|
| Required reviewers | `perusonao` (the repo owner / authenticated account, user id `300333536`) |
| Prevent self-review | off (default) -- matches design doc section 12's documented, explicit trade-off for a single-owner repo |
| Wait timer | 0 |
| Deployment branch policy | restricted to `main` only (`protected_branches: false`, `custom_branch_policies: true`, one custom policy: branch `main`) |
| Environment variables | `FIREBASE_WIF_PROVIDER` = `projects/1030600909020/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider`; `FIREBASE_DEPLOY_SA_EMAIL` = `github-actions-deploy@teto-pizza-game.iam.gserviceaccount.com` -- both identifiers, not secrets, stored as Environment (not repository-wide) variables per design doc section 12 |

All of the above was read back after creation via `gh api repos/perusonao/teto-pizza-game/environments/production`,
`.../deployment-branch-policies`, and `.../variables` -- confirmed to match exactly what was
requested, nothing extra.

## Deploy targets

Cloud Functions (`submitLunchRushScore`, `setDisplayName`) and Firestore rules/indexes only.
**Firebase Hosting is never a deploy target of this workflow** -- production hosting remains
GitHub Pages (`deploy.yml`, unmodified, unaffected by this PR).

## Predeploy gates

See "Workflow file" above -- functions typecheck/lint/test/build, a real Firestore rules
emulator test, and a scoped `src/shared` root test. The full ~2000-test root suite is
deliberately **not** run by this workflow (already covered by `ci.yml`/`deploy.yml` on every
PR/push; irrelevant to a backend-only deploy).

## Security checks

- No long-lived Google credential (no service-account JSON key, no `FIREBASE_TOKEN`) was created
  or stored anywhere -- authentication is WIF-only, a short-lived token minted per run.
- `git diff` (all three commits) scanned for `private_key`, `BEGIN ... PRIVATE`,
  `service_account` (as a value, not a name/comment), and Firebase Web API key literal patterns
  -- none found. Every identifier this session created (SA email, WIF pool/provider resource
  names) appears only in the workflow file (as a *reference* to a GitHub Environment variable,
  not a literal secret) and in this report -- none of them are secret values; leaking them alone
  grants no access without the OIDC-bound attribute condition also matching.
  - **A raw impersonated OAuth access token was deliberately never printed or captured anywhere
    in this session** -- an attempt to do so for local verification purposes was blocked by this
    session's own tool-use safety classifier, and this session did not attempt to work around
    that block (see "What was NOT verified" below for what this means for verification depth).
- Repository restriction: enforced twice independently (provider `attributeCondition` +
  service-account-level `principalSet` scoped to the same repository attribute) -- confirmed via
  read-back, not assumed from the `gcloud create` command's own success alone.
- Branch restriction: enforced twice independently (GitHub Environment deployment-branch-policy
  restricted to `main` + an in-workflow `github.ref` assertion) -- confirmed via read-back.
- `.firebaserc` is never read or relied upon by the workflow (it doesn't exist in CI); every
  `firebase` CLI call passes `--project teto-pizza-game` explicitly.
- IAM is scoped to exactly four named roles, all project-level, all read back and confirmed --
  no role grants `*.delete` beyond what each named role's own documented permission set already
  includes (e.g. `cloudfunctions.admin` includes function deletion by design -- this was accepted
  as-is from the design doc's own role table, not narrowed further, since the design doc treats
  it as the documented CI-deployer minimum).
- YAML syntax of the new workflow file validated with `python`+`PyYAML`
  (`yaml.safe_load`) -- parses cleanly, correct top-level keys (`workflow_dispatch` trigger,
  `permissions`, one `deploy` job, 17 steps).

## Tests / typecheck / lint / build -- what was and was not verified locally

**Local verification of `npm test` / `npm run lint` / `npm run build` (root and `functions/`)
was blocked by this machine's own outdated Node.js.** This machine's system Node is `v20.8.1`;
this repository's current toolchain (`vitest@^5.0.0`, `oxlint@^1.81.0`, `vite@^8.3.0`/rolldown)
requires `node ^20.19.0 || >=22.12.0` (confirmed via the exact `EBADENGINE` warnings `npm
install` itself printed, and via a real runtime failure -- `oxlint`'s own binary and
`vitest`/rolldown both failed to even start on this Node version, with concrete stack traces, not
merely a version-mismatch guess). No alternate Node version or version manager (`nvm`, `fnm`,
etc.) was found on this machine. **This is a pre-existing local-environment limitation, unrelated
to and not caused by this session's changes** -- the same commands would fail identically on
this machine against `main`'s current `HEAD` with zero files touched.

This is not equivalent to "untested": the repository's own `ci.yml` already runs `npm ci && npm
run lint && npm test && npm run build` successfully on every PR via GitHub's own
`actions/setup-node@v4` with `node-version: 20` (which resolves to a current 20.x release,
satisfying the `^20.19.0` floor) -- the new workflow uses the identical `setup-node`
configuration for the same Node major version, so it inherits that already-proven-working setup
rather than introducing a new one. What this session's own local environment could **not** do is
re-run that proof itself, or specifically verify the two-line `functions/package.json` and
one-line `package.json` dependency change against a live `npm test` here. The `git diff` for
both `package.json` changes is minimal (a `^5.0.2` devDependency addition and its
`package-lock.json` entries) and was manually reviewed instead.

**Verified locally, successfully:**
- YAML syntax of the new workflow file (`PyYAML` `safe_load`).
- `npm install --save-dev @firebase/rules-unit-testing@5.0.2` itself completed successfully (0
  vulnerabilities, peer dependency `firebase: ^12.0.0` satisfied by this repo's existing
  `firebase: ^12.19.0`).
- `git diff`/`git status` review of every changed file, three times (once per commit).

**Verified on the real GitHub Actions runner (this PR's own `ci.yml` run, after opening the
PR)**: the `build` job (`npm ci && npm run lint && npm test && npm run build`, root only, the
same `node-version: 20` / `actions/setup-node@v4` configuration the new workflow also uses)
**passed** -- <https://github.com/perusonao/teto-pizza-game/actions/runs/35568703609> (1m13s).
This directly confirms, on the actual target environment rather than this session's
version-mismatched local machine, that the `@firebase/rules-unit-testing` devDependency addition
does not break the existing root lint/test/build pipeline, and that `node-version: 20` resolves
to a compliant Node release in GitHub's own runner image (closing the local-only gap above for
everything `ci.yml` itself exercises). It does **not** by itself exercise
`firebase-production-deploy.yml`'s own functions-specific or Firestore-rules-emulator steps,
which only run on an actual `workflow_dispatch` of that workflow (see "What was NOT verified"
below).

## What was NOT verified (honest limitation, not a gap papered over)

Design doc section 18's own Phase 1 exit criteria is "a manual, harmless dry run ... proving the
WIF token can actually authenticate against `teto-pizza-game`". This session attempted exactly
that, live, via a temporary throwaway workflow (`.github/workflows/_wif-dry-run-test.yml`,
`workflow_dispatch`-only, no `environment:` gate, no deploy capability, just
`google-github-actions/auth` + `firebase projects:list --project teto-pizza-game`). **This
confirmed, live and empirically (not assumed), that GitHub's `workflow_dispatch` API refuses to
dispatch a workflow that exists only on a non-default branch** (`HTTP 404: workflow ... not
found on the default branch`, tested against this exact branch and file). The temporary test
workflow was therefore removed before finishing (see commit history above) -- **a true live WIF
authentication test cannot happen until this PR merges to `main`.** This is a real, now-confirmed
constraint of GitHub's own platform, not a decision this session made, and matches design doc
Phase 3's own framing (a real `workflow_dispatch` run is the next phase, after the workflow-file
PR merges).

As a partial substitute, this session attempted to verify the four granted IAM roles are
sufficient by impersonating the new service account with the owner's own `gcloud` credentials
locally (`gcloud auth print-access-token --impersonate-service-account=...`) -- **this was
blocked by this session's own tool-use safety classifier** (printing a live, even if short-lived,
OAuth access token was treated as sensitive output) and this session did not attempt to route
around that block. **Net effect: the four IAM roles' sufficiency for a real `firebase deploy`
has not been empirically proven by this session** -- only cross-checked against Google/Firebase's
own IAM documentation (inherited from the Phase 0 design doc's own verified research, which
itself already disclosed this same limitation and named the real dry-run as the actual proof).
**Recommended immediate next step after this PR is reviewed and merged**: recreate a
throwaway `workflow_dispatch`-only, no-environment-gate test workflow like the one this session
removed (or simply dispatch this PR's real `firebase-production-deploy.yml` with `target:
firestore` -- the smallest, already-safely-re-deployable target per design doc section 18 Phase
4) and read its logs before trusting the IAM role list as final; widen a role only in response to
a real, logged permission-denied error, one role at a time, exactly as design doc section 5
instructs.

## Changed files

| File | Change |
|---|---|
| `.github/workflows/firebase-production-deploy.yml` | new |
| `package.json` | `+1` line (`@firebase/rules-unit-testing` devDependency) |
| `package-lock.json` | `+13` lines (lockfile entries for the above) |
| `docs/reports/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_Phase1-2_Result.md` | new (this file) |

No `firestore.rules`, `firestore.indexes.json`, `functions/*`, `src/*` (other than the
`package.json`/`package-lock.json` root manifest change above), or `.github/workflows/ci.yml` /
`.github/workflows/deploy.yml` file was touched. A temporary test workflow
(`_wif-dry-run-test.yml`) was added and removed within this branch's own history -- it does not
appear in the final diff against `main` (confirmed via `git diff origin/main...HEAD --stat`:
exactly the three files above).

## Manual steps still required (owner)

1. **Review and merge this PR.** Not done by this session (explicit stop condition).
2. **Immediately after merging**, before dispatching any real deploy target: re-verify the WIF
   authentication path actually works end-to-end from GitHub Actions (see "What was NOT
   verified" above) -- either via a throwaway test workflow, or by dispatching this workflow
   with `target: firestore` (the smallest, safely-re-deployable target, since Firestore
   rules/indexes are already live and idempotent to redeploy) and reading the run's logs before
   trusting it for `functions`.
3. **Approve each real deploy dispatch** at the `production` Environment's required-reviewer
   gate. Self-approval is allowed (the account that dispatches can also approve), per this
   design's own documented single-owner trade-off -- not a gap this session introduced.
4. If a future `functions`/`all` deploy is dispatched, be aware `setDisplayName` (Player Profile
   1.0 Phase 1A) is merged to `main` but **not yet live in production** -- this will be the first
   time it deploys; confirm this is intended before that particular dispatch.

Nothing else requires manual/browser action -- the `production` Environment, its required
reviewer, its branch policy, and its variables were all created via the GitHub API by this
session, not left for the user to click through.

## Production deploy status

**Not performed.** No `firebase deploy` command was run by this session against `teto-pizza-game`
(the only `firebase` CLI invocation actually run was the design doc's own already-confirmed-safe
read path considerations documented above -- no deploy, no write). This matches the task's
explicit stop condition ("productionへ実際にdeployする直前では一旦停止").

## Rollback procedure

Per design doc section 11: **not** an arbitrary-SHA redeploy. `git revert` the bad commit(s) on
`main` through a normal reviewed PR, merge, then `workflow_dispatch` this same workflow (target
`functions` and/or `firestore`, as needed) through the same `production` Environment gate. This
keeps "only `main`, only reviewed" intact during rollback too.

To roll back **this PR's own infrastructure** (if ever needed, independent of any future
production deploy):

```bash
# Remove the WIF trust and deploy identity (GCP)
gcloud iam service-accounts delete github-actions-deploy@teto-pizza-game.iam.gserviceaccount.com --project teto-pizza-game
gcloud iam workload-identity-pools providers delete github-actions-provider --project teto-pizza-game --location global --workload-identity-pool github-actions-pool
gcloud iam workload-identity-pools delete github-actions-pool --project teto-pizza-game --location global

# Remove the GitHub Environment (via GitHub Settings -> Environments -> production -> Delete,
# or `gh api --method DELETE repos/perusonao/teto-pizza-game/environments/production`)
```

No existing Firebase Functions, Firestore rules, or Firestore indexes were touched, so none of
the above affects anything already live in production.

## Known limitations

- Local test/lint/build re-verification was blocked by this machine's outdated Node.js (see
  above) -- inherited risk, not new, and the new workflow reuses `ci.yml`'s already-proven
  `setup-node`/Node-20 configuration rather than a novel one.
- The true end-to-end WIF/OIDC authentication path has not been proven by a real GitHub Actions
  run (confirmed impossible pre-merge, not merely untried) -- recommended as the very first
  post-merge action, before any real deploy dispatch.
- The four granted IAM roles are a verified **starting point** (per design doc section 5's own
  framing), not empirically proven sufficient by this session (the local impersonation test was
  blocked by this session's own safety tooling, deliberately not routed around) -- widen one role
  at a time only in response to a real, logged permission-denied error from an actual dispatch.
- `setDisplayName` (Player Profile 1.0 Phase 1A) remains undeployed to production; this PR does
  not deploy it and does not change that state -- flagged only so the first real `functions`/
  `all` dispatch through this new workflow doesn't treat that as a surprise.
- `roles/cloudfunctions.admin` includes function *deletion*, not just deploy/update -- accepted
  as-is from the design doc's own documented CI-deployer-minimum role, not narrowed to a
  more restrictive custom role by this session.

## Next step

1. Owner reviews and merges this PR (or requests changes).
2. Immediately post-merge: live WIF dry-run verification (see "Manual steps still required" #2).
3. Design doc Phase 3 (a full dry run through every gate, stopping short of the real `firebase
   deploy` calls) and Phase 4 (the first real production deploy, recommended smallest-first:
   `target: firestore`) -- both owner-driven, both out of this session's scope per the explicit
   stop condition on production deploy.
4. Design doc Phase 5 (an owner-only iPhone-from-scratch smoke test) once Phases 3-4 are done.

No credential, token, or private key value appears anywhere in this report.
