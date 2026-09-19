# Teto Pizza Game — Economy & Progression 1.0 EP1: Recipe Unlock Foundation (Result)

**Scope: EP1 only — Recipe Unlock foundation.** No Inventory consumption, CONFIRM_BAKE material
consumption, Shop 2.0, starter-stock grants (`starterStockPlays = 10`), Economy price changes,
Pitz formula changes, RESULT 2.0 additions, Save schema bump, EP2/EP3/EP4, or Recipe Master
Catalog work was touched in this session, per instruction.

- **Audited `origin/main` SHA at session start**: `8918fe4bd93816b0acefe4a35106fa1a4e8653e2`
  ("Save v2 / Inventory E1: wire InventoryState into GameState (foundation only) (#78)"),
  confirmed fresh via `git fetch origin` — matches PR #78's reported squash-merge SHA and
  includes PR #77's merged design doc (`654629f`). The working branch
  (`claude/recipe-unlock-foundation-ep1-4xa0j6`) was already up to date with this SHA and had no
  prior commits, so `origin/main` at session start is exactly this EP1's base.
- **Branch**: `claude/recipe-unlock-foundation-ep1-4xa0j6`
- **PR**: see final report (opened against `main`, left OPEN per instruction, not merged).

---

## 1. Fresh Audit (pre-implementation)

Read directly before any code change: `docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md`,
`docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md`, `src/data/recipes.ts`,
`src/data/ingredients.ts`, `src/state/progression.ts`, `src/state/pizzaSelect.ts`,
`src/screens/PizzaSelectScreen.tsx`, `src/state/gameReducer.ts`, `src/data/orders.ts`,
`src/mission/lunchRush.ts`, `src/state/dex.ts`, `src/state/inventory.ts`, `src/state/persistence.ts`.

**Confirmed diff between SSOT and shipped code**: every recipe except `fugazza` had **no**
recipe-level unlock concept at all — `isRecipeAvailable` derived purely from
`ownedIngredientIds`, and since every ingredient except `onion` is in `STARTER_INGREDIENT_IDS`
(always owned, unconditionally), recipes #1–#6 were always available from a fresh save.
`fugazza` was the sole locked recipe, gated entirely on `onion`'s existing
`Ingredient.unlockCondition` (`minTotalStars: 12`) + Shop purchase — there was no distinct
"recipe unlocked" concept even for it.

**Minimum required change** (confirmed before touching any file): add a new,
orthogonal `Recipe.unlockCondition` type + data (7 entries), a pure `recipeUnlocked()` function,
and turn `isRecipeAvailable` into the two-axis AND the SSOT specifies
(`recipeUnlocked(recipe, dex) && ingredientsOwned(recipe, ownedIngredientIds)`) — nothing in
`src/data/ingredients.ts`, `src/state/inventory.ts`, `src/logic/economy.ts`, or
`src/state/persistence.ts` needed to change, since:

- Every EP1-locked recipe's *ingredients* (recipes #2–#6) are all Starter Set ingredients
  (unaffected by `STARTER_INGREDIENT_IDS`, unchanged this session) — so the new recipe-level
  gate is the *only* thing blocking them; no ingredient-ownership work was needed for #2–#6.
- `fugazza` already had its ingredient-level gate (`onion`); EP1 only adds the second,
  independent recipe-level gate on top — the existing Shop/purchase code for `onion` is
  untouched.
- `InventoryState`/`ownedIngredientIds` (Inventory E1, PR #78) stay completely separate from the
  new `Recipe.unlockCondition` concept — recipe unlock is derived from `DexState`
  (`discovered`/`bestStars`) only, never from `InventoryState`.

This confirmed the design's own EP1 slice boundary (§12 of the Fresh Design doc) as the correct,
minimal scope — no new design document was needed.

---

## 2. Recipe Unlock architecture

### `Recipe.unlockCondition` (`src/data/recipes.ts`)

```ts
export interface RecipeUnlockCondition {
  requiresRecipeId?: RecipeId;   // discovered (any quality, ★1 floor) at least once
  minTotalStars?: number;        // AND'd with requiresRecipeId when both are present
}
```

Added as an optional field on `Recipe`, alongside a new `mysteryLock?: boolean` field (Pizza
Select presentation only — see §4).

### `recipeUnlocked()` (`src/state/progression.ts`)

```ts
export function recipeUnlocked(recipe: Recipe, dex: DexState): boolean {
  const condition = recipe.unlockCondition;
  if (!condition) return true;
  if (condition.requiresRecipeId && !isDiscovered(dex, condition.requiresRecipeId)) return false;
  if (condition.minTotalStars !== undefined && totalStars(dex) < condition.minTotalStars) {
    return false;
  }
  return true;
}
```

Pure, derived entirely from `DexState` (`isDiscovered`/`totalStars`, both pre-existing from
Phase 3C-1/3C-3) — no new persisted state.

### Two-axis `isRecipeAvailable`

```ts
export function isRecipeAvailable(
  recipe: Recipe,
  dex: DexState,
  ownedIngredientIds: readonly string[],
): boolean {
  return recipeUnlocked(recipe, dex) && ingredientsOwned(recipe, ownedIngredientIds);
}
```

`availableRecipeIds(dex, ownedIngredientIds)` and `recipesUnlockedByIngredient(ingredientId, dex,
ownedIngredientIds)` were updated to the same two-axis signature (both call sites: `gameReducer.ts`,
`ShopOverlay.tsx`). Every call site in production code was updated (`gameReducer.ts`'s
`nextOrderState`/`nextMissionOrderState`/`SELECT_RECIPE`, `pizzaSelect.ts`'s `recipeCardState`,
`ShopOverlay.tsx`'s purchase-preview label).

---

## 3. The 7 recipe conditions (exactly per SSOT §3.2 / MATRIX §1)

| # | Recipe | `unlockCondition` | `mysteryLock` |
|---|---|---|---|
| 1 | margherita | *(none — always unlocked)* | — |
| 2 | funghi | `{ requiresRecipeId: "margherita" }` | false |
| 3 | marinara | `{ requiresRecipeId: "funghi" }` | false |
| 4 | bismarck | `{ requiresRecipeId: "marinara" }` | false |
| 5 | genovese | `{ requiresRecipeId: "bismarck" }` | false |
| 6 | quattro-formaggi | `{ requiresRecipeId: "genovese", minTotalStars: 8 }` | false |
| 7 | fugazza | `{ requiresRecipeId: "quattro-formaggi", minTotalStars: 12 }` | **true** |

Verified live (Playwright, see §9): the ★8 gate holds a chain-satisfied `quattro-formaggi`
LOCKED at `totalStars = 5` and unlocks it exactly at `totalStars = 9` (≥8); Margherita stays
permanently unconditional; `fugazza` additionally still requires `onion` OWNED (pre-existing
Shop purchase flow, untouched).

---

## 4. Pizza Select behavior (SSOT §9, exact)

`RecipeCardState`'s `LOCKED` variant gained a `mystery: boolean` field (from
`recipe.mysteryLock`) and a redesigned `unlockHint`:

- **#2–#6**: `mystery: false` — the card shows the real recipe name plus a hint naming the
  still-missing prerequisite recipe (`"${prevName}を1枚完成させると解禁"`), or once chain is met
  but stars aren't, a star-progress line (`"あと★N で解禁"`). Never reveals ingredient names.
- **#7 (fugazza)**: `mystery: true` — card still shows `？？？`, hint is **only** a star-progress
  line (`"あと★12で解禁"`), never the recipe or ingredient (`onion`) name — matches SSOT's
  explicit requirement to drop the old ingredient-unlockCondition-based hint text
  (`"たまねぎを解放（★12）で作れます"`) that would have leaked the mystery.
- A LOCKED card is `disabled`/`aria-disabled`; `SELECT_RECIPE` independently re-checks
  `isRecipeAvailable` in the reducer, so a locked recipe can never be started even via a stray
  dispatch bypassing the UI (existing pattern, unchanged).

## 5. Lunch Rush behavior

No changes needed inside `src/mission/lunchRush.ts`/`src/data/orders.ts` — both already accepted
an `availableRecipeIds` array from their caller (pre-existing extension point from Phase 3C-6).
Only the caller (`gameReducer.ts`'s `nextMissionOrderState`) was updated to compute that array
via the new two-axis `availableRecipeIds(dex, ownedIngredientIds)` instead of the old
ingredient-only version. Verified live: a fresh save's Lunch Rush ORDER screen only ever offers
Margherita; no locked recipe name ever appears.

---

## 6. Inventory E1 integration

`InventoryState`/`ownedIngredientIds` (PR #78) were **not modified**. Recipe unlock is derived
purely from `DexState`; ingredient ownership stays the separate, pre-existing axis it already
was. The two concepts remain structurally distinct, per instruction ("recipe unlockとingredient
ownershipを同一概念にしない").

## 7. Save compatibility

No `PersistentSaveV1`/`PersistentSaveV2` schema change, no `schemaVersion` bump, no migration
logic added. `persistence.ts` was not touched. An existing save's `dex`/`ownedIngredientIds`
load exactly as before; `recipeUnlocked`/`isRecipeAvailable` are pure functions of that already-
sanitized state, so nothing can crash regardless of what recipes a pre-EP1 save has discovered
"out of chain order" (e.g. a save with `quattro-formaggi` discovered but `funghi` not — a real
possible shape under the old all-always-available model). **Expected, deliberate regression**
(explicitly called out as EP4's problem, not EP1's, per instruction): such a save's
already-discovered-but-chain-broken recipes will render LOCKED again until replayed in order.
No crash, no data loss — every Dex entry is preserved verbatim; only *availability* is
re-derived.

## 8. Scope creep check

None found. Diff touches exactly: `src/data/recipes.ts` (type + data),
`src/state/progression.ts` (pure logic), `src/state/pizzaSelect.ts` (card-state derivation),
`src/screens/PizzaSelectScreen.tsx` (render), `src/state/gameReducer.ts` (3 call-site
signature updates only — no new reducer cases, no inventory/economy logic), and
`src/components/ShopOverlay.tsx` (2 call-site signature updates only — no new Shop
behavior). No `starterStockPlays`, no inventory consumption, no Shop restock, no Pitz/Save
schema change anywhere in the diff. Remaining files changed are test-only.

---

## 9. Verification

- **typecheck** (`tsc -b`): ✅ clean, 0 errors.
- **lint** (`oxlint`): ✅ clean, exit 0.
- **focused tests**: `progression.test.ts`, `pizzaSelect.test.ts`, `PizzaSelectScreen.test.tsx`,
  `recipes.test.ts`, `orders.test.ts`, `gameReducer.test.ts`,
  `gameReducer.scoringV2Authority.test.ts`, `App.test.tsx`, `App.playerReference.test.tsx` — all
  pass. New tests cover: the chain unlock progression one recipe at a time, the AND semantics of
  `requiresRecipeId`/`minTotalStars` (quattro-formaggi/fugazza), the two-axis
  `isRecipeAvailable` (chain-satisfied-but-ingredient-missing and vice versa), Pizza Select's
  named-vs-mystery LOCKED rendering and hint text, and Lunch Rush's availability filtering.
- **full test suite**: **1238/1238 pass** (63 test files) — up from the pre-session baseline of
  1217/1217 (PR #78), +21 net new tests from this slice's own coverage additions, 0 regressions.
- **build** (`tsc -b && vite build`): ✅ succeeds, no warnings.
- **Preview**: not created (not requested as a deployed preview; manual verification instead used
  a local `vite dev` server + headless Chromium at a 390×844 viewport — see below). No production
  deploy was made.
- **Manual mobile verification (390×844, Playwright/Chromium against `vite dev`)**:
  - HOME → FREE (Pizza Select): only Margherita selectable on a fresh save; #2–#6 render LOCKED
    with their real name + prerequisite hint (e.g. `🔒 フンギ / マルゲリータを1枚完成させると解禁`);
    Fugazza renders `🔒 ？？？ / あと★12で解禁`.
  - A forced click on a disabled LOCKED card never navigates away from Pizza Select (confirmed
    for `fugazza`).
  - Clicking Margherita reaches PREPARE (`.game-screen`) correctly.
  - Seeded a Dex at `totalStars = 5` (chain-satisfied, stars-gate unmet) → quattro-formaggi
    stayed LOCKED with `あと★3で解禁`; bumped to `totalStars = 9` (≥8) → same card became a
    clickable NEW card. Confirms the ★8 gate is exact, not off-by-one.
  - Lunch Rush's ORDER screen on a fresh save only ever mentions マルゲリータ; no locked recipe
    name ever appeared.
  - No horizontal overflow (`scrollWidth > clientWidth`) on HOME, Pizza Select, or PREPARE at
    390px width.
  - No console errors / page errors during the full walkthrough.
- **GitHub CI status**: pending — see the created PR for live check results (not fabricated
  here).

---

## 9. Unresolved issues

None blocking EP1. Per the Fresh Design's own §14, four items remain explicitly deferred to
later slices (unaffected by this session): migration exact mechanics (EP4), the exact
starter-grant guard mechanism (EP4), the shared-ingredient pool question (EP4), and the exact
FAST-variant numbers (Human Feel pass). None of these block EP1's own scope.

## 10. Dependencies / notes for EP2

- EP2 (Inventory E2 atomic consumption) can build directly on this slice's `isRecipeAvailable`
  two-axis model without further changes to it — EP2's own work is entirely on the *ingredient*
  axis (consumption at `CONFIRM_BAKE`), which this slice deliberately left untouched.
- EP4 (starter-stock grant + migration) will need to decide the exact "already granted" guard
  and migration rule against the `DexState`-driven `recipeUnlocked` this slice now ships —
  nothing here presupposes or forecloses that design.
- The Pizza Select `mystery`/hint logic (`unlockHintFor` in `src/state/pizzaSelect.ts`) is
  purely presentational and reads only `Recipe.unlockCondition`/`Dex` — EP4's starter-grant
  banner (Fresh Design §10) is a separate, additive concern and does not need to touch this
  function.

---

## FINAL VERDICT

**A. EP1 COMPLETE — READY FOR MERGE REVIEW.**

PR left **OPEN**, not merged, per instruction.
