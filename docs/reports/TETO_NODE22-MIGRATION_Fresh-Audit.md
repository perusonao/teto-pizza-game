# Teto Pizza Game — Node.js 20 → 22 Migration: Fresh Audit

READ-ONLY, docs-only Fresh Audit. **No production code changed in this session** — `package.json`,
`package-lock.json`, `functions/package.json`, `functions/package-lock.json`, every
`.github/workflows/*.yml`, `firebase.json`, and every file under `functions/src/` are
byte-identical to the audited `main` HEAD. Node version is **not** changed. No Firebase deploy was
run (`target: verify`-only dispatch was not even used — this audit made zero Firebase/CI calls).
No merge to `main`.

## Audited main SHA

`f8e461ae4f632c1480e1a71432719817172867c3` — fetched fresh via `git fetch origin && git rev-parse
origin/main` at the start of this session. This branch (`claude/node22-migration-audit-j4wnmj`)
was created directly from this SHA (`git status` showed a clean tree, zero divergence, before this
report was added).

Recent history on `main` leading to this SHA (most recent first):

```
f8e461a Issue #159: Cooking UI 1-Screen Polish (#160)
d0085a3 docs: PR #154 Human Verification Videos -- ingredient selection, CUT regression, edge case (#156)
37e6199 Add Human Verification Policy SSOT for UI/UX/gameplay changes (#155)
```

## Issue #157 conflict check

A separate session is implementing **Issue #157** (`Lunch Rush RESULT → HOME`, tracked via **PR
#158**, branch `claude/lunch-rush-result-home-ln82nn`). Its own scope statement (`MissionResultOverlay`,
`App.tsx` navigation wiring, related CSS, related tests/e2e — explicitly **not** Firebase/scoring/
economy/recipe data) shares **zero files** with anything this audit reads or would touch in a future
implementation phase (`package.json`, `functions/**`, `.github/workflows/**`, `firebase.json`,
`docs/**`). **No conflict, confirmed by file-scope comparison, not assumption.** This audit also made
no Firebase/CI/production changes of any kind, so there is nothing for a concurrent session to race
against.

## 1. Repo-wide Node-version-location search

Full-repo grep for `node20|node22|node-version|nodejs20|nodejs22|"node":|Node.js 20|Node 20|Node20`
plus a dedicated glob for `.nvmrc`/`.node-version`/`Dockerfile*`/`docker-compose*`:

| Location | Current value | Notes |
|---|---|---|
| `functions/package.json` `engines.node` | `"20"` | The authoritative Cloud Functions Gen2 runtime selector (see §2). |
| `functions/package.json` `scripts.build` (esbuild) | `--target=node20` | esbuild's JS-syntax lowering target, independent of `engines.node` (see §3). |
| `.github/workflows/ci.yml` | `actions/setup-node@v4` `node-version: 20` | PR-gate CI (lint/test/build), runs on every PR into `main`. |
| `.github/workflows/deploy.yml` | `actions/setup-node@v4` `node-version: 20` | GitHub Pages frontend build/deploy (push to `main`). Firebase Hosting is never used — confirmed by this workflow's own file, matching `firebase-production-deploy.yml`'s header comment. |
| `.github/workflows/firebase-production-deploy.yml` | `actions/setup-node@v4` `node-version: 20` | Manual, gated production Functions/Firestore deploy (WIF + `production` Environment). |
| `.nvmrc` / `.node-version` | **absent** | No local dev Node pin exists anywhere in the repo. |
| Docker/dev container config | **absent** | No `Dockerfile`/`docker-compose*` anywhere in the repo. |
| root `package.json` `engines` | **absent** | No root-level Node engine constraint is declared at all (only transitive-dependency `engines.node` ranges apply — see §5). |
| `firebase.json` | no Node-version field | Functions runtime is derived from `functions/package.json`'s `engines.node`, not from `firebase.json` (confirmed: no `runtime` key anywhere in `firebase.json`, and `functions/src/index.ts`'s two `onCall(...)` definitions pass no `runtime` override either — see §9). |
| `functions/tsconfig.json` | `target: "es2023"`, `lib: ["ES2023"]` | TypeScript compile target, unrelated to the Node *runtime* version; ES2023 is fully supported by both Node 20 and Node 22 V8 builds. No change needed for this migration. |
| Documentation (`docs/design/TETO_FIREBASE-GITHUB-ACTIONS-PRODUCTION-DEPLOY_1.0.md`, various `docs/reports/*.md`) | narrative mentions of "Node 20" / `node-version: 20` | Descriptive only, not machine-read; will need a follow-up mention once the runtime actually changes (tracked in §11 Phase D/E, not this audit). |

No other Node-version-bearing file exists in the repository (confirmed by the grep above covering
every `package.json`/`package-lock.json`/workflow/config file; the search also covered
`docs/reports/**`/`docs/design/**` for narrative-only mentions, listed above for completeness).

## 2. Firebase Functions Gen2 — is Node.js 22 runtime available today?

**Yes.** Node.js 22 (`nodejs22`) has been Generally Available for Cloud Functions (2nd gen) /
Cloud Run functions for some time now, alongside Node.js 20 and the deprecated Node.js 18. It is
selected the same way Node 20 is selected today in this repo: the `engines.node` field in
`functions/package.json`. Neither of this repo's two Cloud Functions (`submitLunchRushScore`,
`setDisplayName`, both defined via `onCall(...)` in `functions/src/index.ts`) passes a per-function
`runtime` override in its options object, so both inherit whatever `functions/package.json`'s
`engines.node` says at deploy time — there is exactly one place to change, not two.

`firebase-tools` historically had a bug (tracked and fixed upstream, `firebase/firebase-tools`
PR #7252) where an older CLI version rejected `"nodejs22"` as an unrecognized runtime string. That
bug predates this repo's pinned CLI version by a large margin — `firebase-production-deploy.yml`
pins `FIREBASE_TOOLS_VERSION: "15.26.0"` (§6), which is far newer than the version that had the
bug, so this repo's pinned CLI already accepts `nodejs22` deploys with no CLI upgrade required.

## 3. Impact of changing `functions/package.json` `engines.node` from `"20"` to `"22"`

This is the single field that actually selects the deployed Cloud Functions runtime. Changing it:

- **Does not require any code change** in `functions/src/**` — nothing in `submitLunchRushScore.ts`,
  `setDisplayName.ts`, `periodIds.ts`, or `index.ts` uses a Node-18/20-specific API absent from
  Node 22 (all are plain `firebase-admin`/`firebase-functions` v2 callable-function code, ES module
  syntax, no `node:` built-in usage beyond what both runtimes share).
- **Does** require a `firebase deploy --only functions` to actually take effect in production — Gen2
  Cloud Functions do not hot-swap their runtime; the deployed instance keeps running whatever
  runtime it was last deployed with until the next deploy (see §9/§10).
- Interacts with esbuild's own `--target=node20` (§3 below) and `functions/tsconfig.json`'s
  `target: "es2023"` only in the sense that all three should describe a consistent minimum
  JavaScript/Node baseline; today they are already inconsistent in one direction (esbuild targets
  `node20` while `tsconfig.json` already targets the newer `es2023` syntax level, and both already
  build/run fine on Node 20's V8), so raising `engines.node` to `22` without also touching esbuild's
  target would not break anything — it would just leave esbuild's syntax-lowering floor one major
  version more conservative than the actual deploy target, which is safe (lowering to an older
  target than necessary never produces invalid output for a newer runtime) but not ideal cleanup.
- Local functions dev/test (`npm run build`, `npm test`, `npm run typecheck` inside `functions/`)
  is unaffected by this field either way — those run under whatever Node the developer's machine or
  CI runner has installed (see §4/§8), not under an emulated `engines.node` runtime; npm's `engines`
  field is advisory-only in this repo (see §5, no `.npmrc` sets `engine-strict=true` anywhere in the
  repo).

## 4. esbuild `--target=node20` — should it become `node22`?

`functions/package.json`'s `build` script:

```
esbuild src/index.ts --bundle --platform=node --target=node20 --format=esm --outfile=lib/index.js ...
```

`--target=node20` controls esbuild's **JS syntax lowering ceiling** (what language features it is
allowed to emit unlowered), not which Node binary the output is later *run* on. It is a separate
knob from `engines.node` (§2/§3) and from `functions/tsconfig.json`'s `target: "es2023"` (TypeScript's
own, independent type-checking/emit-target setting — `tsconfig.json` is `noEmit: true` here; esbuild,
not `tsc`, does the real emit).

Recommendation: **yes, change it to `node22` in the same PR that changes `engines.node`**, for
consistency and to stop under-declaring the actual runtime floor — but it is not a functional
blocker either way. `--target=node20` output already runs correctly on Node 22 (esbuild targets are
purely a *minimum*, never a ceiling that later Node versions reject), so leaving it at `node20`
would not break a Node 22 deploy; it would just mean esbuild continues lowering a few newer syntax
forms it no longer needs to. Bumping it removes that superfluous lowering and keeps `engines.node`/
esbuild target/`tsconfig.json`'s `target` all telling the same story.

## 5. GitHub Actions `setup-node` — should it move from `20` to `22`?

Split into two independent questions, since three separate workflows use `setup-node`
(`ci.yml`, `deploy.yml`, `firebase-production-deploy.yml`), and each pins Node for a different
purpose:

- **`ci.yml`/`deploy.yml`** pin Node 20 for the **root** (frontend) install/build/test — this Node
  version has no direct relationship to the Cloud Functions runtime at all; it is purely "what Node
  does `npm ci`/`vite build`/`vitest run` execute under in CI." Raising this is a **frontend
  toolchain compatibility question, not a Functions-runtime question** (see §6 below — this is
  exactly where the real, already-present mismatch lives).
- **`firebase-production-deploy.yml`** pins Node 20 for the **CI runner** that later calls
  `firebase deploy`. This is *also* independent of the deployed Functions runtime (§9) — the
  Firebase CLI is itself just a Node program being executed by the runner; it packages and uploads
  `functions/`'s build output (already built by `esbuild --target=node20`/`node22` per §4) to Google
  Cloud, where Google's own Node 22 (or 20) container image actually executes the function. Running
  `firebase-tools` itself under Node 20 vs Node 22 on the CI runner does not change what runtime the
  deployed function ends up running on — `engines.node` in `functions/package.json` is the only
  input that does that (§2/§3).

**Recommendation:** raise all three `setup-node` pins to `22` as part of Phase A (§11), primarily to
close the compatibility gap identified in §6, and secondarily so CI/deploy tooling itself runs on a
supported, non-deprecated runtime ahead of the 2026-10-30 Node 20 Cloud Functions decommission date
this task cites. This is safe to do independently of and ahead of the actual `functions/package.json`
`engines.node` change (§2/§3) — see Phase A vs. Phase B split in §11.

## 6. Root frontend toolchain — does it already require/recommend Node 22?

**Yes — this is the audit's most important finding.** Inspecting the *installed* (locked)
`engines.node` field of the root toolchain's own dependencies (`package-lock.json`, not just each
package's `package.json` as declared upstream) shows:

| Package (locked version) | `engines.node` |
|---|---|
| `vite@8.3.0` | `^20.19.0 \|\| >=22.12.0` |
| `vitest@5.0.0` (root) | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` |
| `@testing-library/jest-dom@7.0.1` | `>=22` |
| `oxlint@1.81.0` native bindings | `^20.19.0 \|\| >=22.12.0` |
| several `jsdom` transitive deps (`@asamuzakjp/*`) | `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0` |

**`vitest@5.0.0`'s own locked `engines.node` (`^22.12.0 || ^24.0.0 || >=26.0.0`) does not include
any Node 20.x range at all.** `@testing-library/jest-dom@7.0.1` similarly declares `>=22` only.
`functions/package-lock.json` shows the identical situation for its own `vitest@5.0.1` dev
dependency.

This means **today's `main`, right now, already runs its entire Vitest suite (2088+ tests per the
latest merged Result report) under a Node version (CI's pinned Node 20) that `vitest@5`/
`@testing-library/jest-dom@7` do not declare support for.** It works today only because npm's
`engines` field is advisory by default — there is no `.npmrc` anywhere in this repo setting
`engine-strict=true` (confirmed absent), so `npm ci`/`npm test` silently proceed under Node 20
rather than failing or even warning loudly. This is a **latent, currently-invisible risk**, not a
theoretical one: a future `vitest`/`@testing-library` patch release could start relying on a Node
22-only runtime API (not just declare the engines range, but actually *use* something Node 20
lacks) with zero warning in this repo's current CI, and the first symptom would be a real CI
failure, not an `engines` warning ahead of time.

**Conclusion for this question specifically:** the frontend toolchain does not merely "recommend"
Node 22 — its two newest/most security-relevant dev dependencies (`vitest@5`, `@testing-library/
jest-dom@7`) already declare Node 20 as unsupported. This is an independent, standalone reason to
raise `setup-node`'s `node-version: 20` → `22` in `ci.yml`/`deploy.yml` (§5), separate from and not
gated on the Cloud Functions decommission deadline that motivated this audit.

## 7. Firebase CLI `15.26.0` compatibility

Already confirmed compatible with `nodejs22` deploys (§2) — the historical `firebase-tools`
Node 22 runtime-string rejection bug (`firebase/firebase-tools` PR #7252) was fixed in a CLI
version far older than `15.26.0`. No CLI version bump is needed for this migration; `.github/
workflows/firebase-production-deploy.yml`'s `FIREBASE_TOOLS_VERSION: "15.26.0"` pin can stay
exactly as-is through every phase in §11.

Separately, `firebase-production-deploy.yml`'s `firestore`/`all` targets set up **JDK 21** via
`actions/setup-java@v4` for the Firestore rules emulator (`firebase-tools 15.26.0`'s own documented
Java 21 floor, per that workflow's own inline comment). This is completely orthogonal to the
Node 20→22 migration — it is the emulator's JVM requirement, not a Node requirement — and needs
**no change** as part of this migration.

## 8. Functions dependency compatibility

Locked (`functions/package-lock.json`) `engines.node` for every direct Functions dependency:

| Package (locked version) | `engines.node` |
|---|---|
| `firebase-admin@13.10.0` | `>=18` |
| `firebase-functions@7.4.0` | `>=18.0.0` |
| `esbuild@0.28.2` (dev) | `>=18` |
| `typescript@6.0.3` (dev, via `~6.0.2`) | `>=14.17` |
| `vitest@5.0.1` (dev) | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` (same Node-20-excludes-itself situation as §6, for `functions/`'s own local test run) |

All production dependencies (`firebase-admin`, `firebase-functions`) already declare broad `>=18`
floors and are fully Node 22-compatible today — no version bump needed for the migration itself.
The one real finding here (mirroring §6) is that `functions/`'s own `vitest@5.0.1` dev dependency
already excludes Node 20 from its declared engines range, so `functions -- test` in
`firebase-production-deploy.yml` (currently run under `setup-node`'s Node 20 pin) has the identical
latent-risk situation as the root suite.

## 9. GitHub Actions runner Node-20-deprecated warning vs. Functions runtime — these are separate problems

Explicitly separating the two, since the task calls this out and it is a common source of
confusion:

- **GitHub Actions' own "Node.js 20 actions are deprecated" runner warning** (if/when it appears)
  concerns the Node version that *GitHub Actions itself* uses internally to execute JavaScript
  **Actions** (e.g. `actions/checkout@v4`, `actions/setup-node@v4` — the action's own `runs.using:
  node20` field in its own metadata, controlled by GitHub, not by this repo). This repo does not
  author any custom JavaScript Action, so this warning class — if it ever appears — is coming from
  third-party/GitHub-authored action *implementations*, not from anything in
  `.github/workflows/*.yml`'s `node-version:` inputs, and is **not fixed by** changing this repo's
  own `setup-node` `node-version:` value.
- **This repo's own `setup-node` `node-version: 20`** (§5) controls what Node version the workflow's
  own `run:` steps (`npm ci`, `npm test`, `npm run build`, `firebase deploy`, ...) execute under —
  a completely different, repo-controlled setting.
- **Cloud Functions Gen2's Node 20 runtime decommission** (the actual reason this audit exists,
  2026-10-30 per the task) is a third, still-separate thing: Google Cloud retiring an *execution
  environment for deployed functions*, controlled by `functions/package.json`'s `engines.node`
  (§2/§3), unrelated to either of the above two.

None of these three is fixed by changing either of the other two. This audit's Phase A/B split
(§11) exists specifically because Phase A (root `setup-node` → 22, §5/§6) addresses a real but
*independent* frontend-toolchain compatibility gap, while Phase B (`functions/package.json`
`engines.node` → 22, plus its own `setup-node` pins) is what actually addresses the Cloud Functions
decommission deadline.

## 10. Do `setDisplayName`/`submitLunchRushScore` need a redeploy for the runtime migration?

**Yes.** Confirmed via `functions/src/index.ts`: both are defined as `onCall({ region:
"asia-northeast1" }, ...)` (Gen2 `firebase-functions/v2/https`), neither passes any `runtime`
override in its options object, so both inherit `functions/package.json`'s `engines.node` at
**deploy time only** — a currently-deployed Gen2 function keeps running on whichever runtime it was
last built/deployed with; merely editing `engines.node` in the repo does nothing to already-running
production instances until `firebase deploy --only functions --project teto-pizza-game` (via
`firebase-production-deploy.yml`, `target: functions` or `all`) actually runs again. This is the
same manual, gated, WIF-authenticated, `production`-Environment-reviewed workflow every other
Functions deploy in this repo already goes through — no new deploy mechanism is needed, only a
normal dispatch of the existing workflow once `engines.node`/esbuild target have been changed and
merged to `main` (Phase B/D, §11).

## 11. Rollback method

Two layers, matching this repo's existing "no long-lived credential, WIF + `production`
Environment + manual `workflow_dispatch`" deploy model (`firebase-production-deploy.yml`'s own
design-doc-cited rationale):

1. **Code-level rollback (primary, always available):** `git revert` the `functions/package.json`
   `engines.node`/esbuild-target commit (and, if separately merged, the `setup-node` pin commits) on
   `main`, then re-dispatch `firebase-production-deploy.yml` with `target: functions` (or `all`) to
   redeploy the two Functions back onto Node 20 — the exact same manual, reviewed, WIF-gated path
   used for the forward migration, requiring no new tooling or permissions. This is the recommended
   default rollback path and matches how every other change in this repo is already rolled back.
2. **Faster in-place rollback (if a Node 22 regression is found in production before a revert PR can
   land):** Gen2 Cloud Functions run on Cloud Run under the hood, and Cloud Run retains prior
   revisions after a new deploy — an operator with the appropriate `gcloud`/Cloud Console access
   could shift traffic back to the prior (Node 20) revision via `gcloud run services
   update-traffic` without waiting for a new `firebase deploy`. This is a genuine capability of the
   underlying platform, **not** currently wired into this repo's GitHub Actions workflow (no step in
   `firebase-production-deploy.yml` does this today) and would be manual, out-of-band PC/Console
   work by whoever holds direct GCP access — noted here as an available emergency option, not as
   something this migration's implementation phases need to build.

No Firestore schema, IAM, or WIF configuration is touched by this migration in either direction, so
neither rollback path has any data-migration or permission-re-grant step to worry about.

## Node 22 LTS status (context for the deadline)

Node.js 22 entered Active LTS in October 2024 and moved to Maintenance LTS around October 2025 —
already the case as of this audit's assumed "current date" (2026-09-22) — with an end-of-life date
in April 2027. That leaves comfortable headroom past the cited 2026-10-30 Cloud Functions Node 20
decommission date; this migration is not chasing a moving target on the Node 22 side, only on the
Node 20 Cloud Functions retirement side.

## Phase plan (design only, no code changed by this audit)

Ordered to isolate risk and keep the existing production-gated deploy model (`production`
Environment + WIF + manual `workflow_dispatch` approval) completely intact — no phase below adds,
removes, or changes any IAM/WIF/Environment configuration.

- **Phase A — local/CI Node 22 compatibility (frontend only, no Functions change).**
  Bump `setup-node`'s `node-version: 20` → `22` in `ci.yml` and `deploy.yml` only. Run the full
  root suite (Vitest + Playwright + typecheck/lint/build) under Node 22 in CI to confirm no
  regression — this directly closes the §6 finding (`vitest@5`/`@testing-library/jest-dom@7`
  already declaring Node 20 unsupported) and is safe to land and merge **independently of and
  ahead of** Phase B, since it touches zero Firebase/Functions configuration. No production deploy
  is triggered by this phase (`ci.yml`/`deploy.yml` never touch Firebase Functions).
- **Phase B — Functions runtime/config Node 22.**
  In one PR: `functions/package.json` `engines.node`: `"20"` → `"22"`; esbuild `--target=node20` →
  `--target=node22`; `firebase-production-deploy.yml`'s own `setup-node` `node-version: 20` → `22`
  (the CI-runner-side Node, per §5/§9 — independent of the deployed-runtime change but bundled here
  since it is the same workflow file and the same PR's natural scope). No deploy happens
  automatically — `firebase-production-deploy.yml` is `workflow_dispatch`-only.
- **Phase C — full tests.**
  `functions -- typecheck`/`lint`/`test`/`build` (all four already exist as discrete steps in
  `firebase-production-deploy.yml`) plus the root `src/shared` scoped Vitest run and the Firestore
  rules emulator test, all executed locally/in a PR-gate context under Node 22 before any dispatch
  to production. This phase is what actually proves Phase B's change is safe, not merely
  syntactically valid.
- **Phase D — production-gated GitHub Actions deploy.**
  Manual `workflow_dispatch` of `firebase-production-deploy.yml` against `main` (after Phase B/C's
  PR is merged), `target: functions` first (not `all`, to keep the Firestore rules/indexes deploy
  path untouched and independently verifiable) — going through the existing `production` Environment
  reviewer gate exactly as every prior Functions deploy has. This is the one phase that actually
  redeploys `setDisplayName`/`submitLunchRushScore` onto Node 22 (§10).
- **Phase E — production smoke.**
  Post-deploy verification that both Functions respond correctly on the new runtime: a real
  `submitLunchRushScore`/`setDisplayName` call from the deployed frontend (or `target: verify`'s
  existing read-only WIF/auth check, extended informally with a manual functional smoke test),
  plus a Cloud Functions/Cloud Run console check that the deployed revision reports `nodejs22`.
  Only after Phase E passes is the migration considered complete; until then, rollback (§11) stays
  a one-`git revert`-plus-redispatch operation away.

Each phase is a **separate, independently reviewable PR/dispatch** — Phase A can land days or weeks
before Phase B with zero coupling; Phase B/C/D/E are the actual Functions-runtime change and stay
gated behind the existing manual production approval exactly as today.
