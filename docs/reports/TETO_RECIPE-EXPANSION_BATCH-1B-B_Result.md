# Recipe Expansion Batch 1B-B: Capricciosa -- Result Report

Adds the second implementation slice of Recipe Expansion Batch 1B: **Capricciosa**
(カプリチョーザ), the 14th production recipe, plus its 2 new ingredients (**ham**/ハム,
**black-olive**/ブラックオリーブ). Scope: Capricciosa + ham + black-olive only -- no other
Batch 1B recipe (Meat Lovers, Supreme, Hawaiian, Ortolana), no Firebase/Ranking/new Shop UI/Dex
filter/new cooking mechanic/scoring/economy-formula/Save-schema change, no flaky-test fix.

## 0. Duplicate PR Gate #1 (pre-implementation) / Gate #2 (pre-PR)

**Gate #1** (session start): `git fetch origin`; audited `origin/main` SHA
`4a42868a8392dbf6f82bd53fd8defcaf0f564cc9` ("Visual Polish 1C: improve Shop scalability (#111)").
Checked open PRs (`list_pull_requests`, state=open) and every remote branch name for anything
scoped to Batch 1B-B / Capricciosa / ham / black-olive: none found (the 5 open PRs at audit time
were #105 automation opt-in worker, #72 docs status fix, #46 D0 audit, #34 issue #32 phase 1, #3
docs -- all unrelated). One adjacent branch, `claude/batch-1b-design-audit-92elmc`, carries the
read-only Batch 1B Fresh Design Audit doc (`TETO_RECIPE-EXPANSION_BATCH-1B_Fresh-Design.md`,
merged to no branch, docs-only, `currentGameRecipe: false` throughout) -- not an implementation,
not merged to main, and not itself synced with the current Master Catalog, so it was read only
as **background context**, never as authority for the actual production values below (see
Sections 2-3). Cleared to implement.

**Gate #2** (immediately before PR creation): `git fetch origin main` again -- main had advanced
to `13151e8b2521dd90e7df17e2760e1321fc92be24` ("Firebase ranking Phase 1A: foundation and
anonymous auth (#113)", merged after this task's implementation began). Re-checked open PRs:
still no Capricciosa/Batch-1B-B-scoped PR or branch. Diffed `4a42868..13151e8` (13 files,
Firebase client/auth/config modules + one 14-line, fully additive/no-op-without-config
`App.tsx` hook) -- zero overlap with any file this task touches. Fast-forward merged
`origin/main` into the working branch (clean, no conflicts) and re-ran the full verification
suite (Section 10) against the new base -- all green.

## 1. Fresh Baseline (audited at `4a42868a...`)

| Item | Before |
|---|---|
| `src/data/recipes.ts` | 13 recipes, last = `breakfast-pizza` (chained after `pizza-bianca`, `minTotalStars: 36`) |
| `src/data/ingredients.ts` | 20 ingredients (3 Starter + 10 EP4 Starter-Grant + `onion` + Batch 1A's 4 + Batch 1B-A's 2) |
| `data/recipes/pizza_master_catalog.json` | 53 recipe entries; `capricciosa` present as `verificationStatus: "game_design_candidate"`, `currentGameRecipe: false`, `bakeProfile: {58, 78}` (already fixed at catalog-authoring time, unlike pizza-bianca/breakfast-pizza's own `null` pre-1B-A), `ingredients: ["black-olive", "ham", "mozzarella", "mushroom", "oregano", "tomato-sauce"]` |
| `data/recipes/ingredient_master_catalog.json` | 62 ingredient entries; `ham`/`black-olive` both `existingInGame: false`, `category: "topping"`, `placementType: "scatter"` |
| Unlock chain | `margherita` (unconditional) -> `funghi` -> `marinara` -> `bismarck` -> `genovese` -> `quattro-formaggi` -> `fugazza` -> `salsiccia`(16) -> `pepperoni`(20) -> `napoletana`(24) -> `tonno-e-cipolla`(28) -> `pizza-bianca`(32) -> `breakfast-pizza`(36) |
| Starter Grant | `applyStarterGrants` (`src/state/starterStock.ts`): `scatter` ingredient grant = `minCount x STARTER_STOCK_PLAYS_CHAPTER_1(10)`; shared ingredient tops up to `Math.max(current, newGrant)` (floor, never adds) |
| Category schema | `IngredientCategory = "sauce" \| "cheese" \| "topping"` (`src/data/ingredients.ts`), unchanged since EP1 |
| Completion Gate authority | `evaluatePizzaCompletion` (`src/logic/completionGate.ts`), `SAUCE_MIN_RATIO` untouched |

No `TETO_RECIPE-EXPANSION_BATCH-1B_Fresh-Design.md` exists on `main` (it lives only on the
unmerged `claude/batch-1b-design-audit-92elmc` branch) -- read as background per Section 0, not
as authority. Every production value below was independently confirmed against fresh
`origin/main` + `data/recipes/pizza_master_catalog.json` / `ingredient_master_catalog.json`.

## 2. Capricciosa

Final production definition (`src/data/recipes.ts`):

```
id: "capricciosa", nameJa: "カプリチョーザ"
requiredIngredients: tomato-sauce x1, mozzarella x2, mushroom x2, oregano x1, ham x1, black-olive x2
bakeTarget: { start: 58, end: 78 }   // verbatim from the Master Catalog's own bakeProfile
baseRewardPitz: 100
unlockCondition: { requiresRecipeId: "breakfast-pizza", minTotalStars: 40 }
```

Ingredients/sauce/bake target are taken verbatim from the Master Catalog's own `capricciosa`
entry. **One deliberate rebalance from the Fresh Design audit's provisional proposal**: the
audit suggested `ham x2, black-olive x3` (10 total non-sauce pieces); this task ships `ham x1,
black-olive x2` (8 total non-sauce pieces) instead. Reason: `src/data/playerReference.ts`
assigns every non-sauce piece a slot from the shared, fixed 8-entry `PIECE_RING_POSITIONS`
table (`src/logic/pizzaReferenceLayout.ts`, also reused by `PizzaThumbnail`'s card preview for
*every* recipe) -- `quattro-formaggi` already reaches this exact 8-piece ceiling, and the
audit's own un-rebalanced 10-piece proposal would silently wrap and collide in that ring
(caught by `playerReference.test.ts`'s pre-existing collision regression test). Growing that
shared table was out of scope (risk of visual regression for every other recipe's card preview
for one recipe's benefit), so `minCount` was rebalanced down instead -- `restockQuantity` for
both new ingredients was resized to match (`minCount x 3`, the established per-batch formula).
Only DOUGH/SAUCE/TOPPING/BAKE/RESULT are used -- zero new mechanic. Scoring 2.0 Reference
fixture (`CAPRICCIOSA_REFERENCE`, `src/data/referencePizza.ts`) added: mozzarella/mushroom on an
inner radius-18 ring (opposite pairs, matching `QUATTRO_FORMAGGI_REFERENCE`'s own convention),
ham/black-olive/oregano on an outer radius-32 ring. Sauce profile
(`src/data/recipeSauceProfiles.ts`): `tomato-sauce`/`PAINT`, matching the Master Catalog's own
`sauce` field. An `order-capricciosa` entry was added to `src/data/orders.ts` (every recipe
needs exactly one Order, per `recipes.test.ts`'s own integrity check).

## 3. ham / black-olive

| Field | ham | black-olive |
|---|---|---|
| `category` | topping | topping |
| `placement` | scatter | scatter |
| `emoji` | 🍖 (`\u{1F356}`) | ⚫ (`⚫`, plain-shape convention `pepperoni`'s red circle already established -- `olive-oil` already owns the literal olive emoji) |
| `pricePitz` | 140 (matches `sausage`/`bacon`'s premium-meat tier) | 90 (matches `garlic`/`gorgonzola`'s mid-tier flavor topping) |
| `restockQuantity` | 3 (`minCount 1 x 3`) | 6 (`minCount 2 x 3`) |
| `unlockCondition` | `{ minTotalStars: 0 }` (inert -- see below) | `{ minTotalStars: 0 }` (inert) |
| `starterGrantOnly` | `true` | `true` |

No new field invented; existing schema/category/Economy-tier conventions reused verbatim,
following the exact EP4/Batch-1A/1B-A pattern (`starterGrantOnly` suppresses the manual-purchase
Shop row entirely -- first unit is always free via Capricciosa's own Starter Grant, restock is
the only Shop transaction that ever applies). No other ingredient's price/restock was touched.

## 4. Progression

Unlock chain confirmed and adopted exactly as the design audit anticipated:

```
... -> tonno-e-cipolla(28) -> pizza-bianca(32) -> breakfast-pizza(36) -> capricciosa(40)
```

`requiresRecipeId: "breakfast-pizza"` (current production final recipe, freshly confirmed),
`minTotalStars: 40` (continuing the existing +4 step: 16/20/24/28/32/36/**40**). No
`mysteryLock`. Existing `recipeUnlocked`/`isRecipeAvailable` (`src/state/progression.ts`) used
unmodified -- zero new progression mechanism.

## 5. Starter Grant

`applyStarterGrants` requires no code change -- capricciosa's grant derives automatically from
`requiredIngredients`:

| Ingredient | Grant | Notes |
|---|---|---|
| `tomato-sauce`, `mozzarella` | -- (skipped) | Starter Set, no `unlockCondition`, unconditionally unlimited |
| `mushroom` | `Math.max(existing, 2x10=20)` | floors against `funghi`'s own existing 3x10=30 grant -- **unchanged at 30**, confirmed in the browser pass (Shop/Tray showed `mushroom x30`) |
| `oregano` | `Math.max(existing, 1x10=10)` | floors against `marinara`'s own existing 2x10=20 grant -- **unchanged at 20**, confirmed in the browser pass |
| `ham` | `1x10=10` | fresh grant, confirmed in the browser pass (`ハム x10`) |
| `black-olive` | `2x10=20` | fresh grant, confirmed in the browser pass (`ブラックオリーブ x20`) |

Dedicated exactly-once ledger test added (`starterStock.test.ts`, "Batch 1B-B recipe grant
amounts (#14, capricciosa)"): grants ham/black-olive fresh, floors mushroom/oregano against
their existing grants (no duplicate-farming stacking), and confirms capricciosa is never
re-granted once already claimed. Shop Visual Polish 1C's `starterGrantOnly` gate (Shop never
shows a LOCKED/AVAILABLE_TO_BUY row for either ingredient pre-grant) is untouched and reused as-is.

## 6. Shop compatibility

Confirmed in the running app (see screenshots): `ham`/`black-olive` correctly categorized under
「トッピング」, hidden from Shop before Capricciosa's Starter Grant lands (never shown as
LOCKED/AVAILABLE_TO_BUY, matching every other `starterGrantOnly` row), and appear automatically
with a Restock row (stock/`+N`/price/CTA, never a plain purchase button) once granted. Both
「すべて」 and 「トッピング」 tabs render them correctly. `EARLY_GAME_HINT_THRESHOLD`
(`src/data/ingredients.ts`) is derived from `INGREDIENTS.filter((i) => i.unlockCondition).length`
-- updated automatically (no code change) by the 2 new rows. Shop UX itself untouched.

## 7. Inventory / Dex / Tray

- **Inventory**: 22/22 owned ingredients render correctly across all category filters (confirmed
  in-browser: 「所持 22/22種」, ham/black-olive visible and correctly filtered under 「トッピング」).
- **Dex**: Capricciosa correctly appears as card #14/14 with a reference-thumbnail preview
  (mushroom/ham/oregano/black-olive icons) before being played, and registers as discovered
  ("✨ カプリチョーザを発見しました！") immediately after a PASS bake.
- **Ingredient Tray**: exactly 6 ingredients (tomato-sauce painted at the SAUCE step outside the
  tray; mozzarella at CHEESE; mushroom/oregano/ham/black-olive at TOPPING) -- fits
  `MAX_INGREDIENT_PALETTE_SLOTS = 6` with zero scroll, confirmed visually (the 「このピザにおすすめ」
  recommended row shows all 4 TOPPING-step ingredients on one screen, no pagination triggered).
  No Visual Polish redesign.

## 8. Completion Gate

`evaluatePizzaCompletion` used as the sole authority, unmodified. `SAUCE_MIN_RATIO` untouched.
Confirmed both directions:
- **PASS**: real in-browser playthrough (Section 12) reached `★★★★☆ 80点`,
  "カプリチョーザ、いい焼き色だ！これはうまく焼けたぞ！", +106 Pitz.
- **FAILED**: generic regression test #27 (`completionGate.test.ts`) asserts every one of the 14
  recipes' ideal-fixture PASSes and empty-pizza FAILEDs, capricciosa included (test updated
  13->14). The very first in-browser attempt (with under-painted sauce) also produced a genuine
  "失敗 -- トマトソースをもう少し広くぬろう！" FAILED result before the sauce-painting gesture
  was strengthened, independently confirming the FAILED path end-to-end.

## 9. Scoring / Cooking Time

Zero changes to Scoring 2.0 weights/star thresholds/bake thresholds/efficiency coefficients/
Cooking Time rules. Capricciosa is piped through the existing `computeScoringV2` pipeline via
its new Reference fixture only (`efficiency.test.ts`'s generic 14-recipe regression test
confirms valid, ordered, strictly-increasing thresholds for it like every other recipe).

## 10. Tests

All items A-P from the task list are covered:

| Item | Coverage |
|---|---|
| A. Capricciosa recipe definition | `recipes.test.ts` dedicated `describe("capricciosa (Batch 1B-B)")` |
| B. ham definition | `ingredients.test.ts` dedicated `describe("ham / black-olive ...")` |
| C. black-olive definition | same |
| D. unlock chain | `recipes.test.ts` (`requiresRecipeId: "breakfast-pizza"`) |
| E. ★40 gate | `recipes.test.ts` (`minTotalStars: 40`) |
| F. Starter Grant (ham/black-olive/shared floor/duplicate-farming) | `starterStock.test.ts` "Batch 1B-B recipe grant amounts (#14, capricciosa)" (3 tests) |
| G. Shop (pre-ownership hidden/post-grant visible/category filter/price/restock) | generic `App.test.tsx` Shop suites (data-driven off `INGREDIENTS`/`EARLY_GAME_HINT_THRESHOLD`) + in-browser confirmation |
| H. Inventory | `InventoryOverlay.test.tsx` (count updated 20->22) + in-browser |
| I. Dex | in-browser (card #14/14, discovery banner) |
| J. Ingredient Tray (6 ingredients, pagination/scroll regression) | `playerReference.test.ts` collision regression (was the one real bug this task caught and fixed via the minCount rebalance) + in-browser (no pagination triggered) |
| K. Completion Gate PASS | in-browser real playthrough + `completionGate.test.ts` #27 |
| L. missing ingredient FAILED | `completionGate.test.ts` #27 (empty-pizza FAILED for all 14) + in-browser under-sauced attempt |
| M. Scoring regression | full suite green, `efficiency.test.ts` 14-recipe regression |
| N. Lunch Rush regression | full suite green (`lunchRush.test.ts`, `mission/*` untouched, recipe-count-agnostic) |
| O. Save/load regression | full suite green (`persistence.test.ts` untouched; in-browser save v2 round-trip exercised throughout) |
| P. existing 13 recipes regression | full suite green (1691/1691 tests pass) |

**Full verification run** (post-Gate-#2 merge, against `13151e8`): `npx vitest run` ->
**87 test files, 1705 tests, all green** (84 files/1691 tests were this task's own contribution
plus the pre-existing suite; +3 files/+14 tests came from the newly-merged Firebase Phase 1A's
own test files, untouched by and unrelated to this task).
`python3 tools/validate_recipe_catalog.py` -> all checks passed. `npx tsc -b` -> clean.
`npx oxlint` -> clean. `npm run build` -> clean production build.

## 11. Known flaky

`src/state/phase4a1a.regression.test.ts` -- confirmed **byte-identical** to `origin/main`
(`git diff origin/main -- src/state/phase4a1a.regression.test.ts` is empty). Isolated rerun
(`npx vitest run src/state/phase4a1a.regression.test.ts`) failed with the same
randomized-order symptom (`expect(state.recipe.id).toBe("marinara")` received `"salsiccia"`)
on two separate isolated runs, while the full-suite run (`npx vitest run`, all 84 files
together) passed clean both times. This is the pre-existing, previously-documented flake --
**not fixed by this PR**, per Scope Guard.

## 12. Browser verification

Dev server (`vite`) run locally; verified with Playwright (real Chromium, not jsdom) at
**390x844** (primary) and **360x800** (representative). Full playthrough:

Recipe Select (paged to card 14/14, `カプリチョーザ`, `NEW` badge) -> PREPARE (DOUGH stretched
via a 12-direction outward drag -> SAUCE painted via a 2-pass, 5-ring drag covering most of the
dough with a bare rim -> CHEESE: mozzarella x2 placed via tap-to-place -> TOPPING: mushroom x2 /
oregano x1 / ham x1 / black-olive x2 placed via tap-to-place, all 4 visible on one
「このピザにおすすめ」 row with the correct Starter Grant quantities: マッシュルーム x30
(floored), オレガノ x20 (floored), ハム x10 (fresh), ブラックオリーブ x20 (fresh)) -> BAKE
(needle polled and confirmed inside the 58-78% target zone) -> **RESULT: PASS**
(`★★★★☆ 80点`, "カプリチョーザ、いい焼き色だ！これはうまく焼けたぞ！", "✨ カプリチョーザを
発見しました！", +106 Pitz, 500->606). Also confirmed: Shop's トッピング filter shows both new
ingredients with correct restock rows (ハム 在庫10 +3 140 Pitz; ブラックオリーブ 在庫20 +6 90
Pitz); Inventory's トッピング filter shows both, 22/22 total. **Horizontal overflow: 0** at
every checkpoint (`document.documentElement.scrollWidth === clientWidth` throughout, both
viewport widths). **Console errors: 0** (no `console.error`/`pageerror` captured across the
entire session).

## 13. Screenshots

Saved to `docs/reports/screenshots/recipe-expansion-1b-b/`:

- `01-recipe-select-capricciosa.png` -- Pizza Select, card 14/14, NEW badge
- `02-prepare-dough.png` -- PREPARE, DOUGH step
- `03-prepare-topping.png` -- PREPARE, TOPPING step with all 4 toppings placed
- `04-result-pass.png` -- RESULT, PASS (★4, 80点, discovery banner, +106 Pitz)
- `05-shop-ham-blackolive.png` -- Shop, トッピング filter, ham/black-olive restock rows
- `06-inventory-ham-blackolive.png` -- Inventory, トッピング filter, ham/black-olive owned
- `07-360x800-recipe-select.png` -- 360x800 representative, Pizza Select capricciosa

## 14. Master Catalog sync

Same PR. `data/recipes/pizza_master_catalog.json`: `capricciosa`'s `sourceReferences` ->
`["internal://src/data/recipes.ts#capricciosa"]`, `verificationStatus` ->
`"verified_internal"`, `gameDesignStatus` -> `"shipped"`, `currentGameRecipe` -> `true`;
`bakeProfile` left untouched (`{58, 78}`, already matched production verbatim).
`statusBreakdown`: `verified_internal` 13->14, `game_design_candidate` 15->14.
`data/recipes/ingredient_master_catalog.json`: `ham`/`black-olive` -> `existingInGame: true`,
`visualDistinctiveness: null`, `implementationCost: "none (shipped)"`, `reusePotential: "n/a
(already shipped)"` (matching the exact 1B-A sync pattern -- `mechanicDependency`/`notes`
dropped). `existingIngredientCount` 20->22, `newIngredientCount` 42->40 (`totalIngredientCount`
62 unchanged). **Not touched**: Meat Lovers, Supreme, Hawaiian, Ortolana, or any other
non-production candidate entry. `python3 tools/validate_recipe_catalog.py` -> all checks passed
both before and after.

## 15. Remaining Batch 1B

Not implemented in this PR (per Scope Guard): Meat Lovers, Supreme (both still
`game_design_candidate`/`currentGameRecipe: false` in the Master Catalog, ready for a future
Batch 1B-C style slice once independently audited against fresh `main`), Hawaiian, Ortolana,
Firebase, Ranking, new Shop UI, Dex filter, new cooking mechanic, scoring changes, economy
formula changes, Save schema changes, the pre-existing flaky test.

## 16. Final Verdict

**A. READY TO MERGE**

- Fresh main audited before and immediately before PR creation (Duplicate PR Gate #1 and #2),
  no conflicting in-flight work found either time.
- Capricciosa + ham + black-olive implemented using only existing mechanics/schema/authority
  (DOUGH/SAUCE/TOPPING/BAKE/RESULT, existing Completion Gate, existing Starter Grant floor
  semantics, existing Economy tiers).
- One real design correction made and test-caught: the Fresh Design audit's provisional
  ham x2/black-olive x3 proposal was rebalanced to x1/x2 to respect the existing 8-slot
  player-reference ring ceiling (`playerReference.test.ts`'s pre-existing collision regression
  test caught this before it ever reached a screen).
- Full verification green: 84/84 test files, 1691/1691 tests, Master Catalog validator, `tsc -b`,
  `oxlint`, production `build`, and a real-browser PASS playthrough with 0 console errors and 0
  horizontal overflow at both target viewport widths.
- The one known flaky test is confirmed byte-identical to `origin/main` and reproduces
  identically in isolation there too -- not a regression, not touched, per Scope Guard.
