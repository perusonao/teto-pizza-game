# Firebase Production Deploy via GitHub Actions -- Phase 0 Fresh Design

Status: **design only, Phase 0**. This document specifies a *future* `.github/workflows/`
Firebase production-deploy workflow. **No workflow file is created or modified by this
document or its PR.** No Firebase production deploy is performed. No GitHub Secret, GitHub
Environment, GCP service account, or Workload Identity Federation (WIF) pool is created. See
the companion Result Report (`docs/reports/
TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_Phase0_Fresh-Design_Result.md`) for the fresh
audit this design is based on, and section 18 below for the phased implementation plan that
actually builds this.

## 0. Why this exists

Today, Firebase production deploys (`firebase deploy --only functions`, `firebase deploy
--only firestore:rules,firestore:indexes`) are run manually from the project owner's own PC
(see `docs/reports/TETO_FIREBASE-PRODUCTION-CONNECTION_Result.md`). When the owner cannot use
that PC, no one can ship a backend change to production, even though the frontend
(`https://perusonao.github.io/teto-pizza-game/`, GitHub Pages) already deploys automatically
on every push to `main`.

The goal is **not** "push to `main` -> auto-deploy Firebase". It is: let the owner start and
confirm a Firebase production deploy from GitHub's own UI (including from an iPhone browser or
the GitHub mobile app), with the same or better safety margin than today's manual process --
explicit target selection, a second confirmation step, no long-lived deploy credential sitting
in GitHub Secrets, and no path for an unreviewed branch or a fork PR to ever reach production.

## 1. Current state (fresh-audited; see Result Report for exact commands/SHAs)

- `.github/workflows/ci.yml` -- PR-only (`pull_request: branches: [main]`), lint + test +
  build. No Firebase involvement.
- `.github/workflows/deploy.yml` -- GitHub Pages only. Triggers on push to `main` and
  `workflow_dispatch`. Builds the Vite frontend with four `VITE_FIREBASE_*` **client config**
  secrets (Web SDK config, not deploy credentials -- see section 13) and publishes to Pages.
  **No Firebase CLI, no Firestore/Functions deploy step exists anywhere in this repo today.**
- `firebase.json` -- `functions` (codebase `default`, `predeploy: npm --prefix functions run
  build`) + `firestore` (`rules`/`indexes`) + `emulators`. **No `hosting` key** -- Firebase
  Hosting is correctly never used; GitHub Pages remains the only production frontend.
- `.firebaserc` is **gitignored** (`.gitignore` line 20) and does not exist in this repo or in
  any CI checkout -- only `.firebaserc.example` (a placeholder) is committed. Any future
  workflow must not assume `.firebaserc` exists.
- Two Cloud Functions, both `onCall`, both pinned to `{ region: "asia-northeast1" }`
  (`functions/src/index.ts`): `submitLunchRushScore` (Firebase Ranking 1.0 Phase 1B, live in
  production per `TETO_FIREBASE-PRODUCTION-CONNECTION_Result.md`) and `setDisplayName` (Player
  Profile 1.0 Phase 1A, merged to `main` via PR #131 but **not yet deployed** -- see section 15
  and the Player Profile Phase 1A Result Report's own "Not deployed" line).
- `firestore.rules` on `main` already includes the Phase 1A `users/{uid}` rule (owner-read,
  all-writes-denied) -- this rule text is merged but, per the same not-yet-deployed finding,
  its live-production status is unconfirmed and must not be assumed.
- No Firebase deploy workflow, no manual-Firebase-deploy workflow, no `workflow_dispatch`
  Firebase deploy, no service-account/WIF setup, and no equivalent open Issue or PR exist in
  this repository today (Duplicate Gate; see Result Report section "Duplicate Gate").

## 2. Target UX

```
Owner, on iPhone (Safari or the GitHub app)
  -> repo -> Actions tab
  -> "Firebase Production Deploy" workflow
  -> Run workflow
       - Use workflow from: Branch: main   (GitHub Environment branch policy forces this)
       - target: functions | firestore | all   (dropdown, default: functions)
  -> Run workflow
  -> job pauses at the `production` Environment gate
  -> Actions tab -> the waiting run -> Review deployments -> Approve and deploy
  -> job resumes: checkout main -> install -> typecheck/lint/test (backend-scoped only)
     -> project-ID guard -> firebase deploy --only <target> --project teto-pizza-game
  -> job summary shows target(s) attempted / succeeded / failed
```

Three targets only (`functions`, `firestore`, `all`) -- deliberately not split further (e.g.
`firestore:rules` vs `firestore:indexes` separately), since both are always deployed together
in this project's history and an index-only or rules-only production need has not occurred
yet. `all` runs functions then firestore as two independent steps, never a single combined
command (section 10).

## 3. Trigger strategy

| | A. push-to-main auto-deploy | B. workflow_dispatch, no gate | **C. workflow_dispatch + Environment approval (recommended)** | D. tag/release-based | E. issue-comment `/deploy` |
|---|---|---|---|---|---|
| iPhone operability | N/A (no button to press; deploy just happens) | Good -- Actions tab, one tap | Good -- one tap to dispatch, one tap to approve | Poor -- must create a tag/release each time, extra ceremony | Poor -- must build/maintain comment-auth logic safely |
| Accidental-deploy risk | **High** -- any merged docs/frontend-only PR to `main` would also fire a backend deploy unless carefully path-filtered, and path filters alone don't stop a bad merge from deploying immediately | Medium -- one intentional click still deploys immediately, no second confirmation | **Low** -- dispatch is intentional, and a second, explicit "Approve and deploy" click is required before anything runs | Low, but tagging discipline itself becomes a new failure mode | Medium-high -- anyone who can comment could attempt to trigger if the auth check has a bug |
| Security (fork/PR risk) | Push to `main` only, but couples deploy timing to merge timing -- no room for "merge now, deploy later after owner confirms" | `workflow_dispatch` already requires repo write access, so a fork PR can never trigger it (confirmed; see Result Report) | Same base protection as B, plus the Environment's own deployment-branch-policy (main only) and required-reviewer gate as defense in depth | Same as B, tag creation itself requires write access | Requires bespoke authorization logic in the workflow -- an extra thing to get wrong |
| Rollback / auditability | Deploy history is just "whatever `main`'s HEAD was" -- no separate deploy log | GitHub Actions run history is the log | **Best** -- GitHub Environments keep a first-class "Deployments" history (who approved, when, which run) separate from commit history | Good (tags are a natural deploy log) but adds process overhead | Poor -- history lives in issue/PR comments, harder to audit |
| Maintenance / complexity | Simplest to wire, hardest to make safe | Simple | Slightly more setup (one Environment, one reviewer list) but simple to operate | Needs a tagging convention and discipline | Highest -- custom trigger-auth code to write and maintain |
| Owner workload | Zero (automatic) -- but that's exactly the risk this task explicitly rejects | One tap | Two taps (dispatch + approve) -- an intentional, small amount of friction | One extra step (create the tag/release) before the two taps | Type a comment correctly |
| Cost | Free | Free | Free -- required reviewers are available for **public** repositories on every GitHub plan including Free (confirmed; see Result Report) | Free | Free |

**Recommended: C -- `workflow_dispatch` + GitHub Environment `production` with a required
reviewer.** This repository is public (`perusonao/teto-pizza-game`, confirmed via the GitHub
API), so Environment protection rules (required reviewers, deployment branch policy,
deployment history) are fully available on the Free plan -- no GitHub Team/Enterprise upgrade
needed. This was explicitly re-verified rather than assumed, since required reviewers are
**not** available for *private* repositories below Enterprise.

The task's own first-candidate design (workflow_dispatch + Environment + manual approval) is
confirmed feasible as-is; no fallback design is needed.

## 4. Firebase/GCP authentication strategy

| | A. `FIREBASE_TOKEN` (`firebase login:ci`) | B. Service-account JSON key | **C. GitHub OIDC + Workload Identity Federation (recommended)** |
|---|---|---|---|
| Long-lived secret | Yes -- a long-lived refresh token in a GitHub Secret | Yes -- a long-lived private key in a GitHub Secret | **No** -- no credential is stored in GitHub at all; each run mints a short-lived token via OIDC |
| Rotation | Manual, easy to forget | Manual, easy to forget | Automatic (per-run) |
| Leak impact | Full account-level Firebase CLI access until manually revoked | Full access to whatever the key's IAM roles grant, until manually deleted | Minimal -- a leaked GitHub Actions log cannot reproduce a WIF token (they're short-lived and bound to the specific run), and no static credential exists to steal from GitHub Secrets |
| Setup difficulty | Low (one CLI command) but this login flow is Google's own legacy/deprecated CI-auth path | Low-medium (create SA, download key, paste into Secrets) | Medium -- one-time GCP setup (WIF pool, provider, attribute condition, IAM bindings) |
| iPhone-only initial setup feasibility | Needs a CLI (`firebase login:ci`) -- **not** iPhone-only | Needs GCP Console (browser-only, so technically iPhone-capable, but pasting a multi-KB JSON key into a GitHub Secret from an iPhone is impractical) | GCP Console-only (`gcloud` CLI is the documented path, but the WIF pool/provider/IAM bindings can also be created from the Console UI) -- see section 14 for the honest iPhone-only verdict |
| Firebase CLI compatibility | Yes (this is what it was built for) | Yes | Yes, **as of the current `firebase-tools`/Firebase Admin SDK generation** -- WIF support landed after an earlier gap (see below); must pin a `firebase-tools` version confirmed to include it |
| Least privilege | Coarse -- tied to a whole Google account's Firebase CLI permissions | Fine-grained (whatever IAM roles the SA has) | Fine-grained, same as B, plus the credential itself cannot be reused outside the exact GitHub repo/workflow the attribute condition names |
| Current Google/Firebase recommendation | Legacy path, superseded | Still supported, still common, but Google's own CI/CD guidance now steers toward WIF for exactly the reasons in this table | **Current recommendation** for GitHub Actions -> GCP |

**Recommended: C -- GitHub OIDC + Workload Identity Federation**, using
`google-github-actions/auth` with `create_credentials_file: true` and
`export_environment_variables: true` (this is what makes `GOOGLE_APPLICATION_CREDENTIALS`
available to `firebase-tools`, which reads Application Default Credentials).

**This was verified against current tooling, not assumed:**
- `google-github-actions/auth`'s own documentation confirms the ADC-credentials-file mode
  (`create_credentials_file`/`export_environment_variables`) is the mode that downstream tools
  reading `GOOGLE_APPLICATION_CREDENTIALS` (which includes `firebase-tools`) should use. A
  *different* mode of that action -- requesting a raw GitHub OIDC **ID token** as an output --
  is explicitly documented as **not** supported by the Firebase Admin SDK; this design uses the
  ADC-credentials-file mode, not the ID-token mode, so that limitation does not apply here.
- **Known historical gap, now closed:** `firebase-tools` issue #3926 documented that
  `GOOGLE_APPLICATION_CREDENTIALS` pointing at a WIF (`external_account`-type) credential file
  failed with `"The incoming JSON object does not contain a client_email field"` -- i.e.
  `firebase-tools` originally only understood traditional service-account-key JSON, not WIF's
  `external_account` format. Third-party tooling built specifically to work around this
  confirms native support was added **as of November 12, 2024**. Since this design is being
  written well after that date, native `firebase-tools` + WIF should work -- **but Phase 1's
  own exit criteria (section 18) is a real, harmless dry-run command
  (`firebase projects:list --project teto-pizza-game`) proving this against whatever
  `firebase-tools` version is actually pinned in this repo (`functions/package.json`
  `devDependencies.firebase-tools`) at implementation time, rather than trusting this document's
  research date indefinitely.**
- Always add an attribute condition restricting the WIF pool to this exact repository (e.g.
  `assertion.repository == 'perusonao/teto-pizza-game'`), narrower than the
  repository-owner-only example in Google's own `google-github-actions/auth` documentation.

App Check (section 16) is a separate, later concern -- it authenticates the **client app**
calling Firebase, not the **deploy pipeline** authenticating to Firebase/GCP. Adopting WIF now
does not need to be redone when App Check is added later; they are orthogonal.

## 5. Least privilege / IAM

No `roles/editor`, `roles/owner`, or a broad "Firebase Admin" role is granted to the deploy
service account. Confirmed current predefined-role names (Google/Firebase IAM documentation,
Cloud Functions IAM docs, and cross-checked against a community WIF-based Functions-deploy
action's own documented minimal setup):

| Role | Why | functions | firestore | both |
|---|---|---|---|---|
| `roles/cloudfunctions.admin` | Full deploy/update/delete rights over Cloud Functions (2nd gen) -- the documented minimum for a CI deployer per Firebase's own IAM permissions reference | required | -- | required |
| `roles/iam.serviceAccountUser` | Lets the deployer "act as" the Function's runtime service account and the Cloud Build service account during a Gen 2 deploy (Gen 2 functions build via Cloud Build and run on Cloud Run under the hood) -- without this, a Gen 2 deploy fails with an `iam.serviceaccounts.actAs`-denied error even with `cloudfunctions.admin` alone | required | -- | required |
| `roles/firebaserules.admin` | Deploy (release) Firestore Security Rules | -- | required | required |
| `roles/datastore.indexAdmin` | Create/modify/delete Firestore composite indexes | -- | required | required |

**Explicitly not granted, unless a real deploy failure proves it necessary** (add narrowly,
never jump straight to a broad role): `roles/run.admin`, `roles/run.sourceDeveloper`,
`roles/serviceusage.serviceUsageConsumer`, `roles/cloudbuild.builds.editor`,
`roles/artifactregistry.admin`. Gen 2 Cloud Functions deploys have a documented tendency to
need one or more of these depending on exact project history (e.g. whether the
`cloud-run-source-deploy` Artifact Registry repository already exists, which Cloud Build
version is used) -- **this is exactly why Phase 1's exit criteria is a real dry-run deploy
against `teto-pizza-game`, not a checklist assumed to be complete from documentation alone.**
Start from the four roles above; widen only in response to a specific, logged
permission-denied error, one role at a time, and record which one was actually needed in the
Phase 1/2 Result Report.

This project's Cloud Functions are both Gen 2 (`firebase-functions/v2/https`'s `onCall`), both
in `asia-northeast1`, both HTTPS-callable (no Eventarc/Pub-Sub trigger) -- so no
`roles/eventarc.admin` or similar trigger-plumbing role is needed.

**Never**: `roles/owner`, `roles/editor`, `Firebase Admin` (the broad predefined role), or any
role granted at the organization/folder level -- every role above is bound to the
`teto-pizza-game` project only, to this one deploy service account only.

**Update (real production dry-run, Phase 4b, see
`docs/reports/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_Phase3_Verification_Result.md`
Session 6)**: exactly one additional permission was needed beyond the four roles above --
`firebase.projects.get`, required by `firebase-tools`' own `GET
.../v1beta1/projects/{project}/adminSdkConfig` call early in `firebase deploy --only functions`
(confirmed from a real failed run's log, not assumed). No predefined role scopes this narrowly
(the smallest predefined role containing it, `roles/firebase.viewer`, carries 300+ read
permissions across every Firebase product, most unrelated to this project). Per this section's
own "widen only in response to a specific, logged permission-denied error, one role at a time"
instruction, a **project-scoped custom role** (`projects/teto-pizza-game/roles/firebaseProjectsGetOnly`,
exactly one included permission) was created and bound instead of adopting a broader predefined
role -- keeping the deploy service account's total grant at five narrowly-scoped roles, still
project-bound, still nothing broader than what a real, logged failure proved necessary.

## 6. Workflow design (future file, not created this phase)

`.github/workflows/firebase-production-deploy.yml` (name TBD at Phase 2):

```yaml
on:
  workflow_dispatch:
    inputs:
      target:
        type: choice
        options: [functions, firestore, all]
        default: functions

permissions:
  contents: read
  id-token: write   # required for OIDC/WIF

concurrency:
  group: firebase-production-deploy
  cancel-in-progress: false   # never cancel a deploy already in flight

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production   # gates on required reviewer + branch policy (main only)
    env:
      FIREBASE_PROJECT_ID: teto-pizza-game   # hardcoded constant, not an input, not a secret
    steps:
      - checkout (main, whatever commit the Environment's branch policy admitted)
      - setup-node
      - google-github-actions/auth (WIF)
      - project-ID guard (section 8)
      - npm ci (root) -- only if target needs src/shared/* coverage
      - npm --prefix functions ci / typecheck / lint / test / build -- if target is functions or all
      - firestore rules emulator test -- if target is firestore or all
      - firebase deploy --only functions --project "$FIREBASE_PROJECT_ID" --non-interactive
        -- if target is functions or all
      - firebase deploy --only firestore:rules,firestore:indexes --project "$FIREBASE_PROJECT_ID" --non-interactive
        -- if target is firestore or all
      - write $GITHUB_STEP_SUMMARY (section 10)
```

No `ref`/SHA input is exposed to the operator. `workflow_dispatch`'s own branch selector, *and*
the `production` Environment's deployment-branch-policy (restricted to `main`), together mean
this workflow can only ever run against `main`'s current tip -- an arbitrary unreviewed branch
or an arbitrary older commit is never selectable from the UI. A belt-and-suspenders in-workflow
check (`if: github.ref != 'refs/heads/main' then fail`) is added as well, since Environment
branch policies are a GitHub setting that could in principle be misconfigured later -- the
workflow should not rely on that setting alone.

`concurrency: cancel-in-progress: false` is deliberate -- a second dispatch while one deploy is
still running should queue, not cancel an in-flight Firebase deploy (an interrupted `firebase
deploy` mid-upload is worse than a short wait).

## 7. Pre-deploy gates

| Gate | Runs for | Rationale |
|---|---|---|
| `github.ref == 'refs/heads/main'` assertion | always | belt-and-suspenders on top of the Environment branch policy (section 6) |
| Project-ID guard (section 8) | always, before any deploy step | the single highest-value gate against "deployed to the wrong Firebase project" |
| `functions`: `npm ci && npm run typecheck && npm run lint && npm test && npm run build` | `functions`/`all` | exactly what `TETO_FIREBASE-PRODUCTION-CONNECTION_Result.md`'s own prior sessions ran by hand before every deploy; `functions/package.json`'s `deploy` script already chains `build` -> `firebase deploy`, this workflow keeps `typecheck`/`lint`/`test` explicit and visible as separate steps/checks rather than folded into one opaque script |
| `firestore.rules.test.ts` against a real local Firestore emulator | `firestore`/`all` | this is the one gate that actually exercises the rule text before it goes live -- the only realistic substitute for a true `firebase deploy --dry-run` (Phase 0 found no reliable current dry-run flag for `firestore:rules` deploy across `firebase-tools` versions; do not assume one exists without checking the exact pinned version at Phase 2/3) |
| `npx vitest run src/shared` (root, scoped) | `functions`/`all` | `functions/`'s Cloud Functions import `src/shared/lunchRushScoring.ts` and `src/shared/lunchRushPeriodIds.ts` at build time (bundled by esbuild, section 1) -- this is the one root-level dependency a backend-only deploy actually needs covered |
| **NOT** run: the full root suite (2000+ tests, gameplay/UI/economy/progression/etc.) | never, for this workflow | those tests cover frontend gameplay code this workflow never touches or deploys; GitHub Pages' own `ci.yml`/`deploy.yml` already cover that surface on every PR/push. Running ~2000 unrelated tests on every backend deploy would add minutes of pure overhead with no safety benefit -- deliberately scoped out, per this task's own "必要十分なgateに絞り" instruction |

## 8. Project-ID guard

`.firebaserc` does not exist in CI (section 1) and must never be relied on, generated from an
operator-supplied input, or trusted as the sole guard. Instead:

1. `FIREBASE_PROJECT_ID: teto-pizza-game` is a **hardcoded workflow-level `env:` constant** --
   not a `workflow_dispatch` input, so the operator cannot type (or mistype) a different
   project id at dispatch time at all.
2. Every `firebase` CLI invocation in the workflow passes `--project "$FIREBASE_PROJECT_ID"`
   explicitly -- never an implicit `firebase use`-selected default.
3. A preflight step runs `firebase projects:list --project "$FIREBASE_PROJECT_ID"` (or
   equivalent) before any deploy step, confirming the authenticated WIF identity actually has
   access to exactly that project id, and fails loudly (not silently) otherwise.
4. The WIF service account's IAM roles (section 5) are themselves bound to the
   `teto-pizza-game` project only -- even a compromised or misconfigured workflow step cannot
   reach any *other* GCP project, because the credential has no permissions there at all. This
   is a stronger guard than any in-workflow string check, since it holds even if the
   `--project` flag were somehow omitted from a future edit.

This does not depend on `.firebaserc` alias correctness at all, per this task's own instruction
not to rely on that alone.

## 9. Deploy targets (current `firebase-tools` command shape)

```bash
# functions
firebase deploy --only functions --project teto-pizza-game --non-interactive

# firestore
firebase deploy --only firestore:rules,firestore:indexes --project teto-pizza-game --non-interactive

# all: the two commands above, run sequentially as two separate steps (never combined
# into one --only functions,firestore:rules,firestore:indexes call -- see section 10)
```

`firebase.json`'s existing `functions[0].predeploy` (`npm --prefix functions run build`) runs
automatically before the `functions` deploy call -- no separate manual build step is needed in
the workflow beyond the explicit `typecheck`/`lint`/`test` gates in section 7, which exist for
visibility (separate CI check annotations) rather than because the predeploy hook wouldn't
otherwise catch a broken build.

`--non-interactive` is required in CI (no TTY to answer an interactive prompt); Phase 2 should
confirm the exact current `firebase-tools` flag name against the version actually pinned
(`--non-interactive` has been stable for a long time, but this is exactly the kind of detail
Phase 2's implementation should re-verify against the live CLI `--help` output rather than trust
this document indefinitely).

## 10. Failure / partial deploy handling

`all` is **explicitly not atomic**. It runs as two independent steps in one job:

1. `functions` deploy step.
2. `firestore` deploy step -- only reached if step 1 succeeded (default GitHub Actions
   step-failure behavior: a failed step stops the job, later steps are skipped).

If step 1 fails: the job fails, step 2 never runs, nothing new was deployed to Firestore rules/
indexes -- a clean, fully-failed state, easy to reason about.

If step 1 succeeds and step 2 fails: this **is** a genuine partial-deploy state (new Functions
code is live; Firestore rules/indexes are still whatever they were before this run) -- the
workflow cannot and does not pretend otherwise. The job summary (`$GITHUB_STEP_SUMMARY`)
explicitly lists each target attempted and its pass/fail outcome, so this state is visible on
the run page itself, not just inferrable from which steps have a green check. The operator's
next action in that case is to re-dispatch with `target: firestore` once the underlying
firestore failure is fixed -- functions does not need to be redeployed again.

`functions` and `firestore` (single-target dispatches) have no partial-deploy question at all
-- each is already the smallest unit this workflow offers.

## 11. Rollback

**Not** "redeploy any arbitrary SHA" -- that would reopen exactly the unreviewed-branch risk
this design exists to close. The supported rollback path is:

```
bad change found in production
  -> open a normal PR that `git revert`s the bad commit(s) on `main`
  -> PR reviewed and merged through the repo's normal review process
  -> new `main` tip is the "previous known-good" code, now itself a reviewed commit
  -> workflow_dispatch this new deploy workflow (functions and/or firestore, as needed)
  -> same Environment-approval gate as any other deploy
```

This keeps the "only `main`, only reviewed" invariant intact **during rollback too** -- a
revert is itself a normal reviewed change, not a special unreviewed-deploy escape hatch.

Cloud Functions Gen 2 retains underlying Cloud Run revisions, but `firebase-tools` does not
expose a first-class "instant traffic-split rollback to the previous revision" command as part
of normal `firebase deploy` usage; achieving that would require manual `gcloud run services
update-traffic` operations outside this workflow's scope entirely -- out of scope for Phases
0-5, callable out as a possible future Phase if an instant-rollback capability is ever actually
needed.

Firestore **indexes** are effectively forward-only in practice -- deleting/rebuilding a
composite index is slow and briefly disables the query it backs, so an index change should be
treated as additive where possible rather than something to "roll back" quickly.

**Firestore data rollback is a different, unaddressed problem.** This design has no backup/
restore mechanism for Firestore documents (e.g. a bad `leaderboards/*` write). That would need
a separate mechanism (e.g. scheduled Firestore exports) and is out of scope for this design
entirely -- noted here only so it is not silently conflated with "rollback" above.

## 12. GitHub Environment

`production` Environment (Settings -> Environments -> New environment), confirmed available on
this public repo's Free plan:

- **Required reviewers**: the project owner (and, optionally, a second trusted collaborator
  account if one exists, for true two-person control). GitHub's default behavior lets the same
  account that dispatched the run also approve it, **unless** the Environment's own "Prevent
  self-review" protection setting is turned on -- for a single-owner project this is a real,
  documented trade-off (see the Result Report's threat-model section) rather than a false sense
  of two-person approval; recommend leaving "Prevent self-review" **off** for now (there is
  only one owner account), and revisiting if a second trusted maintainer is ever added.
- **Deployment branch policy**: restricted to `main` only (not "no restriction", not a
  wildcard) -- the Environment-level technical enforcement backing section 6/8's assertions.
- **Wait timer**: 0 for now -- the required-reviewer step already adds the deliberate friction
  this design wants; a wait timer would only add latency without a distinct safety benefit
  given a single required reviewer.
- **Deployment history**: GitHub's own per-Environment deployment log (who approved, when,
  which run, which commit) is kept automatically -- this becomes the audit trail section 17
  references, separate from and in addition to normal commit/PR history.
- **Environment secrets/variables vs. repository secrets**: the WIF provider resource name and
  the deploy service account's email are **identifiers, not secrets** (leaking them does not by
  itself grant any access -- the attribute condition + IAM binding are what grant access, and
  those live in GCP, not GitHub). Storing them as Environment-scoped **variables** (not
  repository-wide) is still the safer choice: a job only receives them once it has declared
  `environment: production` and been admitted past the branch-policy + reviewer gate, one more
  layer even though they're not secret values. No `FIREBASE_TOKEN`/service-account-key
  repository secret is created at all under the recommended (WIF) design.

## 13. Secret inventory (no overlap, and no new secret created this phase)

| Name | What it actually is | Where it lives today | Relationship to this design |
|---|---|---|---|
| `VITE_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | Public **Web SDK client config** (not a deploy credential; safe in a public bundle per `.env.example`'s own comment) | GitHub Actions repository secrets, read by `deploy.yml` (Pages build) | **Unrelated** to this design -- these authenticate the *browser app* to Firebase, never the deploy pipeline. Never reused or conflated with deploy authentication. |
| A future WIF provider resource name + deploy service-account email | Identifiers, not secrets (section 12) | Would become `production` Environment variables (Phase 2), not created this phase | New, and only an identifier |
| A GCP service-account **private key** / Firebase CLI token / any deploy credential value | An actual secret | **Does not exist anywhere in this repo, this PR, or GitHub Secrets today** | **Never created by this design.** WIF (section 4) is chosen specifically so this row stays permanently empty. |

Absolute rules re-confirmed for this PR and for the eventual implementation Phases: no secret
value is ever written into a doc; no service-account JSON is ever committed; no private key is
ever committed; no Firebase CLI token is ever committed.

## 14. iPhone-only feasibility

Two distinct questions, per this task's own instruction not to conflate them:

**A. Day-to-day deploy, after setup is complete.** **Yes, fully iPhone-only**, once Phase 2's
workflow and Phase 1's WIF/Environment setup exist: Actions tab -> Run workflow -> pick target
-> Run workflow -> Review deployments -> Approve and deploy, all from Safari or the GitHub app.
No PC, no CLI, no `.firebaserc`, no local Firebase login needed for a routine deploy ever
again.

**B. Initial GitHub/GCP/WIF setup (one time).** **Not realistically iPhone-only.** Creating a
GCP Workload Identity Pool + Provider + attribute condition + IAM role bindings is documented
primarily via the `gcloud` CLI; while the GCP Console *does* expose this through browser UI
(technically reachable from an iPhone browser), doing so correctly and safely (attribute
conditions in particular are easy to get subtly wrong, and a wrong condition either blocks
everything or over-widens trust) is realistically a PC-with-`gcloud`-CLI task, at least for this
first-time setup. GitHub-side setup (creating the `production` Environment, its branch
policy, and required reviewer) **is** comfortably iPhone-browser-feasible on its own.
**Verdict: PC needed once, for Phase 1's GCP-side setup only; never again afterward.** This is
a real, honest reduction from "every deploy needs a PC" (today) to "one setup session needs a
PC" (after Phase 1/2 ship) -- not a full elimination of PC dependency, and this document does
not claim otherwise.

## 15. Player Profile 1.0 Phase 1A / 1B handoff

- **Phase 1A** (`setDisplayName` Function + `users/{uid}` Firestore rule): merged to `main` via
  PR #131, but confirmed **not yet deployed** to production
  (`docs/reports/TETO_PLAYER-PROFILE_Phase1A_Result.md` section 14, "Not deployed", explicit).
  Do not assume otherwise.
- **Phase 1B** (PR #133, open, not merged, not touched by this PR): adds a `displayName` read
  inside `submitLunchRushScore`'s existing "new best" write branch and denormalizes it onto
  leaderboard entries. Per its own PR body, `firestore.rules` is **unchanged** by Phase 1B
  (Option A, no rules loosening needed) -- confirmed by reading the PR description, not
  assumed.
- **Once this design's workflow exists and Phase 1B merges**, a single `target: functions`
  deploy (no `firestore` target needed, since Phase 1A's rules text is already merged to
  `main` today and Phase 1B adds no further rules change) would bring **both** Phase 1A's
  `setDisplayName` Function *and* Phase 1B's `submitLunchRushScore` update live together --
  **provided** Phase 1A's `users/{uid}` Firestore rule has *also* been deployed by then (a
  `firestore` deploy, separately, since it's not yet live per the point above). **This
  document does not assume today's Firestore rules deploy state matches `main`'s rules text --
  that must be confirmed (e.g. via Firebase Console inspection) before relying on a
  functions-only deploy being sufficient.**
- This is exactly the coordination problem this design is meant to solve going forward: today
  that "confirm + redeploy" step needs the owner's PC; after Phase 1/2 ship, it's a
  `target: all` (or `firestore` then `functions`) dispatch from anywhere.

## 16. App Check (explicitly out of scope, kept forward-compatible)

App Check is a separate, later Firebase Phase (per `TETO_FIREBASE-RANKING_SETUP.md` section 20:
"Deliberately NOT required for Phase 1B ... Firebase Phase 3B, once there's an actual public
leaderboard worth scripting against") and is not designed, wired, or referenced by this
workflow beyond this note. Because App Check authenticates the *client app calling Firebase*,
not the *deploy pipeline calling GCP* (section 4), adopting WIF for deploy authentication now
requires no rework when App Check is introduced later -- the two are orthogonal credentials
protecting different hops.

## 17. Security threat model

| Threat | Mitigation |
|---|---|
| GitHub account compromise (owner's) | Out of this design's own scope to fully solve (it's an account-security problem), but blast radius is reduced: no long-lived Firebase/GCP secret exists in GitHub to steal (section 4/13); an attacker with the account can still dispatch+approve a deploy, same as today's PC-based process carries an equivalent "if the owner's machine is compromised" risk |
| Malicious PR | `workflow_dispatch` requires repo write access to trigger at all (confirmed) -- a PR from any contributor, malicious or not, cannot trigger this workflow by itself; only a maintainer choosing to run it can |
| Arbitrary branch deployment | Blocked twice over: the Environment's deployment-branch-policy (main only) at the GitHub-platform level, plus an in-workflow `github.ref` assertion (section 6/8) |
| Secret exfiltration | No long-lived secret exists to exfiltrate under the recommended (WIF) design; the WIF-derived token is short-lived and scoped to the one run |
| Fork PR | Confirmed: fork PRs cannot trigger `workflow_dispatch` (requires write access, which fork contributors don't have), and even if a fork PR's own workflow ran (a normal `pull_request` CI job), Environment-scoped secrets/variables are not exposed to it -- a fork PR can reach neither this workflow's trigger nor its credentials |
| Workflow modification attack | A PR that edits `.github/workflows/firebase-production-deploy.yml` itself is a normal PR, reviewed like any other change to this repo (and this Phase 0 PR does not create that file at all, so there is nothing to attack yet); once it exists, treat workflow-file changes as high-sensitivity diffs in review, same as any CI/CD config change |
| Dependency/script attack | `npm ci` (not `npm install`) pins exact lockfile versions for both root and `functions/`; the deploy job's own IAM identity (section 5) is scoped to `teto-pizza-game` only, so even a compromised dependency executing during `npm ci`/build has no path to any *other* GCP project or a broader credential |
| Wrong Firebase project | Section 8's project-ID guard -- hardcoded constant, explicit `--project` flag on every call, IAM scoped to one project only |
| Excessive IAM | Section 5 -- four named roles, each with a stated reason, nothing broader; explicit "add narrowly, only on a real failure" policy |
| Accidental repeated deploy | `concurrency: cancel-in-progress: false` queues rather than races a second dispatch; the required-reviewer step itself is a strong "was this intentional" check each time |
| Partial deployment | Section 10 -- explicitly non-atomic `all`, explicitly surfaced in the job summary, no silent partial state |

## 18. Implementation phase plan

| Phase | Scope | Est. Claude Code effort | Owner manual action | Rollback | Exit criteria |
|---|---|---|---|---|---|
| **0** (this PR) | Fresh design + audit docs, Issue, docs-only PR | Done, this session | Review and merge (or request changes on) this PR | Close the PR / revert the merge -- no code/infra exists yet, zero blast radius | This PR merged (or explicitly rejected) by the owner |
| **1** | GCP + GitHub authentication foundation: create the WIF pool/provider/attribute-condition, the deploy service account with the four roles in section 5, the `production` GitHub Environment (required reviewer, branch policy = main). **No workflow file yet.** Exit check: a manual, harmless dry run (e.g. `google-github-actions/auth` + `firebase projects:list --project teto-pizza-game`) run once, by hand, from a throwaway/manual workflow or local `gcloud`+CLI session, proving the WIF token can actually authenticate against `teto-pizza-game` with the exact pinned `firebase-tools` version | Small-medium | Create the WIF pool/provider/SA in GCP Console/`gcloud` (section 14's "PC needed once"); configure the GitHub Environment | Delete the WIF pool/provider/SA and the GitHub Environment -- nothing else in the repo was touched | The harmless dry-run command above succeeds against `teto-pizza-game` using WIF-derived credentials |
| **2** | Implement `.github/workflows/firebase-production-deploy.yml` per section 6-10, targeting the four gates in section 7 first against a **non-production** dry run (see Phase 3) | Medium | Review and merge the workflow-file PR | Revert the workflow-file PR (no production side effect from the file existing but never having been run against real deploy targets) | Workflow parses, dispatches, reaches (but does not pass) the Environment approval gate correctly in a test dispatch |
| **3** | Safe production dry-run / verification: a real `workflow_dispatch` run, approved, exercising every gate (section 7) through to the project-ID guard (section 8), stopping **before** the actual `firebase deploy` calls (e.g. temporarily gated behind an extra manual confirmation, or run once with the deploy steps commented out) to prove the whole pipeline short of an actual production write | Small | Approve the test dispatch; confirm the job summary/logs look correct | Nothing to roll back -- no real deploy occurred | A full dry run reaches the deploy steps with every prior gate green, without performing a real `firebase deploy` |
| **4** | Real Firebase production deploy via the new workflow -- first real use, on a small/known-safe target (e.g. `firestore` alone, since Phase 1A's rules are already merged and safe to (re)confirm live per section 15) | Small (mostly owner-driven at this point) | Dispatch + approve the real deploy; verify in Firebase Console that the target updated | Section 11's revert-and-redeploy path | The dispatched target is confirmed live in Firebase Console, matching `main`'s current code/rules |
| **5** | iPhone-only operational smoke: the owner performs one real dispatch + approval entirely from an iPhone (Safari or GitHub app), no PC, confirming section 14's "day-to-day, fully iPhone-only" claim in practice, not just in design | Owner-only (no Claude Code effort) | The iPhone-only run itself | N/A (this Phase is a verification exercise, not a code change) | Owner confirms a full dispatch-to-approve-to-verified-live cycle completed from an iPhone alone |

Phases 1-5 are all **future work**, not performed by this PR. Nothing beyond Phase 0 is
started, scaffolded, or partially implemented here.

## 19. Deliverables (this PR)

- `docs/design/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_1.0.md` -- this file.
- `docs/reports/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_Phase0_Fresh-Design_Result.md`
  -- the fresh-audit Result Report this design is based on.
- A new GitHub Issue tracking the goal/motivation/security principles/phase plan/dependencies/
  owner manual steps (see the Result Report for the exact Issue number/URL).
