/**
 * Issue #47 Slice B (Findings F/H): player-facing "what should I build" reference data,
 * available for every currently playable recipe -- deliberately independent of
 * `./referencePizza.ts` (Scoring 2.0's own Margherita-only authoritative target
 * geometry/coefficients). This file never imports from `./referencePizza.ts` or
 * `../logic/scoringV2/*`, and nothing in Scoring 2.0 reads this file -- the two stay
 * separate responsibilities on purpose (player-facing recipe guidance vs. scoring target
 * geometry), per Issue #47's own explicit instruction not to let generated positions here
 * be mistaken for -- or fabricated into -- Scoring 2.0 target coordinates.
 *
 * Positions are a generic, explicitly-labeled "spread evenly" placement guide generated
 * purely from `Recipe.requiredIngredients` + `./ingredients.ts` (the same SSOT Making Game
 * itself reads), reusing the exact same `PIECE_RING_POSITIONS` slot table
 * `../components/PizzaThumbnail.tsx` already uses for Pizza Select's card preview -- never a
 * claim about the real dish's researched appearance, and never hand-authored per recipe.
 */
import { getIngredient, type Ingredient } from "./ingredients";
import type { Recipe, RecipeId } from "./recipes";
import { PIECE_RING_POSITIONS } from "../logic/pizzaReferenceLayout";

export interface PlayerReferencePieceGroup {
  ingredientId: string;
  positions: readonly { x: number; y: number }[];
}

export interface PlayerPizzaReference {
  recipeId: RecipeId;
  sauceIngredientId: string | null;
  pieceGroups: readonly PlayerReferencePieceGroup[];
}

/**
 * Deterministic per-recipe layout: every non-sauce required ingredient is assigned
 * `minCount` consecutive slots from `PIECE_RING_POSITIONS`, walked in
 * `requiredIngredients` order so a given recipe always produces the same groups in the
 * same order. Every current recipe's total non-sauce piece count (4-8, see
 * `./recipes.ts`) fits within the 8-slot ring with no two pieces of the same recipe ever
 * colliding on the same slot.
 */
export function getPlayerReferencePizza(recipe: Recipe): PlayerPizzaReference {
  const sauceIngredient = recipe.requiredIngredients
    .map((req) => getIngredient(req.ingredientId))
    .find((ingredient): ingredient is Ingredient => ingredient?.category === "sauce");

  let slot = 0;
  const pieceGroups: PlayerReferencePieceGroup[] = [];
  for (const req of recipe.requiredIngredients) {
    const ingredient = getIngredient(req.ingredientId);
    if (!ingredient || ingredient.category === "sauce") continue;
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < req.minCount; i += 1) {
      positions.push(PIECE_RING_POSITIONS[slot % PIECE_RING_POSITIONS.length]);
      slot += 1;
    }
    pieceGroups.push({ ingredientId: ingredient.id, positions });
  }

  return {
    recipeId: recipe.id,
    sauceIngredientId: sauceIngredient?.id ?? null,
    pieceGroups,
  };
}
