/**
 * Cooking Steps 2.0 CS-1b (Issue #294, PR-C): the round finalization that `CONFIRM_BAKE` performs,
 * extracted as one pure function. It is the seam a later post-bake step (FINISH, CUT scoring) plugs
 * into; this slice only moves the code, so every result -- and the single inventory consumption -- is
 * byte-identical to the inline version it replaces.
 *
 * What it finalizes, once, from the exact canonical pizza that was just baked:
 *   - free-cook identification (the Phase 3-1 matcher),
 *   - Scoring 2.0 and its legacy `ScoreBreakdown` adapter,
 *   - the Completion Gate,
 *   - the bake classification,
 *   - the one inventory consumption (`consumePizzaInventory`).
 *
 * What it deliberately does NOT do (they stay in `gameReducer.ts`'s CONFIRM_BAKE): choosing the next
 * phase / making step (the #256 post-BAKE skip via `bakeCompletionFailure`), cooking-timing, the
 * non-MATCHED Free Cooking side effects (hint-attempt counter, failed Research trial), and the Dinner
 * wrapper, which reads the result of the base reducer. No input is mutated.
 */
import type { Recipe } from "../data/recipes";
import { FREE_COOK_BAKE_TARGET } from "../data/freeCook";
import { classifyBake, type BakeState } from "../logic/bake";
import { evaluatePizzaCompletion, type PizzaCompletionResult } from "../logic/completionGate";
import { resolveFreeCookPizza, withFreeCookBakeWindow, type FreeCookResolution } from "../logic/discovery/freeCook";
import type { ScoreBreakdown } from "../logic/scoring";
import { computeScoringV2, toLegacyScoreBreakdown, type ScoringV2Result } from "../logic/scoringV2";
import type { DexState } from "./dex";
import { consumePizzaInventory, consumePostBakeInventory, type InventoryState } from "./inventory";
import { pizzaForFinalEvaluation, withoutPostBakeRequirements } from "./finishEngine";
import type { PizzaState } from "./pizzaState";
import { completionPolicyForRound, type RoundKind } from "./roundKind";

export interface FinalizeRoundInput {
  /** The round's recipe (the free-cook / Dinner sentinel for recipe-free rounds). */
  recipe: Recipe;
  /** The baked pizza; `bakeResult` is set from `bakeValue` here. */
  pizza: PizzaState;
  /** The raw 0..100 needle position CONFIRM_BAKE received. */
  bakeValue: number;
  freeCook: boolean;
  isMissionRound: boolean;
  roundKind: RoundKind;
  dex: DexState;
  inventory: InventoryState;
  /**
   * Cooking Steps 2.0 FINISH engine (OD-CS-2 = B). Absent / `"SINGLE"` = today's one-shot finalization (every call
   * site). `"PROVISIONAL"` = CONFIRM_BAKE of a recipe with late requirements: they are left out of the Completion Gate
   * only. Scoring 2.0 keeps the full recipe (its Reference is loaded by recipe id), so the provisional score reads the
   * late ingredient as missing -- it is exactly what the FINAL pass would score on the same pre-bake pizza. It is shown
   * only when a failed bake skips FINISH (the late ingredient then never reaches the pizza, so that IS the final
   * score); otherwise FINISH replaces it. `"FINAL"` = the FINISH confirmation: the full recipe is judged on the finished pizza, and only
   * the pieces placed in FINISH are consumed (the rest were consumed provisionally). For a recipe with no late
   * requirement PROVISIONAL judges exactly like SINGLE. Free Cooking has no FINISH yet (UD-B), so it always runs as SINGLE.
   */
  finalization?: "SINGLE" | "PROVISIONAL" | "FINAL";
}

/** A Free Cooking pizza the matcher did not resolve to a recipe (FAILED / ORIGINAL / AMBIGUOUS /
 *  INCOMPLETE_MATCH): unscored, with the sentinel recipe kept. */
export interface UnmatchedFreeCookFinalization {
  kind: "UNMATCHED_FREE_COOK";
  pizza: PizzaState;
  /** The non-MATCHED resolution, for the reducer's own side effects. */
  freeCook: Exclude<FreeCookResolution, { kind: "MATCHED" }>;
  bakeState: BakeState;
  completion: PizzaCompletionResult;
  inventory: InventoryState;
}

/** Every other round (guided, Lunch Rush, Dinner's sentinel, and a MATCHED free-cook pizza). */
export interface ScoredFinalization {
  kind: "SCORED";
  /** The recipe the round continues as (the matched recipe for a MATCHED free-cook pizza). */
  recipe: Recipe;
  pizza: PizzaState;
  score: ScoreBreakdown;
  bakeState: BakeState;
  scoringV2Result: ScoringV2Result;
  completion: PizzaCompletionResult;
  inventory: InventoryState;
}

export type FinalizedRound = UnmatchedFreeCookFinalization | ScoredFinalization;

export function finalizeRound(input: FinalizeRoundInput): FinalizedRound {
  const { bakeValue } = input;
  const pizza: PizzaState = { ...input.pizza, bakeResult: bakeValue };
  // Progression 2.0 Phase 3-2: a free-cook pizza is identified here, once, by the Phase 3-1 matcher.
  // A MATCHED pizza becomes that recipe's round from this point on; anything else keeps the sentinel
  // and is either FAILED (not a dish) or an unscored ORIGINAL pizza.
  const freeCook = input.freeCook ? resolveFreeCookPizza(pizza, input.dex) : null;
  if (freeCook && freeCook.kind !== "MATCHED") {
    return {
      kind: "UNMATCHED_FREE_COOK",
      pizza,
      freeCook,
      bakeState: classifyBake(bakeValue, input.recipe.bakeTarget),
      completion: freeCook.kind === "FAILED" ? freeCook.completion : { status: "PASS" },
      inventory: consumePizzaInventory(pizza, input.inventory),
    };
  }
  const recipe = freeCook ? freeCook.recipe : input.recipe;
  const finalization = input.freeCook ? "SINGLE" : (input.finalization ?? "SINGLE");
  // What the Completion Gate judges against: the same object as `recipe` unless this is a PROVISIONAL pass over a recipe
  // with late requirements. Scoring 2.0 keeps the FULL recipe: its Reference is loaded by recipe id and must match the
  // recipe's requirements, so a recipe with a requirement removed would make the whole provisional score unavailable.
  // A provisional score is replaced by the FINAL one, and a failed round earns no credit either way.
  const gateRecipe = finalization === "PROVISIONAL" ? withoutPostBakeRequirements(recipe) : recipe;
  // FINAL: a late requirement is met by FINISH pieces only (the same object as `pizza` unless the recipe has one).
  const judgedPizza = finalization === "FINAL" ? pizzaForFinalEvaluation(recipe, pizza) : pizza;
  // Issue #482 (OD-B6 F1): a MATCHED free-cook pizza is judged -- Completion Gate, badge, star cap --
  // by the generic window its gauge showed; the matched recipe's own window is only Scoring 2.0's
  // (`computeScoringV2` below reads it from `recipe`). Every other round uses its recipe's window.
  const judgedBakeTarget = freeCook ? FREE_COOK_BAKE_TARGET : recipe.bakeTarget;
  const bakeState = classifyBake(bakeValue, judgedBakeTarget);
  // A1 Authority Cutover: Scoring 2.0 is the sole scoring authority; this is its one call site,
  // shared by FREE and Lunch Rush alike.
  const scoringV2Result = computeScoringV2(recipe, judgedPizza);
  const score = toLegacyScoreBreakdown(scoringV2Result, bakeValue, judgedBakeTarget);
  // Completion Gate Phase 1 / Lunch Rush Completion Gate 1A: computed unconditionally, from this exact
  // canonical pizza, independently of Scoring 2.0. Issue #215 (OD-1 = G1 / OD-4 = LR-A): a Lunch Rush
  // round still needs the ordered quantity ("order"); every other round completes with one piece of
  // each required ingredient ("recipe"); Dinner reads the round kind.
  const completion = evaluatePizzaCompletion(
    freeCook ? withFreeCookBakeWindow(recipe) : gateRecipe,
    judgedPizza,
    input.isMissionRound ? "order" : completionPolicyForRound({ roundKind: input.roundKind }),
  );
  // EP2: the sole inventory-consumption transaction, from this exact pizza -- ingredients used on a
  // FAILED pizza were still genuinely used, so it does not depend on `completion`.
  const inventory =
    finalization === "FINAL" ? consumePostBakeInventory(pizza, input.inventory) : consumePizzaInventory(pizza, input.inventory);
  return { kind: "SCORED", recipe, pizza, score, bakeState, scoringV2Result, completion, inventory };
}
