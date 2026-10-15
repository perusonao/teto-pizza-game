import { describe, expect, it } from "vitest";
import { sauceHeadroom } from "../state/sauceLedger";
import { sauceGaugeDetail, sauceGaugeUsed, sauceRemainingFraction } from "./sauceRemaining";
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

describe("sauceGaugeDetail (#494: empty sauce vs the pizza-wide cap)", () => {
  const pz = (parts: Array<[string, number]>) => ({
    sauceIds: parts.map(([id]) => id),
    sauceDeposits: parts.map(([id, amount]) => ({ x: 50, y: 50, amount, ingredientId: id })),
  });

  it("usable is exactly the dispenser's headroom / one bottle, with and without a stroke in progress", () => {
    const cases: Array<[Array<[string, number]>, string, number]> = [
      [[["tomato-sauce", 0.4]], "tomato-sauce", 0],
      [[["tomato-sauce", 0.4]], "tomato-sauce", 0.1],
      [[["tomato-sauce", 1], ["pesto", 0.8]], "olive-oil", 0],
      [[["tomato-sauce", 1], ["pesto", 1]], "olive-oil", 0],
      [[["tomato-sauce", 0.5], ["pesto", 1]], "tomato-sauce", 0.2],
    ];
    for (const [parts, id, pending] of cases) {
      const p = pz(parts);
      expect(sauceGaugeDetail(p, id, pending).usable).toBeCloseTo(sauceHeadroom(p, id, pending), 9);
    }
  });

  it("two kinds never hit the pizza-wide cap: capBlocked is 0 and an empty sauce is just empty", () => {
    const p = pz([["tomato-sauce", 1], ["pesto", 1]]);
    expect(sauceGaugeDetail(p, "tomato-sauce")).toEqual({ usable: 0, capBlocked: 0 });
    expect(sauceGaugeDetail(pz([["tomato-sauce", 0.4], ["pesto", 0.7]]), "pesto").capBlocked).toBe(0);
  });

  it("from the third kind on the cap can bind: the unused part of that bottle is capBlocked", () => {
    const p = pz([["tomato-sauce", 1], ["pesto", 0.8]]); // total left 0.2
    expect(sauceGaugeDetail(p, "olive-oil")).toEqual({ usable: expect.closeTo(0.2, 9), capBlocked: expect.closeTo(0.8, 9) });
    const full = pz([["tomato-sauce", 1], ["pesto", 1]]); // total left 0: a fresh third sauce is stopped by the cap alone
    expect(sauceGaugeDetail(full, "olive-oil")).toEqual({ usable: 0, capBlocked: 1 });
  });

  it("is safe on junk input", () => {
    expect(sauceGaugeDetail(null, "tomato-sauce", Number.NaN)).toEqual({ usable: 1, capBlocked: 0 });
  });
});
