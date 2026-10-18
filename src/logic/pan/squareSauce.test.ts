import { describe, expect, it } from "vitest";
import { IDEAL_MARGHERITA_SAUCE_FIXTURE } from "../../data/referencePizza";
import { computeSauceMetrics, SAUCE_FIELD_SIZE, sauceFieldToRgbaPixels, buildSauceField } from "../sauceField";
import { SQUARE_PAN_CORNERS, SQUARE_PAN_HALF_SIDE, SQUARE_TARGET_HALF_SIDE } from "./panGeometry";
import {
  computeSquareSauceMetrics,
  insidePanFraction,
  insideSquareTargetFraction,
  isSquareSauceCellVisible,
  squareOverlapFraction,
} from "./squareSauce";

const LO = 50 - SQUARE_PAN_HALF_SIDE;
const HI = 50 + SQUARE_PAN_HALF_SIDE;

describe("squareOverlapFraction", () => {
  it("is 1 well inside, 0 well outside, 0.5 centred on an edge, 0.25 on a corner", () => {
    expect(insidePanFraction(50, 50)).toBe(1);
    expect(insidePanFraction(-20, 50)).toBe(0);
    expect(insidePanFraction(LO, 50)).toBeCloseTo(0.5, 12);
    expect(insidePanFraction(HI, HI)).toBeCloseTo(0.25, 12);
  });

  it("is continuous across every edge (a hair either side never flips 0 <-> 1)", () => {
    for (const [x, y] of [[LO, 50], [HI, 50], [50, LO], [50, HI], [LO, LO], [HI, HI]]) {
      const inside = insidePanFraction(x + (x <= 50 ? 1e-7 : -1e-7), y + (y <= 50 ? 1e-7 : -1e-7));
      const outside = insidePanFraction(x - (x <= 50 ? 1e-7 : -1e-7), y - (y <= 50 ? 1e-7 : -1e-7));
      expect(Math.abs(inside - outside)).toBeLessThan(1e-5);
    }
  });

  it("is monotone from outside to inside along a line and always within [0, 1]", () => {
    let previous = -1;
    for (let x = LO - 6; x <= LO + 6; x += 0.25) {
      const f = insidePanFraction(x, 50);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
      expect(f).toBeGreaterThanOrEqual(previous);
      previous = f;
    }
  });

  it("treats non-finite points as off the pan", () => {
    expect(squareOverlapFraction(Number.NaN, 50, SQUARE_PAN_HALF_SIDE)).toBe(0);
    expect(squareOverlapFraction(50, Number.POSITIVE_INFINITY, SQUARE_PAN_HALF_SIDE)).toBe(0);
  });

  it("the target region is strictly inside the pan", () => {
    expect(SQUARE_TARGET_HALF_SIDE).toBeLessThan(SQUARE_PAN_HALF_SIDE);
    for (let x = 0; x <= 100; x += 2.5) {
      for (let y = 0; y <= 100; y += 2.5) expect(insideSquareTargetFraction(x, y)).toBeLessThanOrEqual(insidePanFraction(x, y) + 1e-12);
    }
  });
});

describe("isSquareSauceCellVisible", () => {
  it("has 14 x 14 on-pan cells and reaches the four corner cells", () => {
    let count = 0;
    for (let r = 0; r < SAUCE_FIELD_SIZE; r++) for (let c = 0; c < SAUCE_FIELD_SIZE; c++) if (isSquareSauceCellVisible(r, c)) count++;
    expect(count).toBe(196);
    for (const [r, c] of [[1, 1], [1, 14], [14, 1], [14, 14]]) expect(isSquareSauceCellVisible(r, c)).toBe(true);
    expect(isSquareSauceCellVisible(0, 0)).toBe(false);
  });

  it("paints the corner cell (a round mask would leave it bare) when used as sauceFieldToRgbaPixels' cell test", () => {
    const field = buildSauceField([{ x: 8, y: 8, amount: 0.3 }]);
    const pixels = sauceFieldToRgbaPixels(field, undefined, isSquareSauceCellVisible);
    expect(pixels[(1 * SAUCE_FIELD_SIZE + 1) * 4 + 3]).toBeGreaterThan(0);
    const round = sauceFieldToRgbaPixels(field);
    expect(round[(1 * SAUCE_FIELD_SIZE + 1) * 4 + 3]).toBe(0);
  });
});

describe("computeSquareSauceMetrics", () => {
  it("is empty for no deposits", () => {
    expect(computeSquareSauceMetrics([])).toEqual(computeSauceMetrics([]));
  });

  it("conserves the dispensed total (quantity + overflow) at every position, including the edges", () => {
    for (let x = -10; x <= 110; x += 3.7) {
      for (let y = -10; y <= 110; y += 3.9) {
        const m = computeSquareSauceMetrics([{ x, y, amount: 0.04 }]);
        expect(m.quantity + m.overflowAmount).toBeCloseTo(0.04, 12);
      }
    }
  });

  it("a deposit far off the pan is all overflow, one in the middle is all quantity", () => {
    const off = computeSquareSauceMetrics([{ x: 100, y: 100, amount: 0.05 }]);
    expect(off.quantity).toBe(0);
    expect(off.overflowAmount).toBeCloseTo(0.05, 12);
    expect(off.overflowRatio).toBeCloseTo(1, 12);
    const mid = computeSquareSauceMetrics([{ x: 50, y: 50, amount: 0.05 }]);
    expect(mid.overflowAmount).toBe(0);
    expect(mid.edgeAmount).toBe(0);
  });

  it("sauce in the rim band (on the pan, beyond the target region) counts as edge, not overflow", () => {
    const rim = computeSquareSauceMetrics([{ x: 50 + (SQUARE_TARGET_HALF_SIDE + SQUARE_PAN_HALF_SIDE) / 2, y: 50, amount: 0.05 }]);
    expect(rim.overflowAmount).toBe(0);
    expect(rim.edgeAmount).toBeCloseTo(0.05, 12);
  });

  it("a coat that reaches all four corners covers more of the square pan than the same coat clipped to the round dough", () => {
    const cornerDabs = SQUARE_PAN_CORNERS.map((c) => ({ x: c.x + (c.x < 50 ? 3 : -3), y: c.y + (c.y < 50 ? 3 : -3), amount: 0.05 }));
    const square = computeSquareSauceMetrics(cornerDabs);
    expect(square.overflowAmount).toBe(0);
    expect(square.coverage).toBeGreaterThan(0);
    // The same four dabs lie outside the round dough circle (corner distance ~58 > 48): the round metrics call them overflow.
    expect(computeSauceMetrics(cornerDabs).overflowRatio).toBeGreaterThan(0.9);
  });

  it("coverage rises as the pan is painted, and a uniform coat reads as even", () => {
    const grid: { x: number; y: number; amount: number }[] = [];
    for (let x = LO + 3; x <= HI - 3; x += 6) for (let y = LO + 3; y <= HI - 3; y += 6) grid.push({ x, y, amount: 0.004 });
    const m = computeSquareSauceMetrics(grid);
    expect(m.coverage).toBeGreaterThan(0.7);
    expect(m.evenness).toBeGreaterThan(0.8);
    expect(m.overflowAmount).toBe(0);
    const one = computeSquareSauceMetrics([{ x: 50, y: 50, amount: 0.05 }]);
    expect(one.coverage).toBeLessThan(m.coverage);
  });

  it("is deterministic and does not touch the round metrics (round fixture unchanged)", () => {
    const a = computeSquareSauceMetrics(IDEAL_MARGHERITA_SAUCE_FIXTURE);
    const b = computeSquareSauceMetrics(IDEAL_MARGHERITA_SAUCE_FIXTURE);
    expect(a).toEqual(b);
    expect(computeSauceMetrics(IDEAL_MARGHERITA_SAUCE_FIXTURE).overflowAmount).toBe(0);
  });
});
