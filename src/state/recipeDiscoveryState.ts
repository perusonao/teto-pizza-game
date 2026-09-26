import { getIngredient } from "../data/ingredients";
import { getRecipe, type Recipe, type RecipeId } from "../data/recipes";
import { isDiscovered, type DexState } from "./dex";
import type { InventoryState } from "./inventory";

/**
 * Progression 2.0 W1 Discovery 2.0 (W1-a1): the per-recipe discovery state, derived only from
 * state the save already carries -- Dex, ingredient ownership, the Shop ledger and inventory
 * (docs/reports/TETO_PROGRESS2_DISCOVERY_RECIPE-DEX_2_FRESH-DESIGN.md §7). Nothing new is
 * persisted, and the EP1 chain (`unlockCondition` / `mysteryLock` / totalStars) is not an input
 * (OD-DISC-5: EP1 is out of W1 display and gating).
 *
 * - `DISCOVERED`: the Dex entry is discovered.
 * - `DISCOVERABLE`: undiscovered, every required ingredient is usable right now -- onboarding
 *   starters (unlimited) or an OWNED finite material with stock >= 1. Discovery matches "each
 *   ingredient at least once" (Issue #215 OD-5), so one unit is enough to find it.
 * - `KNOWN_BUT_MISSING_MATERIAL`: undiscovered, every required ingredient is Shop-entitled (owned
 *   or unlocked for the Shop) but at least one is not bought yet or out of stock. "KNOWN" means
 *   the Shop knows it, never that the player is told which recipe it is.
 * - `UNKNOWN`: undiscovered and at least one required material is not entitled yet.
 *
 * Priority: DISCOVERED > DISCOVERABLE > KNOWN_BUT_MISSING_MATERIAL > UNKNOWN. Any number of
 * recipes can be in each state at once (a migrated save can hold several DISCOVERABLE).
 */
export type RecipeDiscoveryState = "DISCOVERED" | "DISCOVERABLE" | "KNOWN_BUT_MISSING_MATERIAL" | "UNKNOWN";

export interface RecipeDiscoveryInputs {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  unlockedForShopIngredientIds: readonly string[];
  inventory: InventoryState;
}

/** Stock one finite ingredient has; `Infinity` for an onboarding starter (never consumed). */
function stockOf(ingredientId: string, inventory: InventoryState): number {
  const ingredient = getIngredient(ingredientId);
  if (!ingredient) return 0;
  if (!ingredient.unlockCondition) return Infinity;
  return inventory[ingredientId] ?? 0;
}

function isStarter(ingredientId: string): boolean {
  const ingredient = getIngredient(ingredientId);
  return !!ingredient && !ingredient.unlockCondition;
}

export function recipeDiscoveryState(recipe: Recipe, inputs: RecipeDiscoveryInputs): RecipeDiscoveryState {
  if (isDiscovered(inputs.dex, recipe.id)) return "DISCOVERED";
  const owned = new Set(inputs.ownedIngredientIds);
  const entitled = new Set([...inputs.unlockedForShopIngredientIds, ...inputs.ownedIngredientIds]);
  let allUsable = true;
  for (const { ingredientId } of recipe.requiredIngredients) {
    if (isStarter(ingredientId)) continue;
    if (!getIngredient(ingredientId) || !entitled.has(ingredientId)) return "UNKNOWN";
    if (!owned.has(ingredientId) || stockOf(ingredientId, inputs.inventory) < 1) allUsable = false;
  }
  return allUsable ? "DISCOVERABLE" : "KNOWN_BUT_MISSING_MATERIAL";
}

/** Count of recipes per state over `recipes` (never assumes at most one of anything). */
export function countRecipeDiscoveryStates(
  recipes: readonly Recipe[],
  inputs: RecipeDiscoveryInputs,
): Record<RecipeDiscoveryState, number> {
  const counts: Record<RecipeDiscoveryState, number> = {
    DISCOVERED: 0,
    DISCOVERABLE: 0,
    KNOWN_BUT_MISSING_MATERIAL: 0,
    UNKNOWN: 0,
  };
  for (const recipe of recipes) counts[recipeDiscoveryState(recipe, inputs)] += 1;
  return counts;
}

export interface GuidedRoundInputs {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  inventory: InventoryState;
}

/**
 * F-15: whether `recipe` can be cooked as a full guided round right now -- every required
 * ingredient owned (onboarding starters always are) and every finite one with enough stock for
 * the recipe's own minimum (scatter: `minCount` pieces; a sauce is one unit per pizza). Ownership
 * or a Shop unlock alone is not enough: stock 0 is not cookable. Starters stay unlimited.
 */
export function isRecipeCookable(recipe: Recipe, inputs: Omit<GuidedRoundInputs, "dex">): boolean {
  const owned = new Set(inputs.ownedIngredientIds);
  return recipe.requiredIngredients.every(({ ingredientId, minCount }) => {
    const ingredient = getIngredient(ingredientId);
    if (!ingredient) return false;
    if (!ingredient.unlockCondition) return true;
    if (!owned.has(ingredientId)) return false;
    const needed = ingredient.placement === "scatter" ? Math.max(1, minCount) : 1;
    return stockOf(ingredientId, inputs.inventory) >= needed;
  });
}

/**
 * LK-8 backstop (Discovery Integration Gate §3.3): the single authority for starting a guided
 * (recipe-first, reference-shown) round. Only a DISCOVERED recipe that is cookable right now can
 * start one -- an undiscovered recipe is found only through Free Cooking's matcher, never by
 * holding its id. Used by `SELECT_RECIPE`, `BEGIN_PREPARE`, `RETRY_SAME_RECIPE`, the FREE order
 * pool and App navigation, so no screen can reopen the leak by showing or hiding a card.
 */
export function canStartGuidedRound(recipeId: string, inputs: GuidedRoundInputs): boolean {
  const recipe = getRecipe(recipeId as RecipeId);
  if (!recipe) return false;
  return isDiscovered(inputs.dex, recipe.id) && isRecipeCookable(recipe, inputs);
}
