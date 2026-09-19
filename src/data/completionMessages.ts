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
      // Human Feel Tuning 1A (P1 follow-up to the 11 Recipe Human Feel Audit,
      // docs/reports/TETO_11-RECIPE_HUMAN-FEEL_Post-Completion-CT2_Audit.md section 12): the
      // gate here is a coverage-area check (../logic/completionGate.ts's `checkSauceQuantity`),
      // not purely a quantity one -- a single straight one-way swipe can dispense plenty of
      // sauce and still fail this check because it never covers enough of the dough. The old
      // 「少なすぎます」("not enough") phrasing reads as an amount problem and tempts a player to
      // just hold longer/press harder rather than spread wider, which can never pass. This copy
      // change is the only behavior change in that tuning pass -- the gate/threshold themselves
      // are untouched.
      return `${ingredientNameJa(failed.ingredientId)}をもう少し広くぬろう！`;
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
