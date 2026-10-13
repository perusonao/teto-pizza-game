import { describe, expect, it } from "vitest";
import { sauceRemainingFraction } from "./sauceRemaining";
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
  it("depends only on totals, so switching sauce type cannot reset it", () => {
    expect(sauceRemainingFraction(0.4, 0)).toBe(sauceRemainingFraction(0.2, 0.2));
  });
});
