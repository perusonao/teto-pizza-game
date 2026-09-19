# Teto Pizza Game — Economy & Progression 1.0 EP4: Starter Stock / Exactly-Once Grant (Result)

**Scope: EP4 only — free Starter Grant on Recipe #2–#7 unlock, exactly-once ledger, and the
finite/restockable data these ingredients now need.** No EP3 redesign, no Shop price redesign
beyond the new ingredients this slice itself makes purchasable-by-restock, no Pitz reward
redesign, no Recipe Unlock condition change, no 53/160-catalog production, no new recipes, no
RESULT 2.0, no Lunch Rush UX change, no Making-flow tab work, no Pizza Select visual redesign, no
Ranking, and no Test-Achievement-Reset UI — per the task's own Scope Guard. Reset *compatibility*
(not the Reset feature itself) is designed and tested.

## 0. Audited state / branch / PR

- **Audited `origin/main` SHA**: `29ccc65146d8750fc229b9f1fa9b745c4bf9e541` ("Economy &
  Progression 1.0 EP3: Shop 2.0 restock + placement Stock Gate (#83)"), confirmed fresh via
  `git fetch origin` at session start — matches the task's cited reference SHA exactly, no drift.
- **Branch**: `claude/ep4-starter-stock-grant-9ivbmy` (pre-existing, 0 commits ahead of
  `origin/main` at session start).
- **PR**: to be opened against `main` from this branch — **left OPEN, not merged**, per
  instruction.
- **HEAD SHA**: `f6c014a57eecc358ab2c572203573ddcecab453a` (two commits on top of the audited
  SHA: `7787473` the implementation, `f6c014a` a same-session fixup correcting restock prices
  against a design SSOT missed in the first Fresh Audit pass — see §2.6). This report is a third,
  separate commit.
- **Changed files** (25, 2 new, vs. the audited SHA):
  - `src/state/starterStock.ts` — **new**. `STARTER_STOCK_PLAYS_CHAPTER_1` constant,
    `applyStarterGrants` (the one exactly-once grant transaction).
  - `src/state/starterStock.test.ts` — **new**, 21 tests.
  - `src/data/ingredients.ts` — `unlockCondition`/`pricePitz`/`restockQuantity`/new
    `starterGrantOnly` flag on the 10 previously-Starter ingredients this slice makes finite;
    `onion`'s own comment updated (data unchanged).
  - `src/logic/economy.ts` — `purchaseIngredient` rejects a `starterGrantOnly` ingredient
    (`NOT_FOR_SALE`) as a reducer-boundary defense, mirroring this codebase's existing
    ownership-boundary style.
  - `src/components/ShopOverlay.tsx` — product list is now a per-render `shopProducts(
    ownedIngredientIds)` function (was a module-level constant) so a `starterGrantOnly`
    ingredient is hidden until owned.
  - `src/state/gameReducer.ts` — new `GameState.starterGrantClaimedRecipeIds` field; wired into
    `ProgressionCarry`/`createInitialGameState`; `REGISTER_TO_DEX`/`MISSION_NEXT_ORDER` now call
    `applyStarterGrants` immediately after their own `dex` change.
  - `src/state/persistence.ts` — `PersistentSaveV2.starterGrantClaimedRecipeIds` (no schema
    version bump — see §8), sanitizer, `ProgressionSnapshot`/`persistProgress` wiring.
  - `src/App.tsx` — load-time migration catch-up call to `applyStarterGrants` before
    `createInitialGameState`; persistence effect extended.
  - 16 existing test files updated for the ripple this causes (`STARTER_INGREDIENT_IDS` shrinking
    13→3 breaks any fixture that relied on a now-finite ingredient being trivially owned) — full
    list and reasoning in §9.
  - This report.

---

## 1. Fresh Audit (pre-implementation, read-only)

Read directly before any code change: `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`,
`docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md`, `docs/reports/
TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md`, the EP1/EP3 Result reports, `src/data/recipes.ts`,
`src/data/ingredients.ts`, `src/state/{progression,inventory,dex,gameReducer,persistence}.ts`,
`src/logic/economy.ts`, `src/components/ShopOverlay.tsx`, `src/state/pizzaSelect.ts`, `src/App.tsx`.

**Correction note**: my first pass read the *Fresh Design report* narrative closely but did not
open `docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md` (the machine-readable companion table)
before implementing restock prices — I derived a plausible but wrong "10 Pitz/unit" formula for
the 10 newly-finite ingredients' restock prices. This was caught by re-reading the matrix before
finalizing and fixed in a same-session follow-up commit (`f6c014a`, §2.6). Flagging this
explicitly per the task's own instruction not to silently self-correct without disclosure.

### 1.1 What already existed (EP1/EP2/EP3)

- **`Recipe.unlockCondition`** (EP1, `src/data/recipes.ts`): `recipeUnlocked()` is a pure function
  of `DexState` only — `requiresRecipeId` (chain discovery) AND/optionally `minTotalStars`. The
  chain: margherita → funghi → marinara → bismarck → genovese → quattro-formaggi (+8★) → fugazza
  (+12★). **Unchanged by this slice.**
- **`Ingredient.unlockCondition`** (`{ minTotalStars }`): today, only `onion` has it. Every other
  ingredient (13) has none and is therefore **unconditionally OWNED and unconditionally
  unlimited** (`ingredientState`'s own `!unlockCondition → OWNED` fallback; `hasStock`/
  `consumePizzaInventory`/`remainingStock` all key off the same field to decide "finite at all").
  This single field is EP4's central lever and its central risk (§4).
- **`isRecipeAvailable`** = `recipeUnlocked(recipe, dex) AND` every `requiredIngredients` id
  `∈ ownedIngredientIds`. Pre-EP4, this ingredient-ownership axis was **already trivially
  satisfied for every recipe except フガッサ** (every ingredient but `onion` was unconditionally
  owned) — フガッサ was the *only* recipe where ownership ever mattered. EP4 makes this axis
  genuinely load-bearing for #2–#6 too.
- **EP2's `consumePizzaInventory`** (`CONFIRM_BAKE` only) and **EP3's `canPlaceIngredient`**
  (placement-time Stock Gate) / `restockIngredient` (Shop restock transaction) are both already
  keyed purely on `ingredient.unlockCondition` presence — giving an ingredient `unlockCondition`
  is sufficient, on its own, to make it participate in both systems correctly. **Neither needed
  any code change for EP4** — only new *data* on 10 more ingredients.
- **No "recipe just unlocked" event exists anywhere.** `recipeUnlocked`/`isRecipeAvailable` are
  pure re-derivations from `dex`, recomputed on every read — there is no reducer transition
  called "unlock funghi." This is the reason a naive `if (recipeUnlocked) grant` is impossible to
  place correctly (and explicitly forbidden by the task) — see §5.

### 1.2 The Margherita/shared-ingredient conflict (must-report finding)

`tomato-sauce` and `mozzarella` are required by Margherita **and** by several other recipes
(funghi, marinara, bismarck, genovese, quattro-formaggi all use one or both). Margherita's own
materials must stay **permanently unlimited** (explicit requirement) — but `InventoryState` is a
single ingredient-keyed pool, not per-recipe, so there is no way to make `tomato-sauce` finite
"for funghi" while leaving it unlimited "for margherita." **Resolution, reported rather than
silently decided**: `tomato-sauce`/`mozzarella` (and `basil`, margherita's third ingredient, used
by no other recipe but included for the same reason) **stay permanently Starter/unlimited**
forever — `STARTER_INGREDIENT_IDS` shrinks from 13 to exactly these 3, never to 0. A recipe's
Starter Grant simply never produces an inventory entry for these three ids (skipped the same way
`consumePizzaInventory` already skips any non-`unlockCondition` ingredient). This exactly matches
`docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md`'s own row for these three ("n/a — permanently
unlimited"), confirming the derivation independently before I found that document's explicit
answer.

---

## 2. `starterStockPlays` and the grant calculation

### 2.1 The constant

```ts
// src/state/starterStock.ts
export const STARTER_STOCK_PLAYS_CHAPTER_1 = 10;
```

One named constant, read at every call site, never inlined. Named `..._CHAPTER_1` (not just
`STARTER_STOCK_PLAYS`) per the design matrix's own §4 forward-compatibility note: a future
catalog expansion is expected to make this tier-scoped (illustrative table: starter/early = 10,
mid = 5, late = 3, master = 0–3) — **not implemented here** (explicit scope guard), but the name
is chosen so that future change never needs to touch this one's call sites, only add siblings.

### 2.2 The derivation (fully data-driven, no per-recipe magic numbers)

```ts
// starterGrantForRecipe (src/state/starterStock.ts), for each of recipe.requiredIngredients:
if (!ingredient.unlockCondition) continue;               // unlimited (tomato-sauce/mozzarella/basil) — skip
amount = ingredient.placement === "scatter"
  ? req.minCount * STARTER_STOCK_PLAYS_CHAPTER_1          // scatter: pieces/pizza × 10 plays
  : STARTER_STOCK_PLAYS_CHAPTER_1;                        // spread/sauce: 1 use/pizza × 10 plays
```

This is exactly "Recipe ingredient requirement × starterStockPlays," computed live from
`Recipe.requiredIngredients`/`Ingredient.placement` — never a hand-authored per-recipe table, so
it can never drift from the recipe data itself. Verified against every recipe's own current
`minCount`/`placement` (`src/data/recipes.ts`, `src/data/ingredients.ts`): every value it produces
matches `docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md`'s own table exactly (mushroom 30,
garlic 30, oregano 20, egg 10, pesto 10, cherry-tomato 30, olive-oil 10, gorgonzola/parmigiano/
fontina 20 each, onion 40) — **no placement/minCount mismatch was found for any of the 7 recipes**
(the one deliberate divergence — margherita's own 3 ingredients staying unlimited rather than
receiving a computed grant — is the §1.2 finding above, not a mismatch).

### 2.3 Shared-ingredient additive behavior

`oregano` (marinara `minCount:2`, fugazza `minCount:1`) and `olive-oil` (quattro-formaggi/fugazza,
both `minCount:1`) each receive **two separate additive credits** as their respective recipes
unlock, never overwritten: marinara's unlock credits `oregano += 20`; fugazza's own later unlock
credits `oregano += 10` on top, for 30 total once both are unlocked. Same recipe re-processed
(idempotency) never re-adds its own share (§5). Verified in `starterStock.test.ts`'s "shared
ingredient additive grant" test and the fugazza-grant test (`olive-oil`/`oregano` land at 20/30
respectively, from prior-grant fixtures of 10/20).

### 2.4 Fugazza / onion

`onion ×40` (`minCount:4 × 10`) — no exception, computed by the exact same formula as every other
scatter ingredient. This is the one behavior change to an *already-shipped* ingredient: pre-EP4,
`onion`'s only path to `OWNED` was a mandatory 120-Pitz Shop purchase once `totalStars ≥ 12`; EP4
adds a **free, additive** grant the moment フガッサ itself unlocks (chain + 12★), crediting both
`ownedIngredientIds` and `inventory.onion += 40` in the same transaction. See §7 for what was
deliberately left unchanged.

### 2.5 Margherita exemption

`margherita` is excluded from `applyStarterGrants`'s own recipe loop unconditionally (a named
`STARTER_GRANT_EXEMPT_RECIPE_ID` constant, not an inline string check) — it is always unlocked and
its own three ingredients are permanently unlimited, so a grant for it would be structurally
inert. Verified: `starterGrantClaimedRecipeIds` never contains `"margherita"` even after every
other recipe unlocks (`starterStock.test.ts`).

### 2.6 Fresh-Audit correction: restock prices

My own initial implementation derived `restockQuantity`/`pricePitz` for the 10 newly-finite
ingredients from a formula extrapolated from `onion`'s own EP3 numbers (3 plays/restock, a flat
10 Pitz/unit). Every `restockQuantity` this produced happened to already match
`TETO_ECONOMY-PROGRESSION-1_MATRIX.md`'s own "Restock batch" column exactly, but the flat
10-Pitz/unit price rule does **not** match that document's own non-uniform "Restock price"
column. Corrected in commit `f6c014a` to the matrix's exact values:

| Ingredient | Restock qty | Restock price (Pitz) — **now matches the matrix exactly** |
|---|---|---|
| mushroom | 9 | 60 |
| garlic | 9 | 60 |
| oregano | 6 | 45 |
| egg | 3 | 45 |
| pesto | 3 | 60 |
| cherry-tomato | 9 | 60 |
| olive-oil | 3 | 50 |
| gorgonzola | 6 | 70 |
| parmigiano | 6 | 70 |
| fontina | 6 | 70 |
| onion | 12 | 120 (unchanged, EP3) |

No further "invented" economy numbers remain in this slice — every price/quantity for the 10 new
finite ingredients is now sourced from the pre-existing design SSOT, not derived by me.

---

## 3. Exactly-once architecture

### 3.1 The core problem

`recipeUnlocked(recipe, dex)` is a pure re-derivation, recomputed on *every* read (Pizza Select
card render, Shop preview, `isRecipeAvailable`, order selection) — there is no single "the recipe
just unlocked" event to hang a grant on. A naive `if (recipeUnlocked) grant` would re-grant on
every one of those reads. The task explicitly forbids this and requires "recipe currently
unlocked" and "Starter Grant ever claimed" to be two separate, independently persisted concepts.

### 3.2 The design: an idempotent function + a persistent ledger

`applyStarterGrants(dex, ownedIngredientIds, inventory, claimedRecipeIds)`
(`src/state/starterStock.ts`) is a **pure, idempotent** function: for every recipe that is (a) not
margherita, (b) `recipeUnlocked(recipe, dex)`, and (c) **not already in `claimedRecipeIds`**, it
grants once and adds the recipe id to the ledger. A recipe already in the ledger is *never*
re-evaluated, regardless of what `recipeUnlocked` currently says. A no-op call returns its exact
input objects back by reference (not just equal by value) — every one of its callers can invoke
it unconditionally, on every relevant transition, with no extra "did anything change" branching
and no risk of a spurious re-render/re-persist from a call that granted nothing.

This means **"exactly once" is a property of the ledger, not of when/how often the function is
called** — the correctness burden is entirely on this one pure function, verified directly and
repeatedly in `starterStock.test.ts`, rather than on getting some clever set of call sites exactly
right.

### 3.3 Where it is actually called (and why exactly these three places)

`dex` only ever changes in two reducer cases plus at load:

1. **`REGISTER_TO_DEX`** (FREE) — immediately after `registerScoreToDex`, in the same state
   transition, before `phase` moves to `DISCOVERED`.
2. **`MISSION_NEXT_ORDER`** (Lunch Rush) — immediately after its own `registerScoreToDex` call,
   before `nextMissionOrderState` builds the next round.
3. **App.tsx's load-time initializer** — once, before `createInitialGameState`, against the
   loaded save's `dex`/`ownedIngredientIds`/`inventory`/`starterGrantClaimedRecipeIds`. This is
   the **migration catch-up** path (§8) and also covers "reload"/"app restart" directly.

**Why not inside `buildOrderState`/`createInitialGameState` themselves** (the one common funnel
every "start a new round" path — PLAY_AGAIN, RETRY_SAME_RECIPE, SELECT_RECIPE, MISSION_RESET_ORDER
— already shares)? Two independent reasons ruled this out:

- **A real ordering bug it would introduce**: `SELECT_RECIPE`'s reducer case checks
  `isRecipeAvailable` (which requires the *target ingredient already owned*) **before** calling
  `startPreparingRecipe`/`buildOrderState`. If the grant only ran inside `buildOrderState`, a
  player could never actually reach the funghi/marinara/etc. PREPARE screen via Pizza Select the
  *first* time — `isRecipeAvailable` would reject it as unavailable (mushroom not owned yet)
  before the grant that would have made it available ever ran. The grant has to land at the exact
  moment `recipeUnlocked` itself flips (a Dex change), strictly before any later action reads
  `ownedIngredientIds`.
- **Test-suite semantics**: this codebase's existing test suite constructs many `GameState`
  fixtures via `createInitialGameState(someAlreadyUnlockedDex, someDeliberatelySmallerOwnedSet,
  …)` specifically to exercise `isRecipeAvailable`'s ingredient-ownership axis *in isolation* from
  how ownership was obtained (e.g. "fugazza is LOCKED even once its chain/stars gate holds, because
  onion isn't owned yet" — `progression.test.ts`, `pizzaSelect.test.ts`, `gameReducer.test.ts`).
  Auto-granting inside `createInitialGameState` would silently inject ownership into every one of
  these fixtures, changing what they test without their authors' intent. `createInitialGameState`
  is documented as a deliberately pure passthrough for exactly this reason (its own doc comment);
  the migration catch-up is one explicit call site in App.tsx instead.

### 3.4 What "exactly once" was verified against (all in `starterStock.test.ts` /
`gameReducer.test.ts` unless noted)

| Scenario (task's required list) | How verified |
|---|---|
| reload / app restart | App.tsx's load-time call re-run twice against the same save → byte-identical, confirmed live via Playwright (§12) |
| HOME↔Pizza Select round-trip | No GameAction is dispatched by navigation alone — nothing to re-trigger; asserted in the reducer-integration test |
| PLAY_AGAIN | `applyStarterGrants` not called by this case at all (only carries `starterGrantClaimedRecipeIds` through) — asserted |
| RETRY_SAME_RECIPE | same — asserted |
| FREE/Lunch Rush mode switch (MISSION_RESET_ORDER) | same — asserted |
| Recipe re-selection (SELECT_RECIPE) | same — asserted |
| Shop open/close (PURCHASE_INGREDIENT/RESTOCK_INGREDIENT) | neither case calls `applyStarterGrants` — asserted |
| Dex re-render/recomputation | `recipeUnlocked`/`isRecipeAvailable` are pure reads with no side effects — nothing to re-trigger |
| migration | see §8 |
| save/load | `persistProgress`/`loadSave` round-trip the ledger byte-for-byte (`persistence.test.ts`) |
| same-recipe double-processing | `applyStarterGrants` called twice in a row with its own prior output → second call's `grantedRecipeIds` is `[]`, every returned field reference-equal to the first call's |

---

## 4. Shared inventory / ownership behavior

- Inventory remains one **shared, ingredient-keyed pool** (`InventoryState`, unchanged shape) —
  never per-recipe. A Starter Grant credits `inventory[id] += amount`; two different recipes
  crediting the same id both land, additively (§2.3), and re-processing the *same* recipe never
  re-adds its share (the ledger check happens before any inventory math runs at all — it isn't
  possible for the same recipe to be double-counted even transiently).
- A grant also adds every one of that recipe's finite ingredients to `ownedIngredientIds` **in
  the same transaction** — necessary because `APPLY_SAUCE`/`PLACE_TOPPING`'s own ownership gate
  reads `ownedIngredientIds` list membership directly (not `ingredientState`), so a grant that
  only touched `inventory` would leave a fully-stocked ingredient still unplaceable.

---

## 5. `starterGrantOnly` — a new field, and why it exists

Giving an ingredient `unlockCondition` is a **dual-purpose** signal in the existing code: it marks
an ingredient "finite" (read by `hasStock`/`canPlaceIngredient`/`consumePizzaInventory`/
`remainingStock`) **and** it makes `ingredientState` compute a LOCKED/AVAILABLE_TO_BUY/OWNED
tri-state that `ShopOverlay` renders as a manual-purchase row. EP4 needs the first (10 ingredients
must become finite/restockable) but explicitly **not** the second (none of the 10 was ever meant
to be independently purchasable pre-unlock — they're free via the grant, full stop). Overloading
`unlockCondition` for both would have either (a) let a player manually buy e.g. `mushroom` for
Pitz before `funghi` ever unlocks (once `totalStars` cleared whatever threshold), or (b) required
inventing a real `minTotalStars` threshold for 10 ingredients with no product basis for one.

**Fix**: a new boolean `Ingredient.starterGrantOnly` flag, checked in exactly two places:
`ShopOverlay`'s product list (hides the row entirely — no LOCKED/AVAILABLE_TO_BUY state is ever
shown — until the ingredient is owned) and `purchaseIngredient` (rejects with `NOT_FOR_SALE` as a
reducer-boundary defense against a stray/direct `PURCHASE_INGREDIENT` dispatch, independent of
what the UI does or doesn't wire up — matching this codebase's existing "never trust the UI
alone" discipline). `unlockCondition.minTotalStars` on these 10 rows is therefore inert data
(`{ minTotalStars: 0 }`) — documented as such in `ingredients.ts`, never actually read/acted on
before the grant lands. All finite/Stock-Gate/restock logic (`hasStock`, `consumePizzaInventory`,
`restockIngredient`, `STARTER_INGREDIENT_IDS`) is completely unaffected by this new field — it
continues to key purely on `unlockCondition`'s presence, unchanged from EP1–EP3.

`onion` deliberately does **not** set `starterGrantOnly` — see §7.

---

## 6. Margherita unlimited behavior (verified)

`tomato-sauce`/`mozzarella`/`basil` never gain `unlockCondition` — `hasStock`/`remainingStock`
for them return `true`/`"UNLIMITED"` unconditionally regardless of `inventory` contents, and
`applyStarterGrants` never produces an inventory entry for them (§1.2, §2.2). Verified directly
(`starterStock.test.ts`'s "Margherita exemption" suite) and via the full EP1/EP2 regression suite
continuing to pass unmodified for every margherita-only test.

---

## 7. Fugazza / onion behavior — what changed, what didn't, and one flagged decision

**Changed**: フガッサ's unlock now *also* triggers a free, additive Starter Grant —
`ownedIngredientIds` gains `onion` and `inventory.onion += 40`, at the exact moment
`recipeUnlocked(fugazza, dex)` first becomes true (chain + 12★), with no Pitz required.

**Unchanged (deliberately, per "既存価格を変更しない")**: `onion.unlockCondition = { minTotalStars:
12 }`, `pricePitz: 120`, `restockQuantity: 12` are byte-identical to EP3's shipped values. The
Shop restock transaction (`RESTOCK_INGREDIENT` → `restockIngredient`) is completely untouched.

**Flagged product decision (not resolved here)**: `onion` still keeps its original Phase 3C-6
*manual purchase* path (`purchaseIngredient`, Shop's `AVAILABLE_TO_BUY` row) alongside the new
grant — I did **not** set `starterGrantOnly` on it. Two considered options:

- **(a) Keep both paths** (what this implementation does): the manual purchase becomes vestigial
  in ordinary play (by the time フガッサ's own gate is satisfied, the grant has already landed),
  reachable only in the edge case where `totalStars` crosses 12 *before* `quattro-formaggi` is
  discovered (chain and stars-threshold conditions can decouple since totalStars accrues from any
  recipe). Harmless if reached — pays real Pitz for something about to be free, no double-grant,
  no exploit — but is a second, redundant way to reach the same end state.
- **(b) Retire it** (set `starterGrantOnly: true` on `onion` too, exactly like the other 10 rows):
  more literally matches the design SSOT's repeated "no exception, same rule as every other
  recipe" language, but would retire/rewrite several pre-existing, currently-passing Phase
  3C-6/EP3 regression tests that explicitly pin the manual-purchase mechanic
  (`economy.test.ts`'s "onion (Phase 3C-6) is LOCKED, not ALREADY_OWNED..." /"...becomes
  purchasable once totalStars/pitzBalance clear its real production requirement", plus a
  `gameReducer.test.ts` `PURCHASE_INGREDIENT`+onion test) — a larger, EP3-touching footprint the
  task's own Scope Guard ("EP3再設計をしない") argues against taking on inside this slice.

I chose **(a)** as the minimal, scope-respecting option and am flagging **(b)** explicitly as a
product decision for a future slice, per the task's own "flag rather than silently decide"
instruction. This is the primary reason this report's verdict is **B**, not **A** (§14).

---

## 8. Save / schema decision and migration behavior

**Schema**: `starterGrantClaimedRecipeIds: string[]` added directly to `PersistentSaveV2`,
**without bumping `schemaVersion`** (stays `2`). This follows the exact precedent
`ownedIngredientIds`/`pitzBalance`/`missionBest` already set in Phase 3C-2 (fields reserved in the
v1 shape, sanitized-with-empty-default, before any phase actually wrote non-default values into
them) — an additive, backward-tolerant field, not a shape change requiring a migration transform.
`sanitizeStarterGrantClaimedRecipeIds` treats an absent/non-array/malformed value as `[]`,
per-entry tolerant (an unknown/non-string id is dropped, not the whole array).

**Migration behavior (existing-player fairness vs. no-infinite-grant, both required)**: App.tsx's
load-time initializer runs `applyStarterGrants(save.dex, save.ownedIngredientIds, save.inventory,
save.starterGrantClaimedRecipeIds)` **once, before `createInitialGameState`**, and persists
whatever it returns on the very next `persistProgress` write. For a pre-EP4 save:
`starterGrantClaimedRecipeIds` always reads back `[]` (the field never existed), so any recipe
already `recipeUnlocked` per that player's existing `dex` gets its Starter Grant backfilled
**exactly once**, on the very first post-upgrade load — an existing player who already unlocked
funghi/marinara/etc. before this build shipped is never left holding an unlocked-but-unmakeable
recipe. Because the same function gates on the ledger it's given, a *second* load (or a save that
already has entries in the ledger) is a complete no-op — verified live (§12) and in
`persistence.test.ts`'s dedicated EP4 ledger-persistence suite (round-trip, pre-EP4-absent-field,
v1→v2 migration, malformed-entry sanitization, and the `persistProgress` no-op/write-triggers
tests).

**Migration for `PersistentSaveV1`**: `migrateV1toV2` sets `starterGrantClaimedRecipeIds: []`
explicitly (never invented as "already claimed") — the same App.tsx catch-up call then backfills
it correctly on load, identically to a pre-EP4 v2 save.

---

## 9. EP1/EP2/EP3 regression, and why so many test files needed updates

**No EP1/EP2/EP3 production logic changed** — `recipeUnlocked`, `isRecipeAvailable`,
`consumePizzaInventory`, `canPlaceIngredient`, `restockIngredient`, `purchaseIngredient`'s
LOCKED/AVAILABLE_TO_BUY/OWNED/ALREADY_OWNED/INSUFFICIENT_FUNDS paths are all byte-identical to
`origin/main`. What changed is **data**: `STARTER_INGREDIENT_IDS` shrinking from 13 to 3 means
every existing test fixture that constructed an "available recipe"/"placeable ingredient"
scenario by relying on `STARTER_INGREDIENT_IDS` alone (e.g. "own `STARTER_INGREDIENT_IDS`, expect
funghi/marinara/bismarck/… to already be available/placeable") no longer holds, since 10 of those
13 ids are no longer trivially owned. This is the **intended, load-bearing consequence** of EP4
(these ingredients are supposed to require ownership now) — the fix in every case was updating
the fixture to explicitly own (and, where the fixture exercises actual placement/baking, stock)
the specific non-Starter ingredient(s) that test's own recipe needs, never touching the assertion
being tested. 16 test files needed this treatment:

`data/ingredients.test.ts`, `data/orders.test.ts`, `data/recipes.test.ts`,
`state/progression.test.ts`, `state/pizzaSelect.test.ts`, `screens/PizzaSelectScreen.test.tsx`,
`state/gameReducer.test.ts`, `state/gameReducer.commitSauceDispense.test.ts`,
`state/gameReducer.restock.test.ts`, `state/gameReducer.pitzReward.test.ts`,
`state/persistence.test.ts`, `state/phase4a1a.regression.test.ts`,
`state/phase4a1b.regression.test.ts`, `components/PizzaStage.sauceReset.test.tsx`,
`components/IngredientTray.palette.test.tsx`, `screens/GameScreen.keyboard{Overlay,
SpreadRepeat}.test.tsx`.

Two specific, real (not fixture-only) behavior changes surfaced and are now pinned as regression
tests rather than left as surprises:

- **`gameReducer.test.ts`'s "inventory carry-through" suite**: a from-scratch margherita play's
  own `REGISTER_TO_DEX`/`MISSION_NEXT_ORDER` now *also* grants funghi's Starter Stock in the same
  transition (since discovering margherita is exactly what unlocks funghi) — three tests renamed
  and their expected inventory updated to include the new `mushroom: 30` grant, additive to
  whatever inventory the test had already seeded.
- **`gameReducer.restock.test.ts`'s full EP2↔EP3 product-goal-loop test**: its own fixture pizza
  uses `olive-oil` as its sauce, which is now finite — `CONFIRM_BAKE` correctly starts tracking
  its consumption too (clamped to 0, since no olive-oil stock was ever seeded in that fixture).
  Three exact-equality inventory assertions updated to include `"olive-oil": 0`.

**EP1 unlock regression**: `recipeUnlocked`'s own chain/stars-gate test suite
(`progression.test.ts`'s `recipeUnlocked` describe block) is completely untouched and still
passes byte-for-byte — EP4 never touches this axis.

**EP2 consumption regression**: `gameReducer.inventoryConsumption.test.ts` (EP2's own dedicated
suite) is completely untouched and passes unmodified.

**EP3 restock/Stock-Gate regression**: `gameReducer.restock.test.ts`'s dedicated `RESTOCK_INGREDIENT`
tests and the placement-time Stock Gate tests are untouched except the one fixture correction
above; all pass.

---

## 10. Future Achievement Reset compatibility

Per the task's explicit forward-compatibility requirement: "is this recipe currently unlocked"
(`dex`-derived, via `recipeUnlocked`) and "has this recipe's Starter Grant ever been claimed"
(`starterGrantClaimedRecipeIds`) are two separate, independently-persisted fields by
construction — `applyStarterGrants` only ever reads the ledger to decide whether to act, never
`recipeUnlocked` alone. A future Reset feature (not built here) is therefore safe **as long as it
follows one contract, stated explicitly for that future implementer**: reset `dex`/Dex-derived
Mastery state only; never clear `ownedIngredientIds`, `inventory`, or
`starterGrantClaimedRecipeIds`, for the same reason Shop purchases are already permanent
("purchases are permanent" — SSOT). Verified directly: resetting `dex` back to `EMPTY_DEX` while
carrying the ledger/ownership/inventory forward, then re-discovering margherita again, produces
`grantedRecipeIds: []` on every subsequent `applyStarterGrants` call — no re-grant, no matter how
many times the underlying recipe becomes "unlocked" again (`starterStock.test.ts`'s "future
Achievement Reset compatibility" suite).

---

## 11. FREE / Lunch Rush

Both call `applyStarterGrants` at the exact same point in their own Dex-registration flow
(`REGISTER_TO_DEX` for FREE, `MISSION_NEXT_ORDER` for Lunch Rush) — verified end-to-end via a real
PREPARE→BAKE→RESULT margherita round played through the actual reducer for each mode
(`starterStock.test.ts`'s reducer-integration suite), confirming both grant funghi's Starter Stock
identically and neither double-applies when the other mode is also exercised afterward
(`MISSION_RESET_ORDER` round-trips in the "never re-grant" test).

---

## 12. Tests

- **New**: `src/state/starterStock.test.ts` — 21 tests (constant value, Margherita exemption ×3,
  Recipe #2–#7 grant amounts ×6 covering every recipe including the fugazza/onion/additive case,
  scatter-vs-spread derivation ×2, exactly-once ×3, future-reset-compatibility ×1,
  reducer-integration ×5 covering FREE/Lunch Rush/PLAY_AGAIN/RETRY/SELECT_RECIPE/HOME/mode-switch/
  Shop-open-close/Stock-Gate-after-exhaustion).
- **New**: `src/state/persistence.test.ts`'s EP4 ledger-persistence suite — 6 tests (round-trip,
  pre-EP4-absent-field backfill, v1→v2 migration, malformed-entry sanitization, non-array
  fallback, no-op-vs-write-triggered-by-ledger-alone).
- **Updated**: 16 files, ~40 individual test bodies, per §9 — every change either adds explicit
  ownership/stock to a fixture (never touching what it asserts) or updates an assertion to reflect
  a genuinely new, intended behavior (the two cases called out in §9).
- **Mapped against the task's required 25-item test list**: items 1–9, 11–25 all have a direct,
  named test (STARTER_STOCK_PLAYS_CHAPTER_1 = 10; Margherita no-grant/unlimited; #2 first-unlock
  grant; #3–#7 grants; scatter/spread derivation; Fugazza onion = 40; reload/PLAY_AGAIN/RETRY/
  HOME/mode-switch/Shop-open-close no-double-grant; shared-ingredient additive; same-recipe
  no-double-add; Save round-trip; migration; EP1–EP3 regressions; Stock-Gate-after-exhaustion;
  FREE; Lunch Rush; future-reset-compatibility). Item 10 ("RETRY 二重grantなし") is covered by the
  same reducer-integration test as item 9 (PLAY_AGAIN), since both are exercised in one combined
  "never re-grant after REGISTER_TO_DEX" scenario rather than a separate test each — functionally
  equivalent coverage, noted here for traceability rather than silently merged.

**Full suite**: `npm run test` → **66 test files, 1325 tests, all passing** (was 1298 on
`origin/main`; +27 new: +21 `starterStock.test.ts`, +6 persistence ledger tests; a handful of
existing "carries X unchanged" tests were renamed/updated in place to their post-grant
equivalents rather than duplicated, so the count above is exactly additive).

**Typecheck**: `npx tsc -b --force` → clean, no errors.

**Lint**: `npm run lint` (oxlint) → clean, exit 0.

**Build**: `npm run build` → succeeds (`tsc -b && vite build`), bundle size effectively unchanged
(332.24 kB → 332.24 kB JS, gzip 104.44–104.45 kB; the ~14 KB of new ingredient/grant data and
logic is well within normal minification noise for this bundle).

---

## 13. Mobile verification (390×844, Playwright + the pre-installed Chromium)

Ran the dev server locally and drove it with Playwright at the 390×844 viewport (screenshots
captured, not attached to this report but reproducible from the commands below):

1. **Fresh state → Margherita → Recipe #2 unlock → Starter Stock confirmed → reload → no
   double-grant**: seeded `localStorage` with a **pre-EP4-shaped save** (schemaVersion 2, no
   `starterGrantClaimedRecipeIds` field at all, margherita already discovered, `ownedIngredientIds`
   still Starter-only, empty inventory) — exactly what an existing player's browser holds the
   moment this build first loads. First reload: `ownedIngredientIds` gained `mushroom`,
   `inventory.mushroom === 30`, `starterGrantClaimedRecipeIds === ["funghi"]` — the migration
   catch-up fired correctly. Second reload: byte-identical save (`JSON.stringify` equality) — no
   re-grant.
2. **UI correctness**: HOME renders normally (レシピ 1/7, 0 Pitz). Pizza Select correctly shows
   フンギ as a **NEW, enabled** card (was previously LOCKED pre-grant) while マリナーラ/ビスマルク/
   etc. remain correctly LOCKED with their own chain hints, and フガッサ remains the mystery `？？？`
   card with a star-progress hint — none of Pizza Select's own rendering logic needed touching for
   this to be correct, confirming `isRecipeAvailable`'s existing two-axis AND is doing the right
   thing once ownership is granted. Tapping フンギ correctly lands on its own PREPARE/DOUGH screen.
   Shop correctly lists every one of the 10 newly-finite ingredients as OWNED-with-restock rows
   (在庫 0, +qty, price) once seeded as owned, at the exact restock prices from §2.6's corrected
   table.
3. **Not completed**: a full drag/gesture-simulated bake-through of フンギ (dough stretch, sauce
   paint, topping placement, bake slider) via Playwright — simulating this codebase's real
   pointer-gesture interactions reliably was judged not worth the time against this task's budget,
   given `CONFIRM_BAKE`'s consumption path and the placement-time Stock Gate are already
   exhaustively covered by `gameReducer.inventoryConsumption.test.ts` (EP2, unmodified),
   `gameReducer.restock.test.ts` (EP3, unmodified except the one fixture correction in §9), and
   this slice's own "Stock Gate after exhaustion" integration test
   (`starterStock.test.ts`) — all exercising the identical reducer code path a real drag gesture
   would ultimately dispatch through. Fugazza's own onion-restock loop (unlock → 40 units → bake →
   consume → Shop restock +12) is covered the same way by `gameReducer.restock.test.ts`'s existing
   full product-goal-loop test (updated in this slice, §9), not re-driven through the UI.

---

## 14. Unresolved decisions / open items

1. **§7 — onion's vestigial manual-purchase path**: kept (option (a)), not retired. Product call
   needed on whether a future slice should set `starterGrantOnly` on `onion` too and retire the
   Phase 3C-6 manual-purchase regression tests, or leave it as documented, harmless legacy
   behavior.
2. **Restock prices (§2.6)** are now sourced from the existing design SSOT rather than invented,
   but that SSOT's own §12/§14 note they are "derived, not simulator-verified against live code"
   and flagged for a future Human Feel/playtesting pass — unchanged, inherited caveat, not
   introduced by this slice.
3. Item 10 of the required test list (RETRY_SAME_RECIPE no-double-grant) is covered by a combined
   scenario rather than a fully separate test — see §12's note. No gap in actual coverage, just a
   traceability note.

## 15. Scope confirmation

Confirmed **not** touched, per the task's Scope Guard: EP3's own restock/Stock-Gate transaction
logic (data-only change to which ingredients participate); Shop's existing price/quantity for
`onion` (unchanged); Pitz reward formula (`pitzReward.ts`/`economy.ts`'s mission-reward path,
untouched); Recipe Unlock conditions (`recipeUnlocked`, `Recipe.unlockCondition` data, untouched);
the 53/160-class Recipe Master catalog; new recipes; RESULT/DISCOVERED UI (no "🎉 NEW RECIPE...
プレゼントされました" banner added — explicitly deferred in the design's own §10, external
dependency on RESULT 2.0's follow-up work); Lunch Rush UX; the making-flow tabs; Pizza Select's
visual design; Ranking; the Achievement Reset feature itself (only its *compatibility contract*
is designed/tested, per §10); broad visual redesign.

---

## FINAL VERDICT: **B — IMPLEMENTED, PRODUCT DECISION REQUIRED**

Implementation is complete, typechecked, linted, fully tested (1325/1325 passing, +27 net new
tests directly covering the task's required scenarios), built successfully, and manually verified
at 390×844 for the migration/exactly-once/UI-correctness path. **Not verdict A** because §7
contains one explicit, load-bearing product decision this report surfaces rather than silently
resolves: whether `onion`'s pre-existing Phase 3C-6 manual-purchase path should be retired now
that the Starter Grant supersedes it in all ordinary play, which would touch already-shipped EP3
regression tests outside this slice's own Scope Guard if decided the other way. Per instruction,
**this PR is left OPEN and is not merged**, regardless of verdict.
