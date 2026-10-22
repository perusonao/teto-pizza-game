# Dev CI Phase 2: WebKit Fresh Audit and Design (Issue #207)

- Issue: #207. Follows Issue #201 / PR #203 (conditional WebKit + `WebKit Gate`).
- Audited `main`: `d6b6ef90097617e1efb4096ec6415b8f134caa93` (Merge PR #203).
- Branch: `claude/issue-207-webkit-audit-8y1vln`
- Scope of this document: **audit and design only.** It changes no workflow, script, spec or
  runtime file. PR #202/#204/#205/#206 were not touched, rerun or rebased. No Progression 2.0
  runtime specification and no OD-03 decision is involved.
- Human Verification policy: not applicable (no UI/UX/gameplay change).

## 1. Current WebKit CI (as merged in #203)

```
pull_request → e2e-webkit.yml
  classify      (no npm ci; full-history blob-less checkout; classify-webkit-pr.sh)
     └─ webkit_required = true|false, reason, tested_base
  webkit        (if !cancelled() && !(classify ok && required=false))
     checkout → setup-node(npm cache) → npm ci → actions/cache ~/.cache/ms-playwright
     → playwright install --with-deps webkit → proof
     → playwright test --project=webkit-390x844 --project=webkit-360x800  (ALL specs, 2 workers)
  WebKit Gate   (always(); required-check candidate; records tested_base=<sha> in a notice)
```

- Classifier (`scripts/ci/classify-webkit.mjs`) is a binary allow-list: only `docs/**` and `*.md`
  outside runtime trees skip. Every other path runs the **full** suite on **both** viewports.
- Evidence reuse (`classify-webkit-pr.sh`): a docs-only increment on top of a head whose `WebKit
  Gate` succeeded on the **same tested base** (first parent of the PR merge ref) skips WebKit.
- `playwright.config.ts`: `fullyParallel: true`, `retries: 0`, no `workers` override, so the CI
  default is 50% of the vCPUs. The logs show "using 2 workers" (4-vCPU runner). The web server is
  the **Vite dev server** (`npm run dev`), which compiles modules on first request.

## 2. Measurements (before)

Sources: Actions job/step timestamps and the `list` reporter output of real runs. Nothing was
rerun for this audit.

### 2.1 Whole-workflow and step timings (successful full WebKit runs)

| Run | PR | Workflow wall-clock | classify | setup¹ | of which `install --with-deps` | test step | Result |
|---|---|---|---|---|---|---|---|
| 35892499302 (#89) | #206 | 7m25s | 11s | 71s | 45s | **5m44s** | 116 passed (5.7m) |
| 35889805516 (#88) | #205 | 8m47s | 44s² | 42s | 28s | **7m01s** | pass |
| 35885874406 (#73) | #203 | 8m45s³ | 8s | 39s | 26s | **7m06s** | pass |
| 35886714676 (#74) | #204 (pre-#203) | 8m32s | — | 71s | 55s | **7m07s** | pass |
| 35878191697 (#63) | #199 (pre-#203) | 8m22s | — | 66s | 49s | **7m06s** | pass |

¹ Checkout through the browser-installation proof step. `npm ci` takes 6–8s (npm cache hit).
² 40s of this was the `fetch-depth: 0` checkout; it is normally 4–5s.
³ Includes ~36s of queueing before `classify` started.

- **Bottleneck:** the test step accounts for 5.7–7.1 min of a 7.4–8.8 min workflow (about 80%).
  Setup takes 0.7–1.2 min, mostly apt system packages from `--with-deps`. `classify` and
  `WebKit Gate` take about 10–15s together.
- **The Playwright browser cache never hits on PRs.** Every run's post step prints
  `Cache saved with key: playwright-webkit-Linux-<lockhash>`, which only happens after a miss.
  Cause: the workflow runs only on `pull_request`, and Actions caches are scoped to the ref that
  wrote them and its base. `main` never writes this cache, so each PR's first run misses (and
  concurrency-cancelled pushes often miss again). The browser download itself is ~3s from the
  CDN, so the real loss is ~5–8s per run (download plus the ~4s cache upload). Minor, but free to
  fix (§6, Phase 2A).

### 2.2 Suite size

| Scope | Specs | Tests / viewport | Tests total |
|---|---|---|---|
| `main` @ d6b6ef9 | 10 | 57 | **114** (`playwright test --list`) |
| PR #206 head (adds `save-forward-compat-3-4b.spec.ts`) | 11 | 58 | 116 |

Eight tests pin their own viewport with `page.setViewportSize` (`dynamic-cooking-steps` A/B/C,
`making-ui-1screen` cut-target ×2 + Salsiccia@360 + the 390×650 shrink test,
`pizza-cutting-phase4b` C). They run identically in both projects, which duplicates ~42s of
test time. They are candidates for de-duplication later (§6, Phase 2C).

### 2.3 Per-spec cost (run #89, fast runner; typical runners are ~1.23× slower)

Test-seconds are summed per spec. The wall time is roughly sum ÷ 2 workers.

| Spec | Tests/vp | 390×844 (s) | 360×800 (s) | Main surfaces |
|---|---|---|---|---|
| viewport-1screen | 15 | 51.2 | 46.3 | HOME/overlays 1-screen, Recipe Select, Weekly Ranking, Lunch Rush RESULT nav, PREPARE, FREE RESULT |
| dynamic-cooking-steps | 4 | 48.1⁴ | 21.3 | dynamic steps, full rounds, Lunch Rush D |
| finished-pizza-visual-2.0 | 5 | 43.4 | 36.8 | bake visual, RESULT, Lunch Rush E |
| making-ui-1screen | 9 | 39.7 | 35.0 | cooking UI 1-screen, nav, Reference modal, full round, PizzaStage sizing |
| timing-transparency | 5 | 36.4 | 32.8 | timing summary, RESULT, Lunch Rush E |
| lunch-rush-result-ranking-phase4 | 4 | 33.5 | 33.6 | Lunch Rush result stats (27.9s single test), ranking rows |
| result-1screen-2.0 | 5 | 30.9 | 30.3 | FREE/Lunch Rush RESULT layout |
| pizza-cutting-phase4b | 4 | 27.3 | 25.7 | CUT gesture, full rounds, Lunch Rush D |
| progression2-p3-3-onboarding | 4 | 22.7 | 22.1 | fresh save, Dex 0, reset + reload (WebKit storage race), HOME 1-screen |
| free-cooking-phase3-2 | 2 | 17.7 | 14.6 | FREE cook, owned tray, HOME + restart |
| (#206 only) save-forward-compat-3-4b | 1 | 1.5 | 1.5 | save write + reload |
| **Total** | **57–58** | **~352** | **~300** | |

⁴ Includes Vite dev-server cold compilation: the same tests take 16.9/17.4s in the first worker
slot and 5.3/7.1s later. Every new runner or shard pays this again (~10–20s).

### 2.4 Viewport cost

- 390×844: ~352 test-seconds (54%). 360×800: ~300 test-seconds (46%). The 390 share is inflated
  by the cold start because it runs first.
- Dropping one viewport saves ~45% of the test step. That is the lever for "viewport selection",
  but only where the change cannot be viewport-sensitive (§4).

## 3. Sharding options for Full WebKit

The `webkit` job runs on one 4-vCPU runner with 2 workers. More workers per runner would raise
CPU contention for timing-sensitive tests (bake timing, `MissionClock`), so parallelism should
come from **more runners, each keeping 2 workers**, not from more workers.

| Layout | Jobs | Test step / job (est.) | Workflow wall-clock (est.) | Runner-min (est.) |
|---|---|---|---|---|
| Today | 1 | 5.7–7.1 min | **7.4–8.8 min** | ~8 |
| Viewport split (`--project` per job) | 2 | 2.8–3.8 min | 4.7–5.8 min (−35%) | ~9 |
| Viewport × `--shard=i/2` | 4 | 1.7–2.2 min | **3.3–4.3 min (−50–55%)** | ~12 |
| Viewport × `--shard=i/3` | 6 | 1.3–1.6 min | 2.9–3.8 min | ~15 |

The estimates are test-seconds ÷ 2 workers ÷ shards, plus ~15s cold start per job, ~1 min setup
and ~0.7 min for classify, gate and queueing. With `fullyParallel`, `--shard` splits by test
count (~14–15 tests per shard). The longest single test is 28s, so shards stay balanced to within
about ±20s. Four jobs is the knee: going from 4 to 6 jobs saves less than 30s because setup is
fixed per job.

Coverage is unchanged: the union of shards is every test in both projects. The design in §5.3
verifies that union instead of assuming it.

## 4. Changed-surface → WebKit policy matrix

Levels:

- **L0** none: WebKit not required.
- **L1** affected WebKit, 390×844 only.
- **L2** affected WebKit on 390×844 + 360×800.
- **FULL**: all specs on both viewports, sharded.

Every L1/L2 run also runs the **Safari smoke set**:
- `viewport-1screen` (1-screen layout, overlays, navigation, Lunch Rush CTAs)
- `progression2-p3-3-onboarding` (the known WebKit reload/storage race, reset, Dex 0)
- `pizza-cutting-phase4b` (real pointer gestures through a full round and CUT)

The smoke set costs ~101 test-seconds per viewport.

| # | Category | Example paths | Level | Specs (besides smoke) | Why |
|---|---|---|---|---|---|
| 1 | docs-only | `docs/**`, `*.md` outside runtime trees | **L0** (unchanged #203) | — | Cannot reach the browser; #203 rules and reuse stay as is |
| 1b | test-only / unwired / type-only | `src/**/*.test.ts(x)`, `src/test/**`, `**/testSupport/**`, new modules not imported by the app | **L0**, only when proven by the **bundle graph** (Phase 2C); until then L1 smoke | — | Vitest covers them in `ci.yml`. A file outside the Vite module graph of `index.html` cannot execute in Safari. Proof: `vite build` with a `moduleParsed` hook lists the reachable modules (measured 2.4s, 110 `src` modules; `economySimulation.ts`, `cut/fixtures.ts` and `scoringV2/types.ts` are not reachable). Filename patterns alone are not proof. |
| 2 | pure logic (non-input) | `src/logic/{economy,efficiency,mastery,pitzReward,completionGate,cookingTiming*,missionResultStats}.ts`, `src/shared/*` (non-Lunch-Rush) | **L1** | result-1screen, timing-transparency | Viewport-independent computation. It still runs in JavaScriptCore (Date/Intl/number formatting), so it is not L0. The layout of the resulting text at 360 is owned by category 5 when UI changes. |
| 3 | persistence / storage | `src/state/{persistence,dex,inventory,progression,starterStock,discoveryRegistration}.ts`, `src/firebase/**` | **L1** | free-cooking, save-forward-compat, lunch-rush-result-ranking (for `firebase/**`) | WebKit's storage/reload behaviour is the documented Safari-specific failure (onboarding reset race; `startQuattroFormaggiHeavyInventory` note). It is not viewport-dependent, so 390 is enough. Never docs-only. |
| 4 | Lunch Rush | `src/mission/**`, `src/shared/lunchRush*`, `src/logic/missionScoring.ts`, `src/data/orders.ts`, `src/components/Mission*.tsx`, `WeeklyRankingOverlay.tsx` | **L2** | lunch-rush-result-ranking (+ in Phase 2C: every test titled Lunch Rush/Weekly Ranking/Mission, 18 per viewport) | Mission overlays and the four RESULT CTAs are layout-sensitive at 360. Acceptance criterion in #207. |
| 5a | layout, one component | a single `src/components/*.tsx` or `src/screens/{HomeScreen,PizzaSelectScreen}.tsx` that is not listed under 6/7 | **L2** | specs mapped to that component in the manifest | Viewport-sensitive; both viewports required by #207. |
| 5b | layout, global | `src/App.css`, `src/index.css`, `index.html`, `src/assets/**`, `public/**` | **FULL** | — | A global primitive reaches every screen, so the affected set is the whole suite. |
| 6 | pointer / input / gesture | `src/components/{PizzaStage,IngredientTray,SauceHeatmapCanvas,BakeOverlay}.tsx`, `src/logic/{cut/**,doughShape,pieceDrag,pointerTimestampNormalizer,sauceField,sauceDispenseController,sauceQuantity,pizzaCoordinates,bake,bakeVisual}.ts`, `e2e/gestures.ts` | **FULL** | — | Safari pointer semantics are the historical regression source (#167), and ~90% of tests play a gestured round, so a subset would save little and risk much. |
| 7 | navigation / core flow | `src/App.tsx`, `src/main.tsx`, `src/screens/GameScreen.tsx`, `src/state/{gameReducer,pizzaState,pizzaSelect}.ts` | **FULL** | — | Every spec traverses these. |
| 8 | scoring | `src/logic/{scoring,scoringV2/**,sauceEvaluation,referenceScoring,referenceMatching}.ts` | **L1** | result-1screen, timing-transparency, finished-pizza-visual | Score math is viewport-independent. RESULT rendering is exercised at 390; the RESULT layout at 360 changes only with UI changes (5a). |
| 9a | recipe / ingredient data | `src/data/{recipes,ingredients,cookingProfiles,referencePizza,recipeSauceProfiles,discoveryCatalog,freeCook,playerReference}.ts` | **FULL** | — | Every spec's fixtures are recipes (Margherita/Capricciosa/...). Tab count and piece count drive layout. |
| 9b | copy / text data | `src/data/{dialogue,hints,completionMessages,makingStepLabels}.ts` | **L2** | onboarding, result-1screen, making-ui-1screen | Longer strings overflow first at 360. |
| 10 | e2e spec only | `e2e/*.spec.ts` | **L2** | the changed specs | The changed test must itself pass on WebKit at both viewports. |
| 11 | unknown / high-risk | any unmapped path; `package*.json`, lockfiles, `playwright.config.ts`, `vite.config.*`, `tsconfig*`, `.github/**`, `scripts/ci/**`, `functions/**`, e2e non-spec files; label `webkit-full`; classifier error | **FULL** | — | Fail-safe. The manifest is an allow-list: a path must match a rule to get less than FULL. |

Combining rules:
- A PR's level is the maximum over its files. Specs are the union, and viewports are the union.
- If the union reaches ≥ 70% of the suite's test-seconds, the PR runs FULL: the sharded FULL run
  is then as fast and simpler.
- The mapping manifest (`scripts/ci/webkit-surfaces.json`, Phase 2B) must name every
  `e2e/*.spec.ts`. An unlisted or missing spec fails the classifier self-test, which means FULL
  for everyone until someone updates the manifest. This keeps a new spec from being silently
  excluded from affected runs.

Estimated wall-clock for each level, using §2/§3 rates (≈1 min setup, ≈0.7 min
classify/gate/queue):

| Level / example | Test-seconds | Workflow wall-clock (est.) | vs today (7.4–8.8) |
|---|---|---|---|
| L0 | 0 | ~0.5 min | −95% |
| L1 smoke only | ~101 | ~2.7 min | −65% |
| L1 storage (#206-like) | ~121 | ~2.8 min | −65% |
| L1 scoring | ~211 | ~3.5 min | −55% |
| L2 Lunch Rush (file-level) | ~264 | ~3.2 min (split by viewport) | −60% |
| L2 one component | ~400 | ~3.5 min (split by viewport) | −55% |
| FULL (4 shards) | ~650–800 | **3.3–4.3 min** | −50–55% |

**Key finding:** once FULL is sharded (Phase 2A), affected-only selection saves only another
~0.5–1.5 min per PR, and it brings mapping risk with it. Sharding is the main win and applies to
every WebKit-required PR with zero coverage change. Affected selection is worth doing only where
its safety argument is strong:
- **L0 via bundle-graph proof**: e.g. PR #205's unwired progression rule layer would drop from
  ~8.8 min to ~0.5 min.
- **L1 storage/logic/scoring**, where the smoke set still covers Safari-specific behaviour.

## 5. Design

### 5.1 Jobs

```
classify   → level=none|L1|L2|full, projects=[...], specs=[...], reason, tested_base, plan_id
webkit-full      static matrix {project: [webkit-390x844, webkit-360x800]} × {shard: [1, 2]}
                 if: !cancelled() && (classify.result != 'success' || level == 'full')
                 fail-fast: false
webkit-affected  single job, runs `--project <projects> <specs>`
                 if: !cancelled() && classify.result == 'success' && level in (L1, L2)
WebKit Gate      if: always(); the ONLY required check (name unchanged)
```

- **The FULL matrix is static.** It never depends on classify outputs, so a failed or garbled
  classify still produces a real FULL run. A dynamic `fromJSON` matrix would fail closed but block
  the PR instead of testing it.
- **Affected runs are not sharded.** They are small, and `--shard` on a small set can produce an
  empty shard.
- Both heavy jobs keep 2 workers and `retries: 0`.

### 5.2 Gate truth table (extends #203)

| classify | level | webkit-full | webkit-affected | Gate |
|---|---|---|---|---|
| success | none | skipped | skipped | PASS (safely skipped / reused) |
| success | none | anything else | anything else | FAIL (ran unexpectedly) |
| success | L1/L2 | skipped | success **+ evidence OK** | PASS |
| success | L1/L2 | any | failure / cancelled / skipped / evidence missing | FAIL |
| success | full | success **+ evidence OK** | skipped | PASS |
| not success, or unknown level | (fail-safe → full) | success + evidence OK | skipped | PASS |
| any other combination | | | | FAIL |

- The result of a matrix job is its aggregate, so one failed or cancelled shard gives
  `failure`/`cancelled`.
- `cancelled` and `skipped` never count as success where WebKit was required. This is unchanged
  from #203.

### 5.3 Evidence check (new; defends against a false green inside a successful job)

Each heavy job:
1. Runs `playwright test --list` for its **full planned selection without `--shard`**.
2. Runs its slice with the JSON reporter.
3. Uploads `webkit-evidence-<project>-<shard>.json` containing `{plan_id, project, shard,
   listed_total, expected, unexpected, skipped}`.

`WebKit Gate` downloads all `webkit-evidence-*` files and requires:
- exactly the planned set of (project, shard) entries;
- the same `plan_id` in each;
- `unexpected == 0` and `expected > 0` in each;
- **Σ expected over shards == listed_total** for each project.

This catches duplicated or mis-numbered shards, an empty grep, a plan/run mismatch and a "0 tests
ran" green. A missing artifact means FAIL.

### 5.4 Reuse safety (must not weaken #203)

- `WebKit Gate`'s notice gains `level=<...> plan_id=<sha256 of the sorted projects/specs>` next to
  `tested_base=<sha>`.
- Reuse still requires all of the following:
  1. the increment since the previous head is docs-only;
  2. the previous gate succeeded;
  3. **same `tested_base`** (unchanged from #203);
  4. **new:** the same `level` and `plan_id` as the plan computed for the current PR diff.
- Gates without `level`/`plan_id` (every pre-Phase-2 gate) are never reused, so the first push
  after rollout runs WebKit. This fails safe in the conservative direction.
- A docs-only increment cannot change the plan, because the code diff and the manifest are
  unchanged: `scripts/ci/**` is itself FULL, not docs. Requirement 4 is defence in depth.

### 5.5 Backstops for affected-only escapes

- **Post-merge FULL on `push: main`**, with its own concurrency group and no cancel of PR runs.
  - Catches an interaction that an affected PR run could not see.
  - Also writes the Playwright browser cache on `main`, which fixes the PR cache miss (§2.1).
  - It is informational (red `main` → fix forward). It does not change branch protection.
- **`webkit-full` label**: read from the event payload on the next push or rerun. Deliberately
  **no `labeled` trigger**: with PR-scoped `cancel-in-progress`, any label event would cancel a
  running WebKit run.
- `workflow_dispatch` for a manual FULL run on any ref.

## 6. Implementation plan

Splitting into separate PRs is recommended. Phase 2 is **not** safe as one PR: the sharding and
evidence-gate change alters the success semantics of the required check, while the affected-test
mapping alters coverage. Each should get its own before/after measurement and its own rollback.

| Phase | Content | Coverage change | Expected result | Risk |
|---|---|---|---|---|
| **2A** | FULL as a static 4-job matrix (viewport × shard 1/2, 2/2); evidence artifacts + gate verification (§5.3); gate truth table for `full`/`none`; `push: main` FULL (post-merge + cache warm); classify output `level` = `none`/`full` only (same decisions as #203); reuse also requires `level` | **None**: same tests, same viewports | Every WebKit-required PR 7.4–8.8 → **3.3–4.3 min** | Low. Pure parallelisation; gate is stricter than today |
| **2B** | `scripts/ci/webkit-surfaces.json` manifest + classifier levels L1/L2 for categories 2, 3, 4, 5a, 8, 9b, 10; smoke set; `webkit-affected` job; `plan_id` in the reuse check; self-tests for every row of §4 | Reduced for matched categories only; smoke always included; FULL backstops (§5.5) | Matched PRs **2.7–3.5 min** | Medium. Mapping staleness, bounded by the allow-list, the self-test on the spec list, smoke and post-merge FULL |
| **2C** | Bundle-graph reachability (`vite build` + `moduleParsed`, ~2.4s after `npm ci`) → L0 for test-only, unwired and type-only files; Playwright `tag`s (`@lunch-rush`, `@storage`, `@webkit-smoke`) for test-level selection; optional de-duplication of the 8 viewport-pinned tests | L0 only for code proven unreachable | Unwired/test-only PRs ~8.8 → **~0.5 min** | Low–medium (touches specs' metadata only) |

Each phase ships with:
- a Result report containing real before/after run timings;
- self-tests for the classifier;
- a demonstration run per new path (docs → L0, FULL sharded, a forced classifier failure → FULL,
  a cancelled shard → FAIL).

## 7. Risks and fail-safes

| Risk | Fail-safe |
|---|---|
| Classifier crash, bad output, unknown path | FULL (static matrix runs whenever classify ≠ success) |
| Shard misconfiguration / empty selection / 0 tests | Evidence check: Σ expected == listed_total, expected > 0, exact entry set |
| Cancelled or skipped shard | Aggregate matrix result ≠ success → Gate FAIL |
| Mapping too narrow (Phase 2B) | Allow-list manifest; categories 5b/6/7/9a/11 always FULL; smoke set in every affected run; post-merge FULL; `webkit-full` label |
| New spec not in the manifest | Self-test fails → FULL for all until the manifest is updated |
| Base moved after an affected/full pass | Unchanged #203 rule: `tested_base` must match or WebKit runs |
| Reusing a narrower plan's evidence | Reuse requires the same `level` + `plan_id`; pre-Phase-2 gates are never reused |
| More runners, more flakiness | Workers per runner unchanged (2), `retries: 0` unchanged; parallelism only across machines |
| Runner-minute cost | +~50% on FULL runs (~8 → ~12 runner-min); offset by L0/L1 savings in 2B/2C |

## 8. Safari coverage impact

- **Phase 2A: none.** The same 114 tests (116 once #206 lands) run on the same two WebKit
  viewports and are verified by count.
- **Phase 2B: reduced only for mapped, viewport-independent or component-scoped changes.** Every
  WebKit-required PR still runs the three smoke specs (storage race, gestures, 1-screen/navigation)
  on 390×844, and on both viewports for layout categories. FULL is never removed: it runs for
  high-risk categories, unknown paths, classifier failures, on demand, and after every merge to
  `main`.
- **Phase 2C:** L0 only for code proven unreachable from the shipped module graph.

## 9. Rollback

- Phase 2A: `git revert` restores the #203 single `webkit` job. `WebKit Gate` keeps its name, so
  branch protection needs no change.
- Phase 2B/2C: revert the manifest/classifier commit; the classifier falls back to #203's binary
  docs-only/full decision.
