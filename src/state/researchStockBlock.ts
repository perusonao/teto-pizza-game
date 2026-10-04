import { getIngredient } from "../data/ingredients";
import type { Recipe } from "../data/recipes";
import { isResearchRegistrable } from "../logic/discovery/researchEntry";
import type { DexState } from "./dex";
import type { InventoryState } from "./inventory";

/**
 * #378 Option 1 (OD-378-2): is a registered Research Entry unable to start BECAUSE of stock?
 *
 * True only when ALL of these hold, each read from existing authority and none inferred from "cannot
 * start research" in general:
 * - the recipe is a registered Research Entry (`isResearchRegistrable`: undiscovered, at least one finite
 *   ingredient, EVERY finite ingredient already OWNED), and
 * - at least one of its finite ingredients has stock < 1 (the same `>= 1` rule `recipeDiscoveryState` uses
 *   for DISCOVERABLE).
 *
 * Because every finite ingredient is owned for a registered entry, a refill (never a first purchase) is always
 * the right remedy. A future non-stock reason for "cannot research" does NOT make this true. The result is a
 * single boolean: it exposes no ingredient id, name, count or missing count.
 */
export function isResearchStockBlocked(
  recipe: Recipe,
  inputs: { dex: DexState; ownedIngredientIds: readonly string[]; inventory: InventoryState },
): boolean {
  if (!isResearchRegistrable(recipe, inputs)) return false;
  return recipe.requiredIngredients.some(({ ingredientId }) => {
    if (!getIngredient(ingredientId)?.unlockCondition) return false;
    const stock = inputs.inventory[ingredientId];
    return !(typeof stock === "number" && stock >= 1);
  });
}
