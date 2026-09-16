/**
 * Phase 4A-2: Scoring 2.0 Shadow Recipe correctness component -- required ingredient *type*
 * presence only ("did the player use tomato sauce / mozzarella / basil at all"), reusing
 * ../scoring.ts's `countUsedIngredient` primitive wholesale.
 *
 * Deliberately distinct from ../scoring.ts's legacy `matchScore` (which requires each
 * ingredient's own `minCount` to be met) and from ./piecesComponent.ts (which scores *how
 * many* and *how well placed* mozzarella/basil are): this component only asks "is the right
 * ingredient type on the pizza at all", never "how much" or "placed how well" -- see
 * scoringV2.test.ts's "recipe correctness / pieces separation" tests, which pin that a pizza
 * with too few mozzarella pieces (a Pieces concern) still reads as full Recipe correctness as
 * long as mozzarella is present at all, so the same mistake is never penalized twice across
 * these two components.
 */
import { countUsedIngredient } from "../scoring";
import type { Recipe } from "../../data/recipes";
import type { PizzaState } from "../../state/pizzaState";
import { safeUnit } from "./tolerance";
import type { RecipeComponentV2 } from "./types";

export function scoreRecipeComponentV2(recipe: Recipe, pizza: PizzaState): RecipeComponentV2 {
  const required = recipe.requiredIngredients;
  if (required.length === 0) {
    return { available: true, requiredTypesPresent: 0, requiredTypesTotal: 0, score: 100 };
  }

  const requiredTypesPresent = required.filter(
    (req) => countUsedIngredient(pizza, req.ingredientId) >= 1,
  ).length;
  const score = safeUnit(requiredTypesPresent / required.length) * 100;

  return {
    available: true,
    requiredTypesPresent,
    requiredTypesTotal: required.length,
    score,
  };
}
