import { describe, expect, it } from "vitest";
import { advanceSauceCarry, sauceRemainingFraction } from "./sauceRemaining";
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

describe("advanceSauceCarry (usage kept across sauce switches)", () => {
  const start = { token: 1, total: 0.5, carried: 0 };

  it("returns the same object when nothing changed", () => {
    expect(advanceSauceCarry(start, 1, 0.5, 5)).toBe(start);
  });

  it("keeps the same sauce's growth out of `carried` (token unchanged)", () => {
    expect(advanceSauceCarry(start, 1, 0.7, 7)).toEqual({ token: 1, total: 0.7, carried: 0 });
  });

  it("carries the replaced sauce's total on a switch (token + 1)", () => {
    expect(advanceSauceCarry(start, 2, 0.1, 1)).toEqual({ token: 2, total: 0.1, carried: 0.5 });
  });

  it("accumulates over several switches", () => {
    const afterOne = advanceSauceCarry(start, 2, 0.1, 1);
    expect(advanceSauceCarry(afterOne, 3, 0.2, 2)).toEqual({ token: 3, total: 0.2, carried: 0.6 });
  });

  it("clears when the deposits are emptied (reset / new pizza)", () => {
    const carried = advanceSauceCarry(start, 2, 0.1, 1);
    expect(advanceSauceCarry(carried, 0, 0, 0)).toEqual({ token: 0, total: 0, carried: 0 });
  });
});
