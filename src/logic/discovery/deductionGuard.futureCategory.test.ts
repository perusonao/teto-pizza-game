import { describe, expect, it, vi } from "vitest";

/**
 * Discovery Hint 4.0 (Issue #253), DH4-2B Pre-Implementation Gate: a FUTURE ingredient category
 * (for example a spread layer or a dough base) that Rule W does not rank. The catalog is extended in
 * this test file only (a module mock); production data is unchanged.
 */
vi.mock("../../data/ingredients", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../data/ingredients")>();
  const extra = [
    { ...original.INGREDIENTS[0], id: "future-spread-a", nameJa: "みらいスプレッドA", category: "spread" },
    { ...original.INGREDIENTS[0], id: "future-spread-b", nameJa: "みらいスプレッドB", category: "spread" },
  ] as unknown as typeof original.INGREDIENTS;
  const INGREDIENTS = [...original.INGREDIENTS, ...extra];
  return { ...original, INGREDIENTS, getIngredient: (id: string) => INGREDIENTS.find((i) => i.id === id) };
});

const { ALL_INGREDIENT_IDS } = await import("./testSupport/deductionInversion");
const { guardedAnswerForParts, hypotheticalReserves, toppingClauseAllowedForParts } = await import("./deductionGuard");
const { endgameAttack } = await import("./testSupport/deductionAttacker");

const OWNED = [...ALL_INGREDIENT_IDS, "future-spread-a", "future-spread-b"];
const guard = { answer: guardedAnswerForParts, clauseAllowed: toppingClauseAllowedForParts };

describe("future (unranked) category", () => {
  it("an unranked hypothesis never enters H, and owning such items leaves the answer leak-free", () => {
    const parts = { recipeIngredientIds: ["tomato-sauce", "mozzarella", "basil", "ham"], reserveId: "ham", keyId: "basil", owned: OWNED };
    expect(hypotheticalReserves(parts).some((id) => id.startsWith("future-"))).toBe(false);
    expect(hypotheticalReserves(parts)).toContain("ham");
    const results = endgameAttack(guard, { recipeIngredientIds: parts.recipeIngredientIds, reserveId: "ham", keyId: "basil", owned: OWNED });
    expect(results.filter((r) => r.leak)).toEqual([]);
  });
  it("an unranked item in the known part fails closed: existence, no clause", () => {
    const parts = { recipeIngredientIds: ["future-spread-a", "mozzarella", "basil", "ham"], reserveId: "ham", keyId: "basil", owned: OWNED };
    expect(hypotheticalReserves(parts)).toEqual([]);
    expect(guardedAnswerForParts(parts)).toEqual({ level: "existence", factId: "attr:existence" });
    expect(toppingClauseAllowedForParts(parts)).toBe(false);
  });
  it("an unranked reserve fails closed: existence, no clause", () => {
    const parts = { recipeIngredientIds: ["tomato-sauce", "future-spread-a"], reserveId: "future-spread-a", keyId: "tomato-sauce", owned: OWNED };
    expect(guardedAnswerForParts(parts)).toEqual({ level: "existence", factId: "attr:existence" });
    expect(toppingClauseAllowedForParts(parts)).toBe(false);
  });
});
