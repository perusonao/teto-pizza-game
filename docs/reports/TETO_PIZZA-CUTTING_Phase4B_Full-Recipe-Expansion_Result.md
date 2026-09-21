# Pizza Cutting Phase 4B: Full Recipe Expansion — Result Report

**Latest `main` SHA (Fresh Audit / base):** `4a3e6048de8a784477407a1b4f0ae26b2c36504d` (PR #171, "Cooking UI
1-Screen 2.0 PR-C: Verification Hardening", the current tip of `main` at the start of this
session — re-confirmed via `git fetch origin main` immediately before implementation began and
again immediately before push (Duplicate Gate #2), unchanged both times).

**Base SHA (branch created from):** `4a3e6048de8a784477407a1b4f0ae26b2c36504d` (same commit — the
designated branch `claude/pizza-cutting-phase-4b-qcxkvo` was already sitting exactly on latest
`main` with a clean tree at session start).

**Implementation HEAD:** `793e1641a8ab4f8d796d2a34bf5666d62bc0355a`

## Duplicate Gate #1 / #2

- **Gate #1** (before implementation): `search_pull_requests`/`search_issues` for CUT/Pizza
  Cutting/all recipes/full recipe expansion/Phase 4B/POST_BAKE/cooking profile — no open PR or
  Issue implements this scope. Open PRs at the time: #105 (Dev Automation), #72 (docs sync,
  stale), #46 (Dough D0 audit, superseded), #34 (Issue #32 Phase 1, superseded), #3 (old docs) —
  none touch `cookingProfiles.ts`/CUT. Open issues: 15 total, none CUT-related. **No duplicate.**
- **Gate #2** (immediately before push): `git fetch origin main` — still `4a3e604...`, unchanged.
  Re-ran the open-PR/open-issue search — no new PR/Issue appeared. **No duplicate.**

## Previous audit re-verification

Previous docs-only Fresh Audit: `docs/reports/TETO_PIZZA-CUTTING_Phase3_Expansion_Fresh-Audit.md`
(PR #163, audited `f8e461a`, 15 recipes). Between that SHA and this session's base
(`4a3e604`), three more PRs landed on `main` — #168 (Phase 0 Fresh Audit), #169 (PR-A real-device
layout), #170 (PR-B Reference Truth), #171 (PR-C Verification Hardening) — all part of "Cooking UI
1-Screen 2.0", none of which touched `src/data/cookingProfiles.ts`, `src/logic/cut/*`, or
`src/state/gameReducer.ts`'s CUT branches (confirmed by reading the current file content directly,
not by trusting the old report). **The previous audit's architecture recommendation (Option C,
explicit allowlist) and recipe classification (all 15 shipped recipes CUT-eligible) were both
re-confirmed still accurate against fresh code**, so this implementation follows it directly
rather than re-deriving from scratch.

## Production recipe count

**15** (`src/data/recipes.ts`, unchanged by this PR): margherita, marinara, quattro-formaggi,
genovese, bismarck, funghi, fugazza, salsiccia, pepperoni, napoletana, tonno-e-cipolla,
pizza-bianca, breakfast-pizza, capricciosa, meat-lovers.

## Full recipe eligibility matrix

| # | `id` | Shape/type | Cooking profile before | CUT before | Requested slices | Special rendering/interaction | Standard round single-bake? | CUT eligibility (Phase 4B) |
|---|---|---|---|---|---|---|---|---|
| 1 | margherita | round | CUT profile (Phase 2) | Yes | 6 | none | Yes | **Eligible** (unchanged, regression control) |
| 2 | marinara | round | DEFAULT | No | — | no cheese step content | Yes | **Eligible** |
| 3 | quattro-formaggi | round | DEFAULT | No | — | 4-cheese, 8-piece reference ring ceiling | Yes | **Eligible** |
| 4 | genovese | round | DEFAULT | No | — | pesto sauce | Yes | **Eligible** |
| 5 | bismarck | round | DEFAULT | No | — | egg topping | Yes | **Eligible** |
| 6 | funghi | round | DEFAULT | No | — | none | Yes | **Eligible** |
| 7 | fugazza | round | DEFAULT | No | — | olive-oil base, `mysteryLock` (unrelated to CUT) | Yes | **Eligible** |
| 8 | salsiccia | round | DEFAULT | No | — | none | Yes | **Eligible** (Video B) |
| 9 | pepperoni | round | DEFAULT | No | — | none | Yes | **Eligible** |
| 10 | napoletana | round | DEFAULT | No | — | anchovy | Yes | **Eligible** |
| 11 | tonno-e-cipolla | round | DEFAULT | No | — | tuna/onion | Yes | **Eligible** |
| 12 | pizza-bianca | round | DEFAULT | No | — | olive-oil base, no tomato sauce | Yes | **Eligible** |
| 13 | breakfast-pizza | round | DEFAULT | No | — | none | Yes | **Eligible** |
| 14 | capricciosa | round | DEFAULT | No | — | 5 ingredient types / 8-piece reference ring ceiling | Yes | **Eligible** (Video C, topping-heavy) |
| 15 | meat-lovers | round | DEFAULT | No | — | 5 ingredient types / 8-piece reference ring ceiling | Yes | **Eligible** |

All 15 are standard round, single-piece, single-bake pizzas sharing the identical circular-dough
contract (`DOUGH_CENTER`/`DOUGH_RADIUS`, `src/logic/pizzaCoordinates.ts`) every DOUGH/SAUCE/TOPPING
gesture already uses. None uses `FOLD`/`SEAL`/`EDGE_FILL` (reserved `MakingStep` members with zero
production wiring). **No exclusions among the 15 shipped recipes.**

**Future exclusion candidates** (not shipped, not designed): calzone, fugazzeta, mezza-e-mezza,
siciliana, square pizza — any recipe whose finished shape is not a single round disc. These are
explicitly **not** added to the allowlist; a human must deliberately re-confirm shape compatibility
before ever adding one.

## Architecture

**Before:** `COOKING_PROFILES: ReadonlyMap<RecipeId, CookingProfile>` with exactly one entry
(`margherita`). Every other recipe resolved to `DEFAULT_COOKING_PROFILE` (absent-entry fallback).

**After:** `src/data/cookingProfiles.ts` gains an explicit `CUT_ELIGIBLE_RECIPE_IDS: ReadonlySet<RecipeId>`
allowlist (all 15 ids), a pure derivation (`withCut(steps, cutConfig)` + shared
`STANDARD_CUT_CONFIG = { requestedSliceCount: 6 }`), and a reserved, currently-empty
`COOKING_PROFILE_OVERRIDES: ReadonlyMap<RecipeId, CookingProfile>` escape hatch for a future
CUT-eligible recipe wanting a non-standard slice count. `getCookingProfile` checks the override map
first, then the allowlist, then falls back to `DEFAULT_COOKING_PROFILE` — the exact same
"absent = default" contract `getReferencePizza` already established for this codebase, just with
one more branch. A new `isCutEligible(recipeId)` export exists purely for test coverage.

**Why Option C (allowlist) over the other two candidates (§4 of the prior audit, re-validated):**

- **Option A (14 individual `CookingProfile` entries)** — same opt-in safety property, but ~4x the
  line count of Option C for zero new information content, and a real copy-paste-typo risk (a
  hand-typed entry with the wrong step order would only be caught by review/tests, not the type
  system).
- **Option B (bake CUT into `DEFAULT_COOKING_PROFILE`)** — **rejected outright.** This is the one
  option that actually creates the "全ピザ強制CUT" failure mode the task explicitly asks to avoid:
  a future recipe added to `RECIPES` with no `cookingProfiles.ts` entry (the normal way every
  recipe has been added so far — confirmed by reading `recipes.ts`'s own Batch 1A/1B-A/1B-B/1B-C/
  1B-C history, none of which touched `cookingProfiles.ts`) would silently inherit CUT.
- **Option C (explicit allowlist, implemented)** — identical opt-in safety property to Option A, at
  roughly a quarter of the line count, plus a stronger built-in regression test than a flat Map
  naturally offers (`CUT_ELIGIBLE_RECIPE_IDS ⊆ RECIPES.map(id)`, pinned in `cookingProfiles.test.ts`).

## Why `DEFAULT_COOKING_PROFILE` was not globally changed

`DEFAULT_COOKING_PROFILE` still resolves to exactly `{ steps: ["DOUGH", "SAUCE", "CHEESE",
"TOPPING"] }`, unconditionally, for any `RecipeId` absent from both `COOKING_PROFILE_OVERRIDES` and
`CUT_ELIGIBLE_RECIPE_IDS`. Even though every one of today's 15 recipes happens to be CUT-eligible,
encoding that as "the default is now CUT" would mean a future recipe never has to opt in — the
exact inversion of the safety property this task requires. `cookingProfiles.test.ts` pins this
directly: a synthetic id absent from the allowlist resolves to the same frozen
`DEFAULT_COOKING_PROFILE` object reference, with no `CUT` step, no `cutConfig`.

## `requestedSliceCount` decision

All 15 CUT-eligible recipes use `requestedSliceCount: 6` via the shared `STANDARD_CUT_CONFIG`. No
existing authoritative rule specifies a different slice count for any shipped recipe (re-confirmed
by re-reading every recipe's own data and the original CUT 1.0 design doc) — inventing per-recipe
variety here would not be grounded in anything real, so this is documented as **intentional Phase
4B behavior**, not an oversight. The reserved `COOKING_PROFILE_OVERRIDES` map is the sanctioned
extension point if a future recipe genuinely needs a different count.

## FREE behavior

Verified via Vitest + Chromium Playwright + manual video capture:

- Margherita (regression control): unchanged full round, CUT card renders identically to before.
- Salsiccia (simple, newly CUT-enabled): PREPARE → BAKE → POST_BAKE/CUT → RESULT, CUT card renders.
- Capricciosa (topping-heavy, 5 ingredient types/8 pieces): same flow at the secondary 360×800
  viewport, no horizontal overflow, CUT drag gesture unaffected by topping density.
- Quattro-formaggi (also topping-heavy/reference-ring-ceiling) was not separately video-verified
  this session, but is covered by the same generic `cookingProfiles.test.ts` allowlist proof and
  the CUT engine's own recipe-agnostic geometry (§ Architecture) — no code path distinguishes it
  from Capricciosa.

## Lunch Rush behavior

`MissionServePanel.tsx`'s own `cutEvaluation &&` guard (pre-existing, unchanged) now renders a real
CUT line for every recipe Lunch Rush can draw, since every recipe is now CUT-eligible. Video D
(seeded with a small margherita/funghi/marinara-reachable pool — Lunch Rush's own random
`getNextOrder` picked marinara in the recorded run) confirms: CUT completion → serve transition with
no stale overlay, `MISSION_NEXT_ORDER` advances `servedCount` by exactly one and starts a fresh
`cutState` for the next order (pre-existing reducer guarantee,
`gameReducer.cutStep.test.ts` §23/24, unchanged), no double score submission, `MissionClock` timer
unaffected (CUT already cost real mission-clock seconds for margherita since Phase 4A; this is now
true for every recipe, not a new mechanism).

## RESULT behavior

`ResultPanel.tsx`'s `cutEvaluation?: CutEvaluation | null` prop and its native
`<details>`/`<summary>` default-closed presentation (PR #151) are completely unchanged — the CUT
card now simply renders for more recipes because more recipes produce a non-null `cutEvaluation`.
No RECIPE can enter CUT and then lose its CUT result data (same `state.cutState.evaluation`
lifecycle for all 15). `ResultPanel.test.tsx`'s pre-existing "omits the CUT evaluation summary for
a non-CUT recipe (cutEvaluation null)" unit test still holds — it is prop-driven, not
recipe-name-coupled, so the CUT expansion does not touch it at all.

## Reference Truth / Cooking UI preservation

- **Reference Truth (PR-B, #170):** zero changes to `SauceHeatmapCanvas.tsx`, `PizzaVisualPieces.tsx`,
  `ReferenceThumbnail.tsx`, `ReferencePreview.tsx`, `PlayerReferencePreview.tsx`, or any Reference
  data (`referencePizza.ts`/`playerReference.ts`) — diff-verified. Reference continues to represent
  pizza construction target, never a cut-line target.
- **Cooking UI 1-Screen (Issue #159/#167):** zero changes to `MakingStepTabs.tsx`,
  `GameScreen.tsx`'s nav-strip mounting, or any App.css layout rule. The nav strip already mounted
  through BAKE/POST_BAKE generically via its existing `postSteps`/`currentPhase` contract (built for
  exactly this expansion) — newly-eligible recipes now simply have a non-empty `postSteps`, no new
  code path. `e2e/pizza-cutting-phase4b.spec.ts`'s Scenario C re-confirms no horizontal overflow at
  360×800 for a newly-eligible, topping-heavy recipe's own CUT tab.

## Tests

- **Focused:** `cookingProfiles.test.ts` (60 tests), `gameReducer.cutStep.test.ts`,
  `GameScreen.makingStepNav.test.tsx`, `App.test.tsx`, `App.playerReference.test.tsx`,
  `App.cookingTimingBackground.test.tsx`, `gameReducer.inventoryConsumption.test.ts` — all pass.
- **Full Vitest:** **2196/2196 pass** (0 regressions; net tests unchanged in count terms since this
  session extended/replaced fixtures rather than adding a large new suite — the exhaustive
  per-recipe `describe.each` coverage in `cookingProfiles.test.ts` alone contributes 45 of the
  file's 60 cases).
- **TypeScript:** `tsc -b` — clean.
- **Lint:** `oxlint` — clean (exit 0).
- **Build:** `vite build` — clean (pre-existing >500kB single-chunk warning, unrelated to this PR).
- **Chromium E2E:** **54/54 pass** across both `iphone-390x844`/`iphone-360x800` projects,
  including the 4 new Phase 4B scenarios in `e2e/pizza-cutting-phase4b.spec.ts`. Scenario D (Lunch
  Rush) was run 10 additional times locally to exercise its random recipe-selection branches
  (margherita/funghi/marinara) — all passed.
- **WebKit:** not runnable in this sandboxed session (browser binary not installed, consistent with
  every prior PR-A/PR-B/PR-C session's own documented network-egress limitation) — **GitHub Actions
  is the authority**; see the PR for the actual `e2e-webkit.yml` run result once CI completes.

### Migrated "non-CUT recipe" test fixtures

Every test that used a real non-Margherita recipe id (funghi/bismarck/marinara) as its "this recipe
has no CUT" regression control was migrated to a synthetic ineligible `RecipeId` fixture (a real
recipe's shape with only `id` swapped to a value deliberately absent from the allowlist), per the
task's explicit "do not simply delete those protections" instruction:

- `gameReducer.cutStep.test.ts` — 3 spots (allowlist-absent profile resolution, inert `cutState`,
  `ADD_CUT_LINE` rejection for a non-eligible recipe's PREPARE).
- `GameScreen.makingStepNav.test.tsx` — "Non-cut recipes never show a CUT tab" block, previously
  keyed on `marinara`.
- `cookingProfiles.test.ts` (new) — dedicated synthetic-fixture test (§C) plus the
  allowlist-subset/exhaustive-decision tests (§A/B/D/E/F/G).

`App.test.tsx`, `App.playerReference.test.tsx`, and `App.cookingTimingBackground.test.tsx`'s own
bismarck-based integration flows were updated to walk the real POST_BAKE/CUT step bismarck now has
(via each file's own `completeCutStepIfPresent` UI-gesture helper), rather than being migrated away
from bismarck — these are full-`App` integration tests whose purpose (RESULT hero pizza, Reference
popover lifecycle, Cooking Time pause bookkeeping) is orthogonal to CUT eligibility, so the more
natural fix was to make bismarck's own flow correct under its new CUT-eligible status. The
component-level "non-CUT recipe never shows a CUT card" protection itself now lives at
`ResultPanel.test.tsx`'s pre-existing, prop-driven `cutEvaluation={null}` test (recipe-independent
by construction, untouched by this PR) plus the reducer/allowlist-level synthetic-fixture coverage
above.

## Screenshots

Committed under `docs/reports/screenshots/pizza-cutting-phase4b/`:

- `01-salsiccia-non-margherita-cut-390x844.png`
- `02-capricciosa-topping-heavy-cut-390x844.png` / `02-capricciosa-topping-heavy-cut-360x800.png`
- `03-result-with-cut-data.png`
- `04-cut-360x800.png`

## Human Verification

Per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`. Captured via Playwright Chromium
(`recordVideo`) driving the real dev server, converted `.webm` → MP4/H.264 with system
`ffmpeg`/`libx264` (`apt`-installed this session), verified with `ffprobe` **and** direct visual
frame inspection (not metadata alone). Delivered directly to the user, not committed.

| Video | Scenario | Viewport | Encoded resolution | Duration | Codec | File size | Verification |
|---|---|---|---|---|---|---|---|
| A | Margherita regression | 390×844 | 390×844 | 22.72s | h264 | 564 KB | **PASS** |
| B | Salsiccia (newly CUT-enabled) | 390×844 | 390×844 | 21.16s | h264 | 484 KB | **PASS** |
| C | Capricciosa (topping-heavy) | 360×800 | 360×800 | 20.32s | h264 | 492 KB | **PASS** |
| D | Lunch Rush (order→CUT→serve) | 390×844 | 390×844 | 21.08s | h264 | 468 KB | **PASS** |

**PASS criteria confirmed for each** (file exists, nonzero, playable through end, H.264, complete
viewport captured, relevant CUT transition visible, physical cut gesture visible, CTA activation
visible, RESULT/serve visible where required, no obvious clipping/scroll regression):

- **Video A:** HOME → FREE → Margherita → PREPARE (dough/sauce/cheese/basil) → BAKE → 取り出す！ →
  POST_BAKE/CUT (3-line drag gesture, progress readout 0/3→3/3) → 切り終わる → RESULT with ★2/59点
  and the CUT card (100点) visible, byte-identical presentation to pre-Phase-4B margherita.
- **Video B:** Same flow for Salsiccia (newly CUT-eligible) — sausage topping placement, CUT
  gesture, RESULT (★3/61点 + CUT 100点card) — visibly proves a non-Margherita recipe now enters
  CUT normally.
- **Video C:** Capricciosa at 360×800 — all 6 tabs fit with no horizontal overflow, 5-ingredient-type
  TOPPING placement (mushroom/oregano/ham/black-olive/mozzarella), CUT gesture works at the smaller
  viewport, Bottom CTA (焼く！/取り出す！/切り終わる) stays reachable throughout, RESULT shows CUT
  card.
- **Video D:** Lunch Rush order (this run: Marinara) → BAKE (Teto's coaching bubble visible) →
  取り出す！ → POST_BAKE/CUT (same 3-line gesture, "6等分に切ろう") → 切り終わる → serve screen
  showing ★3/61点, "カット 100点（6切れ）", "+1 SERVED (1)" → 次の注文へ → next order starts fresh
  at DOUGH (フンギ) with no stale overlay and served count advanced by exactly one.

## Scope check

| Area | Changed? |
|---|---|
| Scoring 2.0 total formula | No |
| Completion Gate | No |
| Pitz / economy | No |
| Firebase / Cloud Functions | No |
| Ranking | No |
| Recipe requirements / ingredient data | No |
| CUT scoring itself (`src/logic/cut/*`) | No — zero changes, engine already fully generic |
| `.github/workflows/*` | No — WebKit job already runs every `e2e/*.spec.ts` file |

`cutScore` remains never added to `state.score.total`/`ScoringV2Result.totalScore`
(`gameReducer.cutStep.test.ts` §26 regression, unchanged and re-passing for every recipe).

## Known limitations

- WebKit CI result not yet confirmed from this session (sandboxed network policy) — see the PR's
  own Actions run for the authoritative result.
- Video D's specific recipe (Marinara) was determined by Lunch Rush's own real random selection,
  not forced — this is by design (the task explicitly allows "smallest legitimate verification
  without changing production recipe selection just for the video"), but means a different session
  re-recording this exact scenario may show a different recipe.
- Quattro-formaggi and meat-lovers (both topping-heavy/reference-ring-ceiling recipes) are covered
  by the same generic engine/allowlist tests as Capricciosa but were not individually
  video-recorded this session — no code path distinguishes them from Capricciosa's own coverage.

## Next CUT phase recommendation

No further CUT work is required for the 15 currently shipped recipes — full expansion is complete.
The next natural extension point is **not** more recipes on the existing engine, but a genuinely
new shape family (calzone/fugazzeta/mezza-e-mezza/siciliana/square pizza) if one is ever designed —
that would need its own geometry design pass (the current engine's `DOUGH_CENTER`/`DOUGH_RADIUS`/
`GRID_RESOLUTION` all assume a circular dough) before any such recipe could be added to
`CUT_ELIGIBLE_RECIPE_IDS`.
