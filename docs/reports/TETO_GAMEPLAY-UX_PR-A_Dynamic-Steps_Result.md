# Gameplay UX / Scoring 3.0 PR-A: Dynamic Cooking Steps & Compact Bake Tab — Result Report

Status: **Implementation, complete**. Do NOT merge — pending external Merge Gate review.

## 0. SHAs

- Latest `origin/main` at task start: `36721a03be4434ec5f95bb1c925227ab6322c9a5` (PR #177 tip).
- **Latest `origin/main` immediately before push (Duplicate Gate #2): `195a61df...`** (PR #175,
  "Lunch Rush Phase 4: Result Summary & Ranking achievedAt", merged mid-task — see §7).
- Base SHA this branch was created from: `36721a03be4434ec5f95bb1c925227ab6322c9a5`.
- Implementation HEAD: this branch, merged forward onto `195a61d` (see §7), plus this task's own
  commits.

## 1. Issue / PR linkage

- Umbrella: #176 (Gameplay UX / Scoring 3.0).
- Child issue: **#178** ("Gameplay UX PR-A: 不要工程スキップ + 焼くタブ省スペース化"), linked as a
  sub-issue of #176.
- Audit PR: #177 (merged, `36721a0`).
- PR #175 state at task start: **open** (`83c88bb`, based on the older `4a3e604` main).
- PR #175 state at task end: **merged** (`195a61d`), discovered via Duplicate Gate #2 — see §7 for
  the merge-forward and re-verification this triggered.

## 2. Duplicate Gate #1 (searched at task start)

Searched open issues/PRs for: "dynamic cooking steps", "skip cooking step", "skip cheese", "skip
topping", "Marinara cheese", "cooking profile", "MakingStepTabs", "bake emoji", "🔥 焼く", "recipe
steps". Findings:

- No open issue or PR scoped to this exact task (dynamic PREPARE-step skip + bake-tab emoji
  removal).
- PR #124 ("Recipe Cooking Steps 1.0 Phase 1A: Cooking Step Foundation", **merged**) built the
  `CookingProfile`/`getCookingProfile` foundation this task extends — not a duplicate, the
  intended prerequisite (Phase 1A's own scope explicitly deferred "activating a non-default
  profile on any real recipe").
- Open PRs at gate time: #175 (Lunch Rush result/ranking display, unrelated scope), #105
  (dev-automation, unrelated), #72/#46/#34 (long-stale, unrelated).

**Conclusion: no duplicate.** Child issue #178 created (§1).

## 3. Fresh Recipe-Step Matrix

Classification source: **`Ingredient.category`** (`src/data/ingredients.ts`, one of
`"sauce" | "cheese" | "topping"`), read generically via `getIngredient(id).category` for every id
in a recipe's `requiredIngredients` — never inferred from ingredient/recipe display names or ids.
Fresh-confirmed against `src/data/ingredients.ts` directly (not the prior audit's cached claims):

| Category | Ingredients |
|---|---|
| sauce | tomato-sauce, olive-oil, pesto |
| cheese | mozzarella, gorgonzola, parmigiano, fontina |
| topping | basil, garlic, oregano, cherry-tomato, egg, mushroom, onion, sausage, pepperoni, anchovy, tuna, rosemary, bacon, ham, black-olive |

Fresh per-recipe matrix (all 15 shipped recipes, `RECIPES` in `src/data/recipes.ts` cross-checked
against the table above):

| Recipe | DOUGH | SAUCE | CHEESE | TOPPING | BAKE | CUT |
|---|---|---|---|---|---|---|
| margherita | Y | Y | Y | Y | Y | Y |
| **marinara** | Y | Y | **N** | Y | Y | Y |
| **quattro-formaggi** | Y | Y | Y | **N** | Y | Y |
| genovese | Y | Y | Y | Y | Y | Y |
| bismarck | Y | Y | Y | Y | Y | Y |
| funghi | Y | Y | Y | Y | Y | Y |
| **fugazza** | Y | Y | **N** | Y | Y | Y |
| salsiccia | Y | Y | Y | Y | Y | Y |
| pepperoni | Y | Y | Y | Y | Y | Y |
| napoletana | Y | Y | Y | Y | Y | Y |
| tonno-e-cipolla | Y | Y | Y | Y | Y | Y |
| **pizza-bianca** | Y | Y | **N** | Y | Y | Y |
| breakfast-pizza | Y | Y | Y | Y | Y | Y |
| capricciosa | Y | Y | Y | Y | Y | Y |
| meat-lovers | Y | Y | Y | Y | Y | Y |

**No-CHEESE recipes (3/15):** marinara, fugazza, pizza-bianca — each uses only `tomato-sauce` or
`olive-oil` (sauce) plus topping-category ingredients, zero cheese-category ingredients.
**No-TOPPING recipes (1/15):** quattro-formaggi — its four non-sauce ingredients (mozzarella/
gorgonzola/parmigiano/fontina) are all cheese-category, zero topping-category ingredients.
**SAUCE/DOUGH/BAKE/CUT are universal** across all 15 today — Fresh-confirmed, not assumed; SAUCE
is still derived generically (not hardcoded), so a hypothetical future no-sauce recipe would
correctly skip it too (see §4).

This exactly reproduces the prior Fresh Audit's own finding (Audit F) — independently
re-derived from current production data, not copied.

## 4. Architecture

**One authoritative derivation point**: `deriveCoreSteps(recipe)` in
`src/data/cookingProfiles.ts`, called from `getCookingProfile(recipeId)`. For a real (`RECIPES`-
listed) recipe: `steps = ["DOUGH", ...(SAUCE if any required ingredient has category "sauce"),
...(CHEESE if any has category "cheese"), ...(TOPPING if any has category "topping")]`. No
per-recipe branching anywhere else in the codebase (no `if (recipeId === "marinara")` — the task's
own explicit anti-pattern).

- **DOUGH**: always present (current production contract, unchanged).
- **SAUCE/CHEESE/TOPPING**: each derived from `requiredIngredients` category membership,
  including SAUCE — deliberately *not* hardcoded as always-present despite being universal today,
  per the task's own instruction not to "future-proof by accidentally forcing it into DEFAULT
  semantics."
- **BAKE**: unchanged, still a fixed phase transition (`START_BAKE`/`CONFIRM_BAKE`), never a
  `MakingStep`.
- **CUT eligibility**: completely untouched — `CUT_ELIGIBLE_RECIPE_IDS` (Phase 4B's own allowlist)
  is still the sole authority for whether `withCut(...)` appends `"CUT"`; only *what* it appends
  CUT onto (the recipe-specific `deriveCoreSteps` result, not the literal
  `DEFAULT_COOKING_PROFILE.steps`) changed. A recipe absent from `RECIPES` entirely (synthetic/
  future id) still resolves to the literal `DEFAULT_COOKING_PROFILE` object (unchanged reference
  identity, preserving every existing "unknown id" test) — there is nothing to derive from.
- **Default behavior preserved**: `DEFAULT_COOKING_PROFILE` itself (`["DOUGH","SAUCE","CHEESE",
  "TOPPING"]`) is never mutated, still the exact fallback for an unresolvable id.

**Reducer/navigation**: `gameReducer.ts`'s `preBakeSteps`/`postBakeSteps`/`nextStepWithin`
(built by PR #124) already walked an arbitrary `CookingProfile.steps` array generically — **zero
reducer changes were needed**. `MakingStepTabs.tsx` already rendered whatever `steps` prop it was
given — **zero rendering-logic changes were needed** beyond the emoji removal (§6).

**The one real navigation bug found and fixed**: `GameScreen.tsx`'s 「次へ」/「焼く！」 CTA bar was
hardcoded to `state.makingStep === "TOPPING"` to decide when to switch from "次へ" to "焼く！". For
quattro-formaggi (no TOPPING step, CHEESE is its own last PREPARE step), this would have left the
CTA stuck on "次へ" forever — a no-op past the last step — with no way to ever reach BAKE. Fixed by
computing `isLastPrepareStep = currentStep === preBakeSteps(cookingProfile).at(-1)` once
(`GameScreen.tsx`) and using that instead of the hardcoded step name, shared by both the CTA and
`MakingStepTabs`. See §12 (Reviews) — this is the highest-risk finding of the whole task, exactly
matching the brief's own §7 warning.

## 5. Before/After Examples

**Marinara** (no CHEESE):
```
Before: 生地 → ソース → チーズ(空) → 具材 → 🔥 焼く → カット
After:  生地 → ソース → 具材 → 焼く → カット
```
**Quattro-formaggi** (no TOPPING):
```
Before: 生地 → ソース → チーズ → 具材(空) → 🔥 焼く → カット
After:  生地 → ソース → チーズ → 焼く → カット
```
**Margherita** (full-step, regression baseline — unchanged):
```
生地 → ソース → チーズ → 具材 → 焼く → カット
```

## 6. Bake Emoji — Search Findings

Fresh repo-wide search for `🔥`/`\u{1F525}` in `src/`:

| Location | Classification | Action |
|---|---|---|
| `MakingStepTabs.tsx:186` (BAKE tab indicator) | Decorative | **Removed** — label is now exactly `"焼く"` / `"✓ 焼く"` |
| `ResultPanel.tsx:79` (`burnt: "\u{1F525}"`, bake-state result badge) | Semantic (indicates burnt outcome) | Unchanged |
| `BakeOverlay.tsx:108` (`.bake-oven__flame`, oven visual during the BAKE minigame) | Decorative but a different element (not the tab label) | Unchanged — out of this task's scope |
| `GameScreen.tsx:571` (`"🔥 焼く！"` primary CTA button) | Decorative but explicitly out of scope per task instructions (separate, larger, non-cramped element) | Unchanged |

Zero test files matched the literal emoji character before this change (every test already
matched `/焼く/`) — no test updates were required for the emoji removal itself.

## 7. Duplicate Gate #2 (immediately before push)

`git fetch origin` re-run: **`origin/main` had advanced** from `36721a0` to `195a61d` — **PR #175
merged** ("Lunch Rush Phase 4: Result Summary & Ranking achievedAt").

Overlap check (`git diff --stat 36721a0..195a61d`): PR #175 touched `src/screens/GameScreen.tsx`
(3 lines, a different section — `MissionResultOverlay`'s `stats` prop, nowhere near this task's
own edits) and `e2e/gestures.ts` (added `startLunchRushMission`/`failMissionOrderMissingSauce`).

**Real overlap found**: `failMissionOrderMissingSauce` (new in PR #175) hardcoded exactly 3
`"次へ"` taps after DOUGH, assuming every recipe has the fixed DOUGH/SAUCE/CHEESE/TOPPING
4-step sequence — the same class of bug as §4's CTA fix, newly introduced by PR #175 after this
task's own branch point. Fixed: replaced the 3 fixed clicks with a `while (next-button exists)`
loop that walks however many PREPARE steps the drawn recipe's own profile actually has.

Merged `origin/main` (`195a61d`) into this branch — **clean auto-merge**, no conflicts in either
`GameScreen.tsx` or `gestures.ts` (edits landed in disjoint regions of both files). Re-ran full
verification after the merge (§9) — all green, including PR #175's own new
`lunch-rush-result-ranking-phase4.spec.ts` (which exercises the now-fixed
`failMissionOrderMissingSauce` with a real PASS+FAILED serve).

No further Issue/PR changes found on re-check of #176/open PRs/open issues.

## 8. Timing Regression

`cookingTiming.ts`'s `perStepElapsedMs`/`completedMs` are unaffected by skipped steps by
construction — a step that never opens simply never gets a `perStepElapsedMs` entry (map absence,
not a zero sentinel, matching the module's own existing "not measured yet" convention). No
phantom/artificial duration is created for a skipped step, and the whole-round `completedMs` is
still finalized at `START_BAKE` from real elapsed time regardless of which steps were visited.
Regression-tested directly (`gameReducer.dynamicCookingSteps.test.ts`, "Timing regression"
describe block) — marinara/quattro-formaggi both confirmed to have no `CHEESE`/`TOPPING` entry
respectively, with `DOUGH`/`SAUCE` elapsed times unaffected and `completedMs` still exactly the
real elapsed wall-clock ms.

## 9. Test Results (Fresh totals, this session)

- **Focused** (new/changed files): `cookingProfiles.test.ts` 87/87,
  `MakingStepTabs.test.tsx` 29/29, `gameReducer.dynamicCookingSteps.test.ts` 16/16,
  `GameScreen.dynamicSteps.test.tsx` 7/7 — all pass.
- **Full Vitest**: **2282/2282 pass** (117 test files) — run after merging PR #175's own 2 new
  test files (`missionResultStats.test.ts`, `formatAchievedAt.test.ts`) forward onto this branch.
- **TypeScript** (`tsc -b`): clean.
- **Lint** (`oxlint`): clean.
- **Build** (`vite build`): clean.
- **Chromium E2E** (`iphone-390x844` + `iphone-360x800` projects, single-worker to avoid sandbox
  resource-contention flakes): **70/70 pass** — the existing 62-test suite (including PR #175's
  own new `lunch-rush-result-ranking-phase4.spec.ts`, 8 tests) plus this task's own new
  `dynamic-cooking-steps.spec.ts` (4 scenarios × 2 viewports = 8 tests).
- **WebKit**: not runnable in this sandbox — `playwright install webkit` fails with a blocked-host
  403 (`cdn.playwright.dev`/`playwright.download.prss.microsoft.com`), the same pre-existing
  limitation every prior PR in this repo has documented. `dynamic-cooking-steps.spec.ts` has no
  path filter excluding it from `.github/workflows/e2e-webkit.yml`, which runs every `e2e/*.spec.ts`
  on every PR to `main` — **this PR's own GitHub Actions WebKit run is authoritative.**

### Two pre-existing E2E tests updated for the new dynamic-step contract

Both failures were genuine (not flakes) on the first full-suite run after the architecture change,
confirming §4's CTA fix was necessary — re-run in isolation and with `--workers=1` to separate
real regressions from this sandbox's own resource-contention flakes (two other, unrelated
timeouts under 2-worker load both passed cleanly in isolation/at 1 worker, confirmed flakes, not
regressions):

1. **`e2e/viewport-1screen.spec.ts`**, "quattro-formaggi heavy inventory" — walked a hardcoded
   `["SAUCE","CHEESE","TOPPING"]` loop assuming TOPPING was always the (now-nonexistent, empty)
   last step for quattro-formaggi. Updated to walk only `["SAUCE","CHEESE"]` (its own real derived
   sequence) and assert the CTA already reads 焼く！ at CHEESE, never 次へ.
2. **`e2e/pizza-cutting-phase4b.spec.ts`**, Scenario D (Lunch Rush) — unconditionally clicked
   「次へ」 after the CHEESE step regardless of whether a CHEESE tray was ever shown. Fixed by
   moving that click inside the same `if (モッツァレラ button present)` guard already used to place
   cheese — for marinara (if it were ever actually drawn; this pool's own ingredient ownership
   makes it structurally unreachable today, see the test's own updated comment) SAUCE's own 次へ
   already lands directly on TOPPING, so no extra click is needed or safe.

## 10. Human Verification

Per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`. All three recorded via Playwright (real
Chromium, human-paced 0.5–2.5s holds per state/transition per §4), converted from WebM to
MP4/H.264 via system `ffmpeg`/`libx264`, validated via `ffprobe` + direct frame extraction/visual
inspection, delivered directly to the user this session (never committed, per policy §6).

| | Video A | Video B | Video C |
|---|---|---|---|
| Filename | `video-A-marinara-390x844.mp4` | `video-B-margherita-390x844.mp4` | `video-C-capricciosa-360x800.mp4` |
| Scenario | Marinara (no CHEESE): recipe select → tabs (no チーズ) → DOUGH→SAUCE→TOPPING→BAKE→CUT→RESULT | Margherita (full-step): CHEESE+具材 remain, 焼く has no emoji, BAKE→CUT | Capricciosa (max-tab): all 6 tabs fit @360×800, no clipping, 焼く/カット readable, basic navigation |
| Viewport | 390×844 | 390×844 | 360×800 |
| Encoded resolution | 390×844 | 390×844 | 360×800 |
| Duration | 22.60s | 24.44s | 15.76s |
| Codec | H.264 (libx264, yuv420p) | H.264 (libx264, yuv420p) | H.264 (libx264, yuv420p) |
| File size | 559,290 bytes (~546 KB) | 549,704 bytes (~537 KB) | 236,324 bytes (~231 KB) |
| Video Verification | **PASS** | **PASS** | **PASS** |

PASS basis for all three: file exists, nonzero, H.264, exact required resolution (verified via
`ffprobe`), playable to end, relevant tab sequence + interaction visible, representative frames
extracted and visually inspected (confirmed: Video A shows 生地/ソース/具材/焼く/カット with no
チーズ tab at any point and the CTA correctly reading 焼く！ once TOPPING is reached; Video B shows
the full 生地/ソース/チーズ/具材/焼く/カット set; Video C shows all 6 tabs fitting cleanly at
360×800 with 焼く/カット both legible, no clipping).

**Video D (Lunch Rush, skipped-step recipe)**: not produced. Lunch Rush's own order picker
(`pickMissionOrder`/`getNextOrder`) draws uniformly at random from every *available* recipe;
margherita has no `unlockCondition` at all, so it is always in the pool alongside whatever else a
seed's dex/ownership makes available, and there is no production hook to force a single specific
recipe deterministically without changing order-picking code (out of scope — Lunch Rush RESULT/
ranking code must not be touched per this task's own scope guard). The same production behavior
is already fully covered by: (a) `gameReducer.dynamicCookingSteps.test.ts`'s reducer-level
marinara/quattro-formaggi CUT-eligibility tests, (b) `e2e/dynamic-cooking-steps.spec.ts` Scenario
D (a generic dynamic-step-aware Lunch Rush E2E test, conditionally asserting the CHEESE tab is
absent when marinara happens to be drawn), and (c) the fix to `failMissionOrderMissingSauce`
(§7), which is itself exercised end-to-end by PR #175's own `lunch-rush-result-ranking-phase4.spec.ts`.
Per the task's own explicit allowance ("do not make Video D mandatory if... there is no practical
deterministic recipe fixture; document the decision") — documented here rather than produced.

## 11. Screenshots

Committed under `docs/reports/screenshots/gameplay-ux-pr-a/`:

- `A-marinara-no-cheese-tabs-390x844.png` — 390×844, marinara PREPARE/DOUGH, tabs 生地/ソース/具材/
  焼く/カット, no チーズ tab.
- `B-margherita-full-step-tabs-390x844.png` — 390×844, margherita PREPARE/DOUGH, full tabs 生地/
  ソース/チーズ/具材/焼く/カット.
- `C-capricciosa-max-tab-layout-360x800.png` — 360×800, capricciosa PREPARE/SAUCE, all 6 tabs
  visible with no clipping.

All three captured from the actual implemented state (not mocked/hand-edited), visually verified
before commit.

## 12. Changed Files

Production:
- `src/data/cookingProfiles.ts` — `deriveCoreSteps`, `getCookingProfile` derivation.
- `src/components/MakingStepTabs.tsx` — emoji removal, doc comment update.
- `src/screens/GameScreen.tsx` — `isLastPrepareStep` navigation fix (the one real bug found).

Tests (new):
- `src/state/gameReducer.dynamicCookingSteps.test.ts`
- `src/screens/GameScreen.dynamicSteps.test.tsx`
- `e2e/dynamic-cooking-steps.spec.ts`

Tests (updated):
- `src/data/cookingProfiles.test.ts` — per-recipe matrix pin, replacing the uniform-sequence
  assumption.
- `src/components/MakingStepTabs.test.tsx` — skipped-step rendering + emoji-removal assertions.
- `e2e/gestures.ts` — `startMarinaraUnlocked`/`playFullMarinaraRound` (new fixtures); the PR #175
  merge-forward fix to `failMissionOrderMissingSauce` (§7).
- `e2e/viewport-1screen.spec.ts`, `e2e/pizza-cutting-phase4b.spec.ts` — dynamic-step-aware fixes
  (§9).

Docs:
- `docs/reports/TETO_GAMEPLAY-UX_PR-A_Dynamic-Steps_Result.md` (this file).
- `docs/reports/screenshots/gameplay-ux-pr-a/*.png` (§11).

## 13. Scope Guard

- **Scoring**: unchanged — `score.total`/Scoring 2.0 weights/stars untouched; no scoring-related
  file edited.
- **Pitz**: unchanged — `pitzReward.ts` untouched.
- **Timing thresholds**: unchanged — `efficiency.ts` constants untouched; §8 confirms no
  corruption from skipped steps.
- **Firebase**: unchanged — no `firebase/*` file touched.
- **Ranking**: unchanged — no Lunch Rush RESULT/ranking production code touched (only the E2E
  gesture-helper fix in §7, test-only).
- **Recipe requirements**: unchanged — `recipes.ts`'s `requiredIngredients`/`bakeTarget`/etc. all
  byte-identical; only how *steps are derived from* that existing data changed.
- **CUT scoring**: unchanged — `cut/evaluation.ts` untouched; CUT eligibility allowlist untouched.

## 14. Known Limitations

- Video D (Lunch Rush skipped-step) not produced — see §10 for the documented reason (no
  deterministic fixture without touching out-of-scope order-picking code).
- WebKit not run locally (sandbox network restriction, §9) — GitHub Actions is authoritative for
  this PR's own WebKit run.
- `cutRejectionMessage`/`resolvePhysicalDrop` and a few other `GameScreen` props in the new
  component test file are stubbed no-ops, matching the existing `GameScreen.makingStepNav.test.tsx`
  convention — not a gap specific to this task.
