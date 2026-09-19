# Teto Pizza Game — Economy & Progression 1.0 EP3: Shop 2.0 / Inventory Restock (Result)

**Scope: EP3 only — Shop restock transaction + a minimal placement-time Stock Gate.** No Recipe
Master production/new recipes, no `starterStockPlays = 10` starter grant (EP4), no Recipe
Unlock condition change, no Economy-wide price redesign, no Pitz reward redesign, no RESULT 2.0,
no Save schema bump, and no production deploy were touched in this session, per instruction.

## 0. Audited state / branch / PR

- **Audited `origin/main` SHA**: `c3741810cf2fce96a6cc2f422e919d9aa471b1ec` ("docs: Recipe Master
  Catalog 160 -- fresh data-first analysis (read-only, verdict A) (#81)"), confirmed fresh via
  `git fetch origin` at session start — matches the reference SHA the task cited exactly, no
  drift found. `main` has EP1 (`b784cd3`, #80) and EP2 (`397ad41`, #82) merged, plus the Recipe
  Master Catalog audit (`c374181`, #81, docs-only, verdict A) on top — neither EP1 nor EP2 nor
  #81 needed any further reconciliation for this slice.
- **Branch**: `claude/ep3-shop-inventory-restock-7nu0ao` (already existed, 0 commits ahead of
  `origin/main` at session start — created fresh from the cited SHA).
- **PR**: opened against `main` in this session (see link below) — left **OPEN**, not merged,
  per instruction.
- **HEAD SHA (implementation commit)**: `b0a6257a227620b9303fe9ce2453267efd860f3c`. This report
  is committed on top of it as its own commit; the PR's final head is whichever of the two
  commits is newest at push time (both are part of the same PR).
- **Changed files** (implementation commit, 13 files, 1 new):
  - `src/data/ingredients.ts` — new `restockQuantity` field; `onion.restockQuantity = 12`.
  - `src/state/inventory.ts` — new `canPlaceIngredient` (Stock Gate).
  - `src/logic/economy.ts` — new `restockIngredient` transaction + `RestockFailureReason`.
  - `src/state/gameReducer.ts` — new `RESTOCK_INGREDIENT` case; Stock Gate wired into
    `PLACE_TOPPING`/`APPLY_SAUCE`/`COMMIT_SAUCE_DISPENSE`.
  - `src/components/ShopOverlay.tsx` — restock row (stock/qty/price/CTA) for owned finite
    ingredients; new `inventory`/`onRestock` props.
  - `src/App.tsx` — `handleRestockIngredient`, wired to `ShopOverlay`.
  - `src/App.css` — `.shop-item__restock*` styles.
  - `src/logic/economy.test.ts`, `src/state/inventory.test.ts`, `src/state/gameReducer.test.ts`,
    `src/state/persistence.test.ts`, `src/App.test.tsx` — extended.
  - `src/state/gameReducer.restock.test.ts` — new.
  - This report (`docs/reports/TETO_ECONOMY-PROGRESSION_EP3_Shop-Restock_Result.md`) — second
    commit.

---

## 1. Fresh Audit (pre-implementation, read-only)

Read directly before any code change: the Economy & Progression 1.0 SSOT
(`docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md`,
`docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md`), the EP1 and EP2 Result reports,
`src/data/ingredients.ts`, `src/state/inventory.ts`, `src/logic/economy.ts`,
`src/components/ShopOverlay.tsx`, `src/components/IngredientTray.tsx`, `src/state/gameReducer.ts`
(PLACE_TOPPING/APPLY_SAUCE/COMMIT_SAUCE_DISPENSE/CONFIRM_BAKE/PURCHASE_INGREDIENT/
RETRY_SAME_RECIPE/PLAY_AGAIN cases), `src/state/persistence.ts`, `src/state/progression.ts`,
`src/App.tsx`.

### 1.1 Existing Shop / purchase architecture

- **`purchaseIngredient`** (`src/logic/economy.ts`) is an **exactly-once unlock** transaction:
  `LOCKED`/`AVAILABLE_TO_BUY`/`OWNED` (`ingredientState`, `src/state/progression.ts`) is derived
  purely from `ownedIngredientIds` + `totalStars`; a purchase moves an ingredient
  `AVAILABLE_TO_BUY -> OWNED` exactly once — calling it again on an already-`OWNED` ingredient
  always returns `ALREADY_OWNED`, by design. **There was no restock concept anywhere in shipped
  code before this session** — `ShopOverlay`'s `OWNED` branch rendered a static `✓ 購入済み`
  checkmark with no further interaction.
- **`SHOP_PRODUCTS`** (`ShopOverlay.tsx`) is `INGREDIENTS.filter(i => i.unlockCondition)` — i.e.
  every ingredient with a Mastery/finite gate. **Today that is exactly one ingredient: `onion`.**
  Every other ingredient (13) has no `unlockCondition` and is therefore permanently,
  unconditionally unlimited (`STARTER_INGREDIENT_IDS`) — Starter ingredients have never appeared
  in the Shop list at all, before or after this session.
- **`ownedIngredientIds`** vs. **`InventoryState`** (Save v2 / Inventory E1, `src/state/inventory.ts`)
  are already structurally separate axes: the former answers "can this ever be placed at all,"
  the latter "how many uses remain" (only meaningful for a finite, `unlockCondition`-bearing
  ingredient). EP1/EP2 both preserved this split; EP3 does too.
- **`consumePizzaInventory`** (EP2, `CONFIRM_BAKE` only) is the sole existing consumption point;
  it clamps to 0 and never blocks a bake. **`IngredientTray`** (audited directly) filters its
  displayed items only by `ownedIngredientIds.includes(id)` — **it does not read `inventory` or
  gate on stock at all**, confirmed by reading its full prop list and render body. This
  reproduces EP2's own already-flagged "known risk" (§17 of the EP2 report): a finite ingredient
  driven to 0 stock could still be freely placed in PREPARE before this session.

### 1.2 Unlock-Shop vs. restock-Shop separation (this task's central architectural question)

The audit confirms the two concerns were already cleanly separable in the existing code, needing
no refactor of `purchaseIngredient`/`ingredientState`/`isRecipeAvailable`:

| Concept | Existing owner | Reused as-is by EP3? |
|---|---|---|
| "Can this be placed at all" (LOCKED/AVAILABLE_TO_BUY/OWNED) | `ingredientState`, `ownedIngredientIds` | Yes, unchanged — restock never mutates `ownedIngredientIds`. |
| "Exactly-once unlock purchase" | `purchaseIngredient`, `PURCHASE_INGREDIENT` | Yes, unchanged — restock is a **new**, separate, repeatable transaction, never routed through this. |
| "How many uses remain" | `InventoryState`, `hasStock`/`remainingStock` (E1/E2) | Yes, unchanged — restock only ever adds to `inventory[id]`. |
| Consumption | `consumePizzaInventory` (`CONFIRM_BAKE` only) | Yes, unchanged. |

**Conclusion**: no part of the existing "unlock Shop" needed to change to add a "restock Shop" —
they are additive, parallel transactions over already-separate state, exactly as the task
required (§2 "Shop がunlock/購入 Shop として作られている部分とrestockに再利用できる部分を分離").

### 1.3 Price / pack quantity — SSOT source, and a scope boundary this audit surfaced

The SSOT (`TETO_ECONOMY-PROGRESSION-1_MATRIX.md` §2 / Fresh Design §6.2) has a **confirmed,
already-decided** restock table for **11** non-Starter ingredients (mushroom, garlic, oregano,
egg, pesto, cherry-tomato, olive-oil, gorgonzola, parmigiano, fontina, onion) — batch size and
Pitz price for each. However, **only `onion` exists in shipped `INGREDIENTS` data with
`unlockCondition`/`pricePitz` set at all.** The other 10 ingredients in that SSOT table are
currently Starter (`!unlockCondition`, unconditionally unlimited, always `OWNED`) — giving them
`unlockCondition`/`pricePitz`/a finite-stock identity is explicitly **EP4's** job (the
`starterStockPlays` free-grant slice, per the Fresh Design's own §12 slice table), not EP3's.

**This is not a blocker requiring a product decision** (no new price was invented, and the one
already-confirmed value — onion, 120 Pitz / 12 units, unchanged from its existing `pricePitz`) —
it is a scope boundary: **EP3's restock mechanism is built generically** (any ingredient with
`unlockCondition` + `pricePitz` + the new `restockQuantity` is restockable), but **only `onion`
is restockable in shipped data today**, exactly matching the task's own framing ("既に
unlock/owned済みの有限ingredient" — today, that set has exactly one member). This is called out
explicitly here rather than silently assumed, per instruction §12.

- `onion.pricePitz` — **unchanged** at `120` (already shipped, Phase 3C-6).
- `onion.restockQuantity` — **new field, `12`**, taken directly from the SSOT's already-decided
  "Restock batch" column for onion (`TETO_ECONOMY-PROGRESSION-1_MATRIX.md` §2 row), not invented.

### 1.4 Unlimited-ingredient semantics reused (not Recipe.unlockCondition)

Reused exactly the existing distinction, structurally identical to EP2's own re-verification:
`Ingredient.unlockCondition` (ingredient-scoped, gates `ownedIngredientIds`/finite-stock/
`hasStock`) vs. `Recipe.unlockCondition` (EP1, recipe-scoped, `requiresRecipeId`/`minTotalStars`
against `DexState`, gates `recipeUnlocked`/`isRecipeAvailable`). `restockIngredient` and
`canPlaceIngredient` (both new, this session) read only `Ingredient.unlockCondition` — neither
imports or references `Recipe.unlockCondition`/`recipeUnlocked`/`isRecipeAvailable` at all,
exactly like EP2's `consumePizzaInventory` before them.

### 1.5 Stock placement gate — Fresh Audit finding

Confirmed live in `IngredientTray.tsx` (full read): its item list is filtered **only** by
`ownedIngredientIds.includes(id)`; it receives no `inventory` prop and performs no stock check
anywhere. Combined with `gameReducer.ts`'s `PLACE_TOPPING`/`APPLY_SAUCE`/`COMMIT_SAUCE_DISPENSE`
cases (also fully read): none of the three previously checked stock either — only
`phase`/`makingStep`/category/`ownedIngredientIds`. **Confirmed reproducible**: a finite
ingredient at 0 stock could be placed without limit before this session (EP2's own §17 risk).
This session adds the minimal Stock Gate described in §4 below.

---

## 2. Restock transaction (`restockIngredient`, `src/logic/economy.ts`)

A **new, separate** pure function from `purchaseIngredient` — never merged into it (see §1.2's
table). Contract:

```
restockIngredient({ ingredient, ownedIngredientIds, inventory, pitzBalance })
  -> { success: true, nextInventory, nextPitzBalance }
  -> { success: false, reason: "NOT_OWNED" | "UNLIMITED" | "NOT_FOR_SALE" | "INSUFFICIENT_FUNDS" }
```

- **Owned-only**: rejects `NOT_OWNED` for an ingredient not yet in `ownedIngredientIds` (covers
  both LOCKED and AVAILABLE_TO_BUY — a Shop purchase must land first).
- **Finite-only**: rejects `UNLIMITED` for any ingredient with no `unlockCondition` (every
  Starter ingredient) — unconditionally, regardless of Pitz balance.
- **Valid batch/price required**: rejects `NOT_FOR_SALE` if `pricePitz`/`restockQuantity` is
  absent, zero, negative, fractional, or `NaN` (mirrors `purchaseIngredient`'s own
  `isValidPrice`).
- **Atomic**: on success, `nextInventory[id] = inventory[id] + restockQuantity` and
  `nextPitzBalance = pitzBalance - pricePitz` are computed together in one pure return value;
  on any failure, **neither** field is touched — no partial-success state exists.
- **Repeatable** (the one deliberate difference from `purchaseIngredient`): restocking an already
  `OWNED` ingredient is the *normal*, expected case — every successful call can be followed by
  another.

### Wiring (`gameReducer.ts`'s new `RESTOCK_INGREDIENT` case)

Same shape as the existing `PURCHASE_INGREDIENT` case: looks up the ingredient, calls
`restockIngredient`, applies the whole result or returns `state` unchanged on failure. **Atomic
Pitz/inventory transaction, one reducer step.**

### Double-dispatch safety

No new locking/idempotency mechanism was added — none was needed. `useReducer` (React's own
dispatch queue) already applies actions strictly sequentially against the already-updated state,
the same guarantee `purchaseIngredient`'s own doc comment relies on. A genuine double-tap
dispatches `RESTOCK_INGREDIENT` twice; the second sees the *first*'s already-debited
`pitzBalance`/already-credited `inventory`, so it either succeeds again at the (now real) second
charge or fails on `INSUFFICIENT_FUNDS` — it can never apply one tap's charge twice. Verified
directly (`gameReducer.restock.test.ts`, "is repeatable... two sequential dispatches both apply,
no double-charge from either alone"; `economy.test.ts`, "a double-tap sequence... is not a
special case").

### Insufficient-Pitz behavior

Confirmed atomic: `pitzBalance` and `inventory` are both **completely unchanged** on
`INSUFFICIENT_FUNDS` (`economy.test.ts`, `gameReducer.restock.test.ts`). No partial charge, no
partial credit.

### Unlimited-ingredient behavior

`restockIngredient` rejects every Starter ingredient with `UNLIMITED` unconditionally (tested
against all 13 real `STARTER_INGREDIENT_IDS`, not just a mock). The Shop UI never offers a
restock CTA for one either, since `SHOP_PRODUCTS` already excludes every ingredient without
`unlockCondition` (§1.1) — Starter ingredients simply never reach the OWNED-row branch that would
need an "∞, no CTA" treatment. This makes the SSOT's "Unlimitedは∞、補充CTAを出さない" requirement
true by construction rather than by an added conditional (there is nothing to special-case: the
list this row lives in structurally excludes unlimited ingredients).

---

## 3. Stock Gate (`canPlaceIngredient`, `src/state/inventory.ts`)

A **reservation/limit check only** — never a consumption. `CONFIRM_BAKE`'s `consumePizzaInventory`
(EP2, untouched) remains the sole place inventory is decremented.

- **Scatter** (cheese/topping): `alreadyPlaced = pizza.toppings.filter(t => t.ingredientId ===
  id).length`, recomputed fresh from the live `pizza` on every call — never a separate counter
  that could drift. Gated via the pre-existing `hasStock(ingredient, inventory, alreadyPlaced)`
  (E1/E2, unmodified). Wired into `PLACE_TOPPING`: a placement that would make `alreadyPlaced`
  reach or exceed remaining stock is rejected using the **same existing** `"rejected"` placement-
  feedback path the "no open spot" case already used (the `✕` mark PizzaStage already renders) —
  no new UI code needed for this signal.
- **Spread/sauce**: re-applying/continuing to dispense the pizza's *already-active* sauce id
  costs no new unit (`pizza.sauceIds.includes(id)` short-circuits to allowed); only a **fresh**
  application (a first pick, or switching to a different sauce) is gated on
  `hasStock(ingredient, inventory, 0)`. Wired into `APPLY_SAUCE` and, for `COMMIT_SAUCE_DISPENSE`,
  only on `isFreshApplication`. **No shipped spread/sauce ingredient is finite today** (only
  `onion`, scatter/topping) — this branch is real code, exercised by unit tests via synthetic
  fixtures (mirroring EP2's own test-data note), not yet reachable through any real in-game item.
- **Unlimited ingredients**: completely unaffected — `hasStock` returns `true` unconditionally
  for any ingredient with no `unlockCondition`, exactly as before.

### Responsibility separation (placement = reservation, CONFIRM_BAKE = consumption)

Preserved exactly as required: `canPlaceIngredient` never writes to `state.inventory` — verified
directly (`gameReducer.restock.test.ts`, "never decrements inventory itself... a rejected or
accepted placement leaves state.inventory untouched"). `consumePizzaInventory` (EP2) is
byte-for-byte unchanged in this session.

### Scatter placement/stock consistency

Verified: placing up to exactly the remaining stock succeeds; the `(stock+1)`th placement of the
same finite ingredient is rejected, keeping `pizza.toppings`'s placed count for that ingredient
always `<=` its remaining stock for the whole PREPARE phase (`gameReducer.restock.test.ts`,
"placed count can never exceed stock").

---

## 4. Shop UI (`ShopOverlay.tsx`, mobile 390×844)

No large-scale redesign — the existing `SHOP_PRODUCTS`/`shop-item` structure, category-less flat
list, and `.dex-overlay` container are all unchanged. Only the `OWNED` branch's content changed:

- **Before**: a static `✓ 購入済み` checkmark, no further interaction.
- **After**: a restock row — ingredient name/emoji (existing), **在庫 N**（`remainingStock`）,
  **+N**（`restockQuantity`）, **N Pitz**（`pricePitz`）, and a **補充する** button, `disabled`
  when `pitzBalance < pricePitz` (same disabled-button pattern the existing AVAILABLE_TO_BUY
  "購入" button already used — no new insufficient-funds copy was added, matching that
  precedent). A separate, component-local restock feedback message ("📦 ◯◯を12補充しました！")
  mirrors the existing purchase-feedback pattern, gated on the credit having actually landed
  (never shows on a rejected/insufficient-funds tap).
- Since `SHOP_PRODUCTS` already excludes every unlimited ingredient (§1.1), no unlimited
  ingredient ever reaches this branch — the "∞, no CTA" requirement holds structurally.

Verified live at 390×844 (Playwright/Chromium, §7): 在庫/+N/price/CTA all render legibly, the CTA
disables correctly under insufficient Pitz, and the restock credit/debit and feedback message
all appear correctly after a tap.

---

## 5. EP2 integration

`consumePizzaInventory` (EP2) is untouched — 0 lines changed in this session. The full
consume→restock→consume loop was verified both at the unit/reducer level
(`gameReducer.restock.test.ts`, "EP2 -> EP3 integration" describe block: bake onion to exactly 0
→ Stock Gate blocks a new placement → `CLAIM_MISSION_REWARD` + `RESTOCK_INGREDIENT` → onion
placeable again → a second bake consumes from the restocked stock, ending at `{ onion: 8 }` from
`12 - 4`) and live in a real browser (§7).

---

## 6. EP1 regression

`Recipe.unlockCondition`/`recipeUnlocked`/`isRecipeAvailable` (EP1) were not touched — 0 lines
changed. The full pre-existing suite (`progression.test.ts`, `pizzaSelect.test.ts`,
`recipes.test.ts`, `App.test.tsx`'s locked-card tests, etc.) passes unchanged in the full run
(§8). No new EP1-specific test was added, since nothing in this diff can affect that axis
(confirmed by the green full run, not just by inspection, per EP1/EP2's own precedent).

---

## 7. Persistence / Save compatibility / FREE / Lunch Rush / mobile verification

- **Persistence**: zero changes to `src/state/persistence.ts`. `RESTOCK_INGREDIENT`'s
  `inventory`/`pitzBalance` output is the exact same shape `PURCHASE_INGREDIENT`/`CONFIRM_BAKE`
  already produce, flowing through the unmodified `persistProgress`/`sanitizeInventory` path.
  Added one explicit round-trip test (`persistence.test.ts`, "roundtrips a restocked
  ingredient's inventory count") to close the loop rather than leave it purely inferred.
- **Save schema**: **no bump** — `schemaVersion` stays `2`, no new persisted field. Restock only
  ever writes into the already-existing `inventory`/`pitzBalance` fields.
- **RETRY_SAME_RECIPE / PLAY_AGAIN**: both already carry `state.inventory`/`state.pitzBalance`
  forward via the pre-existing `ProgressionCarry` (E1/EP1) with zero new code — verified directly
  (`gameReducer.restock.test.ts`, "survives RETRY_SAME_RECIPE"/"survives PLAY_AGAIN").
- **FREE / Lunch Rush**: `RESTOCK_INGREDIENT` is not mode-gated (Shop is reached from HOME, not
  from an in-round screen, for either mode) — verified the reducer transaction itself behaves
  identically for `isMissionRound: true` and `false` (`gameReducer.restock.test.ts`).
- **Mobile verification (390×844, Playwright/Chromium against `vite dev`)**: seeded a save with
  onion owned, `inventory: { onion: 2 }`, `pitzBalance: 150`, Chapter-1 chain discovered through
  quattro-formaggi. Full walkthrough, 13/13 checks passed:
  1. Reached PREPARE for フガッサ, completed DOUGH/SAUCE/CHEESE.
  2. TOPPING: placed exactly 2 onion (the seeded stock) — succeeded.
  3. A 3rd onion placement was **rejected** (piece count stayed at 2, the `✕` reject mark
     rendered) — Stock Gate confirmed live, not just in unit tests.
  4. Baked → RESULT (onion consumed to exactly 0).
  5. HOME → Shop: showed **在庫 0** and a **補充する** CTA for onion.
  6. Tapped 補充する → Shop updated to **在庫 12**, balance **150 → 30** (120 Pitz spent).
  7. Started a new フガッサ round → onion was placeable again (1 piece placed successfully).
  8. No console/page errors during the whole walkthrough; no horizontal overflow at 390px.

---

## 8. Tests / validation

- **New/extended test files**: `src/logic/economy.test.ts` (+16 `restockIngredient` tests),
  `src/state/inventory.test.ts` (+7 `canPlaceIngredient` tests), `src/state/gameReducer.test.ts`
  (1 existing test updated for the new Stock Gate precondition, doc-commented why),
  `src/state/persistence.test.ts` (+1), `src/App.test.tsx` (+4, Shop UI restock rendering/CTA/
  insufficient-funds/not-owned), `src/state/gameReducer.restock.test.ts` (new, 20 tests: restock
  transaction wiring, Stock Gate on `PLACE_TOPPING`, and the full EP2→EP3 integration loop).
- **Required scenario checklist** (task §10, all covered):
  1. Finite owned ingredient restocks ✅ (`economy.test.ts`, `gameReducer.restock.test.ts`)
  2. Increases by exactly `restockQuantity` ✅
  3. Decreases by exactly `pricePitz` ✅
  4. Insufficient Pitz rejects atomically ✅
  5. Neither field changes on rejection ✅
  6. Unlimited ingredient can't be restocked ✅
  7. Locked/unowned ingredient can't be restocked ✅ (`NOT_OWNED`, covers both LOCKED and
     AVAILABLE_TO_BUY)
  8. Restock persists ✅ (`persistence.test.ts`)
  9. Survives RETRY ✅
  10. Survives PLAY_AGAIN ✅
  11. EP2 consumption → restock → consumption ✅
  12. FREE mode ✅
  13. Lunch Rush ✅
  14. EP1 regression ✅ (full suite green, unchanged EP1 files)
  15. Save compatibility ✅ (no schema bump, round-trip test)
  16. Stock Gate: stock=0 blocks placement ✅
  17. Scatter placed count never exceeds stock ✅
  18. Unlimited ingredient placement unaffected ✅
- **typecheck** (`npx tsc -b`): ✅ clean, 0 errors.
- **lint** (`npx oxlint`): ✅ clean, exit 0.
- **focused tests**: all new/modified files green (159/159 across `economy.test.ts`,
  `inventory.test.ts`, `gameReducer.restock.test.ts`, `gameReducer.inventoryConsumption.test.ts`,
  `persistence.test.ts`; 104/104 across `App.test.tsx`, `gameReducer.test.ts`,
  `App.playerReference.test.tsx`).
- **full test suite** (`npx vitest run`): ✅ **1298/1298 pass**, 65 test files — up from EP2's
  1255/1255 baseline, **+43 net new tests, 0 regressions**.
- **build** (`npx tsc -b && vite build`): ✅ succeeds, no warnings.
- **CI status**: pending — see the created PR for live check results (not fabricated here).

### A real pre-existing test's premise changed (expected, not a defect)

`gameReducer.test.ts`'s "PLACE_TOPPING succeeds for onion once it is OWNED" assumed ownership
alone was sufficient to place a finite ingredient — true before this session, no longer true
after the Stock Gate ships (ownership **and** stock `> 0` are both now required). Updated the
test to seed `{ onion: 1 }` inventory so it keeps testing what it always tested (the *ownership*
boundary), with the *stock* boundary now covered separately in `gameReducer.restock.test.ts`.
This is the one behavior change the Stock Gate makes to existing semantics, called out explicitly
here rather than silently absorbed into the diff.

---

## 9. Scope creep check

None found beyond what §1.3 already flags as an explicit, non-blocking scope boundary (EP4's 10
ingredients not touched). Diff touches exactly: `ingredients.ts` (1 new field + 1 new value on
`onion` only), `inventory.ts` (1 new additive export), `economy.ts` (1 new additive export),
`gameReducer.ts` (1 new case + 3 existing cases gain a Stock Gate check each, no other case
touched), `ShopOverlay.tsx`/`App.tsx`/`App.css` (restock UI only), plus test files and this
report. No Recipe Master, no new recipe, no starter-grant code, no `starterStockPlays` constant,
no Recipe Unlock condition change, no Economy-wide repricing, no Pitz formula change, no RESULT
2.0, no Save schema bump, no production deploy anywhere in the diff.

---

## 10. Unresolved decisions / EP4 dependencies

- **EP4's own scope, unaffected by this session**: giving the other 10 ingredients
  (mushroom/garlic/oregano/egg/pesto/cherry-tomato/olive-oil/gorgonzola/parmigiano/fontina)
  `unlockCondition`/`pricePitz`/`restockQuantity`, plus the `starterStockPlays = 10` free-grant
  transaction on recipe unlock, remain entirely EP4's job. EP3's `restockIngredient`/
  `canPlaceIngredient`/Shop UI are all written generically against *any* ingredient with
  `unlockCondition` — EP4 does not need to touch any EP3 code to make those 10 ingredients
  restockable/stock-gated once it gives them the right data shape.
- **No other open product decision.** The one already-confirmed price/pack pair this session
  needed (onion, 120 Pitz / 12 units) was used verbatim from the SSOT, unchanged.

---

## FINAL VERDICT

**A. EP3 COMPLETE — READY FOR MERGE REVIEW.**

The play → consume → out-of-stock → Shop → restock → play-again loop is fully implemented,
tested (1298/1298, +43 net new, 0 regressions), typechecked, linted, built, and verified live at
390×844 end to end, including the Stock Gate blocking an over-placement and the Shop CTA
correctly crediting/debiting. Per instruction, this PR is left **OPEN**, not merged, regardless
of verdict.
