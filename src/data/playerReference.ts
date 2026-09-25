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
 *
 * RT-01b (docs/reports/TETO_RT01_REFERENCE-PIECE-CAPACITY_Fresh-Design.md, Owner Decision
 * RT-01-OD-1): slots now come from `getReferenceSlots`/`assignReferenceSlots`
 * (../logic/pizzaReferenceLayout.ts) instead of `PIECE_RING_POSITIONS[slot % 8]`. For 1-8 total
 * pieces that is byte-identical to before (same table, same consecutive assignment); 9+ pieces
 * get the approved multi-ring layout with ingredients interleaved, instead of wrapping onto
 * already-used slots.
 */
import { getIngredient, type Ingredient } from "./ingredients";
import type { Recipe, RecipeId } from "./recipes";
import { assignReferenceSlots } from "../logic/pizzaReferenceLayout";

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
 * Deterministic per-recipe layout: every non-sauce required ingredient contributes `minCount`
 * pieces, in `requiredIngredients` order, placed by `assignReferenceSlots` -- consecutive slots
 * for up to 8 total pieces (the original behaviour), interleaved multi-ring slots for 9+. A given
 * recipe always produces the same groups in the same order, and no two pieces ever share a slot
 * regardless of the total.
 */
export function getPlayerReferencePizza(recipe: Recipe): PlayerPizzaReference {
  const sauceIngredient = recipe.requiredIngredients
    .map((req) => getIngredient(req.ingredientId))
    .find((ingredient): ingredient is Ingredient => ingredient?.category === "sauce");

  const groups: { ingredientId: string; count: number }[] = [];
  for (const req of recipe.requiredIngredients) {
    const ingredient = getIngredient(req.ingredientId);
    if (!ingredient || ingredient.category === "sauce") continue;
    groups.push({ ingredientId: ingredient.id, count: req.minCount });
  }
  const pieceGroups: PlayerReferencePieceGroup[] = assignReferenceSlots(groups);

  return {
    recipeId: recipe.id,
    sauceIngredientId: sauceIngredient?.id ?? null,
    pieceGroups,
  };
}
