import { describe, expect, it } from "vitest";
import { FREE_COOK_BAKE_TARGET } from "./freeCook";
import { LATE_RECIPES } from "./lateCatalog";
import { RECIPES } from "./recipes";
import { BAKE_DURATION_S } from "../logic/bakeProgress";

/**
 * Owner decision "plan A" (replaces the 20pt / 0.6s window): every recipe's bakeTarget is 40 gauge points wide
 * (1.2s of the 3s bake), centred where it always was, and fits the 0..100 gauge. FREE Cooking's generic window is the
 * median of the recipes' windows, so it is 40pt wide as well (48-88 = centre 68).
 */
const WIDTH_PT = 40;

describe("bake window width (plan A)", () => {
  it("every shipped recipe (ordinary and late) has a 40pt window inside 0..100", () => {
    expect(RECIPES.length).toBeGreaterThan(100);
    for (const r of RECIPES) {
      expect(r.bakeTarget.end - r.bakeTarget.start, r.id).toBe(WIDTH_PT);
      expect(r.bakeTarget.start, r.id).toBeGreaterThanOrEqual(0);
      expect(r.bakeTarget.end, r.id).toBeLessThanOrEqual(100);
    }
  });

  it("the late catalog recipes are included in the checked set", () => {
    const ids = new Set(RECIPES.map((r) => r.id));
    expect(LATE_RECIPES.length).toBeGreaterThan(0);
    for (const r of LATE_RECIPES) expect(ids.has(r.id), r.id).toBe(true);
  });

  it("window centres are the pre-change ones (55..75), so the outside-window penalty curve is unchanged", () => {
    for (const r of RECIPES) {
      const centre = (r.bakeTarget.start + r.bakeTarget.end) / 2;
      expect(centre, r.id).toBeGreaterThanOrEqual(55);
      expect(centre, r.id).toBeLessThanOrEqual(75);
    }
  });

  it("the FREE Cooking generic window is 48-88 (40pt = 1.2s of the 3s bake)", () => {
    expect(FREE_COOK_BAKE_TARGET).toEqual({ start: 48, end: 88 });
    expect(((FREE_COOK_BAKE_TARGET.end - FREE_COOK_BAKE_TARGET.start) / 100) * BAKE_DURATION_S).toBeCloseTo(1.2);
  });
});
