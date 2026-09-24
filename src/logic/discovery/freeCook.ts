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
 *    applies. PASS -> MATCHED: the round is then
 *    scored, registered and paid as that recipe by the unchanged REGISTER_TO_DEX path.
 *    FAILED -> INCOMPLETE_MATCH, shown as an original pizza with a near-miss note.
 *
 * Everything else (no match, an ambiguous match, an incomplete match) is an ORIGINAL pizza: a
 * normal, finished result, not a failure. It is not scored (there is no recipe to score it
 * against), and it writes nothing to the Dex.
 */
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { FREE_COOK_RECIPE } from "../../data/freeCook";
import { getRecipe, type Recipe } from "../../data/recipes";
import { discoveredRecipeIds, type DexState } from "../../state/dex";
import type { PizzaState } from "../../state/pizzaState";
import {
  evaluatePizzaCompletion,
  type PizzaCompletionFailed,
  type PizzaCompletionResult,
} from "../completionGate";
import { sanitizeStringArray, sanitizeToppings } from "../scoringV2/boundary";
import { evaluateDiscovery, type DiscoveryOutcome } from "./matcher";
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

/** Phase-2 X-3's recipe-free completion rule. */
export function evaluateFreeCookCompletion(pizza: PizzaState): PizzaCompletionResult {
  const hasItem =
    sanitizeStringArray(pizza?.sauceIds).length > 0 || sanitizeToppings(pizza?.toppings).length > 0;
  // The sentinel recipe has no requirements and no Reference, so this is the bake check alone.
  const bake = evaluatePizzaCompletion(FREE_COOK_RECIPE, pizza);
  if (hasItem) return bake;
  const empty = { reason: "MISSING_REQUIRED_INGREDIENT" as const };
  return {
    status: "FAILED",
    reason: empty.reason,
    failures: bake.status === "FAILED" ? [empty, ...bake.failures] : [empty],
  };
}

export function resolveFreeCookPizza(pizza: PizzaState, dex: DexState): FreeCookResolution {
  const completion = evaluateFreeCookCompletion(pizza);
  if (completion.status === "FAILED") return { kind: "FAILED", completion };

  const outcome = evaluateDiscovery(
    signatureOfPizza(pizza),
    RECIPE_DISCOVERY_CATALOG,
    discoveredRecipeIds(dex),
  );
  if (outcome.kind !== "NEW_DISCOVERY" && outcome.kind !== "ALREADY_DISCOVERED") {
    return { kind: "ORIGINAL", outcome };
  }
  const recipe = getRecipe(outcome.recipeId);
  if (!recipe || evaluatePizzaCompletion(recipe, pizza, "recipe").status !== "PASS") {
    return {
      kind: "ORIGINAL",
      outcome: { kind: "INCOMPLETE_MATCH", recipeId: outcome.recipeId, targetId: outcome.targetId },
    };
  }
  return { kind: "MATCHED", recipe, outcome };
}
