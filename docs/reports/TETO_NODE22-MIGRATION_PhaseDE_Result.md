# Teto Pizza Game — Node.js 20 → 22 Migration Phase D/E: Result

Issue: [#161](https://github.com/perusonao/teto-pizza-game/issues/161)
Fresh Audit SSOT: `docs/reports/TETO_NODE22-MIGRATION_Fresh-Audit.md` (Phase D/E, §11).
Phase A Result: `docs/reports/TETO_NODE22-MIGRATION_PhaseA_Result.md` (PR #164, merged).
Phase B/C Result: `docs/reports/TETO_NODE22-MIGRATION_PhaseBC_Result.md` (PR #165, merged).

## Pre-deploy Fresh Gate

- `git fetch origin` — `origin/main` tip: **`7e5692f95d2752e31884f04767e523d141f390da`** (PR #165's
  own merge commit), matching the expected Phase B/C merge SHA cited by this task's own
  instructions exactly (not blindly trusted — verified fresh via `git fetch`/`git log` before any
  other action this session).
- Read fresh: `CLAUDE.md`, `docs/PROJECT_HANDOFF.md`, `docs/reports/TETO_NODE22-MIGRATION_Fresh-Audit.md`,
  `docs/reports/TETO_NODE22-MIGRATION_PhaseA_Result.md`, `docs/reports/TETO_NODE22-MIGRATION_PhaseBC_Result.md`,
  and `.github/workflows/firebase-production-deploy.yml`.

### Pre-Deploy Safety Gate (confirmed on `main` before dispatch)

| Check | Result |
|---|---|
| `functions/package.json` `engines.node` | `"22"` |
| `functions/package.json` `scripts.build` esbuild `--target` | `node22` |
| `firebase-production-deploy.yml` `actions/setup-node@v4` `node-version` | `22` |
| `workflow_dispatch` with `target` choice (`functions`/`firestore`/`all`/`verify`) | present, unchanged |
| `environment: production` gate | present, unchanged |
| WIF (`google-github-actions/auth@v2`, no long-lived credential) | present, unchanged |
| Manual reviewer approval (governed by the `production` Environment) | present, unchanged |
| `FIREBASE_TOOLS_VERSION: "15.26.0"` pin | present, unchanged |

## Current Production State (before this deploy)

Per `docs/reports/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_Phase3_Verification_Result.md`
(Session 7, the last live, first-party record — a real `firebase deploy` transcript, not an
inference): both `submitLunchRushScore` and `setDisplayName` were `ACTIVE`, Gen 2,
`asia-northeast1`, running **Node.js 20** (that same deploy's own log emitted the CLI's
"Runtime Node.js 20 was deprecated..." warning, which is the reason this migration exists).

**This session could not independently re-confirm that pre-deploy state live** — this sandboxed
execution environment has no `gcloud`/Firebase CLI installed and no outbound network egress to
Google/Firebase API domains (confirmed by the network-policy check performed for Phase E below).
Per this task's own instruction ("確認できない場合は推測しない"), the pre-deploy Node 20 state is
cited from the last documented first-party evidence above, not re-verified live, and not guessed
beyond that citation.

## Pre-Deploy Verification (Fresh, this session, under Node 22)

Run locally in this session, native Node 22 (`node --version`: `v22.22.2`):

- `functions/`: `rm -rf node_modules lib && npm ci` — succeeded, 287 packages, 0 lockfile diff.
- `functions -- npm run typecheck` (`tsc --noEmit`): clean, zero errors.
- `functions -- npm run lint` (`oxlint src`): clean, zero findings.
- `functions -- npm test` (`vitest run`): **72/72 tests passed**, 3 test files, 277ms.
- `functions -- npm run build` (esbuild `--target=node22`): succeeded, `lib/index.js` 13.3kb.
- root `npx vitest run src/shared` (the shared code `functions/` imports at build time): **56/56
  tests passed**, 3 test files.
- `git status --short`: clean after every install/build step — no unintended lockfile or file
  drift.

All green, matching Phase B/C's own verification counts exactly. This is the same evidence the
production workflow's own `functions -- *` steps re-derive during the dispatch below.

## Production Deployment (Phase D)

Dispatched via GitHub Actions `workflow_dispatch` (not `firebase deploy`/`gcloud` locally, both of
which remain prohibited): `ref: main`, `target: functions` only. `firestore`/`all` were never
selected.

- **Run:** <https://github.com/perusonao/teto-pizza-game/actions/runs/35620410992>
- **Run ID:** `35620410992`
- **Head SHA:** `7e5692f95d2752e31884f04767e523d141f390da` (exact `main` tip at dispatch time)
- **Target:** `functions`
- **Conclusion:** `success`

The run sat at the `production` Environment's required-reviewer approval gate; the human owner
approved it (per this task's own instruction, this session never self-approves). This report's
findings below are fetched fresh from the Actions API (`list_workflow_jobs`, the job's own full
log) after approval — not trusted from a "Status: Success" summary alone.

### Per-step results (fetched from the Jobs API)

| Step | Conclusion |
|---|---|
| Guard against non-main ref | success |
| `actions/checkout@v4` | success |
| `actions/setup-node@v4` (`node-version: 22`) | success — logged `node: v22.23.2` |
| Authenticate to Google Cloud (WIF) | success |
| Install firebase-tools (`15.26.0`) | success |
| Project-ID guard (preflight) — `firebase projects:list` | success — returned exactly `teto-pizza-game` |
| `npm ci` (root) | success |
| `functions -- npm ci` | success |
| `functions -- typecheck` | success |
| `functions -- lint` | success |
| `functions -- test` | success — **72/72 passed** (`periodIds`, `setDisplayName`, `submitLunchRushScore` suites) |
| `functions -- build` | success — esbuild `--target=node22`, `lib/index.js` 13.3kb |
| `root -- src/shared scoped test` | success — **56/56 passed** |
| `firestore -- set up JDK 21 (emulator runtime)` | **skipped** (correct — not reachable for `target: functions`) |
| `firestore -- rules emulator test` | **skipped** |
| **`Deploy -- functions`** | **success** |
| **`Deploy -- firestore (rules + indexes)`** | **skipped** (never reached — not reachable for `target: functions`) |
| Job summary | success |

**Firestore deploy: NOT PERFORMED.** Both Firestore-related steps report `skipped` in the Jobs
API response, confirming `target: functions` never made `firebase deploy --only firestore:...`
reachable in this run.

### `firebase deploy` transcript (from the step's own log — first-party evidence, not inferred)

```
i  functions: preparing codebase default for deployment
✔  functions: functions source uploaded successfully
i  functions: updating Node.js 22 (2nd Gen) function setDisplayName(asia-northeast1)...
i  functions: updating Node.js 22 (2nd Gen) function submitLunchRushScore(asia-northeast1)...
✔  functions[submitLunchRushScore(asia-northeast1)] Successful update operation.
✔  functions[setDisplayName(asia-northeast1)] Successful update operation.

✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/teto-pizza-game/overview
```

This is the deploy's own CLI transcript, fetched via the GitHub Actions Jobs API log — it states
the new runtime explicitly (**"Node.js 22 (2nd Gen)"**) for both functions, and both report
`Successful update operation`. No Node.js 20 deprecation warning appears in this run's log
(present in every prior Node-20 deploy's log, absent here — consistent with the runtime having
actually changed).

### Secrets / production mutation check

- Full job log scanned for `private_key`, `BEGIN ... PRIVATE`, an `access_token` value, a
  `ya29.`-prefixed OAuth token, or an `AIza`-prefixed API key literal — **none found**. Only the
  WIF credential file's *path* appears (`gha-creds-*.json`, ephemeral, removed at job cleanup:
  "Removed exported credentials at ..." confirmed in the log), never its contents.
- No IAM, WIF, or `production` Environment configuration was read-write touched by this session or
  this run — the workflow's `Authenticate to Google Cloud` step used the exact same
  `workload_identity_provider`/`service_account` values as every prior deploy (logged, matches
  `docs/reports/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_Phase3_Verification_Result.md`'s own
  fresh IAM audits).
- **Production mutation from this run: exactly the two Cloud Functions' code/runtime.** No
  Firestore rule, index, or other GCP resource was created, modified, or deleted.

## Runtime Verification (Phase D outcome)

| Function | Runtime | Region | Deploy outcome |
|---|---|---|---|
| `setDisplayName` | **Node.js 22 (2nd Gen)** | `asia-northeast1` | Successful update operation |
| `submitLunchRushScore` | **Node.js 22 (2nd Gen)** | `asia-northeast1` | Successful update operation |

**Evidence source:** the `firebase deploy` CLI's own transcript (above), fetched fresh from the
GitHub Actions Jobs API for run `35620410992` — not the job's green checkmark alone, and not
carried forward from a prior session's report.

**Limitation, stated explicitly rather than glossed over:** this sandboxed execution environment
has no `gcloud`/Firebase CLI installed and no outbound network egress to Google/Firebase API
domains (see the Phase E network-policy finding below), so an independent
`gcloud functions describe`-style re-confirmation of live `ACTIVE` status/revision (the kind prior
sessions in `TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_Phase3_Verification_Result.md`
performed with the owner's own authenticated `gcloud` session) **could not be performed by this
session**. The deploy transcript's explicit "Node.js 22 (2nd Gen)" + "Successful update operation"
for both functions is the strongest first-party evidence available in this session, and is not a
guess — but it is a different evidentiary source than a live post-deploy `gcloud`/Console read.
Recommend the owner (who has real `gcloud`/Firebase Console access) do a quick confirming glance at
the Cloud Functions console before treating this as fully closed.

## Phase E — Production Smoke Test

### Network-access check (performed first, per this task's own "safe/controlled verification"
principle — do not attempt a live call blind)

- `curl` to `https://perusonao.github.io/teto-pizza-game/` from this session's sandbox: **failed**
  — `CONNECT tunnel failed, response 403`, confirmed via the agent proxy's own status endpoint as
  `connect_rejected` ("the egress proxy denied the CONNECT (organization policy)").
- `WebFetch` to the same URL: **failed** — `EGRESS_BLOCKED` ("Access to perusonao.github.io is
  blocked by the network egress proxy").
- No Google/Firebase API domain (`identitytoolkit.googleapis.com`, `firestore.googleapis.com`,
  `*.cloudfunctions.net`, etc.) is in this proxy's allowed-domains list either (confirmed via the
  proxy status's own `noProxy` list, which covers only `npm`/`pypi`/Anthropic API domains).

**Conclusion: this sandboxed session has no path to reach either the Public Demo or any
Firebase/Google API endpoint.** This is an environment/network-policy constraint of this specific
remote execution session, not a production issue.

### `setDisplayName` smoke (Anonymous Auth / safe test flow)

**NOT PERFORMED — blocked by the network-access finding above.** No Callable Function invocation,
browser-driven Anonymous Auth flow, or Firebase client SDK call could be made from this session.
Per this task's explicit instruction not to guess when something cannot be confirmed, this is
reported as **NOT PERFORMED**, not as a fabricated PASS.

### `submitLunchRushScore` smoke

**NOT PERFORMED**, for the same network-access reason. Separately: no existing, documented
*production* smoke procedure for `submitLunchRushScore` was found in `docs/reports/**` or
`docs/design/**` (a repo-wide search for "smoke" found only the unrelated, owner-only "Phase 5
iPhone-only operational smoke" line in the production-deploy design doc, which concerns the
dispatch/approval process itself, not a Functions-payload smoke test). Consistent with this task's
explicit "ランキングへ不要なfake scoreを残すようなテストは禁止" instruction, this session did not
attempt to fabricate a payload/call path for this function either — there was no safe,
already-reviewed procedure to reuse, and no network path to execute one even if there had been.

### Section 10 — Public Demo / iPhone Browser Smoke

**NOT PERFORMED**, same network-access constraint. No app-launch, Anonymous Auth, profile-name, or
ranking-load check could be run against `https://perusonao.github.io/teto-pizza-game/` from this
session.

**Recommendation:** the human owner (who has a real browser/network path, and per the design doc's
own "day-to-day, fully iPhone-only" operating model) perform a short manual check of the Public
Demo — app launch, Anonymous Auth, a display-name change, and the ranking screen loading — before
treating Phase E as fully closed. This is a ~2-minute manual check, not a code or infrastructure
task.

## Firebase / GCP Mutation Guard (confirmed)

| Item | Status |
|---|---|
| Firestore schema/rules/indexes | **NOT TOUCHED** — `Deploy -- firestore` step `skipped` |
| IAM | **UNCHANGED** — this session made zero IAM calls or changes |
| WIF | **UNCHANGED** — same provider/service account as every prior deploy, confirmed from this run's own log |
| `production` GitHub Environment | **UNCHANGED** — this session made zero changes to Environment settings |
| Cloud Run traffic | **UNCHANGED** — not touched |
| Firebase Hosting / Authentication / App Check config | **UNCHANGED** — not touched |

## Human Verification

**N/A — runtime migration only.** Per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`: this
phase deploys `functions/package.json`/esbuild-target changes already merged and Human-Verification-exempt
in Phase B/C (a Node runtime/config migration with zero `src/**` or gameplay/UI change). Phase D/E
itself performs no code change at all — only a production dispatch of already-reviewed code — so no
new Human Verification video/screenshots apply here either.

## Rollback

**NOT REQUIRED.** The deploy succeeded per its own transcript (both functions: "Successful update
operation", new runtime "Node.js 22 (2nd Gen)"). No regression evidence exists (none could be
gathered live in this session — see Phase E above — but none was reported by the deploy itself,
and the pre-deploy Fresh verification suite was 100% green). If the owner's recommended manual
Public Demo check (above) surfaces a regression, `docs/reports/TETO_NODE22-MIGRATION_Fresh-Audit.md`
§11's documented rollback path (`git revert` the `engines.node`/esbuild-target commit, re-dispatch
`target: functions`) remains available and untouched by this session.

## Final Node 22 Migration Verdict

**Deploy/runtime migration: COMPLETE.** Both `setDisplayName` and `submitLunchRushScore` are
confirmed, via the deploy's own first-party CLI transcript, running **Node.js 22 (2nd Gen)** in
`asia-northeast1` production, deployed through the existing, unmodified, WIF+`production`-Environment-gated
GitHub Actions pipeline, `target: functions` only, zero Firestore/IAM/WIF/Environment mutation.

**Phase E functional/production smoke: NOT PERFORMED**, blocked entirely by this session's own
sandboxed network-egress policy (no path to the Public Demo or any Firebase/Google API domain) —
not a production defect, and not glossed over as a false PASS. Per this task's own §14 instruction,
**Issue #161 is not closed by this report** — it stays open pending the owner's own manual Public
Demo smoke check (recommended above) and a Fresh Review of this docs-only PR.

## Changed files (this session)

- `docs/reports/TETO_NODE22-MIGRATION_PhaseDE_Result.md` (this file, new)

No production code, workflow, Firebase, or GCP configuration file was changed by this session — the
only "changes" this session made to Firebase/GCP state are the single `workflow_dispatch` run
itself (`35620410992`, approved by the owner) and this new report file.
