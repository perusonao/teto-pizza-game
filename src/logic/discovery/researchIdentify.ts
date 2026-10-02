/**
 * Issue #356 (Discovery 3.1) Slice 1: Correct Ingredient Identification -- the pure domain.
 *
 * The player declares ONE ingredient before a Research Target attempt; after the attempt this module says
 * whether that single ingredient is identified. It carries no state and reads no save.
 *
 * - **Authority**: membership is `getRecipe(targetId).requiredIngredients` -- the very list the matcher's
 *   `RECIPE_DISCOVERY_CATALOG.items` is derived from. No new membership table exists. Sauce, cheese and
 *   topping are one list, so there is no per-category branch.
 * - **One bit, one ingredient**: the only fact an attempt can reveal is "the declared ingredient is in the
 *   target recipe". Nothing about any other ingredient on the pizza is read.
 * - **Verdict parity (Anti-Oracle 2.0, INV-3)**: only a plain ORIGINAL outcome can be POSITIVE. A negative,
 *   an INCOMPLETE_MATCH and an AMBIGUOUS outcome all return the same NOT_IDENTIFIED, so a player-facing line
 *   built from the verdict cannot tell them apart. MATCHED / FAILED rounds never reach this module.
 * - **Matcher independence (INV-4)**: this runs after the matcher; it is never an input to it.
 * - The only persisted result is the existing `ing:<id>` Hint fact (`addFactId`), never a negative.
 */
import { getRecipe, type RecipeId } from "../../data/recipes";
import { sanitizeStringArray, sanitizeToppings } from "../scoringV2/boundary";
import { hintFactId } from "./selectableHint";

export type IngredientTestVerdict = "POSITIVE" | "NOT_IDENTIFIED" | "NOT_USED";

/** The pizza shape this module reads: only the ingredients actually placed. */
export interface IngredientTestPizza {
  sauceIds?: unknown;
  toppings?: unknown;
}

export interface IngredientTestInput {
  /** The Research Target the attempt was declared against. */
  targetRecipeId: string;
  /** The single ingredient the player declared before the attempt. */
  testedIngredientId: string;
  pizza: IngredientTestPizza;
  /** `DiscoveryOutcome.kind` of the finished attempt (ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH). */
  outcomeKind: string;
}

export interface IngredientTestResult {
  verdict: IngredientTestVerdict;
  /** The one `ing:<id>` fact to persist, only for POSITIVE. Never set for anything else. */
  addFactId: string | null;
}

/** Whether `ingredientId` is in the canonical recipe (the matcher's own identity list). */
export function isCanonicalRecipeIngredient(recipeId: string, ingredientId: string): boolean {
  const recipe = getRecipe(recipeId as RecipeId);
  return !!recipe && recipe.requiredIngredients.some((r) => r.ingredientId === ingredientId);
}

/** Whether the pizza actually carries at least one piece of `ingredientId` (same sanitize path as stock use). */
export function pizzaUsesIngredient(pizza: IngredientTestPizza, ingredientId: string): boolean {
  return (
    sanitizeStringArray(pizza.sauceIds).includes(ingredientId) ||
    sanitizeToppings(pizza.toppings).some((t) => t.ingredientId === ingredientId)
  );
}

export function evaluateIngredientTest(input: IngredientTestInput): IngredientTestResult {
  if (!pizzaUsesIngredient(input.pizza, input.testedIngredientId)) return { verdict: "NOT_USED", addFactId: null };
  if (input.outcomeKind === "ORIGINAL" && isCanonicalRecipeIngredient(input.targetRecipeId, input.testedIngredientId)) {
    return { verdict: "POSITIVE", addFactId: hintFactId(input.testedIngredientId) };
  }
  return { verdict: "NOT_IDENTIFIED", addFactId: null };
}
