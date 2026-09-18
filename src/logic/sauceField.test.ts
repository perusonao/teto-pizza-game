import { describe, expect, it } from "vitest";
import {
  buildSauceField,
  circleOverlapFraction,
  computeSauceMetrics,
  emptySauceMetrics,
  insideDoughFraction,
  insideDoughShapeFraction,
  insideTargetFraction,
  isCellInsideDough,
  isCellInsideDoughShape,
  SAUCE_FIELD_SIZE,
  SAUCE_HEATMAP_COLOR,
  sauceFieldToRgbaPixels,
  SAUCE_TARGET_RADIUS,
  SAUCE_TOMATO_HEX,
  smoothSauceFieldForDisplay,
  totalDispensed,
} from "./sauceField";
import { SAUCE_RATE_PER_TICK } from "./sauceQuantity";
import { DOUGH_RADIUS } from "./pizzaCoordinates";
import { DOUGH_SHAPE_POINTS, DOUGH_SHAPE_TECHNICAL_MAX_RADIUS, type DoughShape } from "./doughShape";
import { IDEAL_MARGHERITA_SAUCE_FIXTURE } from "../data/referencePizza";
import { INGREDIENTS } from "../data/ingredients";

function uniformShape(radius: number): DoughShape {
  return { radii: new Array(DOUGH_SHAPE_POINTS).fill(radius) };
}

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

  // Pins the exact boundary Codex flagged (P1, PR #21): COVERAGE_THRESHOLD must stay
  // strictly below one normal dispense tick's own amount (SAUCE_RATE_PER_TICK, imported
  // here rather than duplicated as a literal so this test breaks if the two constants are
  // ever changed back into the wrong order relative to each other), otherwise a player who
  // paints quickly enough that each tick lands in its own cell would visibly cover the dough
  // while the coverage metric silently stayed at 0.
  it("a single normal dispense tick registers as touched (coverage > 0)", () => {
    const metrics = computeSauceMetrics([{ x: 50, y: 50, amount: SAUCE_RATE_PER_TICK }]);
    expect(metrics.coverage).toBeGreaterThan(0);
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

describe("SAUCE_TARGET_RADIUS / circleOverlapFraction / insideTargetFraction (Human Feel Fix 2)", () => {
  it("SAUCE_TARGET_RADIUS is strictly inside DOUGH_RADIUS, leaving a real rim margin", () => {
    expect(SAUCE_TARGET_RADIUS).toBeLessThan(DOUGH_RADIUS);
    expect(DOUGH_RADIUS - SAUCE_TARGET_RADIUS).toBeGreaterThanOrEqual(4);
  });

  it("circleOverlapFraction against DOUGH_RADIUS is exactly insideDoughFraction", () => {
    for (const [x, y] of [[50, 50], [80, 60], [50, 110]] as const) {
      expect(circleOverlapFraction(x, y, DOUGH_RADIUS)).toBe(insideDoughFraction(x, y));
    }
  });

  it("insideTargetFraction never exceeds insideDoughFraction (the target circle is strictly inside the dough circle)", () => {
    for (const d of [0, 10, 30, 38, 40, 42, 44, 46, 48, 50]) {
      const target = insideTargetFraction(50 + d, 50);
      const dough = insideDoughFraction(50 + d, 50);
      expect(target).toBeLessThanOrEqual(dough + 1e-9);
    }
  });

  it("is 1 well inside the target radius, 0 well outside it, and never jumps discontinuously across it", () => {
    expect(insideTargetFraction(50, 50)).toBe(1);
    expect(insideTargetFraction(50, 96)).toBe(0); // distance 46: inside the dough, well outside the target radius (40) + footprint (3).
    const justInside = insideTargetFraction(50 + SAUCE_TARGET_RADIUS - 0.1, 50);
    const justOutside = insideTargetFraction(50 + SAUCE_TARGET_RADIUS + 0.1, 50);
    expect(Math.abs(justInside - justOutside)).toBeLessThan(0.05);
  });
});

describe("SauceMetrics.edgeAmount / edgeRatio (Human Feel Fix 2)", () => {
  it("is 0 for a deposit well inside the target radius", () => {
    const metrics = computeSauceMetrics([{ x: 50, y: 50, amount: 0.3 }]);
    expect(metrics.edgeAmount).toBe(0);
    expect(metrics.edgeRatio).toBe(0);
  });

  it("counts (nearly) the full amount for a deposit painted onto the rim band, still inside the dough", () => {
    // distance 44 from center: inside DOUGH_RADIUS (48, so not overflow) but outside
    // SAUCE_TARGET_RADIUS (40, so counted as edge).
    const metrics = computeSauceMetrics([{ x: 94, y: 50, amount: 0.3 }]);
    expect(metrics.overflowAmount).toBeCloseTo(0, 5);
    expect(metrics.edgeAmount).toBeCloseTo(0.3, 1);
    expect(metrics.edgeRatio).toBeGreaterThan(0.9);
  });

  it("counts true overflow (past the dough entirely) as edge too -- 'missed the pizza' and 'touched the ear' are the same player mistake here", () => {
    const metrics = computeSauceMetrics([{ x: 50, y: 110, amount: 0.2 }]);
    expect(metrics.overflowRatio).toBeCloseTo(1);
    expect(metrics.edgeRatio).toBeCloseTo(1);
  });

  it("the reference fixture's own edgeRatio is near 0 -- the game's 'ideal' example never touches the rim band it warns players away from", () => {
    const metrics = computeSauceMetrics(IDEAL_MARGHERITA_SAUCE_FIXTURE);
    expect(metrics.edgeRatio).toBeLessThan(0.03);
  });

  it("edgeRatio is bounded to [0, 1]", () => {
    const metrics = computeSauceMetrics([
      { x: 50, y: 50, amount: 0.2 },
      { x: 94, y: 50, amount: 0.2 },
      { x: 50, y: 110, amount: 0.2 },
    ]);
    expect(metrics.edgeRatio).toBeGreaterThanOrEqual(0);
    expect(metrics.edgeRatio).toBeLessThanOrEqual(1);
  });
});

describe("sauceFieldToRgbaPixels (Human Feel Fix 3: pixels, never shapes)", () => {
  it("uses the recipe sauce color while preserving the same field alpha", () => {
    const field = buildSauceField([{ x: 50, y: 50, amount: 0.02 }]);
    const tomato = sauceFieldToRgbaPixels(field);
    const pesto = sauceFieldToRgbaPixels(field, "#6b8e3d");
    const centerIndex = ((SAUCE_FIELD_SIZE / 2) * SAUCE_FIELD_SIZE + SAUCE_FIELD_SIZE / 2) * 4;

    expect(Array.from(pesto.slice(centerIndex, centerIndex + 3))).toEqual([107, 142, 61]);
    expect(pesto[centerIndex + 3]).toBe(tomato[centerIndex + 3]);
  });

  it("returns exactly one RGBA pixel per field cell -- SAUCE_FIELD_SIZE^2 * 4 bytes, no more, no less", () => {
    const field = buildSauceField([{ x: 50, y: 50, amount: 0.3 }]);
    const pixels = sauceFieldToRgbaPixels(field);
    expect(pixels.length).toBe(SAUCE_FIELD_SIZE * SAUCE_FIELD_SIZE * 4);
  });

  it("an empty field is fully transparent (every alpha byte 0) -- no cell paints on its own", () => {
    const field = buildSauceField([]);
    const pixels = sauceFieldToRgbaPixels(field);
    for (let i = 3; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(0);
    }
  });

  it("a cell outside the dough circle is never painted even if the raw field has a value there (BRUSH_RADIUS_CELLS falloff can reach it)", () => {
    // A deposit right on the rim spreads a little past it into out-of-dough cells via the
    // brush falloff -- sauceFieldToRgbaPixels must still leave those transparent, exactly
    // like the coverage/evenness math (computeSauceMetrics) already does.
    const field = buildSauceField([{ x: 98, y: 50, amount: 0.3 }]);
    const pixels = sauceFieldToRgbaPixels(field);
    for (let row = 0; row < SAUCE_FIELD_SIZE; row += 1) {
      for (let col = 0; col < SAUCE_FIELD_SIZE; col += 1) {
        if (isCellInsideDough(row, col)) continue;
        const alphaIndex = (row * SAUCE_FIELD_SIZE + col) * 4 + 3;
        expect(pixels[alphaIndex]).toBe(0);
      }
    }
  });

  it("a touched in-dough cell gets the sauce heatmap color with a non-zero alpha", () => {
    const field = buildSauceField([{ x: 50, y: 50, amount: 0.3 }]);
    const pixels = sauceFieldToRgbaPixels(field);
    const centerCell = Math.floor(SAUCE_FIELD_SIZE / 2);
    const centerIndex = (centerCell * SAUCE_FIELD_SIZE + centerCell) * 4;
    expect(pixels[centerIndex]).toBe(SAUCE_HEATMAP_COLOR.r);
    expect(pixels[centerIndex + 1]).toBe(SAUCE_HEATMAP_COLOR.g);
    expect(pixels[centerIndex + 2]).toBe(SAUCE_HEATMAP_COLOR.b);
    expect(pixels[centerIndex + 3]).toBeGreaterThan(0);
  });

  it("more overlap (a larger field value) never produces a lower alpha than less overlap -- the darker/lighter gradient never inverts", () => {
    const thin = sauceFieldToRgbaPixels(buildSauceField([{ x: 50, y: 50, amount: 0.02 }]));
    const thick = sauceFieldToRgbaPixels(buildSauceField([{ x: 50, y: 50, amount: 0.3 }]));
    const centerCell = Math.floor(SAUCE_FIELD_SIZE / 2);
    const alphaIndex = (centerCell * SAUCE_FIELD_SIZE + centerCell) * 4 + 3;
    expect(thick[alphaIndex]).toBeGreaterThan(thin[alphaIndex]);
  });
});

/**
 * Human Feel Fix 4 (Sauce Visual Polish): the iPhone Gate complaint this round fixes --
 * painted sauce read as "the dough got a little pink" rather than "sauce was spread on it",
 * because Fix 3's `min(0.85, value * 2.2)` alpha curve put even a fully, evenly painted
 * dough (`IDEAL_MARGHERITA_SAUCE_FIXTURE`) at alpha ~0.02-0.15 -- see `densityToAlpha`'s own
 * doc comment (sauceField.ts) for the measured field values these tests are built from.
 * These pin the four-way visual distinction the brief asks for (untouched / thin / good /
 * overlapped) directly against realistic field values, not round numbers.
 */
describe("sauceFieldToRgbaPixels alpha curve (Human Feel Fix 4)", () => {
  function alphasOf(pixels: Uint8ClampedArray): number[] {
    const out: number[] = [];
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) out.push(pixels[i]);
    return out;
  }

  function medianOf(sorted: readonly number[]): number {
    return sorted[Math.floor(sorted.length / 2)];
  }

  it("an untouched field has zero alpha everywhere (未塗布)", () => {
    const pixels = sauceFieldToRgbaPixels(buildSauceField([]));
    for (let i = 3; i < pixels.length; i += 4) expect(pixels[i]).toBe(0);
  });

  it("a single light dab already reads clearly as sauce, not a faint dough tint (薄塗り floor)", () => {
    const field = buildSauceField([{ x: 50, y: 50, amount: SAUCE_RATE_PER_TICK }]);
    const pixels = sauceFieldToRgbaPixels(field);
    const centerCell = Math.floor(SAUCE_FIELD_SIZE / 2);
    const alpha = pixels[(centerCell * SAUCE_FIELD_SIZE + centerCell) * 4 + 3];
    // Fix 3's formula put this exact case at alpha ~4 (out of 255) -- essentially invisible.
    // Fix 4 puts any touched cell comfortably past half-opaque immediately.
    expect(alpha).toBeGreaterThan(128);
  });

  it("a single light dab (薄塗り) has a lower opacity than the ideal fixture's well-painted density (適量)", () => {
    const dabAlpha = alphasOf(
      sauceFieldToRgbaPixels(buildSauceField([{ x: 50, y: 50, amount: SAUCE_RATE_PER_TICK }])),
    )[0];
    const idealAlphas = alphasOf(sauceFieldToRgbaPixels(buildSauceField(IDEAL_MARGHERITA_SAUCE_FIXTURE))).sort(
      (a, b) => a - b,
    );
    expect(dabAlpha).toBeLessThan(medianOf(idealAlphas));
  });

  it("re-painting the same area (重ね塗り) has a higher opacity than the ideal fixture's well-painted density (適量), never the reverse", () => {
    const idealAlphas = alphasOf(sauceFieldToRgbaPixels(buildSauceField(IDEAL_MARGHERITA_SAUCE_FIXTURE))).sort(
      (a, b) => a - b,
    );
    const overlapped = [...IDEAL_MARGHERITA_SAUCE_FIXTURE, ...IDEAL_MARGHERITA_SAUCE_FIXTURE];
    const overlapAlphas = alphasOf(sauceFieldToRgbaPixels(buildSauceField(overlapped))).sort((a, b) => a - b);
    expect(medianOf(overlapAlphas)).toBeGreaterThan(medianOf(idealAlphas));
  });

  it("sauce color stays in the tomato hue family at every density -- never shifts toward a different color as it darkens/lightens", () => {
    const light = sauceFieldToRgbaPixels(buildSauceField([{ x: 50, y: 50, amount: SAUCE_RATE_PER_TICK }]));
    const heavy = sauceFieldToRgbaPixels(buildSauceField([{ x: 50, y: 50, amount: 0.3 }]));
    const centerCell = Math.floor(SAUCE_FIELD_SIZE / 2);
    const pixelIndex = (centerCell * SAUCE_FIELD_SIZE + centerCell) * 4;
    for (const pixels of [light, heavy]) {
      const [r, g, b] = [pixels[pixelIndex], pixels[pixelIndex + 1], pixels[pixelIndex + 2]];
      expect(r).toBeGreaterThan(g * 1.5);
      expect(r).toBeGreaterThan(b * 1.5);
    }
  });

  it("SAUCE_TOMATO_HEX SSOT: the tomato-sauce ingredient's own tray/reference-preview color matches the painted heatmap color", () => {
    const tomatoSauce = INGREDIENTS.find((i) => i.id === "tomato-sauce");
    expect(tomatoSauce?.color).toBe(SAUCE_TOMATO_HEX);
  });
});

/**
 * Phase 4A-1B.1 Fix B (Short Sauce Stroke): pins the *authoritative* metrics for an isolated
 * single tap and a very short stroke exactly as they are today, before the render-only
 * smoothing this fix adds -- computeSauceMetrics/buildSauceField are never touched by that
 * fix (only PizzaStage.tsx's canvas draw path feeds `smoothSauceFieldForDisplay`'s output
 * into pixels), so these numbers must stay bit-for-bit whatever they already were.
 */
describe("Regression (Phase 4A-1B.1 Fix B): authoritative field unchanged for isolated tap / short stroke", () => {
  it("an isolated single tap's metrics are unchanged", () => {
    const metrics = computeSauceMetrics([{ x: 50, y: 50, amount: SAUCE_RATE_PER_TICK }]);
    expect(metrics.quantity).toBeCloseTo(0.02, 10);
    expect(metrics.coverage).toBeCloseTo(0.005319148936170213, 10);
    expect(metrics.evenness).toBeCloseTo(0.6547677550192725, 10);
    expect(metrics.overflowAmount).toBe(0);
    expect(metrics.edgeAmount).toBe(0);
  });

  it("a very short stroke's (three adjacent taps) metrics are unchanged", () => {
    const deposits = [
      { x: 48, y: 50, amount: SAUCE_RATE_PER_TICK },
      { x: 50, y: 50, amount: SAUCE_RATE_PER_TICK },
      { x: 52, y: 50, amount: SAUCE_RATE_PER_TICK },
    ];
    const metrics = computeSauceMetrics(deposits);
    expect(metrics.quantity).toBeCloseTo(0.06, 10);
    expect(metrics.coverage).toBeCloseTo(0.047872340425531915, 10);
    expect(metrics.evenness).toBeCloseTo(0.6813936726183989, 10);
    expect(metrics.overflowAmount).toBe(0);
    expect(metrics.edgeAmount).toBe(0);
  });

  it("computing metrics again after also computing the render-smoothed field (same call order the real UI now does) produces identical metrics -- the two paths share no mutable state", () => {
    const deposits = [{ x: 50, y: 50, amount: SAUCE_RATE_PER_TICK }];
    const before = computeSauceMetrics(deposits);
    const field = buildSauceField(deposits);
    smoothSauceFieldForDisplay(field); // render-only path, like PizzaStage.tsx now runs
    const after = computeSauceMetrics(deposits);
    expect(after).toEqual(before);
  });
});

/**
 * Phase 4A-1B.1 Fix B: `smoothSauceFieldForDisplay` itself -- render-only, applied to a copy
 * of the field, never to `field`/`computeSauceMetrics`'s own inputs or outputs.
 */
describe("smoothSauceFieldForDisplay (Phase 4A-1B.1 Fix B: Short Sauce Stroke)", () => {
  it("never mutates the field it's given", () => {
    const field = buildSauceField([{ x: 50, y: 50, amount: SAUCE_RATE_PER_TICK }]);
    const snapshot = Float64Array.from(field);
    smoothSauceFieldForDisplay(field);
    expect(field).toEqual(snapshot);
  });

  // Independent Review follow-up (Codex, PR #28): two chained blur passes could bleed a
  // whisper of newly-visible color into the rim band beyond SAUCE_TARGET_RADIUS even where
  // the raw field had nothing there -- painting sauce the player-facing ふち (edge)
  // evaluation says isn't there. IDEAL_MARGHERITA_SAUCE_FIXTURE (edgeAmount exactly 0) is the
  // concrete case Codex found: 19 previously-invisible rim-band cells crossed the visibility
  // floor before this fix.
  it("never makes a previously-invisible rim-band cell (beyond SAUCE_TARGET_RADIUS) visible -- display can't show edge sauce the ふち metric says isn't there", () => {
    const field = buildSauceField(IDEAL_MARGHERITA_SAUCE_FIXTURE);
    const smoothed = smoothSauceFieldForDisplay(field);
    const MIN_VISIBLE_VALUE = 0.005; // sauceFieldToRgbaPixels's own visibility floor
    for (let row = 0; row < SAUCE_FIELD_SIZE; row += 1) {
      for (let col = 0; col < SAUCE_FIELD_SIZE; col += 1) {
        if (!isCellInsideDough(row, col)) continue;
        const idx = row * SAUCE_FIELD_SIZE + col;
        const cellCenter = ((i: number) => ((i + 0.5) / SAUCE_FIELD_SIZE) * 100);
        const dist = Math.hypot(cellCenter(col) - 50, cellCenter(row) - 50);
        if (dist <= SAUCE_TARGET_RADIUS) continue;
        const rawVisible = field[idx] > MIN_VISIBLE_VALUE;
        const smoothedVisible = smoothed[idx] > MIN_VISIBLE_VALUE;
        expect(smoothedVisible && !rawVisible).toBe(false);
      }
    }
  });

  it("a rim-band cell's smoothed value never exceeds its own raw value -- the clamp only ever pulls display down there, never up", () => {
    const field = buildSauceField(IDEAL_MARGHERITA_SAUCE_FIXTURE);
    const smoothed = smoothSauceFieldForDisplay(field);
    for (let row = 0; row < SAUCE_FIELD_SIZE; row += 1) {
      for (let col = 0; col < SAUCE_FIELD_SIZE; col += 1) {
        const idx = row * SAUCE_FIELD_SIZE + col;
        const cellCenter = ((i: number) => ((i + 0.5) / SAUCE_FIELD_SIZE) * 100);
        const dist = Math.hypot(cellCenter(col) - 50, cellCenter(row) - 50);
        if (dist <= SAUCE_TARGET_RADIUS) continue;
        expect(smoothed[idx]).toBeLessThanOrEqual(field[idx] + 1e-12);
      }
    }
  });

  it("an exact flat plateau (every cell in a 3x3 window equal) maps to itself -- normal/broad coverage's already-good look is untouched", () => {
    const field = new Float64Array(SAUCE_FIELD_SIZE * SAUCE_FIELD_SIZE);
    const V = 0.05;
    // Fill a block well away from the grid's own edge so every cell checked below has a full,
    // unclipped 5x5 neighborhood of equal-valued cells (two chained 3x3 passes reach 2 cells
    // out -- see smoothSauceFieldForDisplay's own doc comment).
    for (let r = 2; r <= 13; r += 1) {
      for (let c = 2; c <= 13; c += 1) {
        field[r * SAUCE_FIELD_SIZE + c] = V;
      }
    }
    const smoothed = smoothSauceFieldForDisplay(field);
    for (let r = 4; r <= 11; r += 1) {
      for (let c = 4; c <= 11; c += 1) {
        expect(smoothed[r * SAUCE_FIELD_SIZE + c]).toBeCloseTo(V, 10);
      }
    }
  });

  it("softens an isolated single-cell spike into a wider, lower-peak gradient instead of a hard-edged block", () => {
    const field = new Float64Array(SAUCE_FIELD_SIZE * SAUCE_FIELD_SIZE);
    const center = Math.floor(SAUCE_FIELD_SIZE / 2);
    field[center * SAUCE_FIELD_SIZE + center] = 0.08;
    const smoothed = smoothSauceFieldForDisplay(field);

    // The spike's own peak is pulled down (spread into its neighbors)...
    expect(smoothed[center * SAUCE_FIELD_SIZE + center]).toBeLessThan(0.08);
    expect(smoothed[center * SAUCE_FIELD_SIZE + center]).toBeGreaterThan(0);
    // ...while its immediate (previously-zero) neighbors now carry some of it, reading as a
    // round falloff instead of a hard square edge. Two chained 3x3 passes reach 2 cells out.
    expect(smoothed[center * SAUCE_FIELD_SIZE + (center + 1)]).toBeGreaterThan(0);
    expect(smoothed[(center + 1) * SAUCE_FIELD_SIZE + center]).toBeGreaterThan(0);
    expect(smoothed[center * SAUCE_FIELD_SIZE + (center + 2)]).toBeGreaterThan(0);
    // A cell one further step out (3 away, outside the chained blur's reach) stays untouched.
    expect(smoothed[center * SAUCE_FIELD_SIZE + (center + 3)]).toBe(0);
  });

  it("preserves the total quantity/coverage/evenness metrics computed from the raw field -- it is display-only, so callers that (mistakenly) fed the smoothed field into computeSauceMetrics-style aggregation would still see the isolated tap's coverage grow (a rounder, wider dab), matching the visual fix", () => {
    const deposits = [{ x: 50, y: 50, amount: SAUCE_RATE_PER_TICK }];
    const raw = buildSauceField(deposits);
    const smoothed = smoothSauceFieldForDisplay(raw);
    let rawTouched = 0;
    let smoothedTouched = 0;
    for (let i = 0; i < raw.length; i += 1) {
      if (raw[i] > 0) rawTouched += 1;
      if (smoothed[i] > 0) smoothedTouched += 1;
    }
    // The visual footprint widens (this is the whole point of the fix)...
    expect(smoothedTouched).toBeGreaterThan(rawTouched);
    // ...but computeSauceMetrics (the authoritative metrics path) never sees `smoothed` --
    // only PizzaStage.tsx's pixel-generation path does -- so real coverage is untouched.
    expect(computeSauceMetrics(deposits).coverage).toBeCloseTo(0.005319148936170213, 10);
  });
});

/**
 * Sauce Free Boundary: `isCellInsideDoughShape`/`insideDoughShapeFraction` are the render-only,
 * D3A-dough-shape-aware counterparts to `isCellInsideDough`/`insideDoughFraction` -- used only by
 * PizzaStage's heatmap effect (never by `computeSauceMetrics`, confirmed by every existing
 * `computeSauceMetrics` test above being untouched by this PR). These pin that they genuinely
 * follow the player's own current dough shape instead of the fixed DOUGH_RADIUS circle.
 */
describe("isCellInsideDoughShape / insideDoughShapeFraction (Sauce Free Boundary)", () => {
  it("a uniform DOUGH_RADIUS-sized shape agrees with the fixed-circle isCellInsideDough everywhere", () => {
    const shape = uniformShape(48);
    for (let row = 0; row < SAUCE_FIELD_SIZE; row += 1) {
      for (let col = 0; col < SAUCE_FIELD_SIZE; col += 1) {
        expect(isCellInsideDoughShape(row, col, shape)).toBe(isCellInsideDough(row, col));
      }
    }
  });

  it("a shape stretched past the old fixed DOUGH_RADIUS circle makes previously-outside cells paintable", () => {
    const shape = uniformShape(DOUGH_SHAPE_TECHNICAL_MAX_RADIUS); // 58 > DOUGH_RADIUS (48)
    // Cell just outside the old fixed circle but inside the technical-max one, straight east.
    const col = Math.floor(((50 + 52) / 100) * SAUCE_FIELD_SIZE);
    const row = Math.floor((50 / 100) * SAUCE_FIELD_SIZE);
    expect(isCellInsideDough(row, col)).toBe(false);
    expect(isCellInsideDoughShape(row, col, shape)).toBe(true);
  });

  it("a shape shrunk below the old fixed circle makes previously-inside cells no longer paintable", () => {
    const shape = uniformShape(20);
    const col = Math.floor(((50 + 30) / 100) * SAUCE_FIELD_SIZE); // inside the old fixed circle (48)
    const row = Math.floor((50 / 100) * SAUCE_FIELD_SIZE);
    expect(isCellInsideDough(row, col)).toBe(true);
    expect(isCellInsideDoughShape(row, col, shape)).toBe(false);
  });

  it("insideDoughShapeFraction is 1 well inside the shape and 0 well outside it, matching insideDoughFraction's own shape for a uniform circle", () => {
    const shape = uniformShape(48);
    expect(insideDoughShapeFraction(shape, 50, 50)).toBe(insideDoughFraction(50, 50));
    expect(insideDoughShapeFraction(shape, 50 + 90, 50)).toBe(insideDoughFraction(50 + 90, 50));
  });

  it("insideDoughShapeFraction follows an asymmetric shape: full credit past the old fixed circle on the stretched side", () => {
    const shape: DoughShape = { radii: uniformShape(30).radii.slice() };
    shape.radii[0] = 55; // angle-index 0 = dough-local east, past the old fixed 48
    // A deposit at distance 52 east -- outside the old fixed circle, inside this shape.
    expect(insideDoughShapeFraction(shape, 50 + 52, 50)).toBe(1);
    // The same absolute position would have been partially/fully overflow against the old
    // fixed circle.
    expect(insideDoughFraction(50 + 52, 50)).toBeLessThan(1);
  });
});

/** sauceFieldToRgbaPixels's new `isCellVisible` parameter: default behavior (every existing
 *  caller/test above) must stay byte-identical; passing a shape-aware predicate must change
 *  only which cells are eligible to paint. */
describe("sauceFieldToRgbaPixels isCellVisible parameter (Sauce Free Boundary)", () => {
  it("defaults to isCellInsideDough -- omitting the parameter changes nothing", () => {
    const field = buildSauceField([{ x: 50, y: 50, amount: 0.3 }]);
    const withDefault = sauceFieldToRgbaPixels(field);
    const withExplicitDefault = sauceFieldToRgbaPixels(field, SAUCE_TOMATO_HEX, isCellInsideDough);
    expect(Array.from(withDefault)).toEqual(Array.from(withExplicitDefault));
  });

  it("a shape-aware predicate can paint a cell the fixed circle would have left transparent", () => {
    // Cell (row 13, col 14): center at dough-percent (90.625, 84.375), distance from center
    // ~53.2 -- outside the old fixed DOUGH_RADIUS circle (48) but inside a shape stretched to
    // DOUGH_SHAPE_TECHNICAL_MAX_RADIUS (58). Deposit placed exactly at that cell's own center
    // so the field has a value there with no falloff ambiguity.
    const row = 13;
    const col = 14;
    const field = buildSauceField([{ x: 90.625, y: 84.375, amount: 0.3 }]);
    const shape = uniformShape(DOUGH_SHAPE_TECHNICAL_MAX_RADIUS);
    expect(isCellInsideDough(row, col)).toBe(false);
    expect(isCellInsideDoughShape(row, col, shape)).toBe(true);

    const fixedCirclePixels = sauceFieldToRgbaPixels(field);
    const shapeAwarePixels = sauceFieldToRgbaPixels(field, SAUCE_TOMATO_HEX, (r, c) =>
      isCellInsideDoughShape(r, c, shape),
    );
    const alphaIndex = (row * SAUCE_FIELD_SIZE + col) * 4 + 3;
    expect(fixedCirclePixels[alphaIndex]).toBe(0);
    expect(shapeAwarePixels[alphaIndex]).toBeGreaterThan(0);
  });

  it("a shape-aware predicate never paints a cell with zero underlying field value, regardless of visibility", () => {
    // Cell (row 13, col 1) is symmetric-opposite of the deposit above: inside the same
    // stretched shape's own visibility test, but the deposit's brush falloff never reaches it.
    const row = 13;
    const col = 1;
    const field = buildSauceField([{ x: 90.625, y: 84.375, amount: 0.3 }]);
    const shape = uniformShape(DOUGH_SHAPE_TECHNICAL_MAX_RADIUS);
    expect(isCellInsideDoughShape(row, col, shape)).toBe(true);

    const pixels = sauceFieldToRgbaPixels(field, SAUCE_TOMATO_HEX, (r, c) =>
      isCellInsideDoughShape(r, c, shape),
    );
    const alphaIndex = (row * SAUCE_FIELD_SIZE + col) * 4 + 3;
    expect(pixels[alphaIndex]).toBe(0);
  });
});
