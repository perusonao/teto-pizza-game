import { describe, expect, it } from "vitest";
import { TOPPING_REACH } from "./pieces";
import { TOPPING_BOX_PX, toppingFootprintRadiusPercent, toppingFootprintRadiusPx } from "./toppingFootprint";

/** The rendered dough widths (CSS px) the cut pizza is shown at: the CUT screen at 390x844 / 360x800, and the RESULT's compact dough. */
const CUT_390 = 358;
const CUT_360 = 328;
const RESULT = 196;

describe("toppingFootprintRadiusPx", () => {
  it("is the circle round the box corner: half the diagonal, times the rank scale", () => {
    expect(toppingFootprintRadiusPx(1)).toBeCloseTo((TOPPING_BOX_PX * Math.SQRT2) / 2, 9);
    expect(toppingFootprintRadiusPx(1.3)).toBeCloseTo(toppingFootprintRadiusPx(1) * 1.3, 9);
  });

  it("covers the widest box measured on the pizza (basil, 37.3px at rank 1) and the largest CSS cheese corner (mozzarella M1 28x23 at the 1.16 melt)", () => {
    expect(TOPPING_BOX_PX).toBeGreaterThanOrEqual(37.3);
    const widestBoxCorner = (37.3 * Math.SQRT2) / 2;
    expect(toppingFootprintRadiusPx(1)).toBeGreaterThanOrEqual(widestBoxCorner);
    const cssCheeseCorner = Math.hypot(28 / 2, 23 / 2) * 1.16;
    expect(toppingFootprintRadiusPx(1)).toBeGreaterThanOrEqual(cssCheeseCorner);
  });
});

describe("toppingFootprintRadiusPercent", () => {
  it("converts with the dough's padding box (width minus its 10px borders)", () => {
    expect(toppingFootprintRadiusPercent(1, CUT_390)).toBeCloseTo((toppingFootprintRadiusPx(1) * 100) / (CUT_390 - 20), 9);
    expect(toppingFootprintRadiusPercent(1.3, RESULT)).toBeCloseTo((toppingFootprintRadiusPx(1.3) * 100) / (RESULT - 20), 9);
  });

  it("is larger on the RESULT's small dough than on the CUT screen, for the same topping (why a fixed percent cut toppings flat there)", () => {
    for (const scale of [0.7, 0.85, 1, 1.15, 1.3]) {
      expect(toppingFootprintRadiusPercent(scale, RESULT)).toBeGreaterThan(toppingFootprintRadiusPercent(scale, CUT_390));
      expect(toppingFootprintRadiusPercent(scale, CUT_360)).toBeGreaterThan(toppingFootprintRadiusPercent(scale, CUT_390));
    }
  });

  it("grows with the size class and always reaches at least the drawing's own half-width (box 34.9px at rank 1)", () => {
    const radii = [0.7, 0.85, 1, 1.15, 1.3].map((s) => toppingFootprintRadiusPercent(s, CUT_360));
    for (let i = 1; i < radii.length; i += 1) expect(radii[i]).toBeGreaterThan(radii[i - 1]);
    for (const dough of [CUT_390, CUT_360, RESULT]) {
      const halfWidthPercent = (34.9 / 2) * 100 / (dough - 20);
      expect(toppingFootprintRadiusPercent(1, dough)).toBeGreaterThan(halfWidthPercent);
    }
  });

  it("an unmeasured dough (0px: the first frame, jsdom) keeps the legacy reach; a tiny measure is clamped, never huge", () => {
    expect(toppingFootprintRadiusPercent(1.3, 0)).toBe(TOPPING_REACH);
    expect(toppingFootprintRadiusPercent(1, 40)).toBeCloseTo((toppingFootprintRadiusPx(1) * 100) / 160, 9);
  });
});
