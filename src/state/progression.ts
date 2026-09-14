import { RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import type { Ingredient } from "../data/ingredients";

/**
 * Ingredient / recipe availability (Phase 3C-3, see
 * docs/design/PIZZA_GAME_PROGRESSION_SSOT.md sections 6 and 10). Everything here is a pure
 * derivation from canonical state (`ownedIngredientIds` from persistence, `totalStars` from
 * Dex) -- there is no separate LOCKED/AVAILABLE_TO_BUY/recipe-unlocked boolean stored
 * anywhere. That keeps ownership as the single source of truth: a recipe can never end up
 * unlocked while an ingredient it needs is not, and vice versa.
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
 * A recipe is available exactly when every one of its required ingredients is OWNED --
 * there is no separate per-recipe "unlocked" flag (SSOT section 10). All 6 current recipes
 * only require Starter Set ingredients, so this is always true for them regardless of what
 * else has been purchased.
 */
export function isRecipeAvailable(recipe: Recipe, ownedIngredientIds: readonly string[]): boolean {
  const owned = new Set(ownedIngredientIds);
  return recipe.requiredIngredients.every((req) => owned.has(req.ingredientId));
}

/** Ids of every currently-available recipe, in `RECIPES` order. Used to restrict order
 *  selection (src/data/orders.ts) to recipes the player can actually make right now. */
export function availableRecipeIds(ownedIngredientIds: readonly string[]): RecipeId[] {
  return RECIPES.filter((recipe) => isRecipeAvailable(recipe, ownedIngredientIds)).map(
    (recipe) => recipe.id,
  );
}

/**
 * Recipes that are *not yet* available but would become available if `ingredientId` were
 * added to `ownedIngredientIds` -- i.e. this ingredient is the only thing standing between
 * the player and that recipe (Phase 3C-6, SSOT section 8: "何を買うと何ができるかを購入前にも
 * 分かるようにする"). Purely presentational (Shop's "これを買うと: 🍕 フガッサ" preview and
 * post-purchase "新しいピザが作れます！" feedback) -- never used to gate anything itself, since
 * `isRecipeAvailable` above stays the one source of truth for actual availability.
 */
export function recipesUnlockedByIngredient(
  ingredientId: string,
  ownedIngredientIds: readonly string[],
): RecipeId[] {
  const hypotheticallyOwned = new Set([...ownedIngredientIds, ingredientId]);
  return RECIPES.filter(
    (recipe) =>
      !isRecipeAvailable(recipe, ownedIngredientIds) &&
      recipe.requiredIngredients.every((req) => hypotheticallyOwned.has(req.ingredientId)),
  ).map((recipe) => recipe.id);
}
