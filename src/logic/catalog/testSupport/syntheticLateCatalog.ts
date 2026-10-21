/**
 * FIN-E1 (Issue #294): a SYNTHETIC catalog with one late-addition (`applicationPhase: "POST_BAKE"`) recipe, for validating the
 * FINISH safety guards (`validateFinishCatalog`) without adding any recipe or ingredient to Production -- the TQ-1C precedent
 * ("a synthetic catalog, never RECIPES"). TEST SUPPORT ONLY. The recipe uses existing ingredients only (parsley stands in for
 * the late garnish, as in `finishFixture`) and is never part of `RECIPES`.
 */
import { deriveCoreSteps } from "../../../data/cookingProfiles";
import { RECIPES, participatesInLunchRush, type Recipe, type RecipeId } from "../../../data/recipes";
import { productionCatalogView, type CatalogView } from "./recipeBatchValidator";

export const SYNTHETIC_LATE_ID = "synthetic-late-pizza" as unknown as RecipeId;

/** A well-formed late recipe: tomato-sauce / mozzarella / chicken before the bake, parsley after it; no CUT, opted out of Lunch Rush. */
export function syntheticLateRecipe(over: Partial<Recipe> = {}): Recipe {
  return {
    id: SYNTHETIC_LATE_ID,
    nameJa: "synthetic late pizza (test only)",
    description: "test-only late-addition recipe; not in RECIPES",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "chicken", minCount: 2 },
      { ingredientId: "parsley", minCount: 2, applicationPhase: "POST_BAKE" },
    ],
    bakeTarget: { start: 60, end: 80 },
    baseRewardPitz: 100,
    lunchRush: false,
    ...over,
  };
}

export interface SyntheticViewOptions {
  /** Steps for the synthetic recipe (default: the production derivation, `deriveCoreSteps`). */
  steps?: readonly string[];
  /** Pieces the synthetic Reference places per ingredient; `null` = no Reference at all. Default: 3 of every required ingredient. */
  referencePieces?: Readonly<Record<string, number>> | null;
  /** Add a Dinner mission target for the synthetic recipe. */
  dinnerTarget?: boolean;
}

/** The production view plus the synthetic recipe (and its Reference / steps), every other recipe untouched. */
export function syntheticCatalogView(recipe: Recipe = syntheticLateRecipe(), options: SyntheticViewOptions = {}): CatalogView {
  const base = productionCatalogView();
  const steps = options.steps ?? deriveCoreSteps(recipe);
  const reference =
    options.referencePieces === undefined
      ? Object.fromEntries(recipe.requiredIngredients.map((q) => [q.ingredientId, 3]))
      : options.referencePieces;
  const recipes = [...RECIPES, recipe];
  return {
    ...base,
    recipes,
    isCutEligible: (id) => (id === recipe.id ? steps.includes("CUT") : base.isCutEligible(id)),
    cookingSteps: (id) => (id === recipe.id ? steps : base.cookingSteps(id)),
    lunchRush: (id) => participatesInLunchRush(id, recipes),
    dinnerTargetIds: [...(base.dinnerTargetIds ?? []), ...(options.dinnerTarget ? [recipe.id as string] : [])],
    referencePieceCount: (id, ingredientId) => {
      if (id !== recipe.id) return base.referencePieceCount?.(id, ingredientId) ?? null;
      return reference === null ? null : (reference[ingredientId] ?? 0);
    },
  };
}
