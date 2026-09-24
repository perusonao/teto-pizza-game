# Dev CI Phase 2B: WebKit Fresh Measurement, Selection Decisions, Non-Browser Skip — Result (Issue #207)

- Issue: #207, Phase 2B. Design input: PR #208 (`TETO_DEV-CI_WEBKIT-PHASE2_Fresh-Audit.md`),
  Phase 2A result (`TETO_DEV-CI_WEBKIT-PHASE2A_Result.md`, PR #210, merged as `dff233c`).
- Branch: `claude/phase-2b-webkit-audit-l8z4cr` (PR #219), based on `main` @ `dff233c`.
- Scope: CI workflow and CI scripts only. Specs, `playwright.config.ts`, runtime code and
  Progression 2.0 are unchanged. PR #205/#206/#209/#211/#213/#214/#217 and #215 were not touched
  (#217's finished runs were only *read* as measurement data).
- Human Verification policy: not applicable. There is no UI/UX/gameplay change.

## 0. Summary

| | |
|---|---|
| Bottleneck (post-2A) | Critical path = **shard 1/2 of 360×800** (test step 2m19s–2m30s). Playwright's `--shard` splits by test **count**, so shard 1/2 holds ~60–65% of the test-seconds. Fixed setup (≈45–90s per shard, mostly `install --with-deps`) is second. |
| Wasted Full runs | Docs + `tools/*.py` PRs still ran Full WebKit (#217: 3 runs × ~3.7 min; #196/#191/#188 before it). `tools/*.py` can never reach the browser. |
| **Adopted** | **Non-browser skip.** `tools/**/*.py` and `src/**` unit-test files (`*.test.ts(x)`, `src/test/**`) join docs in the skip allow-list. Both are guarded by a repository scan (any reference or scan error → Full). A tools-only / unit-test-only PR goes from ~3.7 min to a ~25s gate, and a unit-test-only push after a green gate reuses it. |
| **Measured, not adopted** | **Duration-balanced shards.** Implemented and run twice for real: balanced, but 3m55s / 4m07s vs 3m39s–4m03s (§5.2). Removed again in this PR. |
| **Decided against** | **Affected-spec (L1/L2) and single-viewport selection.** With 4 parallel shards they save ≤ ~1.5 min on the PRs they match, and **0 of the last 14 runtime PRs** would have matched a non-FULL tier (§4). |
| Coverage change | **None** for any PR that runs WebKit. The workflow is Phase 2A's, changed only in its header comment. The skip set grows only by files that cannot load in the browser (proved by scan + Vite module graph). |

## 1. Current state checked (GitHub, not past chats)

- `main` = `dff233c` (PR #210, Phase 2A, merged 2026-09-23 21:19Z). Issue #207 comments:
  Phase 2A done; 2B/2C open.
- `e2e-webkit.yml`: `classify` → static matrix `{webkit-390x844, webkit-360x800} × {shard 1/2,
  2/2}` → `WebKit Gate` (evidence-verified). `push: main`, `workflow_dispatch` and the
  `webkit-full` label run Full.
- Classifier: `docs/**` and `**/*.md` outside runtime trees skip. Everything else runs Full.
  Docs-only increments reuse a green gate on the same `tested_base`.
- Suite: 10 specs, 57 tests per viewport, 114 total.

## 2. Fresh measurements (post-2A, real Actions runs, nothing re-run)

### 2.1 Full WebKit runs since Phase 2A

| Run | Event | Wall-clock¹ | classify | Setup² per shard (390 s1 / s2 · 360 s1 / s2) | of which `install --with-deps` | Test step (390 s1 / s2 · 360 s1 / s2) | Gate |
|---|---|---|---|---|---|---|---|
| 35921764963 (#97) | push `main` | 4m03s | 6s | 59 / 50 · 75 / 52s | 40 / 31 · 53 / 35s | 1m38 / 1m38 · **2m19** / 1m08 | 8s |
| 35939059108 (#106) | PR #217 | 3m46s | 11s | 56 / 78 · 49 / 45s | 36 / 56 · 29 / 25s | 2m04 / 1m15 · **2m26** / 1m37 | 8s |
| 35940050018 (#107) | PR #217 | 3m46s | 10s | 61 / 51 · 48 / 49s | 40 / 34 · 28 / 31s | 2m07 / 1m11 · **2m30** / 1m23 | 9s |
| 35946070881 (#108) | PR #217 | 3m39s | 7s | 64 / 56 · 48 / 46s | 42 / 37 · 28 / 27s | 2m11 / 1m09 · **2m26** / 1m37 | 6s |

¹ Run created → `WebKit Gate` completed. ² Job start → test step start (checkout, setup-node,
`npm ci` 4–7s, browser cache 1–2s, `install --with-deps`, proof, `--list` 2–3s).

- The Playwright **browser cache now hits** on PRs ("Cache hit occurred on the primary key"), as
  2A predicted after `main`'s push run warmed it. `install --with-deps` still costs 25–56s: that
  is the apt step, which is not cacheable.
- The **longest shard is always 360×800 shard 1/2** (2m19s–2m30s). Shard 2/2 finishes 45–80s
  earlier, and that time is spent idle.
- Averages: shard 1/2 = 2m00s (390) / 2m25s (360); shard 2/2 = 1m18s (390) / 1m26s (360).

### 2.2 Per-spec and per-viewport time (run #108, list-reporter per-test seconds)

| Spec | Tests/vp | 390×844 (s) | 360×800 (s) | Main surfaces |
|---|---|---|---|---|
| dynamic-cooking-steps | 4 | 57.5³ | 67.4³ | dynamic steps, full rounds, Lunch Rush D |
| viewport-1screen | 15 | 44.7 | 58.2 | HOME/overlays, Recipe Select, Weekly Ranking, Lunch Rush RESULT nav, PREPARE, FREE RESULT |
| finished-pizza-visual-2.0 | 5 | 44.8 | 49.7 | bake visual, RESULT, Lunch Rush E |
| making-ui-1screen | 9 | 44.6 | 49.9 | cooking UI 1-screen, Reference modal, full round, PizzaStage sizing |
| result-1screen-2.0 | 5 | 34.1 | 48.9 | FREE / Lunch Rush RESULT layout |
| timing-transparency | 5 | 34.1 | 47.3 | timing summary, RESULT, Lunch Rush E |
| progression2-p3-3-onboarding | 4 | 29.0 | 40.3 | fresh save, Dex 0, reset + reload (WebKit storage race), HOME |
| lunch-rush-result-ranking-phase4 | 4 | 34.0 | 35.1 | Lunch Rush stats (27.8s single test), ranking rows |
| pizza-cutting-phase4b | 4 | 30.5 | 33.8 | CUT gesture, full rounds, Lunch Rush D |
| free-cooking-phase3-2 | 2 | 17.2 | 18.7 | FREE cook, owned tray, HOME + restart |
| **Total** | **57** | **370.5** | **449.3** | |

³ Includes Vite dev-server cold compilation: Scenario A/B ran first in their worker (20–24s vs
8–10s warm). Every shard pays a cold start once per worker, wherever it lands.

- Viewport split: 390×844 = 45%, 360×800 = 55% of test-seconds in this run (#89 before 2A:
  54/46). Runner-to-runner variance (±15%) is larger than any viewport-intrinsic difference.
- Count-based split (2A): shard 1/2 = first 29 tests = 241s (390) / 268s (360); shard 2/2 = 130s
  / 182s. That is **65% / 60%** of the viewport's test-seconds in shard 1/2.

### 2.3 Where the ~3m40s goes (run #108 critical path)

| Segment | Time |
|---|---|
| queue + `classify` | 0:09 |
| shard queue + setup (360 s1) | 0:59 |
| test step (360 s1, critical) | 2:26 |
| evidence/upload + gate queue + gate | 0:14 |
| **total** | **3:39** (sum 3:48; segments overlap by a few seconds) |

The floor that no test selection can remove is ≈ **1.4–1.7 min**: classify + setup + a cold
Vite start + gate.

## 3. Affected-only candidates, mapping and viewport classification (design)

### 3.1 Changed surface → affected spec (safe mapping, if affected selection is ever wired)

Every run of a partial tier must include the **Safari smoke set**:
- `viewport-1screen`: 1-screen layout, overlays, navigation, Lunch Rush CTAs.
- `progression2-p3-3-onboarding`: the known WebKit storage/reload race, reset, Dex 0.
- `pizza-cutting-phase4b`: real pointer gestures through a full round and CUT.

| Changed surface | Example paths | Tier | Specs beyond the smoke set |
|---|---|---|---|
| docs | `docs/**`, `**/*.md` outside runtime trees | **skip** (unchanged) | — |
| offline tools | `tools/**/*.py` | **skip** (implemented, scan-guarded) | — |
| unit tests only | `src/**/*.test.ts(x)`, `src/test/**` code files | **skip** (implemented, scan-guarded) | — |
| storage / persistence | `src/state/{persistence,dex,inventory,progression,starterStock,discoveryRegistration}.ts`, `src/firebase/**` | L1 (390) — **never skip** | free-cooking-phase3-2, lunch-rush-result-ranking-phase4 (firebase) |
| pure logic (non-input) | `src/logic/{economy,efficiency,mastery,pitzReward,completionGate,cookingTiming*,missionResultStats}.ts` | L1 (390) | result-1screen-2.0, timing-transparency |
| scoring | `src/logic/{scoring,scoringV2/**,sauceEvaluation,referenceScoring,referenceMatching}.ts` | L1 (390) | result-1screen-2.0, timing-transparency, finished-pizza-visual-2.0 |
| Lunch Rush | `src/mission/**`, `src/shared/lunchRush*`, `src/logic/missionScoring.ts`, `src/data/orders.ts`, `src/components/Mission*.tsx`, `WeeklyRankingOverlay.tsx` | L2 (both) | lunch-rush-result-ranking-phase4, dynamic-cooking-steps (D), timing-transparency (E), finished-pizza-visual-2.0 (E) |
| single component (layout) | one `src/components/*.tsx` / `HomeScreen` / `PizzaSelectScreen` not listed below | L2 (both) | specs that render it |
| copy / text data | `src/data/{dialogue,hints,completionMessages,makingStepLabels}.ts` | L2 (both) | onboarding, result-1screen-2.0, making-ui-1screen |
| e2e spec only | `e2e/*.spec.ts` | L2 (both) | the changed specs |
| **navigation / core flow** | `src/App.tsx`, `src/main.tsx`, `GameScreen.tsx`, `gameReducer.ts`, `pizzaState.ts`, `pizzaSelect.ts` | **FULL** | — |
| **input / gesture** | `PizzaStage`, `IngredientTray`, `SauceHeatmapCanvas`, `BakeOverlay`, `src/logic/{cut/**,doughShape,pieceDrag,pointerTimestampNormalizer,sauce*,pizzaCoordinates,bake*}.ts`, `e2e/gestures.ts` | **FULL** | — |
| **global layout** | `src/App.css`, `src/index.css`, `index.html`, `src/assets/**`, `public/**` | **FULL** | — |
| recipe / ingredient data | `src/data/{recipes,ingredients,cookingProfiles,referencePizza,recipeSauceProfiles,discoveryCatalog,freeCook,playerReference}.ts` | **FULL** | — |
| config / deps / CI / unknown | `package*.json`, `playwright.config.ts`, `vite.config.*`, `tsconfig*`, `.github/**`, `scripts/ci/**`, `functions/**`, `data/**`, any unmapped path; label `webkit-full`; classifier error | **FULL** | — |

### 3.2 Viewport classification

| 390×844 only would suffice | Both 390×844 + 360×800 required |
|---|---|
| Viewport-independent computation: storage/persistence/reload, Firebase I/O, pure logic, score math. The Safari-specific risk is JavaScriptCore/storage behaviour, which does not depend on width. | Anything that renders or lays out: components, screens, CSS, copy/text length (overflows first at 360), Lunch Rush overlays/CTAs, e2e specs themselves, input/gesture geometry, recipe/tab/piece counts. |

Eight tests pin their own viewport (`page.setViewportSize`) and run identically in both projects
(≈42s duplicated per run). De-duplicating them is a Phase 2C candidate (spec metadata change).

## 4. Decision: affected-spec / single-viewport selection is **not** implemented now

1. **After 2A, dropping a viewport does not shorten the wall-clock.** The two viewports already
   run on separate, parallel runners, so the wall-clock is the slowest shard. Removing 360×800
   saves ≈ 6 runner-minutes, not minutes of waiting.
2. **Partial tiers save ≤ ~1.5 min, and only on PRs they match.** Floor ≈ 1.4–1.7 min vs Full
   ≈ 3.6–4.1 min.
3. **Almost no real PR would match.** The last 14 merged runtime PRs (#158, #169, #170, #171,
   #173, #175, #179, #181, #185, #187, #193, #197, #199, #202) **all** touch a FULL surface:
   `App.css`/`App.tsx`/`GameScreen.tsx`/`gameReducer.ts`/`e2e/gestures.ts`/recipe-profile data
   or config. The open runtime PRs match nothing lighter either:
   - #205 is an unwired module plus tests. It needs a bundle-graph proof (2C).
   - #206 is `persistence.ts` plus a new e2e spec (L2 at best).

   Every one of these specs plays a full round through the shared cooking flow, so
   "affected" ≈ "all".
4. **The waste that is real is on non-browser PRs:** #217 (3 runs), #196, #191 and #188 changed
   only `tools/*.py` + docs. That is fixed without any coverage reduction (§5.2).

Revisit affected selection only with (a) the 2C bundle graph, (b) Playwright tags per surface,
and (c) evidence that a meaningful share of PRs would land in L1/L2.

## 5. What changed (final state of PR #219)

| File | Change |
|---|---|
| `scripts/ci/classify-webkit.mjs` | Skip allow-list = docs + `tools/**/*.py` + `src/**/*.test.ts(x)` + `src/test/**`. The two new categories require `--repo` scan guards. Self-test grows from 24 to 108 cases (path table + raw-scan fixtures). |
| `scripts/ci/classify-webkit-pr.sh` | Passes `--repo <toplevel>` (the merge-ref checkout). Reason wording changes to "cannot reach the browser". Decision order, forcing rules, `tested_base` reuse and fail-safes are unchanged. |
| `scripts/ci/test-webkit-ci.sh` | 40 → 48 cases: tools-only / unit-test-only / unit+runtime / guard-violation PRs in a throwaway repo, plus classification against **this repository's own tree** (tools-only → skip, unit-test-only → skip, persistence → run). |
| `.github/workflows/e2e-webkit.yml` | Header comment only. Matrix, steps, triggers, concurrency, evidence and gate are identical to Phase 2A. |
| `scripts/ci/webkit-gate.sh` | Comment only (`level` stays `full`/`none`). |
| `docs/PROJECT_HANDOFF.md` | CI/WebKit Gate section updated |

### 5.1 Non-browser skip (tools / unit tests)

The guard **never parses and never strips anything**. It reads the raw text of every scannable
file in the checked-out merge ref: all code, markup and data outside `docs/**`, excluding
`scripts/ci/**`, Vitest-only configs and the guarded files themselves. Because nothing is removed,
no heuristic can hide evidence. Each rule can only push a PR toward Full WebKit.

1. **Name mention.** A changed guarded file runs WebKit if its name stem (`scoring.test`,
   `test/setup`, a tools script stem) appears anywhere, including in a comment. This covers any
   import syntax, `fs` paths, commands, HTML entries and config helpers, without having to
   understand any of them. Guarded files can load each other (runtime → `a.test` → `b.test`).
   So every guarded file named by scanned code is itself scanned like runtime code, and this is
   applied transitively.
2. **Dynamic loading.** If any file uses a path-taking call whose argument is not a plain
   string literal, both categories are disabled. The calls are `import()` / `require()` /
   `fetch()` / `new URL()` / `new Worker()` / `fs` reads. The **whole** first argument must be
   one plain literal. `"a" + name`, a template with `${}` and a comment before the argument
   all fail. `readdir`/`glob`,
   `import.meta.glob`, `eval` and `new Function` also disable both. Any `python` invocation
   disables `tools`.
3. **Config.**
   - `vite.config.*` / `playwright.config.*` may not import local modules, so their settings
     can only live in those two files.
   - Vite `root` / `alias` / `rollupOptions` / `optimizeDeps` / `publicDir` / `input`, and
     Playwright `testMatch` / `testIgnore`, disable both.
   - There must be exactly one Playwright config, with exactly `testDir: "./e2e"`. Otherwise
     Playwright could run `src/**` `*.test.ts` files itself.
   - A `--config` / `-c` switch in `package.json` or the workflow disables both.

**Threat model:** accidental coupling in ordinary code. Deliberate obfuscation is out of scope.
The post-merge Full WebKit run on `main` and the `webkit-full` label are the backstops.

On this repository:
- 96 of the 128 guarded files (unit tests, `src/test`, `tools/*.py`) can skip. The other 32
  are named by runtime code or by a reachable test, often only in a comment, so they
  conservatively run Full.
- For example, `scoringV2.test` and `tools/progression2_phase2_progression.py` are both named
  in source comments, so both run Full.
- #217's `tools/progression2_issue216_fresh_design.py` skips.

Any hit, a missing tree, or a scan error disables that category, and the paths run WebKit.

Cross-check against the real module graph: a `vite build` with a `moduleParsed` hook on `main`
found 140 modules (110 under `src/`). **None** is a `*.test.*`, `src/test/`, `tools/` or
`testSupport` module, which matches the scan.

Still never skippable:
- storage/persistence, navigation, input and runtime UI files;
- `e2e/**`, including `e2e/*.test.ts`, which Playwright's default `testMatch` would run;
- `src/**/testSupport/**`;
- `tools/` files that are not `.py`;
- `data/**`, config and dependency files;
- anything unknown.

The same rule applies to increments. A unit-test-only push after a green WebKit Gate on the same
`tested_base` reuses that result, exactly like a docs-only push (#203 rule unchanged).

Codex review on #219 caught a real bug in the first version. The raw-text check matched the
workflow's own header comment (which mentions the `tools` glob), so the `tools` skip could never
fire. This was fail-safe, but the rule was dead. Fixed in `10d2081`: comments are now stripped,
and the harness classifies against this repository's own tree.

The Final Merge Gate Codex review of `0b3fc42` found a second gap: root configs got a substring
check only, and imports were not traversed. A `vite.config.ts` → helper → `*.test.ts` chain, or
an extensionless `./x.test` import, would have been missed. Fixed by the transitive traversal
above, with 7 new scan fixtures (84 classifier cases). On this repository the traversal covers
123 files, and every relative import resolves.

Rounds 3 and 4 of the Codex review (of `27ce019` and `970f9b3`) found seven more gaps, all in
the same place: a regex-based import **parser** with comment stripping. Examples:
- comments inside `import()`;
- `${}` in a template literal;
- `"/*"` inside a string swallowing real code;
- `e2e` code reading a test file with `fs`;
- `index.html` entries not followed;
- config set through imported helpers.

Patching each instance kept producing new ones, so `694764e` replaced the scanner with the
raw-text, never-strip design above. That removes the whole class. All four round-4 examples
were reproduced through the real PR classifier on git history and now run Full.

Round 5 (on `694764e`) found two gaps in rules of the new design, not in the design itself:
- a concatenated argument that starts with a quote was treated as a literal;
- test-to-test chains were missed, because guarded files were not scanned at all.

Both are fixed: the argument must be one whole literal, and reachable guarded files are
scanned transitively.

Round 6 (on `1a682a1`) found two narrower gaps:
- a comment between the keyword and the parenthesis, as in `import /* … */ (p)`;
- a directory-index module imported by its directory, as in `./test/helper` →
  `test/helper/index.ts`.

Both are fixed. Self-test: 108 cases, and a mutation of each rule fails it.

### 5.2 Duration-balanced shards: implemented, measured, removed

What was tried (commit `353096b`):
- `webkit-shard-plan.mjs` assigned whole spec files to the 2 shards per viewport by measured
  duration (deterministic longest-first, weights from run #108).
- It emitted anchored absolute-path file filters in place of `--shard i/2`.
- The shard evidence and gate were unchanged, so coverage stayed proven.

Validation before the real run:
- local `playwright --list` partition: union = full, no overlap;
- local Chromium end-to-end: 24/33/24/33, 114 passed, verify OK.

The real WebKit runs:

| | 2A count split (runs 97, 106, 107, 108) | Balanced (runs 110, 111) |
|---|---|---|
| Wall-clock | 4m03 / 3m46 / 3m46 / 3m39 (avg 3m49) | **3m55 / 4m07** |
| Longest test step | 2m19 / 2m26 / 2m30 / 2m26 | 2m20 / 2m16 |
| Slowest shard's share of its viewport | 0.60–0.67 | 0.51–0.55 |
| 390×844 test-step total (s1 + s2) | 196 / 199 / 198 / 200s | **257 / 257s** |
| 360×800 test-step total | 207 / 243 / 233 / 243s | 260 / 245s |

The split did balance, but the total work rose by ~60s at 390×844 in both runs. Under the count
split, shard 2/2 started with light HOME/onboarding tests. Under the balanced plan, both shards
start with full-round specs, so both pay the cold Vite + WebKit start. In run 110, finished-pizza
Scenario A/B took 25–26s vs 7–9s warm.

Net result: no wall-clock gain and more runner time. The change was removed in `af4584c`, which
restores the 2A matrix. A future attempt would need to address the cold start first (e.g. warm
the dev server before tests), and that is out of scope here.

## 6. Before / after

| Path | Before (main `dff233c`) | After (PR #219) |
|---|---|---|
| Runtime PR (Full WebKit) | 3m39s–4m03s (runs 97, 106–108) | unchanged mechanics (Phase 2A matrix). Run 35948255611: 4m19s, incl. a 36s runner wait for 360 s1; test steps 1m33 / 1m47 · 2m24 / 0m58, i.e. the same range as before |
| Docs-only PR / docs-only push after green gate | ~25s skip / reuse | same (§7) |
| **`tools/**/*.py`(+docs)-only PR** (e.g. #217) | **Full, ~3m40s–3m50s per push** (#217: 3 runs) | **skip, ~25s gate** (classifier verified on this repo's tree; not live-demonstrated, it would need a separate tools-only PR) |
| **Unit-test-only PR / push after green gate** | Full, ~3m40s–4m | skip / reuse, ~25s |
| Storage/persistence/navigation/input/runtime UI | Full | Full (unchanged; covered by self-tests) |

## 7. Verification

- `bash scripts/ci/test-webkit-ci.sh`: **48/48**, locally and in `ci.yml` on the PR head.
  Classifier self-test: 77/77.
- Mutation checks (not committed):
  - guard bypass → classifier self-test fails → fail-safe Full;
  - persistence misclassified as a unit test → caught;
  - the original comment-matching bug → caught by the "this repo" cases.
- shellcheck 0.11 and actionlint 1.7.7 are clean on all workflows; oxlint is clean.
- Real WebKit runs on PR #219:

  | Run | Head | What it ran | Result |
  |---|---|---|---|
  | 35947483189 (#110) | `353096b` (balanced plan) | Full, 4 shards | Gate PASS, 114 passed, evidence OK |
  | 35947822195 (#111) | `10d2081` (balanced plan + scan fix) | Full, 4 shards | Gate PASS, 114 passed, evidence OK |
  | 35948255611 (#112) | `af4584c` (final: 2A matrix) | Full, 4 shards | Gate PASS, 114 passed, evidence OK |
  | (next run) | this report commit (docs-only) | reuse of `af4584c`'s gate | see the PR thread |

- `CI` (lint, Vitest, build, harness) is green on every head.

## 8. Fail-safe conditions (all paths)

| Condition | Result |
|---|---|
| Any changed path outside the skip allow-list, or an unknown path | Full WebKit |
| `tools` / `unit-test` scan: reference found, tree missing, or scan error | That category disabled → Full |
| Classifier self-test fails | Full (fail-safe) |
| Classify job fails or outputs garbage | Static Full matrix runs; the gate treats WebKit as required |
| `push: main`, `workflow_dispatch`, label `webkit-full` | Full |
| A shard misses or duplicates a test | Evidence verification → gate FAIL (Phase 2A, unchanged) |
| Shard failed / cancelled / skipped while required | Gate FAIL |
| Increment reuse without a green gate on the same `tested_base` | WebKit runs |

## 9. Rollback

`git revert` of PR #219 restores the docs-only allow-list. The workflow is already Phase 2A's.
`WebKit Gate` keeps its name, so branch protection needs no change.

## 10. Recommended next steps (not in this PR)

- The largest remaining fixed cost is `install --with-deps` (25–62s per shard, apt). A Playwright
  container image or pre-baked runner image could remove it. Measure first.
- The cold Vite start (~15–25s per worker) could be cut by warming the dev server before tests.
  It is a prerequisite for any finer sharding.
- Phase 2C, if pursued: bundle-graph proof for unwired modules (e.g. #205-type PRs → skip).
