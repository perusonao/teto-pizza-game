/**
 * Completion Gate Phase 1: player-facing Japanese copy for a FAILED round, kept deliberately
 * separate from ../logic/completionGate.ts's own reason codes -- the logic module never emits
 * display text, and this module has no opinion on PASS/FAILED itself, only on how to phrase a
 * `CompletionFailureDetail` once one exists. One line per primary reason (section 13's "主理由
 * を1つ大きく表示" -- Phase 1 deliberately does not build a multi-reason detail view).
 */
import { completionFailureIngredientName } from "../logic/completionGate";
import type { PizzaCompletionFailed } from "../logic/completionGate";

const FALLBACK_INGREDIENT_NAME = "材料";

function ingredientNameJa(ingredientId: string | undefined): string {
  return completionFailureIngredientName(ingredientId) ?? FALLBACK_INGREDIENT_NAME;
}

/** The one big reason line shown on a FAILED RESULT screen. */
export function buildCompletionFailureMessage(failed: PizzaCompletionFailed): string {
  switch (failed.reason) {
    case "MISSING_REQUIRED_INGREDIENT":
      return `${ingredientNameJa(failed.ingredientId)}が入っていません`;
    case "INSUFFICIENT_REQUIRED_AMOUNT":
      return `${ingredientNameJa(failed.ingredientId)}が足りませんでした`;
    case "INSUFFICIENT_SAUCE":
      return `${ingredientNameJa(failed.ingredientId)}が少なすぎます`;
    case "UNDERBAKED":
      return "生焼けで提供できません";
    case "OVERBAKED":
      return "焦げすぎて提供できません";
    default: {
      const exhaustive: never = failed.reason;
      return exhaustive;
    }
  }
}
