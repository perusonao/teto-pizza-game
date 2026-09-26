import { getIngredient } from "../data/ingredients";
import type { Recipe } from "../data/recipes";
import { finiteRequirementNeed, type GuidedRoundInputs } from "./recipeDiscoveryState";

/**
 * Dinner Mission DM-1 (Issue #236, docs/reports/TETO_DINNER-MISSION_Phase0_Fresh-Design.md §3 / §17):
 * can a *set* of recipes all be cooked, one pizza each, from the stock the player has right now?
 *
 * `isRecipeCookable` answers this for one recipe only. Two recipes that are each cookable alone can
 * still be impossible together when they share a finite material (bismarck and breakfast-pizza each
 * need one egg; with one egg in stock only one of them can be made). The set check sums the need
 * of every recipe per finite ingredient and compares the sum with the stock:
 *
 *   feasible  <=>  for every finite ingredient m: sum over the set of need_r(m) <= have(m)
 *
 * Exact, not a heuristic: every requirement is a fixed amount with no alternative ingredient, so
 * cooking each recipe with exactly its minimum consumes exactly the sum (sufficient), and nothing
 * restocks while the set is being cooked (necessary). The cooking order therefore never changes the
 * answer -- only consumption beyond the minimum (over-placement, a FAILED attempt) does.
 *
 * Same rules as `recipeStockShortage` (./recipeDiscoveryState.ts), which stays the single-recipe
 * authority: the need comes from the shared `finiteRequirementNeed`, starters are never counted
 * (unlimited), an unowned finite material has 0 usable, and an unknown ingredient id needs 1 with 0
 * usable (fails closed). `isRecipeSetCookable([r]) === isRecipeCookable(r)` for every recipe, and
 * the set check is pinned to that by a parity test over the whole catalog.
 *
 * The set is a multiset: a recipe listed twice needs twice the stock. Dinner Mission definitions
 * reject duplicate targets on their own (../mission/dinner/dinnerMission.ts), so this never guesses
 * whether a repeat was intended.
 */

export type RecipeSetInputs = Omit<GuidedRoundInputs, "dex">;

/** Finite units one pizza of `recipe` needs, by ingredient id (starters excluded). */
export function recipeFiniteNeed(recipe: Recipe): Readonly<Record<string, number>> {
  return aggregateFiniteNeed([recipe]);
}

/** Summed finite need of every recipe in `recipes` (a multiset), in first-appearance order. */
export function aggregateFiniteNeed(recipes: readonly Recipe[]): Readonly<Record<string, number>> {
  return Object.fromEntries(finiteNeedMap(recipes));
}

/** Accumulates in a `Map`, so any id -- `__proto__` included -- is counted as its own key and an
 *  unknown id can never slip past the fail-closed check (`Object.fromEntries` above also defines
 *  own properties rather than calling the prototype setter). */
function finiteNeedMap(recipes: readonly Recipe[]): Map<string, number> {
  const need = new Map<string, number>();
  for (const recipe of recipes) {
    for (const { ingredientId, minCount } of recipe.requiredIngredients) {
      const ingredient = getIngredient(ingredientId);
      if (ingredient && !ingredient.unlockCondition) continue; // starter: unlimited
      const units = ingredient ? finiteRequirementNeed(ingredient, minCount) : 1;
      need.set(ingredientId, (need.get(ingredientId) ?? 0) + units);
    }
  }
  return need;
}

/** One finite ingredient the whole set is short of. */
export interface SetIngredientShortage {
  ingredientId: string;
  /** Summed need of every recipe in the set. */
  need: number;
  /** Usable stock now (0 when not owned or unknown). */
  have: number;
  /** Recipes in the set that need this ingredient, in set order, de-duplicated. */
  recipeIds: string[];
}

function usableStock(ingredientId: string, inputs: RecipeSetInputs, owned: ReadonlySet<string>): number {
  if (!getIngredient(ingredientId) || !owned.has(ingredientId)) return 0;
  return inputs.inventory[ingredientId] ?? 0;
}

/**
 * Every finite ingredient the set is short of, in first-appearance order (empty exactly when the
 * whole set can be cooked, one pizza each, from `inputs`).
 */
export function recipeSetStockShortage(
  recipes: readonly Recipe[],
  inputs: RecipeSetInputs,
): SetIngredientShortage[] {
  const owned = new Set(inputs.ownedIngredientIds);
  const shortages: SetIngredientShortage[] = [];
  for (const [ingredientId, units] of finiteNeedMap(recipes)) {
    const have = usableStock(ingredientId, inputs, owned);
    if (have >= units) continue;
    const recipeIds: string[] = [];
    for (const recipe of recipes) {
      if (recipeIds.includes(recipe.id)) continue;
      if (recipe.requiredIngredients.some((req) => req.ingredientId === ingredientId)) recipeIds.push(recipe.id);
    }
    shortages.push({ ingredientId, need: units, have, recipeIds });
  }
  return shortages;
}

/** Whether every recipe in `recipes` can be cooked once each from `inputs`. An empty set is. */
export function isRecipeSetCookable(recipes: readonly Recipe[], inputs: RecipeSetInputs): boolean {
  return recipeSetStockShortage(recipes, inputs).length === 0;
}
