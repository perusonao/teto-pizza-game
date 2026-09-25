/**
 * Progression 2.0 Phase 3-1 (Issue #192): the one place a discovery outcome
 * (../logic/discovery/matcher.ts) is written to the Dex. Called only from gameReducer's
 * REGISTER_TO_DEX, whose `phase === "RESULT"` guard already makes it run at most once per round.
 *
 * The recipe-first flow is left exactly as it was: REGISTER_TO_DEX still registers the selected
 * recipe through `registerScoreToDex` first (BEST/★/timesMade unchanged). This function only adds
 * what the selected-recipe path cannot express -- a pizza whose signature is exactly a
 * *different*, not-yet-discovered recipe. That recipe is scored and gated as itself (its own
 * Scoring 2.0 score, bake window and Completion Gate; Phase-2 X-3 "scoring happens only after a
 * match"), and written through the same `registerScoreToDex`, so BEST only ever goes up.
 */
import { getRecipe, type RecipeId } from "../data/recipes";
import { evaluatePizzaCompletion } from "../logic/completionGate";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";
import { computeScoringV2, toLegacyScoreBreakdown } from "../logic/scoringV2";
import { registerScoreToDex, type DexState } from "./dex";
import type { PizzaState } from "./pizzaState";

export interface DiscoveryRegistration {
  dex: DexState;
  outcome: DiscoveryOutcome;
}

export function registerDiscoveryToDex(
  dex: DexState,
  outcome: DiscoveryOutcome,
  selectedRecipeId: RecipeId,
  pizza: PizzaState,
): DiscoveryRegistration {
  // The selected recipe itself was already registered by the caller; nothing else to write for
  // an original pizza, an ambiguous one, or a recipe that is already in the Dex.
  if (outcome.kind !== "NEW_DISCOVERY" || outcome.recipeId === selectedRecipeId) {
    return { dex, outcome };
  }
  const recipe = getRecipe(outcome.recipeId);
  // Issue #215 OD-5: the "recipe" policy -- one piece of each required ingredient discovers.
  if (!recipe || evaluatePizzaCompletion(recipe, pizza, "recipe").status !== "PASS") {
    return {
      dex,
      outcome: { kind: "INCOMPLETE_MATCH", recipeId: outcome.recipeId, targetId: outcome.targetId },
    };
  }
  const score = toLegacyScoreBreakdown(computeScoringV2(recipe, pizza), pizza.bakeResult, recipe.bakeTarget);
  return { dex: registerScoreToDex(dex, recipe.id, score).dex, outcome };
}
