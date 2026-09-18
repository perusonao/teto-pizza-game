import { describe, expect, it } from "vitest";
import { computeGuideOpacity, GUIDE_FADE_END_S, GUIDE_FADE_START_S } from "./bakeGuideFade";

describe("computeGuideOpacity", () => {
  it("is fully visible for the entire pre-fade window", () => {
    expect(computeGuideOpacity(0)).toBe(1);
    expect(computeGuideOpacity(GUIDE_FADE_START_S)).toBe(1);
  });

  it("decreases monotonically and linearly across the fade window", () => {
    let previous = Infinity;
    for (let t = 0; t <= GUIDE_FADE_END_S + 2; t += 0.05) {
      const value = computeGuideOpacity(t);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(previous + 1e-9);
      previous = value;
    }
  });

  it("reaches exactly 0 at and after the fade end", () => {
    expect(computeGuideOpacity(GUIDE_FADE_END_S)).toBe(0);
    expect(computeGuideOpacity(GUIDE_FADE_END_S + 100)).toBe(0);
  });

  it("is the midpoint value halfway through the fade window", () => {
    const mid = (GUIDE_FADE_START_S + GUIDE_FADE_END_S) / 2;
    expect(computeGuideOpacity(mid)).toBeCloseTo(0.5);
  });
});
