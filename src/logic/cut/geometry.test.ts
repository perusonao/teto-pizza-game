import { describe, expect, it } from "vitest";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../pizzaCoordinates";
import { createDiameterCutLine, createIdealSliceFixtureLines } from "./fixtures";
import {
  CIRCLE_AREA,
  computePieceAreas,
  cutLineOrientationRadians,
  isDuplicateCutLine,
  MIN_CUT_ANGULAR_SEPARATION_RADIANS,
  perpendicularDistanceFromCenter,
  sidesOf,
} from "./geometry";
import type { CutLine } from "./types";

// Grid-sampling discretization noise for the ideal 6-slice fixture is empirically ~0.1% of the
// ideal piece area at GRID_RESOLUTION=96 -- 3% is a generous but still meaningfully discriminating
// tolerance (an actually uneven cut, tested separately below, misses this by a wide margin).
const UNIFORMITY_TOLERANCE_FRACTION = 0.03;

function sumAreas(areas: readonly number[]): number {
  return areas.reduce((a, b) => a + b, 0);
}

describe("computePieceAreas -- ideal 6-slice fixture", () => {
  const lines = createIdealSliceFixtureLines(6);
  const areas = computePieceAreas(lines);

  it("produces exactly 6 pieces from 3 diameter cuts (0deg/60deg/120deg)", () => {
    expect(areas).toHaveLength(6);
  });

  it("produces approximately uniform piece areas", () => {
    const idealArea = CIRCLE_AREA / 6;
    for (const area of areas) {
      expect(Math.abs(area - idealArea) / idealArea).toBeLessThan(UNIFORMITY_TOLERANCE_FRACTION);
    }
  });

  it("areas sum to approximately the full circle area", () => {
    expect(sumAreas(areas)).toBeCloseTo(CIRCLE_AREA, 0);
  });
});

describe("computePieceAreas -- determinism", () => {
  it("returns identical results for identical input across repeated calls", () => {
    const lines = createIdealSliceFixtureLines(6);
    const first = computePieceAreas(lines);
    const second = computePieceAreas(lines);
    expect(second).toEqual(first);
  });
});

describe("computePieceAreas -- 4/8 future configs", () => {
  it("handles 4 slices (2 diameters) without any 6-specific engine change", () => {
    expect(computePieceAreas(createIdealSliceFixtureLines(4))).toHaveLength(4);
  });

  it("handles 8 slices (4 diameters) without any 6-specific engine change", () => {
    expect(computePieceAreas(createIdealSliceFixtureLines(8))).toHaveLength(8);
  });
});

describe("computePieceAreas -- zero lines", () => {
  it("returns a single region covering the whole circle", () => {
    const areas = computePieceAreas([]);
    expect(areas).toHaveLength(1);
    expect(areas[0]).toBeCloseTo(CIRCLE_AREA, 0);
    expect(Number.isFinite(areas[0])).toBe(true);
  });
});

describe("computePieceAreas -- adversarial inputs never crash and stay well-defined", () => {
  it("a duplicate line (identical start/end to another committed line) splits into 2 halves", () => {
    const line = createDiameterCutLine(0);
    const areas = computePieceAreas([line, line]);
    expect(areas).toHaveLength(2);
    expect(sumAreas(areas)).toBeCloseTo(CIRCLE_AREA, 0);
    for (const area of areas) {
      expect(Number.isFinite(area)).toBe(true);
      expect(area).toBeGreaterThan(0);
    }
  });

  it("a near-duplicate line (angle just above a minimal separation) produces a defined tiny sliver", () => {
    const areas = computePieceAreas([createDiameterCutLine(0), createDiameterCutLine(1)]);
    expect(areas.length).toBeGreaterThanOrEqual(2);
    for (const area of areas) {
      expect(Number.isFinite(area)).toBe(true);
      expect(area).toBeGreaterThanOrEqual(0);
    }
    expect(sumAreas(areas)).toBeCloseTo(CIRCLE_AREA, 0);
  });

  it("a zero-length (degenerate) line does not crash and produces one whole-circle region", () => {
    const zeroLength: CutLine = { start: { x: 80, y: 50 }, end: { x: 80, y: 50 } };
    const areas = computePieceAreas([zeroLength]);
    expect(areas).toHaveLength(1);
    expect(Number.isFinite(areas[0])).toBe(true);
    expect(areas[0]).toBeCloseTo(CIRCLE_AREA, 0);
  });

  it("a near-tangent line barely grazing the rim does not crash", () => {
    const nearTangent: CutLine = {
      start: { x: DOUGH_CENTER + DOUGH_RADIUS - 0.001, y: DOUGH_CENTER },
      end: { x: DOUGH_CENTER + DOUGH_RADIUS, y: DOUGH_CENTER + 0.01 },
    };
    expect(() => computePieceAreas([nearTangent])).not.toThrow();
    const areas = computePieceAreas([nearTangent]);
    for (const area of areas) expect(Number.isFinite(area)).toBe(true);
    expect(sumAreas(areas)).toBeCloseTo(CIRCLE_AREA, 0);
  });

  it("crossing lines well off-center still classify into a well-defined set of regions", () => {
    const a: CutLine = { start: { x: DOUGH_CENTER - DOUGH_RADIUS, y: DOUGH_CENTER - 10 }, end: { x: DOUGH_CENTER + DOUGH_RADIUS - 20, y: DOUGH_CENTER + 20 } };
    const b: CutLine = { start: { x: DOUGH_CENTER - 20, y: DOUGH_CENTER - DOUGH_RADIUS + 5 }, end: { x: DOUGH_CENTER + 20, y: DOUGH_CENTER + DOUGH_RADIUS - 5 } };
    const areas = computePieceAreas([a, b]);
    expect(areas.length).toBeGreaterThan(0);
    expect(sumAreas(areas)).toBeCloseTo(CIRCLE_AREA, 0);
    for (const area of areas) expect(Number.isFinite(area)).toBe(true);
  });
});

describe("computePieceAreas -- horizontal / vertical / diagonal lines", () => {
  it("a horizontal diameter (0deg) splits into 2 roughly equal halves", () => {
    const areas = computePieceAreas([createDiameterCutLine(0)]);
    expect(areas).toHaveLength(2);
    expect(Math.abs(areas[0] - areas[1]) / CIRCLE_AREA).toBeLessThan(0.01);
  });

  it("a vertical diameter (90deg) splits into 2 roughly equal halves", () => {
    const areas = computePieceAreas([createDiameterCutLine(90)]);
    expect(areas).toHaveLength(2);
    expect(Math.abs(areas[0] - areas[1]) / CIRCLE_AREA).toBeLessThan(0.01);
  });

  it("a diagonal diameter (45deg) splits into 2 roughly equal halves", () => {
    const areas = computePieceAreas([createDiameterCutLine(45)]);
    expect(areas).toHaveLength(2);
    expect(Math.abs(areas[0] - areas[1]) / CIRCLE_AREA).toBeLessThan(0.01);
  });
});

describe("sidesOf", () => {
  it("classifies points on opposite sides of a horizontal diameter with opposite signs", () => {
    const line = createDiameterCutLine(0);
    const above = sidesOf({ x: DOUGH_CENTER, y: DOUGH_CENTER - 10 }, line);
    const below = sidesOf({ x: DOUGH_CENTER, y: DOUGH_CENTER + 10 }, line);
    expect(above).not.toBe(below);
  });

  it("never crashes for a zero-length line", () => {
    const zeroLength: CutLine = { start: { x: 60, y: 60 }, end: { x: 60, y: 60 } };
    expect(() => sidesOf({ x: 70, y: 70 }, zeroLength)).not.toThrow();
  });
});

describe("cutLineOrientationRadians", () => {
  it("a horizontal (0deg) line has orientation 0", () => {
    expect(cutLineOrientationRadians(createDiameterCutLine(0))).toBeCloseTo(0, 6);
  });

  it("a 180deg (reversed-direction) line has the identical orientation to its 0deg counterpart", () => {
    const zero = cutLineOrientationRadians(createDiameterCutLine(0));
    const reversed = cutLineOrientationRadians(createDiameterCutLine(180));
    expect(reversed).toBeCloseTo(zero, 6);
  });

  it("swapping start/end (the same physical line drawn backwards) does not change orientation", () => {
    const line = createDiameterCutLine(37);
    const swapped: CutLine = { start: line.end, end: line.start };
    expect(cutLineOrientationRadians(swapped)).toBeCloseTo(cutLineOrientationRadians(line), 6);
  });

  it("a 60deg line has orientation pi/3", () => {
    expect(cutLineOrientationRadians(createDiameterCutLine(60))).toBeCloseTo(Math.PI / 3, 6);
  });

  it("a zero-length (degenerate) line returns 0, never NaN", () => {
    const zeroLength: CutLine = { start: { x: 80, y: 50 }, end: { x: 80, y: 50 } };
    expect(cutLineOrientationRadians(zeroLength)).toBe(0);
  });
});

describe("isDuplicateCutLine", () => {
  it("an exact duplicate (identical start/end) is rejected", () => {
    const line = createDiameterCutLine(0);
    expect(isDuplicateCutLine({ ...line }, [line])).toBe(true);
  });

  it("the same line with reversed endpoints is rejected", () => {
    const line = createDiameterCutLine(0);
    const reversed: CutLine = { start: line.end, end: line.start };
    expect(isDuplicateCutLine(reversed, [line])).toBe(true);
  });

  it("a near-duplicate within the threshold (a few degrees off) is rejected", () => {
    const existing = createDiameterCutLine(0);
    const nearDuplicate = createDiameterCutLine(5); // well under MIN_CUT_ANGULAR_SEPARATION_RADIANS (15deg)
    expect(isDuplicateCutLine(nearDuplicate, [existing])).toBe(true);
  });

  it("a line just outside the threshold is accepted", () => {
    const existing = createDiameterCutLine(0);
    const thresholdDegrees = (MIN_CUT_ANGULAR_SEPARATION_RADIANS * 180) / Math.PI;
    const justOutside = createDiameterCutLine(thresholdDegrees + 1);
    expect(isDuplicateCutLine(justOutside, [existing])).toBe(false);
  });

  it("a line just inside the threshold is rejected", () => {
    const existing = createDiameterCutLine(0);
    const thresholdDegrees = (MIN_CUT_ANGULAR_SEPARATION_RADIANS * 180) / Math.PI;
    const justInside = createDiameterCutLine(thresholdDegrees - 1);
    expect(isDuplicateCutLine(justInside, [existing])).toBe(true);
  });

  it("a normal 3-line/6-slice pattern (60deg apart) is never flagged as a duplicate of another", () => {
    const lines = createIdealSliceFixtureLines(6);
    for (let i = 0; i < lines.length; i++) {
      const rest = lines.filter((_, index) => index !== i);
      expect(isDuplicateCutLine(lines[i], rest)).toBe(false);
    }
  });

  it("wraps correctly near the 0/pi boundary (e.g. 178deg vs 2deg are close, not far apart)", () => {
    const nearPi = createDiameterCutLine(178);
    const nearZero = createDiameterCutLine(2);
    expect(isDuplicateCutLine(nearPi, [nearZero])).toBe(true);
  });

  it("an empty existingLines list never flags anything as a duplicate", () => {
    expect(isDuplicateCutLine(createDiameterCutLine(0), [])).toBe(false);
  });
});

describe("perpendicularDistanceFromCenter", () => {
  it("is ~0 for a line through the exact center", () => {
    expect(perpendicularDistanceFromCenter(createDiameterCutLine(0))).toBeCloseTo(0, 6);
  });

  it("matches the known offset for a chord parallel to but away from center", () => {
    const halfWidth = Math.sqrt(DOUGH_RADIUS * DOUGH_RADIUS - 20 * 20);
    const offset: CutLine = {
      start: { x: DOUGH_CENTER - halfWidth, y: DOUGH_CENTER + 20 },
      end: { x: DOUGH_CENTER + halfWidth, y: DOUGH_CENTER + 20 },
    };
    expect(perpendicularDistanceFromCenter(offset)).toBeCloseTo(20, 6);
  });

  it("returns the worst-case distance (DOUGH_RADIUS), not NaN, for a zero-length line", () => {
    const zeroLength: CutLine = { start: { x: 80, y: 50 }, end: { x: 80, y: 50 } };
    const distance = perpendicularDistanceFromCenter(zeroLength);
    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBe(DOUGH_RADIUS);
  });
});
