import { describe, expect, it } from "vitest";
import {
  QUANTITY_EXCESS_COEFFICIENT,
  QUANTITY_SHORTAGE_COEFFICIENT,
  scoreQuantityComponentV2,
} from "./quantityComponent";
import type { PieceGroupScoreV2 } from "./types";

function group(ingredientId: string, playerCount: number, targetCount: number): PieceGroupScoreV2 {
  return {
    available: true,
    ingredientId,
    targetCount,
    playerCount,
    quantitySimilarity: 1,
    placementSimilarity: 1,
    score: 100,
  };
}

describe("Issue #215 quantity factor Q (OD-2 = 0.5, OD-3/OD-4b = 0.15)", () => {
  it("pins the Owner Decision coefficients", () => {
    expect(QUANTITY_SHORTAGE_COEFFICIENT).toBe(0.5);
    expect(QUANTITY_EXCESS_COEFFICIENT).toBe(0.15);
  });

  it("is exactly 1 when every group matches its Reference quantity", () => {
    const q = scoreQuantityComponentV2([group("mozzarella", 3, 3), group("basil", 2, 2)]);
    expect(q).toEqual({ available: true, shortageRatio: 0, excessRatio: 0, shortage: null, excess: null, factor: 1 });
  });

  it("is exactly 1 for a recipe with no piece groups", () => {
    expect(scoreQuantityComponentV2([]).factor).toBe(1);
  });

  it.each([
    [3, 1],
    [2, 1 - 0.5 * (1 / 3)],
    [1, 1 - 0.5 * (2 / 3)],
    [0, 1 - 0.5 * 1],
    [4, 1 - 0.15 * (1 / 3)],
    [5, 1 - 0.15 * (2 / 3)],
    [6, 1 - 0.15 * 1],
    [9, 1 - 0.15 * 1], // excess ratio is capped at 1
  ])("ideal 3 -> %i pieces: factor %f", (placed, expected) => {
    expect(scoreQuantityComponentV2([group("mushroom", placed, 3)]).factor).toBeCloseTo(expected, 12);
  });

  it("uses the worst group, not an average, and reports it", () => {
    const q = scoreQuantityComponentV2([group("mozzarella", 2, 3), group("basil", 1, 2), group("olive", 3, 3)]);
    expect(q.shortageRatio).toBeCloseTo(0.5, 12);
    expect(q.shortage).toEqual({ ingredientId: "basil", playerCount: 1, targetCount: 2 });
    expect(q.factor).toBeCloseTo(0.75, 12);
  });

  it("combines shortage and excess from different groups", () => {
    const q = scoreQuantityComponentV2([group("mozzarella", 2, 3), group("basil", 4, 2)]);
    expect(q.shortage?.ingredientId).toBe("mozzarella");
    expect(q.excess?.ingredientId).toBe("basil");
    expect(q.factor).toBeCloseTo(1 - 0.5 / 3 - 0.15, 12);
  });

  it("keeps the first group on a tie (deterministic Result line)", () => {
    const q = scoreQuantityComponentV2([group("mozzarella", 2, 4), group("basil", 1, 2)]);
    expect(q.shortage?.ingredientId).toBe("mozzarella");
  });

  it("skips a zero-target group instead of dividing by zero", () => {
    const q = scoreQuantityComponentV2([group("mozzarella", 2, 0), group("basil", 2, 2)]);
    expect(q.factor).toBe(1);
    expect(Number.isFinite(q.shortageRatio) && Number.isFinite(q.excessRatio)).toBe(true);
  });
});
