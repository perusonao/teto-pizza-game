/**
 * Discovery 3.0 PR-1 (OD-D3-20 / OD-D3-23): the RESULT's recipe-independent execution advice.
 *
 * A finished Free Cooking pizza whose own sauce is too thin says so -- whatever the pizza is. The advice is a
 * pure function of the player's own pizza and one shared reference amount; it never reads the matcher outcome,
 * a recipe, a hint, the Dex or the discoverable pool, so it cannot tell the player whether the ingredient
 * combination is right (the old 「図鑑のピザまであと少し」 line could: it appeared only for an exact match whose
 * completion gate failed).
 *
 * - The floor is `isSauceBelowMinimum` (../logic/completionGate.ts), the very function the Completion Gate
 *   uses, so "thin" means one thing. The reference is the generic sauce amount: every recipe's Reference derives
 *   its sauce quantity / coverage from the same ideal fixture (`computeMechanicalSauceReference`), which
 *   `executionAdvice.test.ts` re-checks for all recipes.
 * - No bake advice: the bake badge already shows the generic bake state. A recipe's own bake window must not be
 *   used here (it would reveal which recipe the combination is). A pizza that fails only that window gets no
 *   advice (OD-D3-23); a future Execution Feedback design may revisit it.
 * - Static text: nothing here is stored (the Trial Notebook keeps the player's combination and the near-miss
 *   line it was shown, not this).
 */
import { computeMechanicalSauceReference } from "../data/referencePizza";
import { isSauceBelowMinimum } from "../logic/completionGate";
import { sanitizeStringArray } from "../logic/scoringV2/boundary";
import type { PizzaState } from "./pizzaState";

export const SAUCE_THIN_ADVICE_JA = "ソースが少なめかも。もう少し広く塗ってみよう。";

/** The shared sauce amount (identical for every recipe; see the file header). */
export function genericSauceReference() {
  const { quantity, coverage } = computeMechanicalSauceReference("margherita");
  return { quantity, coverage };
}

/** The advice for this pizza, or `null` when there is nothing recipe-independent to say. */
export function executionAdviceJa(pizza: PizzaState): string | null {
  if (sanitizeStringArray(pizza?.sauceIds).length === 0) return null;
  return isSauceBelowMinimum(pizza?.sauceDeposits, genericSauceReference()) ? SAUCE_THIN_ADVICE_JA : null;
}
