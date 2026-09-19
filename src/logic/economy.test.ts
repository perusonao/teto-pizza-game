import { describe, expect, it } from "vitest";
import {
  MISSION_REWARD_BASE_PITZ,
  calculateMissionReward,
  purchaseIngredient,
  restockIngredient,
} from "./economy";
import type { MissionMetrics } from "./missionScoring";
import type { Ingredient } from "../data/ingredients";
import { STARTER_INGREDIENT_IDS, getIngredient } from "../data/ingredients";
import type { InventoryState } from "../state/inventory";

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

  // Phase 3C-6 production data, still LOCKED below its own `unlockCondition` threshold --
  // this axis (`ingredientState`'s LOCKED/AVAILABLE_TO_BUY/OWNED) is orthogonal to EP4's
  // `starterGrantOnly` gate exercised by the tests below.
  it("onion is LOCKED, not ALREADY_OWNED, on a fresh save", () => {
    const onion = getIngredient("onion")!;
    const result = purchaseIngredient({
      ingredient: onion,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
      totalStars: 0,
      pitzBalance: 999999,
    });
    expect(result).toEqual({ success: false, reason: "LOCKED" });
  });

  // Economy & Progression 1.0 EP4 (finalized product decision, see the EP4 Result report §7):
  // onion's old Phase 3C-6 manual-purchase path is retired. Even once totalStars/pitzBalance
  // clear its real `unlockCondition`/`pricePitz` (AVAILABLE_TO_BUY), `starterGrantOnly` rejects
  // the purchase -- onion's first unit is only ever obtained via its Starter Grant
  // (../state/starterStock.ts), exactly like every other EP4 Starter Grant ingredient.
  it("onion is NOT_FOR_SALE (never purchasable) even once totalStars/pitzBalance clear its unlockCondition/pricePitz -- Starter Grant only", () => {
    const onion = getIngredient("onion")!;
    expect(onion.starterGrantOnly).toBe(true);
    const result = purchaseIngredient({
      ingredient: onion,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
      totalStars: onion.unlockCondition!.minTotalStars,
      pitzBalance: onion.pricePitz!,
    });
    expect(result).toEqual({ success: false, reason: "NOT_FOR_SALE" });
  });
});

describe("restockIngredient (Economy & Progression 1.0 EP3)", () => {
  const OWNED_FINITE_INGREDIENT: Ingredient = {
    id: "mock-owned-finite",
    category: "topping",
    nameJa: "補充可能（テスト用）",
    color: "#000",
    emoji: "❓",
    placement: "scatter",
    unlockCondition: { minTotalStars: 5 },
    pricePitz: 120,
    restockQuantity: 12,
  };

  function restock(overrides: Partial<Parameters<typeof restockIngredient>[0]> = {}) {
    return restockIngredient({
      ingredient: OWNED_FINITE_INGREDIENT,
      ownedIngredientIds: [OWNED_FINITE_INGREDIENT.id],
      inventory: {},
      pitzBalance: 1000,
      ...overrides,
    });
  }

  it("restocks an owned finite ingredient: inventory increases by exactly restockQuantity", () => {
    const result = restock({ inventory: { [OWNED_FINITE_INGREDIENT.id]: 3 } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.nextInventory).toEqual({ [OWNED_FINITE_INGREDIENT.id]: 15 }); // 3 + 12
    }
  });

  it("adds exactly the packQuantity onto an absent (0) inventory entry", () => {
    const result = restock({ inventory: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.nextInventory).toEqual({ [OWNED_FINITE_INGREDIENT.id]: 12 });
    }
  });

  it("subtracts exactly pricePitz from pitzBalance on a successful restock", () => {
    const result = restock({ pitzBalance: 500 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.nextPitzBalance).toBe(380); // 500 - 120
    }
  });

  it("real onion data restocks 12 units for 170 Pitz, per Economy Tuning 1's TARGET price", () => {
    const onion = getIngredient("onion")!;
    expect(onion.pricePitz).toBe(170);
    const result = restockIngredient({
      ingredient: onion,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "onion"],
      inventory: { onion: 0 },
      pitzBalance: 200,
    });
    expect(result).toEqual({ success: true, nextInventory: { onion: 12 }, nextPitzBalance: 30 });
  });

  it("rejects atomically when Pitz is insufficient -- neither balance nor inventory changes", () => {
    const inventory: InventoryState = { [OWNED_FINITE_INGREDIENT.id]: 3 };
    const result = restockIngredient({
      ingredient: OWNED_FINITE_INGREDIENT,
      ownedIngredientIds: [OWNED_FINITE_INGREDIENT.id],
      inventory,
      pitzBalance: 119, // one short of the 120 price
    });
    expect(result).toEqual({ success: false, reason: "INSUFFICIENT_FUNDS" });
  });

  it("succeeds with the exact balance, leaving exactly 0 Pitz", () => {
    const result = restock({ pitzBalance: 120 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.nextPitzBalance).toBe(0);
  });

  it("rejects restocking an unlimited (Starter) ingredient regardless of ownership/balance", () => {
    for (const id of STARTER_INGREDIENT_IDS) {
      const ingredient = getIngredient(id)!;
      const result = restockIngredient({
        ingredient,
        ownedIngredientIds: [id],
        inventory: {},
        pitzBalance: 999999,
      });
      expect(result).toEqual({ success: false, reason: "UNLIMITED" });
    }
  });

  it("rejects restocking a finite ingredient that is not yet owned (LOCKED or AVAILABLE_TO_BUY)", () => {
    const result = restock({ ownedIngredientIds: [] });
    expect(result).toEqual({ success: false, reason: "NOT_OWNED" });
  });

  it("rejects an ingredient with no restockQuantity set", () => {
    const noQuantity: Ingredient = { ...OWNED_FINITE_INGREDIENT, id: "mock-no-qty", restockQuantity: undefined };
    const result = restockIngredient({
      ingredient: noQuantity,
      ownedIngredientIds: [noQuantity.id],
      inventory: {},
      pitzBalance: 1000,
    });
    expect(result).toEqual({ success: false, reason: "NOT_FOR_SALE" });
  });

  it("rejects a zero/negative/fractional restockQuantity", () => {
    for (const restockQuantity of [0, -5, 2.5, NaN]) {
      const bad: Ingredient = { ...OWNED_FINITE_INGREDIENT, id: `mock-bad-qty-${restockQuantity}`, restockQuantity };
      const result = restockIngredient({
        ingredient: bad,
        ownedIngredientIds: [bad.id],
        inventory: {},
        pitzBalance: 1000,
      });
      expect(result).toEqual({ success: false, reason: "NOT_FOR_SALE" });
    }
  });

  it("rejects an ingredient with no valid pricePitz, even if restockQuantity is set", () => {
    const noPrice: Ingredient = { ...OWNED_FINITE_INGREDIENT, id: "mock-no-price-restock", pricePitz: undefined };
    const result = restockIngredient({
      ingredient: noPrice,
      ownedIngredientIds: [noPrice.id],
      inventory: {},
      pitzBalance: 1000,
    });
    expect(result).toEqual({ success: false, reason: "NOT_FOR_SALE" });
  });

  it("is repeatable, unlike purchaseIngredient -- two successful restocks in a row both apply", () => {
    const first = restock({ inventory: {}, pitzBalance: 1000 });
    expect(first.success).toBe(true);
    if (!first.success) return;
    const second = restockIngredient({
      ingredient: OWNED_FINITE_INGREDIENT,
      ownedIngredientIds: [OWNED_FINITE_INGREDIENT.id],
      inventory: first.nextInventory,
      pitzBalance: first.nextPitzBalance,
    });
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.nextInventory).toEqual({ [OWNED_FINITE_INGREDIENT.id]: 24 });
      expect(second.nextPitzBalance).toBe(760); // 1000 - 120 - 120
    }
  });

  it("a double-tap sequence (same pre-restock input called twice) is not a special case -- each independent application charges once", () => {
    const input = {
      ingredient: OWNED_FINITE_INGREDIENT,
      ownedIngredientIds: [OWNED_FINITE_INGREDIENT.id],
      inventory: {} as InventoryState,
      pitzBalance: 250,
    };
    const first = restockIngredient(input);
    const second = restockIngredient(input); // same input, not chained -- simulates a double-tap
    expect(first).toEqual(second);
  });

  it("does not mutate the input inventory object", () => {
    const inventory: InventoryState = { [OWNED_FINITE_INGREDIENT.id]: 3 };
    restock({ inventory });
    expect(inventory).toEqual({ [OWNED_FINITE_INGREDIENT.id]: 3 });
  });

  it("touches only the target ingredient's own inventory key, leaving every other id untouched", () => {
    const result = restock({ inventory: { [OWNED_FINITE_INGREDIENT.id]: 0, "other-id": 7 } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.nextInventory).toEqual({ [OWNED_FINITE_INGREDIENT.id]: 12, "other-id": 7 });
    }
  });
});
