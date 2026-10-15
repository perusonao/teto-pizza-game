/**
 * Cooking Steps 2.0 FINISH engine, slice D1a (Issue #294 / #465 item 10): the pure rules of a "late addition" --
 * an ingredient the recipe asks for AFTER the bake. Nothing here is wired into the reducer or the UI yet (D1b / D2),
 * and no `RECIPES` entry uses it, so Production behavior is unchanged.
 *
 * Authority: Issue #294 Owner Decision of 2026-10-14 (recorded in docs/decisions/TETO_COOKING-STEPS-2.0_FINISH-ENGINE_OWNER-DECISIONS.md):
 *   OD-CS-3 = A  the late requirement lives on the recipe (`RecipeRequirement.applicationPhase`), never on an ingredient;
 *   OD-CS-11 = A late pieces are scored by the existing Pieces / Recipe components (no bonus, no ruleset change);
 *   OD-CS-7 = A  a failed bake skips FINISH (the existing `bakeCompletionFailure` verdict -- no new threshold).
 */
import type { Recipe } from "../data/recipes";
import type { PizzaState } from "./pizzaState";
import { isDinnerRound, isFreeCookingRound, isLunchRushRound, type HasRoundKind } from "./roundKind";

/** True when any requirement of `recipe` is met after the bake. False for every shipped recipe. */
export function hasPostBakeRequirement(recipe: Pick<Recipe, "requiredIngredients">): boolean {
  return recipe.requiredIngredients.some((req) => req.applicationPhase === "POST_BAKE");
}

/**
 * The recipe as it can be judged at CONFIRM_BAKE, before FINISH: late requirements left out (OD-CS-2 = B,
 * "provisional"). A recipe with no late requirement is returned as the SAME object, so every shipped recipe is
 * evaluated byte-identically to before.
 */
export function withoutPostBakeRequirements<R extends Pick<Recipe, "requiredIngredients">>(recipe: R): R {
  if (!hasPostBakeRequirement(recipe)) return recipe;
  return { ...recipe, requiredIngredients: recipe.requiredIngredients.filter((req) => req.applicationPhase !== "POST_BAKE") };
}

/**
 * Whether a round kind may have a FINISH step at all. Lunch Rush (ranking fairness) and Dinner (Stage A
 * identifies at START_BAKE) are excluded fail-closed until the Owner decides UD-I; the exclusion is itself asserted.
 */
export function finishAllowedForRound(round: HasRoundKind): boolean {
  return !isLunchRushRound(round) && !isDinnerRound(round);
}

/**
 * D1b: whether the reducer runs the FINISH step for this round. Only a Guided round does (Owner Decision D1b-6):
 * Lunch Rush and Dinner by `finishAllowedForRound`, Free Cooking (which includes Research) because it has no FINISH
 * UI and always finalizes in one pass (UD-B). Everything that makes FINISH act in the reducer asks this one function.
 */
export function roundRunsFinish(round: HasRoundKind): boolean {
  return finishAllowedForRound(round) && !isFreeCookingRound(round);
}

/** The pieces placed in FINISH (`stage === "post"`), in placement order. */
export function postBakePieces(pizza: Pick<PizzaState, "toppings">): PizzaState["toppings"] {
  return pizza.toppings.filter((piece) => piece.stage === "post");
}

/**
 * The pizza as the FINAL evaluation reads it. The phase restriction runs in both directions:
 *  - a requirement declared `POST_BAKE` is met only by pieces placed in FINISH (`stage === "post"`), so a pre-bake
 *    piece of that ingredient cannot hand the recipe its late ingredient for free;
 *  - a requirement with no `applicationPhase` (pre-bake) is met only by pieces placed before the bake, so a FINISH
 *    piece of that ingredient cannot repair a missing ordinary ingredient.
 * Pieces of ingredients the recipe does not require are untouched, and an ingredient required in BOTH phases is left
 * as is (the two sets of pieces cannot be told apart by requirement). A recipe with no late requirement gets the SAME
 * pizza object back, so every shipped recipe is evaluated exactly as before.
 */
export function pizzaForFinalEvaluation<P extends Pick<PizzaState, "toppings">>(recipe: Pick<Recipe, "requiredIngredients">, pizza: P): P {
  const lateIds = new Set(recipe.requiredIngredients.filter((req) => req.applicationPhase === "POST_BAKE").map((req) => req.ingredientId));
  if (lateIds.size === 0) return pizza;
  const earlyIds = new Set(recipe.requiredIngredients.filter((req) => req.applicationPhase !== "POST_BAKE").map((req) => req.ingredientId));
  const toppings = pizza.toppings.filter((piece) => {
    const isPost = piece.stage === "post";
    if (isPost) return !earlyIds.has(piece.ingredientId) || lateIds.has(piece.ingredientId);
    return !lateIds.has(piece.ingredientId) || earlyIds.has(piece.ingredientId);
  });
  return toppings.length === pizza.toppings.length ? pizza : { ...pizza, toppings };
}
