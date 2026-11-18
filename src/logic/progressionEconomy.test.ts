import { describe, expect, it } from "vitest";
import {
  consumePizzaUse,
  progressionIngredientState,
  progressionRefillPricePitz,
  purchaseProgressionIngredient,
  refillProgressionIngredient,
  remainingPizzaUses,
  type ProgressionStock,
} from "./progressionEconomy";
import { progressionStars } from "./progressionStars";
import { getProgressionIngredientUnlock, type ProgressionIngredientUnlock } from "../data/progressionUnlocks";

const egg = getProgressionIngredientUnlock("egg")!; // early, gate ⭐2, 60 Pitz
const mushroom = getProgressionIngredientUnlock("mushroom")!; // early, gate ⭐10, 60 Pitz
const basil = getProgressionIngredientUnlock("basil")!; // starter trio

function fakeUnlock(overrides: Partial<ProgressionIngredientUnlock>): ProgressionIngredientUnlock {
  return { ...egg, ingredientId: "fake", ...overrides };
}

describe("progressionIngredientState", () => {
  it("LOCKED → AVAILABLE_TO_BUY exactly at the gate (inclusive)", () => {
    expect(mushroom.minProgressionStars).toBe(10);
    expect(progressionIngredientState(mushroom, [], 9)).toBe("LOCKED");
    expect(progressionIngredientState(mushroom, [], 10)).toBe("AVAILABLE_TO_BUY");
    expect(progressionIngredientState(mushroom, [], 11)).toBe("AVAILABLE_TO_BUY");
  });

  it("egg is LOCKED at Dex 0 and AVAILABLE_TO_BUY after any first discovery (even BEST ★1)", () => {
    expect(progressionIngredientState(egg, [], progressionStars([]))).toBe("LOCKED");
    const dex = [{ recipeId: "margherita", discovered: true, bestStars: 1 }];
    expect(progressionIngredientState(egg, [], progressionStars(dex))).toBe("AVAILABLE_TO_BUY");
  });

  it("an undiscovered recipe does not open a gate", () => {
    const dex = [{ recipeId: "margherita", discovered: false, bestStars: 5 }];
    expect(progressionIngredientState(egg, [], progressionStars(dex))).toBe("LOCKED");
  });

  it("OWNED once purchased, regardless of stars", () => {
    expect(progressionIngredientState(mushroom, ["mushroom"], 0)).toBe("OWNED");
  });

  it("a starter is always OWNED, even with an empty owned list and 0⭐", () => {
    expect(progressionIngredientState(basil, [], 0)).toBe("OWNED");
  });

  it("invalid stars or gates fail closed (LOCKED)", () => {
    expect(progressionIngredientState(egg, [], -5)).toBe("LOCKED");
    expect(progressionIngredientState(egg, [], Number.NaN)).toBe("LOCKED");
    expect(progressionIngredientState(fakeUnlock({ minProgressionStars: -1 }), [], 100)).toBe("LOCKED");
    expect(progressionIngredientState(fakeUnlock({ minProgressionStars: 2.5 }), [], 100)).toBe("LOCKED");
    expect(progressionIngredientState(fakeUnlock({ minProgressionStars: Number.NaN }), [], 100)).toBe("LOCKED");
  });

  it("a 0-star gate is AVAILABLE_TO_BUY from the start", () => {
    expect(progressionIngredientState(fakeUnlock({ minProgressionStars: 0 }), [], 0)).toBe("AVAILABLE_TO_BUY");
  });
});

describe("purchaseProgressionIngredient (first purchase → OWNED + 10 uses)", () => {
  const base = { unlock: egg, ownedIngredientIds: [] as string[], progressionStars: 2, pitzBalance: 70, stock: {} };

  it("charges the price, marks OWNED and grants exactly 10 uses", () => {
    const result = purchaseProgressionIngredient(base);
    expect(result).toEqual({
      success: true,
      nextOwnedIngredientIds: ["egg"],
      nextPitzBalance: 10,
      nextStock: { egg: 10 },
    });
  });

  it("an exact balance is enough; one short is INSUFFICIENT_FUNDS", () => {
    expect(purchaseProgressionIngredient({ ...base, pitzBalance: 60 })).toMatchObject({ success: true, nextPitzBalance: 0 });
    expect(purchaseProgressionIngredient({ ...base, pitzBalance: 59 })).toEqual({
      success: false,
      reason: "INSUFFICIENT_FUNDS",
    });
  });

  it("LOCKED below the gate, even with plenty of Pitz", () => {
    expect(purchaseProgressionIngredient({ ...base, progressionStars: 1, pitzBalance: 9999 })).toEqual({
      success: false,
      reason: "LOCKED",
    });
  });

  it("a second purchase is ALREADY_OWNED: no second charge, no second grant", () => {
    const first = purchaseProgressionIngredient(base);
    if (!first.success) throw new Error("first purchase failed");
    const second = purchaseProgressionIngredient({
      ...base,
      ownedIngredientIds: first.nextOwnedIngredientIds,
      pitzBalance: first.nextPitzBalance + 1000,
      stock: first.nextStock,
    });
    expect(second).toEqual({ success: false, reason: "ALREADY_OWNED" });
  });

  it("a starter is never for sale (ALREADY_OWNED)", () => {
    expect(purchaseProgressionIngredient({ ...base, unlock: basil })).toEqual({
      success: false,
      reason: "ALREADY_OWNED",
    });
  });

  it("a missing, zero, negative or fractional price is NOT_FOR_SALE", () => {
    for (const price of [0, -60, 59.5, Number.NaN]) {
      const unlock = fakeUnlock({ purchasePricePitz: price });
      expect(purchaseProgressionIngredient({ ...base, unlock }), String(price)).toEqual({
        success: false,
        reason: "NOT_FOR_SALE",
      });
    }
  });

  it("a negative, fractional or non-finite balance is INVALID_BALANCE", () => {
    for (const pitz of [-1, 60.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(purchaseProgressionIngredient({ ...base, pitzBalance: pitz }), String(pitz)).toEqual({
        success: false,
        reason: "INVALID_BALANCE",
      });
    }
  });

  it("keeps valid leftover stock and treats corrupt leftover as 0", () => {
    expect(purchaseProgressionIngredient({ ...base, stock: { egg: 3 } })).toMatchObject({ nextStock: { egg: 13 } });
    expect(purchaseProgressionIngredient({ ...base, stock: { egg: -7 } })).toMatchObject({ nextStock: { egg: 10 } });
    expect(purchaseProgressionIngredient({ ...base, stock: { egg: Number.NaN } })).toMatchObject({
      nextStock: { egg: 10 },
    });
  });

  it("leaves other stock untouched and never mutates its inputs", () => {
    const owned = Object.freeze(["bacon"]) as readonly string[];
    const stock: ProgressionStock = Object.freeze({ bacon: 4 });
    const result = purchaseProgressionIngredient({ ...base, ownedIngredientIds: owned, stock });
    expect(result).toMatchObject({ nextOwnedIngredientIds: ["bacon", "egg"], nextStock: { bacon: 4, egg: 10 } });
    expect(owned).toEqual(["bacon"]);
    expect(stock).toEqual({ bacon: 4 });
  });
});

describe("refillProgressionIngredient (+10 uses at half price)", () => {
  const base = { unlock: egg, ownedIngredientIds: ["egg"], pitzBalance: 100, stock: { egg: 0 } };

  it("refill price is exactly half the purchase price", () => {
    expect(progressionRefillPricePitz(60)).toBe(30);
    expect(progressionRefillPricePitz(100)).toBe(50);
    expect(progressionRefillPricePitz(140)).toBe(70);
    expect(progressionRefillPricePitz(180)).toBe(90);
  });

  it("an odd price rounds up (never undercharges); an invalid price is not for sale", () => {
    expect(progressionRefillPricePitz(61)).toBe(31);
    expect(progressionRefillPricePitz(1)).toBe(1);
    for (const price of [0, -60, 59.5, Number.NaN]) expect(progressionRefillPricePitz(price)).toBeNull();
  });

  it("charges half price and adds exactly 10 uses", () => {
    expect(refillProgressionIngredient(base)).toEqual({ success: true, nextPitzBalance: 70, nextStock: { egg: 10 } });
    expect(refillProgressionIngredient({ ...base, stock: { egg: 4 } })).toMatchObject({ nextStock: { egg: 14 } });
  });

  it("is repeatable: two refills add 20 uses for 2 × half price", () => {
    const first = refillProgressionIngredient(base);
    if (!first.success) throw new Error("first refill failed");
    const second = refillProgressionIngredient({ ...base, pitzBalance: first.nextPitzBalance, stock: first.nextStock });
    expect(second).toEqual({ success: true, nextPitzBalance: 40, nextStock: { egg: 20 } });
  });

  it("an exact balance is enough; one short is INSUFFICIENT_FUNDS", () => {
    expect(refillProgressionIngredient({ ...base, pitzBalance: 30 })).toMatchObject({ success: true, nextPitzBalance: 0 });
    expect(refillProgressionIngredient({ ...base, pitzBalance: 29 })).toEqual({
      success: false,
      reason: "INSUFFICIENT_FUNDS",
    });
  });

  it("rejects not-owned, starter, not-for-sale and invalid-balance cases", () => {
    expect(refillProgressionIngredient({ ...base, ownedIngredientIds: [] })).toEqual({
      success: false,
      reason: "NOT_OWNED",
    });
    expect(refillProgressionIngredient({ ...base, unlock: basil, ownedIngredientIds: ["basil"] })).toEqual({
      success: false,
      reason: "UNLIMITED",
    });
    expect(
      refillProgressionIngredient({
        ...base,
        unlock: fakeUnlock({ purchasePricePitz: 0 }),
        ownedIngredientIds: ["fake"],
      }),
    ).toEqual({ success: false, reason: "NOT_FOR_SALE" });
    expect(refillProgressionIngredient({ ...base, pitzBalance: -30 })).toEqual({
      success: false,
      reason: "INVALID_BALANCE",
    });
  });

  it("repairs corrupt stock to 0 before adding", () => {
    expect(refillProgressionIngredient({ ...base, stock: { egg: -3 } })).toMatchObject({ nextStock: { egg: 10 } });
  });
});

describe("pizza uses (1 pizza = 1 use)", () => {
  it("one pizza consumes exactly one use", () => {
    expect(consumePizzaUse(egg, { egg: 10 })).toEqual({ success: true, nextStock: { egg: 9 } });
    expect(consumePizzaUse(egg, { egg: 1 })).toEqual({ success: true, nextStock: { egg: 0 } });
  });

  it("10 purchased uses make exactly 10 pizzas, then OUT_OF_STOCK", () => {
    const bought = purchaseProgressionIngredient({
      unlock: egg,
      ownedIngredientIds: [],
      progressionStars: 2,
      pitzBalance: 60,
      stock: {},
    });
    if (!bought.success) throw new Error("purchase failed");
    let stock = bought.nextStock;
    for (let i = 0; i < 10; i++) {
      const used = consumePizzaUse(egg, stock);
      if (!used.success) throw new Error(`pizza ${i + 1} ran out`);
      stock = used.nextStock;
    }
    expect(remainingPizzaUses(egg, stock)).toBe(0);
    expect(consumePizzaUse(egg, stock)).toEqual({ success: false, reason: "OUT_OF_STOCK" });
  });

  it("never goes negative: empty, missing or corrupt stock is OUT_OF_STOCK", () => {
    expect(consumePizzaUse(egg, {})).toEqual({ success: false, reason: "OUT_OF_STOCK" });
    expect(consumePizzaUse(egg, { egg: 0 })).toEqual({ success: false, reason: "OUT_OF_STOCK" });
    expect(consumePizzaUse(egg, { egg: -2 })).toEqual({ success: false, reason: "OUT_OF_STOCK" });
    expect(consumePizzaUse(egg, { egg: 0.5 })).toEqual({ success: false, reason: "OUT_OF_STOCK" });
  });

  it("a starter never consumes and reports UNLIMITED", () => {
    const stock = { basil: 0 };
    expect(consumePizzaUse(basil, stock)).toEqual({ success: true, nextStock: stock });
    expect(remainingPizzaUses(basil, {})).toBe("UNLIMITED");
  });

  it("remainingPizzaUses sanitizes corrupt counts to 0", () => {
    expect(remainingPizzaUses(egg, { egg: 7 })).toBe(7);
    expect(remainingPizzaUses(egg, {})).toBe(0);
    expect(remainingPizzaUses(egg, { egg: -1 })).toBe(0);
    expect(remainingPizzaUses(egg, { egg: 2.7 })).toBe(2);
  });
});

describe("audit §5.1 opening (first Margherita → first purchase)", () => {
  // docs/reports/PROGRESSION-2.0_PHASE-3-4_PreImplementation-Audit.md §5.1: low-score ★1 Margherita
  // leaves 70 Pitz and 2⭐; egg/bacon/onion are AVAILABLE_TO_BUY at 60 and one is affordable.
  it("low-score ★1: 70 Pitz, 2⭐ → egg/bacon/onion available @60, buy one with 10 left", () => {
    const stars = progressionStars([{ recipeId: "shipped:margherita", discovered: true, bestStars: 1 }]);
    expect(stars).toBe(2);
    for (const id of ["egg", "bacon", "onion"]) {
      const u = getProgressionIngredientUnlock(id)!;
      expect(u.purchasePricePitz).toBe(60);
      expect(progressionIngredientState(u, [], stars), id).toBe("AVAILABLE_TO_BUY");
    }
    expect(progressionIngredientState(getProgressionIngredientUnlock("pepperoni")!, [], stars)).toBe("LOCKED");
    expect(
      purchaseProgressionIngredient({ unlock: egg, ownedIngredientIds: [], progressionStars: stars, pitzBalance: 70, stock: {} }),
    ).toMatchObject({ success: true, nextPitzBalance: 10, nextStock: { egg: 10 } });
  });
});
