import { describe, expect, it } from "vitest";
import { sauceGaugeUsed, sauceRemainingFraction } from "./sauceRemaining";
import { SAUCE_MAX_QUANTITY } from "./sauceQuantity";

describe("sauceRemainingFraction (#489)", () => {
  it("is full with nothing dispensed", () => {
    expect(sauceRemainingFraction(0, 0)).toBe(1);
  });
  it("sums committed and pending", () => {
    expect(sauceRemainingFraction(0.25, 0.25)).toBeCloseTo(0.5);
  });
  it("is empty at the cap and never negative beyond it", () => {
    expect(sauceRemainingFraction(SAUCE_MAX_QUANTITY, 0)).toBe(0);
    expect(sauceRemainingFraction(0.8, 0.5)).toBe(0);
  });
  it("sanitizes negative / non-finite inputs into [0, 1]", () => {
    expect(sauceRemainingFraction(-1, 0)).toBe(1);
    expect(sauceRemainingFraction(NaN, Infinity)).toBe(1);
  });
  it("does not let an invalid total cancel the other one's usage", () => {
    expect(sauceRemainingFraction(-0.4, 0.5)).toBeCloseTo(0.5);
    expect(sauceRemainingFraction(0.5, -0.4)).toBeCloseTo(0.5);
    expect(sauceRemainingFraction(NaN, 0.25)).toBeCloseTo(0.75);
  });
  it("depends only on totals, so switching sauce type cannot reset it", () => {
    expect(sauceRemainingFraction(0.4, 0)).toBe(sauceRemainingFraction(0.2, 0.2));
  });
});

describe("sauceGaugeUsed (B3: the gauge reads the ledger's binding headroom)", () => {
  const pizza = (ids: string[], deposits: { amount: number; ingredientId?: string }[]) => ({
    sauceIds: ids,
    sauceDeposits: deposits.map((d) => ({ x: 50, y: 50, ...d })),
  });

  it("single sauce: used = the plain total (the historical one-bottle gauge)", () => {
    expect(sauceGaugeUsed(pizza(["tomato-sauce"], [{ amount: 0.3 }, { amount: 0.2 }]), "tomato-sauce")).toBeCloseTo(0.5);
  });

  it("a second sauce starts from its own full bottle (per-kind cap), not from the first sauce's usage", () => {
    const p = pizza(["tomato-sauce", "pesto"], [
      { amount: 0.5, ingredientId: "tomato-sauce" },
      { amount: 0.1, ingredientId: "pesto" },
    ]);
    expect(sauceGaugeUsed(p, "pesto")).toBeCloseTo(0.1);
    expect(sauceGaugeUsed(p, "tomato-sauce")).toBeCloseTo(0.5);
    expect(sauceGaugeUsed(p, "olive-oil")).toBe(0); // never used: full bottle
  });

  it("the pizza-wide cap can bind before the kind's own cap", () => {
    const p = pizza(["tomato-sauce", "pesto"], [
      { amount: 1, ingredientId: "tomato-sauce" },
      { amount: 0.9, ingredientId: "pesto" },
    ]);
    // total left = 2.0 - 1.9 = 0.1 < olive-oil's own 1.0
    expect(sauceGaugeUsed(p, "olive-oil")).toBeCloseTo(0.9);
  });

  it("matches the dispenser: gauge remaining + pending = headroom / SAUCE_MAX_QUANTITY", () => {
    const p = pizza(["tomato-sauce"], [{ amount: 0.4 }]);
    expect(sauceRemainingFraction(sauceGaugeUsed(p, "tomato-sauce"), 0.1)).toBeCloseTo(0.5);
  });
});
