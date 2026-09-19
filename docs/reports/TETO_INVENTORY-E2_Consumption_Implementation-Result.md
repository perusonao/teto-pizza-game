# Teto Pizza Game — Economy & Progression 1.0 EP2: Inventory Atomic Consumption (Result)

**Scope: EP2 only — inventory atomic consumption at `CONFIRM_BAKE`.** No EP1 Recipe Unlock
spec change, no `IngredientTray` stock placement gate, no Shop 2.0/restock, no starter-stock
grant (`starterStockPlays = 10`, EP4), no EP4, no Economy price/Pitz-formula change, no RESULT
2.0 work, no Save schema bump, no Recipe Master Catalog/production-recipe work, and no
production deploy were touched in this session, per instruction.

## 0. Audited state / branch / PR

- **Audited `origin/main` SHA**: `b784cd3164f412252d6e6b1d70b52a5ec665553b` ("Economy & Progression
  1.0 EP1: Recipe Unlock foundation (#80)"), confirmed fresh via `git fetch origin` at session
  start. This matched the SHA the task description cited as the "reference" — no drift found;
  the branch (`claude/inventory-e2-atomic-consumption-3uknx2`) was already `0 behind / 0 ahead` of
  this exact SHA.
- **Branch**: `claude/inventory-e2-atomic-consumption-3uknx2`.
- **PR**: [#82](https://github.com/perusonao/teto-pizza-game/pull/82) — left **OPEN**, not
  merged, per instruction.
- **HEAD SHA (this implementation)**: `ad7994b4c8f6b3a1eed53007fd9a278c4638f8ab`.
- **Changed files** (exactly 3 touched, 1 new): `src/state/inventory.ts`,
  `src/state/gameReducer.ts`, `src/state/inventory.test.ts` (extended),
  `src/state/gameReducer.inventoryConsumption.test.ts` (new), plus this report.

## 1. Fresh Audit (this session, no local EP2 Preflight file was available)

`docs/reports/TETO_INVENTORY-E2_Consumption_Preflight.md` (referenced by the task) does not
exist in this repository/branch — confirmed via `git fetch origin` + a glob search of
`docs/reports/` on the fresh `main` tip; no such file was ever committed. Per the task's own
fallback instruction, every "confirmed fact" the task description assumed a Preflight had already
established was independently re-verified from source in this session before writing any code:

| # | Assumed fact | Re-verified against | Result |
|---|---|---|---|
| 1 | `CONFIRM_BAKE` has no `phase !== "BAKE"` guard | `src/state/gameReducer.ts` line ~498 (pre-change) | **Confirmed** — the case unconditionally computed `pizza`/`bakeState`/`scoringV2Result`/`score` and set `phase: "RESULT"`, with zero phase check. |
| 2 | `pizza.toppings.filter(t => t.ingredientId === id).length` is the correct scatter-placement-count read | `src/state/pizzaState.ts`'s `PizzaState.toppings: PlacedTopping[]` (each `{id, ingredientId, x, y}`), and `gameReducer.ts`'s `PLACE_TOPPING` case (appends one entry per successfully placed piece, never merges/dedupes) | **Confirmed**, unchanged since Inventory E1. |
| 3 | `pizza.sauceIds[0] === id ? 1 : 0` is a reasonable spread/sauce consumption candidate | `gameReducer.ts`'s `APPLY_SAUCE`/`COMMIT_SAUCE_DISPENSE` cases: both always **replace** `sauceIds` with a single-element array (`sauceIds: [action.ingredientId]`) — the array is never length > 1 today | **Confirmed as a special case.** Implemented the more general "1 unit per distinct id present in `sauceIds`" instead of hard-coding index `[0]`, so a future multi-sauce pizza is handled correctly without another EP2-style revisit — behaviorally identical to `sauceIds[0] === id ? 1 : 0` today since the array is always length ≤ 1. |
| 4 | `!ingredient.unlockCondition` is the current unlimited/Starter test | `src/data/ingredients.ts`'s `STARTER_INGREDIENT_IDS` (`INGREDIENTS.filter(i => !i.unlockCondition)`) and `src/state/inventory.ts`'s pre-existing `hasStock`/`remainingStock` (both already gate on `ingredient.unlockCondition` presence) | **Confirmed, unchanged since E1.** Only `onion` has `unlockCondition` today; every other ingredient (13) is unconditionally unlimited. |
| 5 | Recipe-level `unlockCondition` (EP1) must not be used for consumption | `src/data/recipes.ts`'s `Recipe.unlockCondition` (EP1, orthogonal, `requiresRecipeId`/`minTotalStars` against `DexState`) vs. `src/data/ingredients.ts`'s `Ingredient.unlockCondition` (`minTotalStars` only, gates `ownedIngredientIds`/finite-stock semantics) | **Confirmed structurally distinct** — `consumePizzaInventory` (new) reads only `Ingredient.unlockCondition` via `getIngredient(id).unlockCondition`, never touches `Recipe.unlockCondition`/`recipeUnlocked`/`isRecipeAvailable` at all. |
| 6 | `ProgressionCarry`/`InventoryState` carry-through (E1) is already correct and complete | `gameReducer.ts`'s `ProgressionCarry` interface + its 5 construction sites (`buildOrderState`, `nextOrderState`, `nextMissionOrderState`, `startPreparingRecipe`, `createInitialGameState`) | **Confirmed unchanged and sufficient** — EP2 needed zero new carry-through sites; `inventory` already flows through every "start a new round" path from E1. Only `CONFIRM_BAKE` needed a new field write. |
| 7 | `persistence.ts` already reads/writes `inventory` generically | `PersistentSaveV2.inventory`, `sanitizeInventory`, `ProgressionSnapshot.inventory`, `persistProgress`'s `sameInventory`-guarded merge (all pre-existing, E0/E1) | **Confirmed, zero changes needed.** `App.tsx` already calls `persistProgress({..., inventory: state.inventory})` on every `state.inventory` change (E1) — EP2's `CONFIRM_BAKE`-produced `inventory` value persists through this exact same, unmodified path. |
| 8 | `1238/1238` tests / clean typecheck / clean lint / clean build on this exact `main` SHA | `npm ci && npx vitest run && npx tsc -b && npx oxlint && npm run build`, run directly in this session (not cited from a prior report) | **Confirmed**: 1238/1238 pass, 0 typecheck errors, 0 lint errors, build succeeds. |

**Conclusion**: no drift from what the task description assumed a Preflight would have found;
proceeded directly to implementation with the scope below.

## 2. Consumption transaction boundary

**`CONFIRM_BAKE` is the sole inventory-consumption transaction**, exactly per the SSOT. PREPARE-time
placement actions (`PLACE_TOPPING`, `APPLY_SAUCE`, `COMMIT_SAUCE_DISPENSE`) are completely
unmodified in this session — they still only mutate `state.pizza`, never `state.inventory`.
Consumption happens exactly once, inside `CONFIRM_BAKE`'s own case body, computed from the exact
canonical `pizza` that case already builds (`{ ...state.pizza, bakeResult: action.value }`) — the
same pizza Scoring 2.0 (`computeScoringV2`) scores in the same reducer step.

## 3. Scatter semantics

Implemented in the new pure function `consumePizzaInventory` (`src/state/inventory.ts`): every
`PlacedTopping` in `pizza.toppings` is tallied by `ingredientId`, and that **actual placed-piece
count** — never `Recipe.requiredIngredients[i].minCount` — is what gets subtracted from a finite
ingredient's stock. Verified directly: placing 5 onions against `fugazza` (whose own
`minCount` for onion is 4) consumes exactly 5, and placing 2 (below the recipe minimum) consumes
exactly 2 — both proven in `inventory.test.ts` and `gameReducer.inventoryConsumption.test.ts`.
An off-recipe finite ingredient placed via any current placement path would be consumed the same
way (the function reads only `pizza.toppings`, with no recipe-membership filter at all) — matches
the task's explicit "レシピ外の有限ingredientを配置可能な現行仕様が存在する場合も、実際の配置量を
正として扱う" instruction structurally, not as a special case.

## 4. Spread/sauce semantics

**1 pizza = 1 unit**, implemented as "1 unit per distinct id present in `pizza.sauceIds`" rather
than hard-coding `sauceIds[0]` — see Fresh Audit row 3 above for why this is behaviorally
identical to the `sauceIds[0] === id ? 1 : 0` candidate today (the array is always length ≤ 1,
since both `APPLY_SAUCE`/`COMMIT_SAUCE_DISPENSE` always fully replace it) while not needing
another revisit if a future slice ever allows more than one simultaneous sauce id. Verified that
an arbitrarily large `sauceDeposits` log (many dispense ticks) still consumes exactly 1 unit, not
one per deposit.

## 5. Unlimited-ingredient judgment

Reused `!ingredient.unlockCondition` exactly as the task specified, re-verified fresh against
today's `src/data/ingredients.ts` (Fresh Audit row 4) — structurally identical to the pre-existing
`hasStock`/`remainingStock` exemption already shipped in Inventory E1. An unknown ingredient id
(one `getIngredient` can't resolve at all) is treated the same as unlimited — never consumed —
since there is no stock concept to decrement for something not in the catalog.

## 6. EP1 vs. EP2 axis separation

`consumePizzaInventory` never imports or reads `Recipe.unlockCondition`, `recipeUnlocked`, or
`isRecipeAvailable` (`src/state/progression.ts`) — it takes only a `PizzaState` and an
`InventoryState`, and its one data-catalog read is `getIngredient(id).unlockCondition`
(`Ingredient`-scoped, EP0/E1-era field), never `Recipe.unlockCondition` (EP1-era field). The two
axes remain exactly as structurally separate as EP1's own Result report described.

## 7. Clamp-to-zero shortage policy

`remaining = Math.max(0, current - consumed)`, applied per-ingredient inside
`consumePizzaInventory`. A bake is never blocked by insufficient stock — no placement gate, no
Shop/restock work, and no `starterStockPlays` grant were added (all explicitly out of EP2 scope,
per the Scope Guard). Verified: placing 5 onions against a stock of 2 clamps to exactly 0, never
negative; consuming further against an already-0 stock stays at 0.

## 8. Exactly-once design (the fix for the known `phase` guard gap)

Added `if (state.phase !== "BAKE") { return state; }` as the first line of the `CONFIRM_BAKE`
case — the same shape as `REGISTER_TO_DEX`'s own pre-existing `state.phase !== "RESULT"` guard
(`gameReducer.ts`). This was independently re-confirmed missing in this session's own Fresh Audit
(row 1 above) before being added, exactly matching the task's stated known issue. Verified live:

- A first `CONFIRM_BAKE` dispatched from `"BAKE"` computes score + consumes inventory + advances
  to `"RESULT"`, as before.
- A second `CONFIRM_BAKE` dispatched against the resulting `"RESULT"` state returns the **exact
  same state object by reference** (`result === previousResult`) — no recomputation, no second
  inventory decrement.
- A `CONFIRM_BAKE` dispatched from any other phase (`ORDER`/`PREPARE`/`DISCOVERED`) is likewise a
  complete no-op.

## 9. Atomicity

`consumePizzaInventory` is a pure function: `(pizza: PizzaState, inventory: InventoryState) =>
InventoryState`. It tallies every finite ingredient's usage across both `toppings` and
`sauceIds` into one in-memory map first, then computes **one** next-`InventoryState` object from
the current `inventory` snapshot in a single pass — never applying per-ingredient updates as
separate sequential effects. `CONFIRM_BAKE` calls it once and folds the result into the same
`{ ...state, ..., inventory, phase: "RESULT" }` object literal that also carries `score`/
`bakeState`/`scoringV2Result`/`phase` — i.e. inventory consumption, scoring, and the phase
transition are all one state transition, with no intermediate state where only some of a
multi-ingredient bake's finite ingredients have been deducted. Verified directly with two
synthetic finite ingredients consumed together in one call (real shipped data has only one
finite ingredient, `onion` — see §14's test-data note).

Fails closed like every other public consumer of `PizzaState` at the Scoring 2.0 boundary: reused
`sanitizeToppings`/`sanitizeStringArray` (`../logic/scoringV2/boundary.ts`) so a malformed
`toppings`/`sauceIds` (non-array, or an element missing/wrong-typed `ingredientId`) drops the
offending entries rather than throwing — verified against the exact `malformedPizza` shape
`gameReducer.scoringV2Authority.test.ts` already exercises for Scoring 2.0 itself.

## 10. RETRY / PLAY_AGAIN

Neither `RETRY_SAME_RECIPE` nor `PLAY_AGAIN` was touched — both already carry `state.inventory`
forward via the pre-existing `ProgressionCarry` (E1) with zero code change needed. Verified live:
after a bake that consumes onion stock, both actions carry the already-decremented inventory
forward unchanged into the next round's `PREPARE` phase (never re-granting or re-consuming).

## 11. FREE / Lunch Rush

`CONFIRM_BAKE` is the one shared reducer case both FREE and Lunch Rush dispatch (unchanged from
before EP2) — consumption applies identically in both, verified with `isMissionRound: true` and
`false` fixtures producing the same decrement for the same pizza.

## 12. E1 / EP1 architecture preserved

No change to `InventoryState`, `ownedIngredientIds`, `Recipe.unlockCondition`,
`recipeUnlocked`, `isRecipeAvailable`, Pizza Select, Lunch Rush recipe filtering, persistence
sanitization, or the `ProgressionCarry` shape/sites. `hasStock`/`remainingStock` (E1) are
untouched — `consumePizzaInventory` is a new, separate export in the same file, not a
modification of either. No duplicated persistence/state was introduced; `ProgressionCarry`
already propagates `inventory` end to end.

## 13. Persistence compatibility

Zero changes to `src/state/persistence.ts`. `CONFIRM_BAKE`'s new `inventory` value flows out
through the exact same, pre-existing `App.tsx` → `persistProgress` → `sanitizeInventory` →
`localStorage` path E1 already built (confirmed live in the mobile walkthrough below: a 3-onion
Fugazza bake against a seeded `{onion: 5}` save persisted `{onion: 2}` to `localStorage`, and a
subsequent reload read that same `{onion: 2}` back correctly).

## 14. Tests

**17 new tests**, split across the pure-function layer and the reducer-integration layer, plus
confirmed zero regressions in the pre-existing 1238.

`src/state/inventory.test.ts` (extended, 8 new tests, `consumePizzaInventory` describe block):

1. Never consumes an unlimited (Starter) ingredient regardless of placed count.
2. Consumes exactly the placed piece count for a finite scatter ingredient — both above (5) and
   below (2) `fugazza`'s own onion `minCount` (4).
3. A finite spread/sauce ingredient consumes exactly 1 unit per pizza regardless of internal
   deposit count (40 synthetic deposits still consume 1 unit).
4. Multiple distinct finite ingredients consumed together, atomically, from one pure computation
   (and confirms the input `inventory` object is never mutated).
5. Clamps to 0 when placed count exceeds remaining stock — never negative, at multiple starting
   stock levels including already-0.
6. Returns the exact same `inventory` reference when the pizza uses no finite ingredient at all
   (no spurious object churn on an all-Starter round).
7. A malformed pizza (`toppings: null`, `sauceIds: "not-an-array"`) never throws and consumes
   nothing.
8. An unknown ingredient id (not in the catalog) is never consumed.

**Test-data note** (tests 3 and 4 above): today's shipped `INGREDIENTS` catalog has exactly one
finite (`unlockCondition`-bearing) ingredient, `onion` — itself scatter/topping, not spread/sauce.
Testing "a finite spread/sauce consumes 1/pizza" and "multiple distinct finite ingredients
consume atomically" both need fixture data this shipped catalog doesn't have (a finite sauce, or
a second finite ingredient at all). Rather than adding real player-visible ingredients to
production data purely to make these two rules testable — explicitly out of EP2's scope, no
content/economy change — `inventory.test.ts` mocks two synthetic finite fixture ingredients for
`consumePizzaInventory`'s own pure-function tests only, via `vi.mock("../data/ingredients", ...)`
with a fallback to the real catalog for every other id. This mock is scoped to that one test file
and does not affect `gameReducer.inventoryConsumption.test.ts` or any other test file, all of
which use only real shipped data (`onion`, Margherita's Starter set).

`src/state/gameReducer.inventoryConsumption.test.ts` (new, 9 tests):

1. Consumes exactly the placed piece count on the first `CONFIRM_BAKE`, not the recipe's
   `minCount` (5 onions placed against `fugazza`, minCount 4 → consumes 5).
2. A second `CONFIRM_BAKE` dispatched against the resulting `RESULT` state is a no-op — same
   state reference, no double consumption.
3. A `CONFIRM_BAKE` dispatched from any phase other than `BAKE` (e.g. `PREPARE`) is a no-op.
4. `RETRY_SAME_RECIPE` after a bake carries the already-consumed inventory forward unchanged.
5. `PLAY_AGAIN` after a bake carries the already-consumed inventory forward unchanged.
6. FREE mode: consumption applies normally.
7. Lunch Rush: consumption applies identically to a Mission round (same shared reducer path).
8. Inventory shortage clamps to 0 at `CONFIRM_BAKE` time.
9. An all-Starter pizza (Margherita), played through a full real `PREPARE` walkthrough (not the
   direct-injection pattern), never touches inventory at all.

**EP1 Recipe Unlock / persistence regression**: not re-tested with new dedicated cases — verified
via the existing, untouched suites (`progression.test.ts`, `pizzaSelect.test.ts`,
`recipes.test.ts`, `persistence.test.ts`, and `gameReducer.test.ts`'s own "inventory
carry-through" describe block) all still passing unchanged in the full run below, since EP2 does
not modify any file those suites cover except `gameReducer.ts`'s `CONFIRM_BAKE` case (which none
of the EP1/persistence suites dispatch in a way the new `phase` guard or consumption call could
affect — confirmed by the full green run, not just by inspection).

**Full test count**: **1255/1255 pass** (65 test files) — up from the pre-session baseline of
1238/1238 (PR #80), +17 net new tests from this slice, **0 regressions**.

## 15. Validation

- **typecheck** (`npx tsc -b`): ✅ clean, 0 errors.
- **lint** (`npx oxlint`): ✅ clean, exit 0.
- **focused tests** (`inventory.test.ts` + `gameReducer.inventoryConsumption.test.ts`): ✅ 23/23
  pass.
- **full test suite** (`npx vitest run`): ✅ **1255/1255 pass**, 65 test files, 0 regressions.
- **build** (`npx tsc -b && vite build`): ✅ succeeds, no warnings.
- **Mobile verification (390×844, Playwright/Chromium against `vite dev`)**:
  - Seeded a `PersistentSaveV2` with all of Chapter 1's chain discovered through
    quattro-formaggi, `onion` OWNED, `inventory: { onion: 5 }`.
  - HOME → 「ピザを作る」→ selected フガッサ (available, chain+★12 satisfied) → PREPARE.
  - DOUGH: a real circular drag-stretch gesture satisfied the size-completion CTA gate → SAUCE.
  - SAUCE: selected オリーブオイル, tapped the dough → applied (fugazza's own required sauce) →
    CHEESE (fugazza requires no cheese, confirmed by the recipe data — advanced with no
    placement needed) → TOPPING.
  - TOPPING: paginated to the tray's page 2/2, selected たまねぎ, placed **exactly 3** onion
    pieces at well-separated points (visually confirmed 3 onion emoji on the dough).
  - `localStorage`'s persisted save read `{ onion: 5 }` **before** `CONFIRM_BAKE` (PREPARE-time
    placement never touches inventory, confirmed live, not just by unit test).
  - Tapped 焼く！ → BAKE → tapped 取り出す！ (`CONFIRM_BAKE`) → RESULT/DISCOVERED (★1, 生焼け, a
    real gameplay outcome, unrelated to EP2).
  - `localStorage`'s persisted save read `{ onion: 2 }` **after** `CONFIRM_BAKE` — exactly
    `5 - 3 = 2`, confirming the finite ingredient decreased by the actual placed count, exactly
    once, and that the reducer's in-memory result was correctly persisted through the unmodified
    E1 persistence path.
  - A follow-up reload with that same `{ onion: 2 }` save round-tripped correctly (persistence
    regression check).
  - No console errors or page errors during the full walkthrough.
  - No horizontal overflow observed on Pizza Select/PREPARE/BAKE/RESULT at 390px width
    (screenshots captured at each step).
- **GitHub CI status**: ✅ confirmed green — PR #82's `build` check run
  (`.github/workflows`, run [35411158462](https://github.com/perusonao/teto-pizza-game/actions/runs/35411158462/job/105810925088))
  completed with conclusion `success` at `2026-09-19T00:59:57Z`, checked live via the GitHub API
  after the docs-fixup push (`8817c68`).
- **Production deploy**: none made, per instruction.

## 16. Scope creep check

None found. Diff touches exactly: `src/state/inventory.ts` (new `consumePizzaInventory` export,
additive — `hasStock`/`remainingStock` untouched), `src/state/gameReducer.ts` (the `CONFIRM_BAKE`
case only: one new `phase` guard + one new `consumePizzaInventory` call + one field added to the
returned object literal — no other case touched), and two test files (one extended, one new). No
`IngredientTray`/Shop/restock/starter-stock/EP4/Pitz/Save-schema/Recipe-catalog file appears in
the diff anywhere.

## 17. Known risk (onion / EP3 dependency — explicitly not a blocker for EP2)

**Carried forward from the task's own Preflight-equivalent note, independently re-confirmed
true under this implementation, not newly introduced by it**: a migrated player whose `onion`
inventory sits at exactly `DEFAULT_MIGRATION_RESTOCK_QTY = 4` (the v1→v2 migration backfill,
`src/state/persistence.ts`) who then plays `fugazza` once, placing the recipe's own minimum of 4
onion pieces, will have their onion inventory driven to exactly 0 by this session's own
`consumePizzaInventory` — a real, reachable state under EP2. Since Shop 2.0 restock (EP3) does
not exist yet, that player cannot currently replenish onion and will be unable to place any
onion piece on a subsequent `fugazza` attempt until EP3 ships (`IngredientTray` still gates only
on `ownedIngredientIds`, not stock, so the tray itself doesn't yet block or warn about this —
also explicitly EP3's job, not built here per the Scope Guard). This is an intended, temporary
intermediate state under the EP2→EP3 sequencing the SSOT itself describes (§4.1's loop:
"在庫減少 → Shopで補充"), not a defect in this session's implementation — **EP3 is the resolution**,
and this is flagged here exactly as instructed, not silently absorbed into a broader fix.

## 18. Unresolved issues

None blocking EP2's own scope. The onion/EP3 dependency (§17) is a known, explicitly-flagged
carry-forward, not an EP2 defect. No other gap was found in this session's Fresh Audit or
verification pass.

## 19. EP3 dependencies

- EP3 (Shop 2.0 restock/purchase) is the resolution to §17's known risk — once
  `purchaseIngredient`/`ShopOverlay` can credit `inventory[id]` by a batch quantity (per the
  Fresh Design §12), a player whose finite stock has been driven to 0 by this session's
  `CONFIRM_BAKE` consumption can recover through the Shop exactly as designed.
- EP3 can build directly on `consumePizzaInventory`'s existing `InventoryState` shape and
  `hasStock`/`remainingStock` (E1) without any further change to this session's own code —
  EP2 deliberately does not add an `IngredientTray` placement gate or any UI surface for low/zero
  stock, per the Scope Guard; that is EP3's own, separate slice.

## FINAL VERDICT

**B. READY WITH MINOR FOLLOW-UP.**

EP2's own scope (atomic, exactly-once inventory consumption at `CONFIRM_BAKE`, clamp-to-zero,
scatter-by-placed-count, spread-by-per-pizza-unit, unlimited-ingredient exemption, E1/EP1
architecture preservation) is fully implemented, tested (1255/1255, +17 net new), typechecked,
linted, built, and manually verified end-to-end on a 390×844 mobile viewport with real finite-
ingredient consumption observed and persisted correctly. The "minor follow-up" is exactly §17's
already-known, already-flagged onion/EP3 dependency — an intended intermediate state the SSOT
itself describes as resolved by EP3, not a defect introduced or left unaddressed by this session.
Per instruction, this PR is left **OPEN**, not merged, regardless of verdict.
