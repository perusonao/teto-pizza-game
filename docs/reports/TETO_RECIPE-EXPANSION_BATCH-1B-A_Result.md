# Recipe Expansion Batch 1B-A — Result Report

Pizza Bianca + Breakfast Pizza, the first implementation slice of Recipe Expansion Batch 1B
(per `docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B_Fresh-Design.md` section 18's "Batch 1B-A"
plan).

## SHAs

- Audited `origin/main` SHA (fresh `git fetch origin` at session start): `715966d831200c084688951b2710daeacdb63025`
  (PR #108, "Sync Recipe Master with shipped Batch 1A" — already merged).
- Implementation HEAD: `fd7136eb6ed18ee5101b0dfeba29df5c09ef9eda`
- Branch: `claude/recipe-expansion-1b-a-oeg6jm`

## Duplicate PR Gate

Checked at session start (`git fetch origin`, `list_pull_requests` state=open, `search_pull_requests`
for "Pizza Bianca" / "Breakfast Pizza" / "Batch 1B-A" / "Recipe Expansion 1B"): no open PR and no
non-empty branch touches this scope. The designated branch `claude/recipe-expansion-1b-a-oeg6jm`
existed on origin but had zero commits ahead of `main` (a fresh branch, not prior work). One
read-only branch, `claude/batch-1b-design-audit-92elmc`, holds the Batch 1B Fresh Design Audit
doc referenced by this task — read as design input, real code treated as authority throughout.
Re-checked again immediately before opening the PR (Gate #2): still no duplicate.

## Before / After

| | Before (main @ 715966d) | After |
|---|---|---|
| Production recipes (`src/data/recipes.ts`) | 11 | **13** |
| Production ingredients (`src/data/ingredients.ts`) | 18 | **20** |
| Last recipe / unlock chain tail | `tonno-e-cipolla` (minTotalStars 28) | `tonno-e-cipolla` → `pizza-bianca` (32) → `breakfast-pizza` (36) |
| Master Catalog `verified_internal` | 11 | 13 |
| Master Catalog `game_design_candidate` | 17 | 15 |
| Ingredient Catalog `existingIngredientCount` | 18 | 20 |
| Ingredient Catalog `newIngredientCount` | 44 | 42 |

## Pizza Bianca

```
id: "pizza-bianca"
nameJa: "ピッツァ・ビアンカ"
requiredIngredients: [olive-oil x1, rosemary x3]
bakeTarget: { start: 50, end: 70 }
baseRewardPitz: 100
unlockCondition: { requiresRecipeId: "tonno-e-cipolla", minTotalStars: 32 }
mysteryLock: absent (fugazza stays the one deliberate exception)
```

Deliberately no tomato sauce — sauce ingredient is `olive-oil`, matching the Master Catalog's own
`sauce: "olive-oil"` field for this entry.

## Breakfast Pizza

```
id: "breakfast-pizza"
nameJa: "ブレックファストピザ"
requiredIngredients: [tomato-sauce x1, mozzarella x2, egg x1, bacon x3]
bakeTarget: { start: 56, end: 76 }
baseRewardPitz: 100
unlockCondition: { requiresRecipeId: "pizza-bianca", minTotalStars: 36 }
```

`egg` and `tomato-sauce`/`mozzarella` are fully reused from `bismarck` and the Starter Set — the
only new ingredient this recipe introduces is `bacon`.

## New Ingredients

Both follow the existing EP4/`starterGrantOnly` schema exactly (no new field invented):

| id | category | placement | emoji | color | unlockCondition | pricePitz | restockQuantity | starterGrantOnly |
|---|---|---|---|---|---|---|---|---|
| rosemary | topping | scatter | 🌱 | `#7c8f5e` | `{ minTotalStars: 0 }` (inert) | **55** (provisional) | 9 (minCount 3 × 3) | true |
| bacon | topping | scatter | 🥓 | `#c26b4e` | `{ minTotalStars: 0 }` (inert) | **140** (provisional) | 9 (minCount 3 × 3) | true |

Provisional economy rationale (Economy Tuning 1's own tier convention, not a new formula):
`rosemary` matches `oregano`'s herb tier (55 Pitz); `bacon` matches `sausage`'s premium-meat tier
(140 Pitz). Both are the same tier the Batch 1B Fresh Design Audit's own §14 proposed. Economy
system itself (formula, other ingredients' prices) was not touched.

## Unlock Requirements / Starter Grants

Chain: `tonno-e-cipolla` → `pizza-bianca` (`minTotalStars: 32`) → `breakfast-pizza`
(`minTotalStars: 36`), continuing the exact +4-per-step pattern Batch 1A's own chain established
(16 → 20 → 24 → 28 → 32 → 36).

Starter Grant (`minCount × STARTER_STOCK_PLAYS_CHAPTER_1(10)`, existing `starterStock.ts` formula,
untouched):

- `pizza-bianca` unlock grants `rosemary: 3×10 = 30`. `olive-oil` is already a shared
  starterGrantOnly ingredient (first granted by `quattro-formaggi`/`fugazza`); its own grant here
  (`1×10=10`) is floored against whatever the player already has (`Math.max(current, 10)`, the
  existing EP1 P0b shared-floor semantics), never re-added.
- `breakfast-pizza` unlock grants `bacon: 3×10 = 30`. `egg` is shared with `bismarck`
  (`1×10=10` floored, same semantics); `tomato-sauce`/`mozzarella` are unconditional Starter Set
  ingredients (never appear in a grant — `starterGrantForRecipe` skips any ingredient without
  its own `unlockCondition`).

Verified live in-browser (see Screenshots): a fresh unlock of `pizza-bianca` shows
`ローズマリー ×30` in the Ingredient Tray; a fresh unlock of `breakfast-pizza` shows
`ベーコン ×30` and the already-owned `たまご ×10` unaffected.

## Completion Gate Compatibility / Pizza Bianca Sauce Architecture

**No architecture change was needed.** `evaluatePizzaCompletion`'s sauce-quantity check
(`src/logic/completionGate.ts`'s `checkSauceQuantity`) already reads the sauce ingredient
generically from `getReferencePizza(recipe.id).sauce.ingredientId` — it never hardcodes
`tomato-sauce`. `fugazza` (olive-oil, no tomato sauce, already shipped in Batch/Phase 3C-6)
already proves this works in production. Pizza Bianca's `olive-oil` + `rosemary` composition
was implemented exactly like `fugazza`'s, with no Completion Gate code touched.

Verified live in-browser: Pizza Bianca (`olive-oil` painted + 3 rosemary pieces, no tomato sauce
anywhere) reaches RESULT with **PASS**, ★3, "よし、ピッツァ・ビアンカが完璧に焼けた！" — see
screenshot 03. `SAUCE_MIN_RATIO`/`SAUCE_WEIGHT`/every other Completion Gate or Scoring 2.0
constant is unchanged (confirmed by diff — only `src/data/*` and their tests were touched, no
file under `src/logic/completionGate.ts` or `src/logic/scoringV2/**` was edited).

FAILED path (required-ingredient-insufficient) re-confirmed live in-browser on an existing
recipe (margherita, insufficient mozzarella → `モッツァレラが足りませんでした`) and, generically
for all 13 recipes including both new ones, by `completionGate.test.ts` test 27 (PASS for an
ideal pizza / FAILED for an empty one, every recipe).

## Shop / Inventory / Dex / Ingredient Tray

No component code changed — Shop/Inventory/Dex/Ingredient Tray are all fully data-driven off
`INGREDIENTS`/`RECIPES` already (confirmed by code read before implementing: no hardcoded
ingredient/recipe list exists in any production component). Verified live in-browser:

- **Recipe Select**: pager correctly reports `13/13`; switches to counter mode (never a 13-dot
  row), matching the existing `PAGER_DOT_INDICATOR_MAX` gate Batch 1A already exercised.
- **Inventory**: shows `所持 20/20種`; `rosemary`/`bacon` render with their own emoji/color exactly
  like every other topping, no crash.
- **Shop**: `rosemary` (55 Pitz, +9 restock) and `bacon` (140 Pitz, +9 restock) both list as
  ordinary restock rows once owned, no new UI path.
- **Ingredient Tray**: the topping category's existing pagination (`MAX_INGREDIENT_PALETTE_SLOTS
  = 6`) already handles the grown 13-topping catalog — Pizza Bianca's `rosemary` and Breakfast
  Pizza's `bacon` both appear, selectable, no new page-nav code needed.
- **Dex**: `発見 X/13` renders correctly (App.tsx / DexOverlay both derive this from `RECIPES`).

## Recipe Visuals

No new rendering engine/CSS added beyond what data-driven `IngredientPieceVisual`/emoji rendering
already provides. Pizza Bianca reads as visually pale/minimalist (olive-oil base color `#e9d9a0`,
3 small green 🌱 rosemary sprigs) against every other (tomato-red) recipe card — see screenshot
01/02. Breakfast Pizza's egg (🥚, centered) and bacon (🥓 ×3, outer ring) are clearly distinct
pieces on the finished pizza — see screenshot 04/05.

## Master Catalog Sync

Both catalogs updated in the same change:

- `data/recipes/pizza_master_catalog.json`: `pizza-bianca`/`breakfast-pizza` entries flipped to
  `verificationStatus: "verified_internal"`, `gameDesignStatus: "shipped"`,
  `currentGameRecipe: true`, `sourceReferences: ["internal://src/data/recipes.ts#<id>"]`,
  `bakeProfile` filled with the shipped bake target — the exact same field set Batch 1A's own
  shipped entries (e.g. `salsiccia`) use. `statusBreakdown` aggregate updated (`verified_internal`
  11→13, `game_design_candidate` 17→15). `catalogEntryCount`/`viableEntryCount` unchanged (53/51
  — no entries added/removed, only status flipped).
- `data/recipes/ingredient_master_catalog.json`: `rosemary`/`bacon` flipped to
  `existingInGame: true`, `implementationCost: "none (shipped)"`,
  `reusePotential: "n/a (already shipped)"`, `visualDistinctiveness: null`, and their
  candidate-only `mechanicDependency`/`notes` fields removed — matching the exact shipped shape
  of every prior Batch 1A ingredient (e.g. `sausage`). `existingIngredientCount` 18→20,
  `newIngredientCount` 44→42, `totalIngredientCount` unchanged (62).
- `tools/validate_recipe_catalog.py` passes against both files after the sync (53 recipes, 62
  ingredients, 11 mechanics, all checks pass).
- Capricciosa / Meat Lovers / Supreme / Hawaiian / Ortolana and every other non-Batch-1B-A entry
  were **not** touched — statuses/fields for those remain exactly as PR #108 left them.

## Tests

Added/updated coverage (existing files, following each file's own established convention — no
new test file created where an existing one already owns that surface):

- **Recipe/ingredient definitions**: `src/data/recipes.test.ts` (new `describe.each` block +
  dedicated `pizza-bianca`/`breakfast-pizza` describes, incl. the no-tomato-sauce assertion),
  `src/data/ingredients.test.ts` (price/restock pins, total count).
- **Sauce profile / Reference coverage**: `src/data/recipeSauceProfiles.test.ts` (generic,
  count-only change — already iterates `RECIPES`). `referencePizza.ts`'s own entries are exercised
  by `completionGate.test.ts`'s existing "all N recipes" PASS/FAILED test generically.
- **Completion Gate**: `src/logic/completionGate.test.ts` test 27 now covers 13 recipes
  (PASS-for-ideal / FAILED-for-empty), including Pizza Bianca's no-tomato-sauce composition.
- **Progression / unlock chain / totalStars gate**: `src/state/progression.test.ts`.
- **Starter Grant** (first unlock, exact-once ledger, shared-floor semantics):
  `src/state/starterStock.test.ts` (fixed a pre-existing test whose fixed high-star fixture now
  also crosses `pizza-bianca`'s own unlock threshold — added it to that test's `alreadyClaimed`
  list, its own stated subject stays Batch 1A's ledger).
- **Shop/Inventory/Dex/Tray visibility**: `src/components/InventoryOverlay.test.tsx` (count pins),
  `src/components/IngredientTray.palette.test.tsx` (7-owned/2-page pagination boundary re-pinned
  to an explicit 7-ingredient list now that "every topping" is 13, not 7 — no pagination
  regression, this is a test-fixture-only change).
- **Recipe-count regressions**: `src/screens/PizzaSelectScreen.test.tsx`,
  `src/logic/efficiency.test.ts`, `src/App.test.tsx`, `src/App.fullGameReset.test.tsx`.

Result: **1647 / 1647 tests pass** (83/83 files), up from 1634/1634 on baseline main (13 net new
assertions across the updated files, no new test file). `tsc -b`: clean. `oxlint`: clean.
`npm run build`: clean (357 KB / 110 KB gzip JS, no size regression flag). Master Catalog
validator: all checks pass.

**Pre-existing flaky test found and confirmed NOT a regression**:
`src/state/phase4a1a.regression.test.ts` > "APPLY_SAUCE for marinara's tomato-sauce still works
exactly as before" uses a bounded (20-attempt) random retry loop (`MISSION_RESET_ORDER`) to land
on a specific recipe. Isolated rerun (5x) on this branch failed 3/5; the same isolated rerun (5x)
against unmodified `origin/main` (stashing this change) also failed 1/5 — confirming the flake
pre-dates this change. Growing the recipe pool (11→13) mechanically lowers the per-attempt hit
probability within the same fixed 20-try bound, so this branch's flake *rate* is higher, but the
test's own logic (and the production code it exercises) is untouched by this change. Fixing the
test's retry bound/logic is Lunch Rush/Mission-order scope, out of this batch's Scope Guard —
flagged here as a follow-up, not fixed.

## Browser Verification

Real Chromium (Playwright, `/opt/pw-browsers/chromium`), dev server (`vite`, base path
`/teto-pizza-game/`), seeded save state (Dex discovered through the full chain) to reach both
new locked recipes.

- **390×844**: Recipe Select → PREPARE (DOUGH → SAUCE → CHEESE(skip, none required for
  Pizza Bianca) → TOPPING) → BAKE → RESULT, for both `pizza-bianca` and `breakfast-pizza`. Both
  reached **PASS**, ★3, and (for Breakfast Pizza) the "発見しました" first-discovery banner.
  Starter Grant amounts confirmed exactly as designed (`rosemary ×30`, `bacon ×30`).
  Regression spot-check: `margherita` still plays (confirmed its Completion Gate FAILED path
  fires correctly on insufficient mozzarella, a deliberate test-script under-placement, not a
  product bug).
- **360×800**: Recipe Select + Breakfast Pizza PREPARE screenshotted; `document.documentElement`
  `scrollWidth - clientWidth === 0` (no horizontal overflow).
- **Console errors**: 0 across every page load, screen transition, and round in every run
  (`console.error`/`pageerror` listeners attached throughout).
- Shop and Inventory overlays both confirmed to list `rosemary`/`bacon` with correct
  price/restock/stock figures.

## Screenshots

`docs/reports/screenshots/recipe-expansion-1b-a/`:

1. `01-recipe-select-with-new-recipes.png` — Recipe Select, showing the grown pager (1/13)
2. `02-pizza-bianca-prepare.png` — Pizza Bianca TOPPING step (olive-oil base + 3 rosemary)
3. `03-pizza-bianca-result.png` — Pizza Bianca RESULT (PASS, ★3)
4. `04-breakfast-pizza-prepare.png` — Breakfast Pizza TOPPING step (tomato base, mozzarella, egg, bacon)
5. `05-breakfast-pizza-result.png` — Breakfast Pizza RESULT (PASS, ★3, first-discovery banner)
6. `06-inventory-new-ingredients.png` — Inventory topping tab, `所持 20/20種`, rosemary/bacon visible
7. `07-shop-new-ingredients.png` — Shop, rosemary/bacon restock rows
8. `08-360x800-breakfast-pizza-prepare.png` — 360×800 layout check, no overflow

## Remaining Batch 1B Recipes (Deferred)

Per the Fresh Design Audit's own Main Batch (§16) and slicing plan (§18), not touched by this
slice: `capricciosa`, `meat-lovers`, `supreme` (Batch 1B-B/1B-C), and their remaining new
ingredients (`ham`, `black-olive`, `bell-pepper`). Their Master Catalog entries/status are
unchanged by this PR.

## Remaining Risks

- The two new ingredients' `pricePitz`/`bake target`/unlock `minTotalStars` values are
  provisional (matching existing tier conventions, per the task's own instruction), not a final
  Economy/Progression Tuning decision — same caveat every prior batch's numbers carried.
- The pre-existing Mission-order flaky test (see Tests section) is unfixed, tracked as a
  follow-up outside this batch's scope.
- Reference Pizza piece-group positions (`referencePizza.ts`) for both new recipes are authored
  directly (no external/ChatGPT review pass), following the same precedent Batch 1A's own
  4 recipes used — not yet through the earlier B2-era external review process.

## Final Verdict

**A. READY TO MERGE**

Both recipes are fully specified, implemented, and verified (unit tests + live browser PASS for
both, at 390×844 and 360×800, zero console errors, zero horizontal overflow). Completion Gate,
Scoring 2.0, Shop/Inventory/Dex/Tray, Starter Grant, and Master Catalog sync all confirmed working
with **zero changes to shared architecture** (Pizza Bianca's no-tomato-sauce composition reused
`fugazza`'s existing olive-oil sauce path with no code change). Full test suite green
(1647/1647), `tsc`/`oxlint`/`build`/Master-Catalog-validator all clean. The one flaky test found
is pre-existing (confirmed on unmodified main) and out of this batch's scope to fix.
