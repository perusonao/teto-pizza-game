/**
 * Progression 2.0 Phase 3-2 (Issue #194): what a finished free-cook pizza *is*.
 *
 * Pure and deterministic; called once from gameReducer's CONFIRM_BAKE for a free-cook round.
 * The order of questions follows Phase-2 X-3:
 *
 * 1. **Recipe-free completion.** Is it a dish at all? Dough (always present), at least one item
 *    (a sauce or a piece), and the generic bake window (`FREE_COOK_BAKE_TARGET`). A pizza that
 *    fails this is FAILED exactly like a recipe round's Completion Gate failure (raw, burnt or
 *    empty) -- never "original".
 * 2. **Signature match** with the Phase 3-1 matcher against the Dex as it was before this round.
 *    NEW_DISCOVERY / ALREADY_DISCOVERED name one real recipe.
 * 3. **The matched recipe's own Completion Gate** under the `"recipe"` policy (at least one piece
 *    of each required ingredient -- Issue #215 OD-5: quantity is never recipe identity, so an
 *    under-ideal pizza is still a discovery and pays for it in Scoring 2.0's quantity factor --
 *    plus sauce amount and bake window), the same rule Phase 3-1's cross-recipe discovery
 *    applies -- except the bake window, which stays the generic one the gauge showed (Issue #482 /
 *    OD-B6 F1: the recipe's own window is a Scoring 2.0 matter in Free Cooking). PASS -> MATCHED: the round is then
 *    scored, registered and paid as that recipe by the unchanged REGISTER_TO_DEX path.
 *    FAILED -> INCOMPLETE_MATCH, shown as an original pizza with a near-miss note.
 *
 * Everything else (no match, an ambiguous match, an incomplete match) is an ORIGINAL pizza: a
 * normal, finished result, not a failure. It is not scored (there is no recipe to score it
 * against), and it writes nothing to the Dex.
 */
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { FREE_COOK_BAKE_TARGET, FREE_COOK_RECIPE } from "../../data/freeCook";
import { getRecipe, type BakeTarget, type Recipe, type RecipeId } from "../../data/recipes";
import { discoveredRecipeIds, type DexState } from "../../state/dex";
import { pizzaForFinalEvaluation } from "../../state/finishEngine";
import type { PizzaState } from "../../state/pizzaState";
import {
  evaluatePizzaCompletion,
  type PizzaCompletionFailed,
  type PizzaCompletionResult,
} from "../completionGate";
import { sanitizeStringArray, sanitizeToppings } from "../scoringV2/boundary";
import { evaluateDiscovery, type DiscoveryOutcome, type RecipeDiscoveryTarget } from "./matcher";
import { signatureOfPizza } from "./signature";

/** The discovery outcomes a free-cook result can show as an original pizza. */
export type OriginalOutcome = Extract<
  DiscoveryOutcome,
  { kind: "ORIGINAL" } | { kind: "AMBIGUOUS" } | { kind: "INCOMPLETE_MATCH" }
>;

export type FreeCookResolution =
  | { kind: "FAILED"; completion: PizzaCompletionFailed }
  | {
      kind: "MATCHED";
      recipe: Recipe;
      outcome: Extract<DiscoveryOutcome, { kind: "NEW_DISCOVERY" } | { kind: "ALREADY_DISCOVERED" }>;
    }
  | { kind: "ORIGINAL"; outcome: OriginalOutcome };

/**
 * Phase-2 X-3's recipe-free completion rule. `bakeTarget` defaults to the generic window; Dinner
 * Mission DM-3R-1 (../../mission/dinner/dinnerResultDetection.ts) passes the window of the recipe
 * the pizza's composition already identifies, so "is it a dish at all" is judged against the same
 * window the BAKE step used.
 */
export function evaluateFreeCookCompletion(
  pizza: PizzaState,
  bakeTarget: BakeTarget = FREE_COOK_BAKE_TARGET,
): PizzaCompletionResult {
  const hasItem =
    sanitizeStringArray(pizza?.sauceIds).length > 0 || sanitizeToppings(pizza?.toppings).length > 0;
  // The sentinel recipe has no requirements and no Reference, so this is the bake check alone.
  const sentinel = bakeTarget === FREE_COOK_BAKE_TARGET ? FREE_COOK_RECIPE : { ...FREE_COOK_RECIPE, bakeTarget };
  const bake = evaluatePizzaCompletion(sentinel, pizza);
  if (hasItem) return bake;
  const empty = { reason: "MISSING_REQUIRED_INGREDIENT" as const };
  return {
    status: "FAILED",
    reason: empty.reason,
    failures: bake.status === "FAILED" ? [empty, ...bake.failures] : [empty],
  };
}

/**
 * Issue #482 (OD-B6 F1): Free Cooking judges "is it a dish" -- and the result badge -- by the one
 * window its gauge shows (`FREE_COOK_BAKE_TARGET`), never by the matched recipe's own. The recipe's
 * window only enters Scoring 2.0's Bake component. This returns the recipe with that window swapped
 * in for the Completion Gate (ingredients and sauce checks are the recipe's own, unchanged).
 */
export function withFreeCookBakeWindow(recipe: Recipe): Recipe {
  return { ...recipe, bakeTarget: FREE_COOK_BAKE_TARGET };
}

/** The recipe lookup / catalog `resolveFreeCookPizza` reads; a test can pass a synthetic late recipe (never added to `RECIPES`). */
export interface FreeCookResolveSources {
  catalog: readonly RecipeDiscoveryTarget[];
  getRecipe: (id: RecipeId) => Recipe | undefined;
}

export function resolveFreeCookPizza(
  pizza: PizzaState,
  dex: DexState,
  sources: FreeCookResolveSources = { catalog: RECIPE_DISCOVERY_CATALOG, getRecipe },
): FreeCookResolution {
  const completion = evaluateFreeCookCompletion(pizza);
  if (completion.status === "FAILED") return { kind: "FAILED", completion };

  const outcome = evaluateDiscovery(
    signatureOfPizza(pizza),
    sources.catalog,
    discoveredRecipeIds(dex),
  );
  if (outcome.kind !== "NEW_DISCOVERY" && outcome.kind !== "ALREADY_DISCOVERED") {
    return { kind: "ORIGINAL", outcome };
  }
  const recipe = sources.getRecipe(outcome.recipeId);
  // Identification and cooking share one contract: a late requirement is met by FINISH pieces only (`pizzaForFinalEvaluation`, the
  // same filter `finalizeRound` applies to a FINAL pass), so a pizza this accepts is never then FAILED by the FINAL Completion Gate.
  // A recipe with no late requirement gets the same pizza object back -- every shipped recipe resolves exactly as before.
  if (
    !recipe ||
    evaluatePizzaCompletion(withFreeCookBakeWindow(recipe), pizzaForFinalEvaluation(recipe, pizza), "recipe").status !== "PASS"
  ) {
    return {
      kind: "ORIGINAL",
      outcome: { kind: "INCOMPLETE_MATCH", recipeId: outcome.recipeId, targetId: outcome.targetId },
    };
  }
  return { kind: "MATCHED", recipe, outcome };
}
