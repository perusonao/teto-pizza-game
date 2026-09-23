/**
 * Progression 2.0 Phase 3-2 (Issue #194): the recipe-free "free cooking" round.
 *
 * A free-cook round has no selected recipe, but `GameState.recipe`/`GameState.order` are
 * non-null for every round (the hint, BAKE gauge, PizzaStage and every step helper read them).
 * Rather than widen those types across the codebase, a free-cook round carries this one
 * sentinel recipe until CONFIRM_BAKE, where the Phase 3-1 matcher decides which real recipe (if
 * any) the finished pizza is (see ../logic/discovery/freeCook.ts and gameReducer's CONFIRM_BAKE).
 *
 * The sentinel is inert by construction:
 * - `requiredIngredients` is empty, so nothing about the tray, hint or completion gate can
 *   narrow the player's choice to a recipe subset;
 * - its id is not in `RECIPES`, so `getRecipe`, `getReferencePizza` and the Dex sanitizer never
 *   resolve it, and `getCookingProfile` falls back to `DEFAULT_COOKING_PROFILE`
 *   (DOUGH -> SAUCE -> CHEESE -> TOPPING, no CUT) -- every category stays reachable;
 * - REGISTER_TO_DEX never writes it: an unmatched pizza has no score (Phase-2 X-3, "scoring
 *   happens only after a match"), and a matched pizza is re-labelled as the matched recipe first.
 */
import { RECIPES, type BakeTarget, type Recipe, type RecipeId } from "./recipes";
import type { Order } from "./orders";

/** Not a member of `RecipeId`; cast once here so `GameState.recipe` keeps its existing type. */
export const FREE_COOK_RECIPE_ID = "free-cook" as RecipeId;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Phase-2 X-3's "generic bake window". Derived from the shipped recipes (the median start and
 * the median end of every `bakeTarget`), not a new hand-picked number. It only drives the BAKE
 * gauge and the recipe-free completion check: a pizza that matches a recipe is scored and gated
 * against that recipe's own window, exactly as Phase 3-1's cross-recipe discovery already does.
 */
export const FREE_COOK_BAKE_TARGET: BakeTarget = {
  start: median(RECIPES.map((r) => r.bakeTarget.start)),
  end: median(RECIPES.map((r) => r.bakeTarget.end)),
};

export const FREE_COOK_RECIPE: Recipe = {
  id: FREE_COOK_RECIPE_ID,
  nameJa: "じぶんのピザ",
  description: "持っている材料から、好きなものを自由にのせて焼いてみよう。",
  requiredIngredients: [],
  bakeTarget: FREE_COOK_BAKE_TARGET,
  // Never read: Pitz is only credited after a match, from the matched recipe's own base.
  baseRewardPitz: 0,
};

export const FREE_COOK_ORDER: Order = {
  id: "order-free-cook",
  recipeId: FREE_COOK_RECIPE_ID,
  requestedBy: "mito",
  lineJa: "今日は好きな材料で自由に作ってみよう！",
};

export function isFreeCookRecipe(recipe: Pick<Recipe, "id">): boolean {
  return recipe.id === FREE_COOK_RECIPE_ID;
}
