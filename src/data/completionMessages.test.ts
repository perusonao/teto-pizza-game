import { describe, expect, it } from "vitest";
import { buildCompletionFailureMessage } from "./completionMessages";
import type { PizzaCompletionFailed } from "../logic/completionGate";

/**
 * Human Feel Tuning 1A (P1 follow-up to the 11 Recipe Human Feel Audit,
 * docs/reports/TETO_11-RECIPE_HUMAN-FEEL_Post-Completion-CT2_Audit.md section 12): pins the
 * exact player-facing copy for each FAILED reason, in particular INSUFFICIENT_SAUCE's new
 * "spread wider" phrasing (not "not enough") -- see completionMessages.ts's own comment on
 * that case for why. Every other reason's copy is asserted unchanged by this tuning pass.
 */

function failed(overrides: Partial<PizzaCompletionFailed>): PizzaCompletionFailed {
  return {
    status: "FAILED",
    reason: "MISSING_REQUIRED_INGREDIENT",
    failures: [],
    ...overrides,
  };
}

describe("buildCompletionFailureMessage", () => {
  it("INSUFFICIENT_SAUCE reads as a 'spread wider' instruction, not an amount complaint, for every sauce-family ingredient", () => {
    expect(
      buildCompletionFailureMessage(
        failed({ reason: "INSUFFICIENT_SAUCE", ingredientId: "tomato-sauce" }),
      ),
    ).toBe("トマトソースをもう少し広くぬろう！");
    expect(
      buildCompletionFailureMessage(failed({ reason: "INSUFFICIENT_SAUCE", ingredientId: "pesto" })),
    ).toBe("ジェノベーゼソースをもう少し広くぬろう！");
    expect(
      buildCompletionFailureMessage(
        failed({ reason: "INSUFFICIENT_SAUCE", ingredientId: "olive-oil" }),
      ),
    ).toBe("オリーブオイルをもう少し広くぬろう！");
  });

  it("INSUFFICIENT_SAUCE never says 少なすぎます (an amount complaint) -- the whole point of this tuning pass", () => {
    const message = buildCompletionFailureMessage(
      failed({ reason: "INSUFFICIENT_SAUCE", ingredientId: "tomato-sauce" }),
    );
    expect(message).not.toContain("少なすぎ");
  });

  it("falls back to a generic ingredient name when ingredientId is missing/unknown", () => {
    expect(buildCompletionFailureMessage(failed({ reason: "INSUFFICIENT_SAUCE" }))).toBe(
      "材料をもう少し広くぬろう！",
    );
  });

  it("every other FAILED reason's copy is unchanged by this tuning pass (INSUFFICIENT_REQUIRED_AMOUNT reworded for Issue #215)", () => {
    expect(
      buildCompletionFailureMessage(
        failed({ reason: "MISSING_REQUIRED_INGREDIENT", ingredientId: "mushroom" }),
      ),
    ).toBe("マッシュルームが入っていません");
    expect(
      buildCompletionFailureMessage(
        failed({ reason: "INSUFFICIENT_REQUIRED_AMOUNT", ingredientId: "mozzarella" }),
      ),
    ).toBe("注文のモッツァレラの数が足りません"); // Issue #215: Lunch Rush "order" policy only
    expect(buildCompletionFailureMessage(failed({ reason: "UNDERBAKED" }))).toBe(
      "生焼けで提供できません",
    );
    expect(buildCompletionFailureMessage(failed({ reason: "OVERBAKED" }))).toBe(
      "焦げすぎて提供できません",
    );
  });
});
