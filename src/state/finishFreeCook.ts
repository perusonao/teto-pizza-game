/**
 * FINISH FIN-E3a (Issue #604 / #294, Owner Decision UD-B): the Free Cooking half of the FINISH engine -- what CONFIRM_BAKE does for a
 * Free round whose profile carries FINISH. Pure; the reducer applies the result.
 *
 * A Free round's identification (the Phase 3-1 matcher), Scoring 2.0, the Completion Gate and the Research / hint side effects all
 * run in `finalizeRound`'s Free path, once. With FINISH the pizza is not finished at the bake -- a piece placed in FINISH can change
 * what dish it is -- so that pass moves to the FINISH confirmation (CONFIRM_MAKING_STEP, `finalization: "FINAL"`). What stays at the
 * bake is the one question that cannot wait: did the bake itself fail? (OD-CS-7 = A: a failed bake skips FINISH and keeps the
 * existing failure flow.) That is answered here from the same matcher verdict `finalizeRound` would give, and then discarded.
 *
 * Nothing about the dish is kept: no recipe, score, completion, discovery outcome or counter is written while the round waits in
 * FINISH, so the FINISH screen cannot name or hint at what the pizza is (anti-oracle). Only the pre-bake pieces are consumed here;
 * the FINISH pieces are consumed once, on the FINAL pass.
 */
import { classifyBake, type BakeState } from "../logic/bake";
import { bakeCompletionFailure } from "../logic/completionGate";
import { resolveFreeCookPizza } from "../logic/discovery/freeCook";
import type { Recipe } from "../data/recipes";
import type { DexState } from "./dex";
import { consumePizzaInventory, type InventoryState } from "./inventory";
import type { PizzaState } from "./pizzaState";

export interface DeferFreeCookInput {
  /** The Free Cooking sentinel recipe (its bake window is the generic one the gauge showed). */
  recipe: Recipe;
  pizza: PizzaState;
  /** The raw 0..100 needle position CONFIRM_BAKE received. */
  bakeValue: number;
  dex: DexState;
  inventory: InventoryState;
}

export type DeferredFreeCookBake =
  /** The bake held: the round continues in FINISH, still unidentified. */
  | { kind: "DEFERRED"; pizza: PizzaState; bakeState: BakeState; inventory: InventoryState }
  /** UNDERBAKED / OVERBAKED: FINISH is skipped and the round finalizes in one pass, exactly as a Free round without FINISH. */
  | { kind: "BAKE_FAILED" };

export function deferFreeCookAtBake(input: DeferFreeCookInput): DeferredFreeCookBake {
  const pizza: PizzaState = { ...input.pizza, bakeResult: input.bakeValue };
  const resolution = resolveFreeCookPizza(pizza, input.dex);
  if (resolution.kind === "FAILED" && bakeCompletionFailure(resolution.completion) !== null) return { kind: "BAKE_FAILED" };
  return {
    kind: "DEFERRED",
    pizza,
    bakeState: classifyBake(input.bakeValue, input.recipe.bakeTarget),
    inventory: consumePizzaInventory(pizza, input.inventory),
  };
}
