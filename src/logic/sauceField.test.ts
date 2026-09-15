import { describe, expect, it } from "vitest";
import {
  buildSauceField,
  computeSauceMetrics,
  emptySauceMetrics,
  insideDoughFraction,
  isCellInsideDough,
  SAUCE_FIELD_SIZE,
  totalDispensed,
} from "./sauceField";

/** Spreads `total` amount across `count` deposits arranged evenly around the dough. */
function wideDeposits(total: number, count: number): Array<{ x: number; y: number; amount: number }> {
  const deposits: Array<{ x: number; y: number; amount: number }> = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 30; // well inside the dough (radius 48)
    deposits.push({
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
      amount: total / count,
    });
  }
  return deposits;
}

describe("computeSauceMetrics: empty", () => {
  it("returns the empty metrics for no deposits", () => {
    expect(computeSauceMetrics([])).toEqual(emptySauceMetrics());
  });
});

describe("computeSauceMetrics: center (concentrated) deposit", () => {
  it("a single large deposit at the center gives high quantity but low coverage", () => {
    const metrics = computeSauceMetrics([{ x: 50, y: 50, amount: 0.6 }]);
    expect(metrics.quantity).toBeCloseTo(0.6);
    expect(metrics.coverage).toBeLessThan(0.2);
  });
});

describe("computeSauceMetrics: wide distribution", () => {
  // 12 points, spaced well apart around the dough, each depositing enough (0.05) to clear
  // the "touched cell" threshold on its own -- same 0.6 total as the single concentrated
  // deposit below, so quantity is comparable and only coverage/evenness should differ.
  const WIDE_POINT_COUNT = 12;

  it("the same total quantity spread across many points gives much higher coverage than one concentrated point", () => {
    const concentrated = computeSauceMetrics([{ x: 50, y: 50, amount: 0.6 }]);
    const wide = computeSauceMetrics(wideDeposits(0.6, WIDE_POINT_COUNT));

    expect(wide.quantity).toBeCloseTo(concentrated.quantity, 1);
    expect(wide.coverage).toBeGreaterThan(concentrated.coverage);
  });

  it("evenness is higher for a wide spread than for one concentrated deposit of the same total", () => {
    const concentrated = computeSauceMetrics([{ x: 50, y: 50, amount: 0.6 }]);
    const wide = computeSauceMetrics(wideDeposits(0.6, WIDE_POINT_COUNT));
    expect(wide.evenness).toBeGreaterThan(concentrated.evenness);
  });
});

describe("computeSauceMetrics: quantity and coverage are never the same measurement", () => {
  it("a small amount spread thin can have low quantity but higher coverage than a concentrated large amount", () => {
    // Each of the 16 points deposits 0.025 -- enough to individually clear the "touched
    // cell" threshold -- for a 0.4 total, well under the single 0.6 puddle below.
    const thin = computeSauceMetrics(wideDeposits(0.4, 16));
    const puddle = computeSauceMetrics([{ x: 50, y: 50, amount: 0.6 }]);
    expect(thin.quantity).toBeLessThan(puddle.quantity);
    expect(thin.coverage).toBeGreaterThan(puddle.coverage);
  });
});

describe("computeSauceMetrics: overflow", () => {
  it("deposits well outside the dough circle count entirely as overflow, not quantity/coverage", () => {
    // (50, 50) is dough center, radius 48; (50, 110) is distance 60 away -- well past even
    // the smoothed rim transition (see insideDoughFraction's own tests below).
    const metrics = computeSauceMetrics([{ x: 50, y: 110, amount: 0.4 }]);
    expect(metrics.quantity).toBe(0);
    expect(metrics.coverage).toBe(0);
    expect(metrics.overflowAmount).toBeCloseTo(0.4);
    expect(metrics.overflowRatio).toBeCloseTo(1);
  });

  it("mixing well-inside and well-outside deposits reports both independently", () => {
    const metrics = computeSauceMetrics([
      { x: 50, y: 50, amount: 0.3 },
      { x: 50, y: 110, amount: 0.1 },
    ]);
    expect(metrics.quantity).toBeCloseTo(0.3);
    expect(metrics.overflowAmount).toBeCloseTo(0.1);
    expect(metrics.overflowRatio).toBeCloseTo(0.1 / 0.4);
  });

  it("no overflow gives an overflowRatio of 0", () => {
    const metrics = computeSauceMetrics([{ x: 50, y: 50, amount: 0.3 }]);
    expect(metrics.overflowRatio).toBe(0);
  });

  it("inside + overflow conserves the total dispensed amount exactly, even for a deposit straddling the rim", () => {
    const deposits = [
      { x: 50, y: 50, amount: 0.3 },
      { x: 98, y: 50, amount: 0.2 }, // distance 48 from center -- exactly on the rim
      { x: 50, y: 110, amount: 0.1 },
    ];
    const metrics = computeSauceMetrics(deposits);
    expect(metrics.quantity + metrics.overflowAmount).toBeCloseTo(totalDispensed(deposits), 9);
  });
});

describe("insideDoughFraction (rim boundary continuity, Codex MUST FIX 5)", () => {
  it("is 1 for a deposit well inside the rim", () => {
    expect(insideDoughFraction(50, 50)).toBe(1);
    expect(insideDoughFraction(60, 60)).toBe(1);
  });

  it("is 0 for a deposit well outside the rim", () => {
    expect(insideDoughFraction(50, 110)).toBe(0);
  });

  it("is close to 0.5 for a deposit centered exactly on the rim", () => {
    // Center (50,50), radius 48 -> (98, 50) is distance exactly 48 away.
    const fraction = insideDoughFraction(98, 50);
    expect(fraction).toBeGreaterThan(0.4);
    expect(fraction).toBeLessThan(0.6);
  });

  it("never jumps discontinuously across the rim -- a tiny position change near it produces only a small change in fraction", () => {
    const justInside = insideDoughFraction(97.9, 50); // distance 47.9
    const justOutside = insideDoughFraction(98.1, 50); // distance 48.1
    expect(Math.abs(justInside - justOutside)).toBeLessThan(0.05);
  });

  it("is monotonically non-increasing as a deposit moves farther from the center", () => {
    const distances = [0, 40, 44, 46, 47, 48, 49, 50, 52, 60];
    const fractions = distances.map((d) => insideDoughFraction(50 + d, 50));
    for (let i = 1; i < fractions.length; i += 1) {
      expect(fractions[i]).toBeLessThanOrEqual(fractions[i - 1] + 1e-9);
    }
  });

  it("always stays within [0, 1]", () => {
    for (const d of [0, 10, 30, 44.9, 45, 45.1, 48, 50.9, 51, 51.1, 100]) {
      const fraction = insideDoughFraction(50 + d, 50);
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThanOrEqual(1);
    }
  });
});

describe("coverage", () => {
  it("is bounded to [0, 1]", () => {
    const metrics = computeSauceMetrics(wideDeposits(1.0, 100));
    expect(metrics.coverage).toBeGreaterThanOrEqual(0);
    expect(metrics.coverage).toBeLessThanOrEqual(1);
  });
});

describe("evenness", () => {
  it("is bounded to [0, 1] and defined (not NaN) even for a single deposit", () => {
    const metrics = computeSauceMetrics([{ x: 50, y: 50, amount: 0.05 }]);
    expect(Number.isNaN(metrics.evenness)).toBe(false);
    expect(metrics.evenness).toBeGreaterThanOrEqual(0);
    expect(metrics.evenness).toBeLessThanOrEqual(1);
  });
});

describe("buildSauceField / isCellInsideDough", () => {
  it("produces a SAUCE_FIELD_SIZE x SAUCE_FIELD_SIZE grid", () => {
    const field = buildSauceField([{ x: 50, y: 50, amount: 0.5 }]);
    expect(field.length).toBe(SAUCE_FIELD_SIZE * SAUCE_FIELD_SIZE);
  });

  it("the center cell is inside the dough and a far corner cell is not", () => {
    const centerCell = Math.floor(SAUCE_FIELD_SIZE / 2);
    expect(isCellInsideDough(centerCell, centerCell)).toBe(true);
    expect(isCellInsideDough(0, 0)).toBe(false);
  });
});

describe("totalDispensed", () => {
  it("sums every deposit's amount regardless of inside/outside dough", () => {
    const deposits = [
      { x: 50, y: 50, amount: 0.2 },
      { x: 50, y: 100, amount: 0.05 },
    ];
    expect(totalDispensed(deposits)).toBeCloseTo(0.25);
  });
});
