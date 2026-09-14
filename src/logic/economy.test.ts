import { describe, expect, it } from "vitest";
import {
  MISSION_REWARD_BASE_PITZ,
  calculateMissionReward,
  purchaseIngredient,
} from "./economy";
import type { MissionMetrics } from "./missionScoring";
import type { Ingredient } from "../data/ingredients";
import { STARTER_INGREDIENT_IDS, getIngredient } from "../data/ingredients";

function metrics(servedCount: number, totalQualityScore: number, bestQualityScore = 0): MissionMetrics {
  return { servedCount, totalQualityScore, bestQualityScore };
}

describe("calculateMissionReward", () => {
  it("a run with 0 serves earns 0 Pitz -- no reward for doing nothing", () => {
    expect(calculateMissionReward(metrics(0, 0))).toBe(0);
  });

  it("a single low-quality serve still earns at least the base reward", () => {
    const reward = calculateMissionReward(metrics(1, 5)); // avg quality 5
    expect(reward).toBeGreaterThanOrEqual(MISSION_REWARD_BASE_PITZ);
  });

  it("higher average quality earns a strictly higher reward at the same servedCount", () => {
    const low = calculateMissionReward(metrics(4, 4 * 40)); // avg 40
    const high = calculateMissionReward(metrics(4, 4 * 90)); // avg 90
    expect(high).toBeGreaterThan(low);
  });

  it("more pizzas served earns a strictly higher reward at the same average quality", () => {
    const few = calculateMissionReward(metrics(2, 2 * 70));
    const many = calculateMissionReward(metrics(6, 6 * 70));
    expect(many).toBeGreaterThan(few);
  });

  it("the serve bonus is capped -- serving well past the cap does not keep scaling reward", () => {
    const atCap = calculateMissionReward(metrics(10, 10 * 70));
    const wellPastCap = calculateMissionReward(metrics(40, 40 * 70));
    expect(wellPastCap).toBe(atCap);
  });

  it("reward is bounded and stays roughly in the ~50-150 Pitz/mission target for ordinary play", () => {
    // Beginner: a few low/mid-quality pizzas.
    const beginner = calculateMissionReward(metrics(2, 2 * 50));
    // Average: a handful of mid-quality pizzas.
    const average = calculateMissionReward(metrics(5, 5 * 65));
    // Skilled: many high-quality pizzas.
    const skilled = calculateMissionReward(metrics(8, 8 * 85));
    for (const reward of [beginner, average, skilled]) {
      expect(reward).toBeGreaterThan(0);
      expect(reward).toBeLessThanOrEqual(140); // hard ceiling: base(40) + quality(50) + serve(50)
    }
    expect(average).toBeGreaterThan(beginner);
    expect(skilled).toBeGreaterThan(average);
  });

  it("is a pure function -- the same metrics always produce the same reward", () => {
    const m = metrics(4, 4 * 72);
    const first = calculateMissionReward(m);
    const second = calculateMissionReward(m);
    const third = calculateMissionReward({ ...m });
    expect(first).toBe(second);
    expect(first).toBe(third);
  });

  it("never returns a negative or non-integer reward", () => {
    for (const m of [metrics(0, 0), metrics(1, 1), metrics(3, 277), metrics(11, 950)]) {
      const reward = calculateMissionReward(m);
      expect(reward).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(reward)).toBe(true);
    }
  });
});

describe("purchaseIngredient", () => {
  const LOCKED_INGREDIENT: Ingredient = {
    id: "mock-locked",
    category: "topping",
    nameJa: "ロック済み（テスト用）",
    color: "#000",
    emoji: "❓",
    placement: "scatter",
    unlockCondition: { minTotalStars: 20 },
    pricePitz: 100,
  };

  const AVAILABLE_INGREDIENT: Ingredient = {
    id: "mock-available",
    category: "topping",
    nameJa: "購入可能（テスト用）",
    color: "#000",
    emoji: "❓",
    placement: "scatter",
    unlockCondition: { minTotalStars: 5 },
    pricePitz: 100,
  };

  const NO_PRICE_INGREDIENT: Ingredient = {
    ...AVAILABLE_INGREDIENT,
    id: "mock-no-price",
    pricePitz: undefined,
  };

  const ZERO_PRICE_INGREDIENT: Ingredient = { ...AVAILABLE_INGREDIENT, id: "mock-zero-price", pricePitz: 0 };
  const NEGATIVE_PRICE_INGREDIENT: Ingredient = {
    ...AVAILABLE_INGREDIENT,
    id: "mock-negative-price",
    pricePitz: -50,
  };
  const NAN_PRICE_INGREDIENT: Ingredient = { ...AVAILABLE_INGREDIENT, id: "mock-nan-price", pricePitz: NaN };
  const FRACTIONAL_PRICE_INGREDIENT: Ingredient = {
    ...AVAILABLE_INGREDIENT,
    id: "mock-fractional-price",
    pricePitz: 99.5,
  };

  it("rejects purchasing a LOCKED ingredient", () => {
    const result = purchaseIngredient({
      ingredient: LOCKED_INGREDIENT,
      ownedIngredientIds: [],
      totalStars: 0,
      pitzBalance: 1000,
    });
    expect(result).toEqual({ success: false, reason: "LOCKED" });
  });

  it("succeeds when AVAILABLE_TO_BUY and the balance covers the price", () => {
    const result = purchaseIngredient({
      ingredient: AVAILABLE_INGREDIENT,
      ownedIngredientIds: [],
      totalStars: 5,
      pitzBalance: 150,
    });
    expect(result).toEqual({
      success: true,
      nextOwnedIngredientIds: ["mock-available"],
      nextPitzBalance: 50,
    });
  });

  it("succeeds with the exact balance, leaving exactly 0 Pitz", () => {
    const result = purchaseIngredient({
      ingredient: AVAILABLE_INGREDIENT,
      ownedIngredientIds: [],
      totalStars: 5,
      pitzBalance: 100,
    });
    expect(result).toEqual({
      success: true,
      nextOwnedIngredientIds: ["mock-available"],
      nextPitzBalance: 0,
    });
  });

  it("rejects when the balance is insufficient", () => {
    const result = purchaseIngredient({
      ingredient: AVAILABLE_INGREDIENT,
      ownedIngredientIds: [],
      totalStars: 5,
      pitzBalance: 99,
    });
    expect(result).toEqual({ success: false, reason: "INSUFFICIENT_FUNDS" });
  });

  it("rejects re-purchasing an already-OWNED ingredient", () => {
    const result = purchaseIngredient({
      ingredient: AVAILABLE_INGREDIENT,
      ownedIngredientIds: ["mock-available"],
      totalStars: 5,
      pitzBalance: 1000,
    });
    expect(result).toEqual({ success: false, reason: "ALREADY_OWNED" });
  });

  it("rejects an ingredient with no price set", () => {
    const result = purchaseIngredient({
      ingredient: NO_PRICE_INGREDIENT,
      ownedIngredientIds: [],
      totalStars: 5,
      pitzBalance: 1000,
    });
    expect(result).toEqual({ success: false, reason: "NOT_FOR_SALE" });
  });

  it("rejects a zero price", () => {
    const result = purchaseIngredient({
      ingredient: ZERO_PRICE_INGREDIENT,
      ownedIngredientIds: [],
      totalStars: 5,
      pitzBalance: 1000,
    });
    expect(result).toEqual({ success: false, reason: "NOT_FOR_SALE" });
  });

  it("rejects a negative price", () => {
    const result = purchaseIngredient({
      ingredient: NEGATIVE_PRICE_INGREDIENT,
      ownedIngredientIds: [],
      totalStars: 5,
      pitzBalance: 1000,
    });
    expect(result).toEqual({ success: false, reason: "NOT_FOR_SALE" });
  });

  it("rejects a NaN price", () => {
    const result = purchaseIngredient({
      ingredient: NAN_PRICE_INGREDIENT,
      ownedIngredientIds: [],
      totalStars: 5,
      pitzBalance: 1000,
    });
    expect(result).toEqual({ success: false, reason: "NOT_FOR_SALE" });
  });

  it("rejects a fractional price", () => {
    const result = purchaseIngredient({
      ingredient: FRACTIONAL_PRICE_INGREDIENT,
      ownedIngredientIds: [],
      totalStars: 5,
      pitzBalance: 1000,
    });
    expect(result).toEqual({ success: false, reason: "NOT_FOR_SALE" });
  });

  it("subtracts the price exactly once (repeated calls against the same pre-purchase input do not compound)", () => {
    const input = {
      ingredient: AVAILABLE_INGREDIENT,
      ownedIngredientIds: [] as string[],
      totalStars: 5,
      pitzBalance: 250,
    };
    const first = purchaseIngredient(input);
    const second = purchaseIngredient(input); // same input, not chained -- simulates a double-tap
    expect(first).toEqual(second);
    if (first.success) {
      expect(first.nextPitzBalance).toBe(150);
    }
  });

  it("a real double-tap sequence (second call fed the first result) only charges once", () => {
    const first = purchaseIngredient({
      ingredient: AVAILABLE_INGREDIENT,
      ownedIngredientIds: [],
      totalStars: 5,
      pitzBalance: 250,
    });
    expect(first.success).toBe(true);
    if (!first.success) return;

    const second = purchaseIngredient({
      ingredient: AVAILABLE_INGREDIENT,
      ownedIngredientIds: first.nextOwnedIngredientIds,
      totalStars: 5,
      pitzBalance: first.nextPitzBalance,
    });
    expect(second).toEqual({ success: false, reason: "ALREADY_OWNED" });
  });

  it("adds the ingredient id exactly once and does not touch any other owned ingredient", () => {
    const result = purchaseIngredient({
      ingredient: AVAILABLE_INGREDIENT,
      ownedIngredientIds: ["tomato-sauce", "mozzarella"],
      totalStars: 5,
      pitzBalance: 100,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.nextOwnedIngredientIds).toEqual(["tomato-sauce", "mozzarella", "mock-available"]);
    }
  });

  it("does not mutate the input ownedIngredientIds array", () => {
    const owned = ["tomato-sauce"];
    purchaseIngredient({ ingredient: AVAILABLE_INGREDIENT, ownedIngredientIds: owned, totalStars: 5, pitzBalance: 100 });
    expect(owned).toEqual(["tomato-sauce"]);
  });

  it("every current Starter Set ingredient is already OWNED and therefore never purchasable", () => {
    for (const id of STARTER_INGREDIENT_IDS) {
      const ingredient = getIngredient(id)!;
      const result = purchaseIngredient({
        ingredient,
        ownedIngredientIds: [],
        totalStars: 0,
        pitzBalance: 999999,
      });
      expect(result).toEqual({ success: false, reason: "ALREADY_OWNED" });
    }
  });

  // Phase 3C-6: onion is the first production ingredient that is NOT Starter Set -- unlike
  // every ingredient above, it genuinely starts LOCKED and only becomes purchasable once
  // totalStars/pitzBalance clear its real, production `unlockCondition`/`pricePitz`.
  it("onion (Phase 3C-6) is LOCKED, not ALREADY_OWNED, on a fresh save", () => {
    const onion = getIngredient("onion")!;
    const result = purchaseIngredient({
      ingredient: onion,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
      totalStars: 0,
      pitzBalance: 999999,
    });
    expect(result).toEqual({ success: false, reason: "LOCKED" });
  });

  it("onion becomes purchasable once totalStars/pitzBalance clear its real production requirement", () => {
    const onion = getIngredient("onion")!;
    const result = purchaseIngredient({
      ingredient: onion,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
      totalStars: onion.unlockCondition!.minTotalStars,
      pitzBalance: onion.pricePitz!,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.nextOwnedIngredientIds).toEqual([...STARTER_INGREDIENT_IDS, "onion"]);
      expect(result.nextPitzBalance).toBe(0);
    }
  });
});
