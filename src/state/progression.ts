import { RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import type { Ingredient } from "../data/ingredients";
import { isDiscovered, type DexState } from "./dex";
import { totalStars } from "../logic/mastery";

/**
 * Ingredient / recipe availability (Phase 3C-3, see
 * docs/design/PIZZA_GAME_PROGRESSION_SSOT.md sections 6 and 10). Everything here is a pure
 * derivation from canonical state (`ownedIngredientIds` from persistence, `totalStars` from
 * Dex) -- there is no separate LOCKED/AVAILABLE_TO_BUY boolean stored anywhere for
 * ingredients.
 *
 * Economy & Progression 1.0 EP1 (see docs/reports/TETO_ECONOMY-PROGRESSION-1_Fresh-Design.md
 * sec. 3.1): recipes now carry a second, orthogonal axis -- `recipeUnlocked` below, derived
 * from `Recipe.unlockCondition` (Dex discovery chain + optional totalStars floor) -- which is
 * never used to gate ingredient ownership. `isRecipeAvailable` is the two-axis AND of both:
 * "recipe unlocked" and "every required ingredient owned." Recipe unlock and ingredient
 * ownership stay two separate concepts on purpose (Inventory E1's own `InventoryState`/
 * `ownedIngredientIds` split, src/state/inventory.ts, is not touched or conflated here).
 */

export type IngredientState = "LOCKED" | "AVAILABLE_TO_BUY" | "OWNED";

/**
 * Derives one ingredient's LOCKED/AVAILABLE_TO_BUY/OWNED state.
 *
 * Every current (Starter Set) ingredient has no `unlockCondition` and is therefore always
 * OWNED, even if the caller's `ownedIngredientIds` somehow doesn't list it -- this is a
 * deliberate safety net, not just the common case. `persistence.ts`'s
 * `sanitizeOwnedIngredientIds` already backfills the starter set on every load, but keeping
 * the same guarantee here means a starter ingredient can never render as LOCKED even if a
 * future caller passes in a stale or hand-built ownership list.
 */
export function ingredientState(
  ingredient: Ingredient,
  ownedIngredientIds: readonly string[],
  totalStars: number,
): IngredientState {
  if (ownedIngredientIds.includes(ingredient.id)) return "OWNED";
  if (!ingredient.unlockCondition) return "OWNED";
  return totalStars >= ingredient.unlockCondition.minTotalStars ? "AVAILABLE_TO_BUY" : "LOCKED";
}

/**
 * EP1: whether `recipe`'s own unlock gate (`Recipe.unlockCondition`) is satisfied, purely from
 * Dex state -- independent of ingredient ownership. Absent `unlockCondition` (margherita only)
 * is always unlocked. Both sub-conditions, when present, are AND'd: a recipe chained to a
 * discovery *and* a totalStars floor (quattro-formaggi, fugazza) needs both.
 */
export function recipeUnlocked(recipe: Recipe, dex: DexState): boolean {
  const condition = recipe.unlockCondition;
  if (!condition) return true;
  if (condition.requiresRecipeId && !isDiscovered(dex, condition.requiresRecipeId)) return false;
  if (condition.minTotalStars !== undefined && totalStars(dex) < condition.minTotalStars) {
    return false;
  }
  return true;
}

function ingredientsOwned(recipe: Recipe, ownedIngredientIds: readonly string[]): boolean {
  const owned = new Set(ownedIngredientIds);
  return recipe.requiredIngredients.every((req) => owned.has(req.ingredientId));
}

/**
 * A recipe is available exactly when both axes hold: `recipeUnlocked` (EP1's new Dex-derived
 * gate) AND every required ingredient is OWNED (SSOT section 10, unchanged). Neither axis
 * substitutes for the other -- a recipe whose chain/stars gate is satisfied but whose
 * ingredients aren't all owned (fugazza before `onion` is purchased) is still unavailable, and
 * vice versa.
 */
export function isRecipeAvailable(
  recipe: Recipe,
  dex: DexState,
  ownedIngredientIds: readonly string[],
): boolean {
  return recipeUnlocked(recipe, dex) && ingredientsOwned(recipe, ownedIngredientIds);
}

/** Ids of every currently-available recipe, in `RECIPES` order. Used to restrict order
 *  selection (src/data/orders.ts) to recipes the player can actually make right now. */
export function availableRecipeIds(dex: DexState, ownedIngredientIds: readonly string[]): RecipeId[] {
  return RECIPES.filter((recipe) => isRecipeAvailable(recipe, dex, ownedIngredientIds)).map(
    (recipe) => recipe.id,
  );
}

/**
 * Recipes that are *not yet* available but would become available if `ingredientId` were
 * added to `ownedIngredientIds` -- i.e. this ingredient is the only thing standing between
 * the player and that recipe (Phase 3C-6, SSOT section 8: "何を買うと何ができるかを購入前にも
 * 分かるようにする"). EP1: also requires `recipeUnlocked` to already hold, since owning an
 * ingredient alone can no longer make a chain/stars-gated recipe available on its own.
 * Purely presentational (Shop's "これを買うと: 🍕 フガッサ" preview and post-purchase
 * "新しいピザが作れます！" feedback) -- never used to gate anything itself, since
 * `isRecipeAvailable` above stays the one source of truth for actual availability.
 */
export function recipesUnlockedByIngredient(
  ingredientId: string,
  dex: DexState,
  ownedIngredientIds: readonly string[],
): RecipeId[] {
  const hypotheticallyOwned = new Set([...ownedIngredientIds, ingredientId]);
  return RECIPES.filter(
    (recipe) =>
      !isRecipeAvailable(recipe, dex, ownedIngredientIds) &&
      recipeUnlocked(recipe, dex) &&
      recipe.requiredIngredients.every((req) => hypotheticallyOwned.has(req.ingredientId)),
  ).map((recipe) => recipe.id);
}
