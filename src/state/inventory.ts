import { getIngredient, type Ingredient } from "../data/ingredients";
import { sanitizeStringArray, sanitizeToppings } from "../logic/scoringV2/boundary";
import type { PizzaState } from "./pizzaState";

/**
 * Save v2 / Inventory E1: consumable stock, keyed by ingredient id. Deliberately separate
 * from `ownedIngredientIds` (../data/ingredients.ts's Starter/unlock gate, "can this ever be
 * placed at all") -- this field only ever answers "how many uses remain," and only matters
 * for an ingredient that has `unlockCondition` set (today only `onion`). A Starter ingredient
 * is exempt from this check entirely (see `hasStock` below), so `owned === true` and
 * `inventory[id] === 0` (or the key absent) is a legal, intentional combination: unlocked but
 * out of stock. E1 wires this type through `GameState`/persistence only -- no reducer case
 * reads it yet (that's E2's job, see docs/reports/TETO_INVENTORY-E1_Implementation-Preflight.md).
 */
export type InventoryState = Readonly<Record<string, number>>;

export const EMPTY_INVENTORY: InventoryState = {};

/**
 * Whether at least one more unit of `ingredient` can still be used this round. A Starter
 * ingredient (no `unlockCondition`) is unconditionally, structurally unlimited -- it never
 * reads `inventory` at all. A finite ingredient's remaining stock is its persisted count
 * minus whatever has already been used so far this round (a quantity E2's caller, not this
 * function, is responsible for tracking).
 */
export function hasStock(
  ingredient: Ingredient,
  inventory: InventoryState,
  alreadyUsedThisRound: number,
): boolean {
  if (!ingredient.unlockCondition) return true;
  return (inventory[ingredient.id] ?? 0) - alreadyUsedThisRound > 0;
}

/**
 * The persisted stock for `ingredient`, or `"UNLIMITED"` for a Starter ingredient (which has
 * no finite count to report). Absent keys read as `0`, mirroring `ownedIngredientIds`'s own
 * "absent = not owned" convention.
 */
export function remainingStock(
  ingredient: Ingredient,
  inventory: InventoryState,
): number | "UNLIMITED" {
  return ingredient.unlockCondition ? (inventory[ingredient.id] ?? 0) : "UNLIMITED";
}

/**
 * Economy & Progression 1.0 EP2: the sole inventory-consumption transaction. Pure function of
 * the exact `pizza` that was just baked plus the current `inventory` -- called once, from
 * `gameReducer.ts`'s `CONFIRM_BAKE` case (the atomic transaction boundary the EP2 SSOT
 * specifies; PREPARE-time placement never touches inventory). Computing the full next
 * `InventoryState` here as a single pure value (rather than applying each ingredient's
 * consumption as a separate side effect) is what makes a multi-ingredient bake atomic: the
 * reducer applies this result in the same state transition that also advances `phase`, so
 * there is no intermediate state where only some of a pizza's finite ingredients have been
 * deducted.
 *
 * Consumption semantics (EP2 SSOT, ratifying the Economy & Progression 1.0 Fresh Design's
 * unit model, sec. 6.1):
 * - **scatter** (every `PlacedTopping`): consumes exactly the number of pieces of that
 *   ingredient actually placed on this pizza -- never `Recipe.minCount`. A recipe's own
 *   minimum is a *scoring* concern (../logic/scoringV2/), orthogonal to how much stock a
 *   placement used; placing more than the minimum (extra, off-recipe pieces, where the
 *   current placement UI allows it) consumes that larger real amount.
 * - **spread/sauce** (`pizza.sauceIds`): 1 pizza = 1 unit per distinct sauce id that appears,
 *   matching the existing single-sauce-per-pizza state shape (`APPLY_SAUCE`/
 *   `COMMIT_SAUCE_DISPENSE` both always replace `sauceIds` with a single-element array) without
 *   hard-coding that array length -- a future multi-sauce pizza would still charge 1 unit per
 *   sauce actually used, not 1 total.
 * - **unlimited** (`!ingredient.unlockCondition`, today every Starter ingredient): never
 *   consumes, structurally -- mirrors `hasStock`'s own unconditional-`true` exemption above, so
 *   Margherita's own ingredients (the design's one deliberate softlock guard) can never be
 *   depleted by this function no matter how many pieces are placed. An unknown ingredient id
 *   (should never occur from real gameplay, but `sanitizeToppings`/`sanitizeStringArray` don't
 *   themselves know the ingredient catalog) is likewise never consumed -- `getIngredient`
 *   returns `undefined` and the id is skipped.
 * - **clamp-to-zero**: `remaining = Math.max(0, current - consumed)` -- inventory can never go
 *   negative. This is the EP2-decided, deliberately provisional shortage policy: a bake is
 *   never blocked by insufficient stock (that gate is EP3's job, not built here), so a bake
 *   that uses more of an ingredient than is left simply drives that ingredient to exactly 0,
 *   never below.
 *
 * Fails closed like every other public Scoring 2.0-boundary consumer of `PizzaState`
 * (`sanitizeToppings`/`sanitizeStringArray`, ../logic/scoringV2/boundary.ts): a malformed
 * `toppings`/`sauceIds` (non-array, or an element missing/wrong-typed `ingredientId`) drops the
 * offending entries rather than throwing, so a corrupted pizza can never crash `CONFIRM_BAKE`.
 * Returns the exact same `inventory` reference (no-op) when nothing on this pizza consumes any
 * finite stock, so callers that compare inventory by reference (e.g. `persistence.ts`'s
 * `sameInventory` still compares by value, but this keeps `CONFIRM_BAKE` from manufacturing a
 * spurious new object on every all-Starter round).
 */
export function consumePizzaInventory(
  pizza: PizzaState,
  inventory: InventoryState,
): InventoryState {
  const usage: Record<string, number> = {};
  const recordUse = (id: string) => {
    usage[id] = (usage[id] ?? 0) + 1;
  };
  for (const topping of sanitizeToppings(pizza.toppings)) {
    recordUse(topping.ingredientId);
  }
  for (const sauceId of sanitizeStringArray(pizza.sauceIds)) {
    recordUse(sauceId);
  }

  const updates: Record<string, number> = {};
  for (const [id, used] of Object.entries(usage)) {
    const ingredient = getIngredient(id);
    if (!ingredient?.unlockCondition) continue; // unlimited or unknown -- never consumed
    updates[id] = Math.max(0, (inventory[id] ?? 0) - used);
  }
  if (Object.keys(updates).length === 0) return inventory;
  return { ...inventory, ...updates };
}
