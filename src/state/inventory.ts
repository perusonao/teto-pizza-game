import type { Ingredient } from "../data/ingredients";

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
