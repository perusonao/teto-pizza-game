import { describe, expect, it } from "vitest";
import { createChordCutLine, createDiameterCutLine, createIdealSliceFixtureLines } from "./fixtures";
import {
  CIRCLE_AREA,
  CIRCLE_POLYGON_SIDES,
  DEFAULT_CUT_SIGNIFICANCE,
  chordOf,
  computeCutRegions,
  getCutSignificanceThresholds,
  isSignificantRegion,
  isStraightCut,
  type CutRegion,
} from "./regions";
import type { CutLine } from "./types";

const sum = (regions: readonly CutRegion[]) => regions.reduce((s, r) => s + r.area, 0);
const significant = (lines: readonly CutLine[]) => computeCutRegions(lines).filter((r) => isSignificantRegion(r));
const sortedAreas = (lines: readonly CutLine[]) =>
  computeCutRegions(lines)
    .map((r) => r.area)
    .sort((a, b) => a - b);

function pointInConvex(polygon: readonly { x: number; y: number }[], p: { x: number; y: number }): boolean {
  let sign = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/** The three-cut arrangement of #427: diameters at `angle` and `angle + 60`, the third (`angle + 120`) shifted by `d`. */
const triangle = (d: number, angle = 0) => [
  createChordCutLine(angle, 0),
  createChordCutLine(angle + 60, 0),
  createChordCutLine(angle + 120, d),
];

describe("the 720-gon standing in for the ideal circle", () => {
  it("is 720-sided and its area is within 2e-5 of the circle's (exactly 1 - (2 pi / 720)^2 / 6 = 1 - 1.27e-5, 0.09 u^2)", () => {
    expect(CIRCLE_POLYGON_SIDES).toBe(720);
    const [whole] = computeCutRegions([]);
    const expected = 1 - (2 * Math.PI / CIRCLE_POLYGON_SIDES) ** 2 / 6;
    expect(whole.area / CIRCLE_AREA).toBeCloseTo(expected, 7);
    expect(Math.abs(whole.area / CIRCLE_AREA - 1)).toBeLessThan(2e-5);
    expect(CIRCLE_AREA - whole.area).toBeLessThan(0.1);
  });

  it("a diameter makes two halves whose areas differ by under 0.05 u^2", () => {
    const [a, b] = computeCutRegions([createDiameterCutLine(0)]);
    expect(Math.abs(a.area - b.area)).toBeLessThan(0.05);
  });

  it("the regions of every fixed arrangement add up to the circle within 0.1 u^2", () => {
    const arrangements: CutLine[][] = [
      [],
      [createDiameterCutLine(0)],
      [...createIdealSliceFixtureLines(6)],
      [...createIdealSliceFixtureLines(8)],
      triangle(1),
      triangle(6),
      [createChordCutLine(0, 0), createChordCutLine(0, 0.25), createChordCutLine(0, 3)],
      [createChordCutLine(0, 0), createChordCutLine(1.3, 0)],
      [createChordCutLine(0, 47.4)],
      [createChordCutLine(10, 5), createChordCutLine(80, -9), createChordCutLine(130, 20), createChordCutLine(35, -30)],
    ];
    for (const lines of arrangements) expect(Math.abs(sum(computeCutRegions(lines)) - CIRCLE_AREA)).toBeLessThan(0.1);
  });
});

describe("computeCutRegions", () => {
  it("no cuts is the whole pizza as one region", () => {
    expect(computeCutRegions([])).toHaveLength(1);
  });

  it("a degenerate (zero-length) line splits nothing and never produces NaN", () => {
    const point = { x: 50, y: 50 };
    const regions = computeCutRegions([{ start: point, end: point }]);
    expect(regions).toHaveLength(1);
    expect(Number.isFinite(regions[0].area)).toBe(true);
  });

  it("the same cut twice splits no further (a line along another makes no sliver)", () => {
    const line = createDiameterCutLine(30);
    expect(computeCutRegions([line, line])).toHaveLength(2);
  });

  it("is independent of the order of the cuts", () => {
    const lines = [createChordCutLine(10, 5), createChordCutLine(80, -9), createChordCutLine(130, 20)];
    const forward = sortedAreas(lines);
    const reversed = sortedAreas([...lines].reverse());
    expect(reversed).toHaveLength(forward.length);
    forward.forEach((area, i) => expect(reversed[i]).toBeCloseTo(area, 6));
  });

  it("every region is convex, and its centroid is inside it", () => {
    for (const lines of [triangle(1), triangle(6), [createChordCutLine(0, 0), createChordCutLine(1.3, 0)]]) {
      for (const region of computeCutRegions(lines)) {
        expect(pointInConvex(region.polygon, region.centroid), "centroid inside").toBe(true);
        expect(region.width).toBeGreaterThan(0);
        expect(region.width).toBeLessThanOrEqual((4 * region.area) / region.perimeter + 1e-9);
      }
    }
  });

  it("three diameters at 60 degrees make six equal slices", () => {
    const areas = sortedAreas([...createIdealSliceFixtureLines(6)]);
    expect(areas).toHaveLength(6);
    for (const area of areas) expect(area).toBeCloseTo(CIRCLE_AREA / 6, 1);
  });

  it("is fast (a loose bound only: median under 5 ms for six cuts)", () => {
    const lines = [...createIdealSliceFixtureLines(12)];
    const times: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const t0 = performance.now();
      computeCutRegions(lines);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    expect(times[12]).toBeLessThan(5);
  });
});

describe("chordOf / isStraightCut", () => {
  it("a traced path's chord is its first and last point; a path-less line uses start / end", () => {
    const traced: CutLine = {
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
      path: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }],
    };
    expect(chordOf(traced)).toEqual({ a: { x: 10, y: 10 }, b: { x: 30, y: 30 } });
    const legacy: CutLine = { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } };
    expect(chordOf(legacy)).toEqual({ a: { x: 1, y: 2 }, b: { x: 3, y: 4 } });
  });

  it("straight within 0.01 u, curved beyond it", () => {
    expect(isStraightCut(createDiameterCutLine(0))).toBe(true);
    expect(isStraightCut({ start: { x: 0, y: 50 }, end: { x: 100, y: 50 } })).toBe(true);
    const bowed = [{ x: 2, y: 50 }, { x: 50, y: 25 }, { x: 98, y: 50 }];
    expect(isStraightCut({ start: bowed[0], end: bowed[2], path: bowed })).toBe(false);
  });
});

describe("significance thresholds (initial values; adjusted on a real device)", () => {
  it("are named constants: 0.1% of the pizza and 1.0 u", () => {
    expect(DEFAULT_CUT_SIGNIFICANCE).toEqual({ areaFraction: 0.001, minWidth: 1.0 });
    expect(Object.isFrozen(DEFAULT_CUT_SIGNIFICANCE)).toBe(true);
    expect(getCutSignificanceThresholds()).toBe(DEFAULT_CUT_SIGNIFICANCE);
    expect(DEFAULT_CUT_SIGNIFICANCE.areaFraction * CIRCLE_AREA).toBeCloseTo(7.24, 2);
  });

  it("a region needs BOTH the area and the width", () => {
    const t = DEFAULT_CUT_SIGNIFICANCE;
    const area = t.areaFraction * CIRCLE_AREA;
    expect(isSignificantRegion({ area: area + 0.01, width: t.minWidth + 0.01 })).toBe(true);
    expect(isSignificantRegion({ area: area - 0.01, width: 5 })).toBe(false);
    expect(isSignificantRegion({ area: 500, width: t.minWidth - 0.01 })).toBe(false);
  });

  it("depend on nothing but the region (not on the requested slice count)", () => {
    // the predicate has no slice-count input at all; 4 / 6 / 8 cuts make the same regions significant
    expect(significant([...createIdealSliceFixtureLines(4)])).toHaveLength(4);
    expect(significant([...createIdealSliceFixtureLines(6)])).toHaveLength(6);
    expect(significant([...createIdealSliceFixtureLines(8)])).toHaveLength(8);
  });
});

describe("boundaries, fixed from BOTH sides (the 7th region of three nearly concurrent cuts)", () => {
  it.each([0, 10, 20, 30, 45])("centre triangle, cuts rotated %i deg: d=3.5 -> 6 pieces, d=3.75 -> 7", (angle) => {
    expect(significant(triangle(3.5, angle))).toHaveLength(6);
    expect(significant(triangle(3.75, angle))).toHaveLength(7);
  });

  it("the tiny triangle EXISTS (7 regions) at every d > 0 even when it is not significant", () => {
    for (const d of [0.25, 0.5, 1, 2, 3.5]) {
      expect(computeCutRegions(triangle(d))).toHaveLength(7);
      expect(significant(triangle(d))).toHaveLength(6);
    }
    expect(computeCutRegions(triangle(0))).toHaveLength(6);
  });

  it("d sweep 0..8: 6 up to the boundary, 7 beyond it, never back", () => {
    let seven = false;
    for (let d = 0; d <= 8.0001; d += 0.05) {
      const n = significant(triangle(d)).length;
      expect(n === 6 || n === 7).toBe(true);
      if (n === 7) seven = true;
      else expect(seven, `d=${d.toFixed(2)} fell back to 6 after 7`).toBe(false);
    }
    expect(seven).toBe(true);
  });

  it("two parallel cuts: a 0.45 u gap makes no significant strip, 0.55 u does", () => {
    expect(computeCutRegions([createChordCutLine(0, 0), createChordCutLine(0, 0.45)])).toHaveLength(3);
    expect(significant([createChordCutLine(0, 0), createChordCutLine(0, 0.45)])).toHaveLength(2);
    expect(significant([createChordCutLine(0, 0), createChordCutLine(0, 0.55)])).toHaveLength(3);
    for (const rotation of [0, 20, 45, 90]) {
      expect(significant([createChordCutLine(rotation, 0), createChordCutLine(rotation, 0.45)])).toHaveLength(2);
      expect(significant([createChordCutLine(rotation, 0), createChordCutLine(rotation, 0.55)])).toHaveLength(3);
    }
  });

  it("two cuts crossing at a shallow angle: 1.15 deg leaves a thin wedge, 1.3 deg a real one", () => {
    for (const rotation of [0, 17, 45]) {
      expect(computeCutRegions([createChordCutLine(rotation, 0), createChordCutLine(rotation + 1.15, 0)])).toHaveLength(4);
      expect(significant([createChordCutLine(rotation, 0), createChordCutLine(rotation + 1.15, 0)])).toHaveLength(2);
      expect(significant([createChordCutLine(rotation, 0), createChordCutLine(rotation + 1.3, 0)])).toHaveLength(4);
    }
  });

  it("a chord cut near the rim: a 0.7 u sliver is not a piece, a 0.8 u one is", () => {
    const sliver = (thickness: number) => [createChordCutLine(0, 48 - thickness)];
    expect(computeCutRegions(sliver(0.7))).toHaveLength(2);
    expect(significant(sliver(0.7))).toHaveLength(1);
    expect(significant(sliver(0.8))).toHaveLength(2);
    expect(significant(sliver(2))).toHaveLength(2);
  });
});
