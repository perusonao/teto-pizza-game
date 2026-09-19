# TETO UX-2: Making Step Tabs + Ingredient Tray Scalability -- Result Report

- **Issue**: #86 (UX-2: Making-step tabs (生地|ソース|チーズ|トッピング|焼く) as a second
  affordance alongside 「次へ」)
- **Audited `origin/main` SHA**: `1669482c25750dd0fe1349405e33a9fdefb4fc88`
  (PR #92, EP4 Starter Stock -- confirmed as `origin/main`'s tip at audit time; PR #93 UX-4
  Pizza Select pager and PR #91 UX-1 Lunch Rush both already included in that history; PR #94
  confirmed CLOSED/NOT MERGED, a duplicate EP4). The working branch was created directly from
  this commit with a clean `git diff` against it before any change here.
- **Branch**: `claude/making-step-tabs-tray-8508su`
- **Verdict**: **A. UX-2 COMPLETE -- READY FOR MERGE REVIEW**

## Fresh Audit (before implementation)

Read in full before writing any code: Issue #86's own body, `GameScreen.tsx`,
`IngredientTray.tsx`, `App.tsx` (`handleChangeCategory`/`makingStepToCategory`),
`gameReducer.ts` (`MakingStep`, `CONFIRM_MAKING_STEP`, `PLACE_TOPPING`/`APPLY_SAUCE`/
`COMMIT_SAUCE_DISPENSE`), `state/inventory.ts` (`canPlaceIngredient`/`hasStock`/
`remainingStock`/`consumePizzaInventory`), `data/ingredients.ts`, `data/recipes.ts`,
`PizzaStage.tsx`'s keyboard path, `starterStock.ts`, `economy.ts`'s `restockIngredient`, the
existing `IngredientTray.*.test.tsx` / `GameScreen.keyboard*.test.tsx` / `onewayFlow.test.ts`
suites, and the App.css rules for `.category-tabs`/`.ingredient-tray`/`.prepare-bake-bar`. Also
re-read `docs/reports/TETO_INGREDIENT-ECONOMY-UI-SCALABILITY_Fresh-Audit.md`,
`docs/reports/TETO_GAMEPLAY-UX-NEXT_Fresh-Audit.md`, the Economy & Progression 1.0 design docs,
and `PROJECT_HANDOFF.md`.

**Confirmed finding from Issue #86 (matches the prior audit's suspicion)**: `IngredientTray.tsx`
already rendered a `category-tabs` strip with completed/active/locked visual states for
SAUCE/CHEESE/TOPPING, but every tab's `onClick` was wired to `App.tsx`'s `handleChangeCategory`,
an explicit no-op (`function handleChangeCategory(_category) {}`) kept only so the prop wasn't
literally unwired. DOUGH and BAKE had no tab at all. This was exactly the "looks interactive,
does nothing" tab the task description asked to check for.

Also confirmed: `IngredientCategory` (`"sauce" | "cheese" | "topping"`) already matches the
making-step categories 1:1 for every non-DOUGH step -- `ingredientsByCategory` already filters
correctly for SAUCE/CHEESE/TOPPING with zero ambiguity. No ingredient in the current catalog has
a category that doesn't match its making step.

## Before / After

**Before**: the only way to move through PREPARE was the single 「次へ」/「焼く！」 CTA at the
bottom of the screen. The look-alike tab strip inside `IngredientTray` was non-functional for
every step and entirely absent for DOUGH/BAKE. The Ingredient Tray showed every owned ingredient
in the active category as one flat, paged grid with no indication of which ones the current
recipe actually needs.

**After**: a new `MakingStepTabs` strip (rendered by `GameScreen`, not `IngredientTray`) is the
primary navigation for all five steps (DOUGH/SAUCE/CHEESE/TOPPING + a BAKE indicator), with the
existing 「次へ」/「焼く！」 CTA kept unchanged as an auxiliary control (per Issue #86's own
recommendation: "Keep the CTA -- don't remove it in this slice"). `IngredientTray` now groups
ingredients into "このピザにおすすめ" (Recommended, from `recipe.requiredIngredients`) and
"その他" (Other, every other owned ingredient in the category), each chip showing its remaining
stock (`×N` or `∞`) and disabling itself at 0 stock.

## Making Step Tabs architecture

`src/components/MakingStepTabs.tsx` (new) renders DOUGH/SAUCE/CHEESE/TOPPING as `role="tab"`
buttons plus a trailing, permanently non-interactive `<div>` BAKE indicator (never a `<button>`,
per Issue #86's explicit recommendation -- START_BAKE stays reachable only through the existing
「焼く！」 CTA). `GameScreen.tsx` renders it unconditionally for the whole PREPARE phase,
including DOUGH (which had no tab of any kind before this).

**Validation SSOT**: the component makes no dispatch decisions of its own. `currentStep` is
`state.makingStep` (the reducer's own field); `onAdvance` is wired to the exact same
`() => dispatch({ type: "CONFIRM_MAKING_STEP" })` callback the 「次へ」 CTA already used
(`onConfirmMakingStep`, unchanged in `App.tsx`). Because `CONFIRM_MAKING_STEP` only ever advances
`makingStep` by exactly one step forward (`nextMakingStep`, `gameReducer.ts`, unmodified) and is
a no-op everywhere else, only the *immediate next* tab is ever wired to fire it -- the active
tab, every completed tab, and any tab further ahead render `disabled`, so a multi-step "jump" can
never even be expressed in the DOM, let alone reach the reducer. A completed step shows a
`✓` checkmark and stays disabled (no backward-editing path, matching the reducer's
forward-only design, pinned separately in `onewayFlow.test.ts`).

The one existing UI-only completion gate (DOUGH's `doughShapeComplete`, computed from
`pendingDoughShape`/`state.pizza.doughShape` in `App.tsx` -- the reducer itself never gates
`CONFIRM_MAKING_STEP` on completion, see `onewayFlow.test.ts`'s own comment) is now computed
**once** in `GameScreen.tsx` as `nextStepReady` and shared by both the tabs (`nextReady` prop,
gates the immediate-next tab's own `disabled`) and the 「次へ」 CTA's `disabled` attribute
(`disabled={!nextStepReady}`, replacing the old inline `state.makingStep === "DOUGH" &&
!doughShapeComplete}` -- same boolean, computed in exactly one place). No validation logic is
duplicated between the tab UI and the CTA, and neither bypasses the reducer's own gate.

## Ingredient Tray architecture

`IngredientTray.tsx` no longer renders its own `category-tabs` strip (superseded by
`MakingStepTabs`). It gained three new required props -- `recipe: Recipe`, `inventory:
InventoryState`, `pizza: PizzaState` -- all already available on `GameState` and threaded
through by `GameScreen.tsx` (`state.recipe`/`state.inventory`/`state.pizza`).

```
recommendedIds = new Set(recipe.requiredIngredients
  .map(r => r.ingredientId)
  .filter(id => ownedIngredientIds.includes(id)))
recommendedItems = ingredientsByCategory(activeCategory).filter(i => recommendedIds.has(i.id))
otherItems       = ingredientsByCategory(activeCategory)
                     .filter(i => ownedIngredientIds.includes(i.id) && !recommendedIds.has(i.id))
```

"Recommended" renders as a small, unpaged, horizontally-scrollable row (`.ingredient-row--
recommended`) -- a recipe's own `requiredIngredients` count is small, curated, authored data
(observed max: 5 total, 4 in one category for quattro-formaggi's cheeses), never large enough on
its own to need paging. "Other" keeps the pre-existing fixed 3x2 grid + page-nav mechanism
(`MAX_INGREDIENT_PALETTE_SLOTS = 6`, unchanged), now scoped to the smaller "Other" pool instead
of every owned ingredient in the category -- this is also what keeps the tray bounded at
30/62-ingredient scale (see Scalability below). The "Other" heading is omitted when there's
nothing to show under it after taking "Recommended" out; "Recommended" itself is omitted
entirely when the recipe has no requirement in this category (e.g. marinara has no CHEESE
requirement) rather than rendering an empty section.

## Recommended / Other rule

- **Recommended**: `recipe.requiredIngredients`, filtered to the active category and to
  `ownedIngredientIds` (an unowned required ingredient never renders anywhere -- Issue #86's
  own "unowned材料非表示" requirement, test 11).
- **Other**: every remaining owned ingredient in the category. **Never restricted to only the
  recommended set** -- FREE creativity is preserved by construction (test 19): an "Other" chip
  is exactly as selectable/placeable as a "Recommended" one, same `renderChip`, same handlers,
  same Stock Gate.

## FREE / Lunch Rush difference

No mode branching exists in `IngredientTray` at all. `recipe` is simply `state.recipe` --
already the current order's own recipe for both FREE (the player's Pizza Select choice) and
Lunch Rush (the current order, swapped by `MISSION_NEXT_ORDER`). Reusing the same field is what
makes "Lunch Rush surfaces the order's required ingredients first" true automatically (test 20,
verified by re-rendering the same owned-ingredient set under two different `recipe` props and
confirming the Recommended/Other split follows `recipe` alone) -- exactly the "違いを許容する"
FREE/Lunch Rush relationship the task described, achieved without a special case.

## Inventory display

Each chip shows `remainingStock(ingredient, inventory)`: `×N` for a finite (EP3/EP4
`unlockCondition`-bearing) ingredient, `∞` for an unconditionally unlimited Starter ingredient --
both read directly from the existing `src/state/inventory.ts` functions, never re-derived. A
chip with `canPlaceIngredient(...) === false` (0 remaining, or this pizza has already placed/
applied everything its stock allows) renders `disabled` and `.ingredient-chip--disabled`
(dimmed, desaturated) -- disabled removes it from both click and pointer-drag activation, the
same mechanism the pre-existing locked-tab pattern already used. **The reducer's own Stock Gate
(`APPLY_SAUCE`/`COMMIT_SAUCE_DISPENSE`/`PLACE_TOPPING` in `gameReducer.ts`) is completely
unmodified** -- the UI disables a chip using the *same* `canPlaceIngredient` call the reducer
already makes at placement time, purely to spare the player a doomed attempt; it is never the
only thing standing between a tap and a placement.

## Scalability confirmation (14 / 30 / 62 ingredients)

- **14 (real, current catalog)**: unchanged regression coverage across
  `IngredientTray.palette.test.tsx` / `IngredientTray.recommendedOther.test.tsx` /
  `IngredientTray.physicalDragReset.test.tsx`, all against the real, unmocked
  `src/data/ingredients.ts`.
- **~30 / 62 (mocked, standing in for the Recipe Master foundation's target)**:
  `IngredientTray.scalability.test.tsx` mocks `ingredientsByCategory`/`getIngredient` with a
  synthetic 62-entry catalog (real production data untouched) and confirms: the "Other" grid
  never renders more than exactly `MAX_INGREDIENT_PALETTE_SLOTS` (6) chips regardless of how
  many are owned; a page-nav control appears and correctly reaches the catalog's last item; and
  the whole tray renders without error at both 30-owned and 62-owned (all-categories) scale.
  62 ingredients are never dumped onto one screen -- Recommended (small, curated) + Other
  (paged, capped at 6) is what keeps this bounded, exactly as the task specified ("62個すべてを
  一画面に表示する必要はありません").

## 390x844 / 360px results

Both **PASS** -- 0px horizontal overflow (`document.documentElement.scrollWidth -
clientWidth`, measured after every screenshot below) and 0 browser console errors, across every
captured state at both viewports. Screenshots in
`docs/reports/screenshots/ux2-making-step-tabs-20260919/`:

| File | What it shows |
| --- | --- |
| `390x844_01_DOUGH.png` / `360w_01_DOUGH.png` | Fresh round, DOUGH active, other 3 tabs + BAKE locked |
| `390x844_02_DOUGH_complete.png` / `360w_02_...` | Dough stretched past the completion threshold -- SAUCE tab now tappable (bordered), 「次へ」 CTA enabled |
| `390x844_03_SAUCE.png` / `360w_03_...` | SAUCE active, DOUGH completed (✓), Recommended row showing トマトソース (∞) |
| `390x844_04_CHEESE.png` / `360w_04_...` | CHEESE active, DOUGH/SAUCE completed, Recommended showing モッツァレラ |
| `390x844_05_TOPPING.png` / `360w_05_...` | TOPPING active, 3 prior steps completed, CTA switches to 「焼く！」 |
| `390x844_06_CHEESE_Other_stock0.png` | Seeded save: 「その他」 showing ゴルゴンゾーラ ×0, visibly disabled/greyed |
| `390x844_07_TOPPING_finite_stock.png` | Seeded save: 「その他」 showing マッシュルーム ×27 / たまねぎ ×40 alongside Recommended バジル ∞ |
| `390x844_08_LunchRush.png` | Lunch Rush PLAYING: MissionHud + MakingStepTabs + Tray coexist without overlap/overflow |

FREE is demonstrated by every DOUGH/SAUCE/CHEESE/TOPPING screenshot above (the default Pizza
Select -> Margherita flow); Lunch Rush is `390x844_08_LunchRush.png`.

## Tests

**1368/1368 passing** (`npm test`, 68 files). New/changed files:

- `src/components/MakingStepTabs.tsx` (new component)
- `src/components/MakingStepTabs.test.tsx` (new -- tests 1-8 plus BAKE-non-interactive/keyboard/
  future-jump-forbidden coverage)
- `src/components/IngredientTray.recommendedOther.test.tsx` (new -- tests 9-22: Recommended/
  Other grouping, unowned-hidden, finite/unlimited stock display, stock-0 disabled/unplaceable,
  category filters, FREE-Other-usable, Lunch-Rush-recipe-priority, EP4-grant-appears,
  Shop-restock-reflected)
- `src/components/IngredientTray.scalability.test.tsx` (new -- tests 26-28: real 14, mocked ~30,
  mocked 62)
- `src/components/IngredientTray.palette.test.tsx` (rewritten for the Recommended/Other split;
  same physical-drag/reset/paging coverage, now scoped correctly to the "Other" grid)
- `src/components/IngredientTray.physicalDragReset.test.tsx` (unchanged coverage, updated for
  the 3 new required props)
- `src/components/IngredientTray.stepLock.test.tsx` **deleted** -- its entire premise (tabs
  live inside `IngredientTray`) no longer holds; superseded by `MakingStepTabs.test.tsx`, which
  covers the same one-way-lock contract for the new, larger 5-tab strip.
- `src/state/onewayFlow.test.ts`, `src/screens/GameScreen.keyboard*.test.tsx`,
  `src/screens/GameScreen.physicalDragOverlay.test.tsx`, every `gameReducer*.test.ts`, Pizza
  Select/EP3/EP4 suites: **unchanged, all still passing** -- confirms no regression in
  `CONFIRM_MAKING_STEP`/Stock Gate/Pizza Select/keyboard interaction/Lunch Rush/Save schema.

Test 29/30 (390x844 / 360px overflow) are covered by the Playwright browser verification above,
not a unit test (jsdom doesn't lay out real pixels).

## Typecheck / Lint / Build

- `tsc -b`: clean, 0 errors.
- `oxlint`: clean, 0 errors.
- `vite build`: succeeds (`dist/assets/index-*.js` 334.58 kB, gzip 105.16 kB).

## Known limitations / future taxonomy requirement

- **Ingredient taxonomy**: today's `IngredientCategory` (`sauce`/`cheese`/`topping`) happens to
  match the making-step categories exactly, so no taxonomy work was needed for this slice's
  SAUCE/CHEESE/TOPPING filters. This will **not** necessarily hold once the Recipe Master
  foundation's 62-ingredient catalog is registered for real: a future ingredient that is
  simultaneously "sauce-like" and usable as a scatter topping (or a cheese sub-type that behaves
  like a spread), or a category that needs splitting for search/favorites, will need an explicit
  `subcategory`/`placementRole` field rather than continuing to overload `category`. Recording
  this now, per the task's own instruction, rather than doing a taxonomy redesign in this slice.
- **Recommended row at extreme counts**: the horizontal-scroll "Recommended" row has no cap --
  correct for every real recipe today (max 4 in one category), but a hypothetical future recipe
  with a very large single-category requirement count would rely on scroll rather than paging.
  Not a real risk with curated recipe data, flagged for completeness.
- **BAKE tab is permanently inert**: by design (Issue #86's own recommendation) -- START_BAKE
  is reachable only via the existing 「焼く！」 CTA. If tab-only navigation becomes a firm product
  goal in a later slice, wiring BAKE to `START_BAKE` would be a small, isolated follow-up.

## Absolutely-not-touched (verified unchanged)

EP4 Starter Stock / `starterGrantClaimedRecipeIds` / Recipe Unlock conditions / Inventory
consumption (`consumePizzaInventory`) / `CONFIRM_BAKE` consumption boundary / Shop restock
(`restockIngredient`) / Pitz economy / Pizza Select pager / Fugazza mystery lock / scoring / Save
schema (`schemaVersion` stays `2`, no bump) / Lunch Rush continuous progression / Recipe Master
datasets. No other open PR's branch was touched.

## Changed files

```
 src/App.css                                                  | 123 ++++++++++++++--
 src/components/IngredientTray.palette.test.tsx                | 134 ++++++++++++------
 src/components/IngredientTray.physicalDragReset.test.tsx      |   4 +-
 src/components/IngredientTray.recommendedOther.test.tsx (new)
 src/components/IngredientTray.scalability.test.tsx (new)
 src/components/IngredientTray.stepLock.test.tsx (deleted)     | 129 -----------------
 src/components/IngredientTray.tsx                              | 203 +++++++++++++--------
 src/components/MakingStepTabs.tsx (new)
 src/components/MakingStepTabs.test.tsx (new)
 src/screens/GameScreen.tsx                                      |  27 ++-
 docs/reports/TETO_UX-2_MAKING-STEP-TABS_INGREDIENT-TRAY_Result.md (new, this file)
 docs/reports/screenshots/ux2-making-step-tabs-20260919/*.png (new, 13 files)
```

## HEAD SHA

See the PR -- filled in after the final commit/push below.

## FINAL VERDICT

**A. UX-2 COMPLETE -- READY FOR MERGE REVIEW**
