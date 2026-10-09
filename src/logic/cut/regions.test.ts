import { afterEach, describe, expect, it, vi } from "vitest";
import { createCentralTriangleFixture, createDiameterCutLine, createIdealSliceFixtureLines, createOffsetCutLine } from "./fixtures";
import {
  CIRCLE_AREA,
  SIGNIFICANT_REGION_AREA_FRACTION,
  SIGNIFICANT_REGION_MIN_WIDTH,
  computeRegions,
  getSignificanceThresholds,
  isSignificantRegion,
  polygonCentroid,
  significantRegions,
} from "./regions";
import { sidesOf } from "./geometry";

const sig = (lines: Parameters<typeof computeRegions>[0]) => significantRegions(computeRegions(lines)).length;
const sum = (xs: readonly { area: number }[]) => xs.reduce((s, r) => s + r.area, 0);

describe("regions -- area accuracy", () => {
  it("no lines is one region of ~the whole circle", () => {
    const r = computeRegions([]);
    expect(r).toHaveLength(1);
    expect(Math.abs(r[0].area / CIRCLE_AREA - 1)).toBeLessThan(2e-5);
  });

  it("a diameter makes two half-circles that agree to 0.05 u^2", () => {
    const [a, b] = computeRegions([createDiameterCutLine(33)]);
    expect(Math.abs(a.area - b.area)).toBeLessThan(0.05);
  });

  it.each([0, 10, 20, 30, 45])("all regions sum to the circle (rotation %i)", (rot) => {
    for (const d of [0.3, 1, 3.5, 6, 20]) {
      expect(Math.abs(sum(computeRegions(createCentralTriangleFixture(d, rot))) - CIRCLE_AREA)).toBeLessThan(0.1);
    }
  });

  it("area multiset does not depend on line order", () => {
    const lines = createCentralTriangleFixture(5, 7);
    const a = computeRegions(lines).map((r) => r.area).sort((x, y) => x - y);
    const b = computeRegions([...lines].reverse()).map((r) => r.area).sort((x, y) => x - y);
    expect(a).toHaveLength(b.length);
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));
  });

  it("a zero-length line splits nothing and never produces NaN", () => {
    const p = { x: 50, y: 50 };
    const r = computeRegions([{ start: p, end: p }]);
    expect(r).toHaveLength(1);
    expect(Number.isFinite(r[0].area)).toBe(true);
  });

  it("every centroid is inside its own region (sidesOf tuple matches the key)", () => {
    const lines = createCentralTriangleFixture(6, 13);
    for (const region of computeRegions(lines)) {
      const c = polygonCentroid(region.polygon);
      const key = lines.map((l) => (sidesOf(c, l) === 1 ? "1" : "0")).join("");
      expect(key).toBe(region.key);
    }
  });

  it("is fast (median of 6 lines well under 5 ms)", () => {
    const lines = [...createIdealSliceFixtureLines(8), createOffsetCutLine(10, 5), createOffsetCutLine(100, 9)];
    const times: number[] = [];
    for (let i = 0; i < 21; i++) {
      const t = performance.now();
      computeRegions(lines);
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    expect(times[10]).toBeLessThan(5);
  });
});

describe("significance thresholds", () => {
  it("defaults are 0.1% of the circle and 1.0 u, independent of the requested slice count", () => {
    expect(SIGNIFICANT_REGION_AREA_FRACTION).toBe(0.001);
    expect(SIGNIFICANT_REGION_MIN_WIDTH).toBe(1.0);
    expect(getSignificanceThresholds()).toEqual({ areaFraction: 0.001, minWidth: 1.0 });
  });

  it.each([0, 10, 20, 30, 45])("central triangle: d=3.5 -> 6, d=3.75 -> 7 (rotation %i)", (rot) => {
    expect(sig(createCentralTriangleFixture(1, rot))).toBe(6);
    expect(sig(createCentralTriangleFixture(3.5, rot))).toBe(6);
    expect(sig(createCentralTriangleFixture(3.75, rot))).toBe(7);
    expect(sig(createCentralTriangleFixture(6, rot))).toBe(7);
    // The geometry always has 7 regions once the third line is off-centre.
    expect(computeRegions(createCentralTriangleFixture(1, rot))).toHaveLength(7);
  });

  it.each([0, 25])("parallel pair: gap 0.45 -> band not significant, 0.55 -> significant (rot %i)", (rot) => {
    const pair = (gap: number) => [createOffsetCutLine(rot, -gap / 2), createOffsetCutLine(rot, gap / 2)];
    expect(computeRegions(pair(0.45))).toHaveLength(3);
    expect(sig(pair(0.45))).toBe(2);
    expect(sig(pair(0.55))).toBe(3);
  });

  it.each([0, 40])("shallow crossing: 1.15 deg -> not significant, 1.3 deg -> significant (rot %i)", (rot) => {
    const cross = (deg: number) => [createOffsetCutLine(rot, 0), createOffsetCutLine(rot + deg, 0)];
    expect(sig(cross(1.15))).toBe(2);
    expect(sig(cross(1.3))).toBe(4);
  });

  it("rim sliver: 0.7 u thick -> not significant, 0.8 u -> significant", () => {
    const sliver = (t: number) => [createOffsetCutLine(0, DOUGH_RADIUS_MINUS(t))];
    expect(computeRegions(sliver(0.7))).toHaveLength(2);
    expect(sig(sliver(0.7))).toBe(1);
    expect(sig(sliver(0.8))).toBe(2);
  });

  it("thresholds can be injected (the Preview override path)", () => {
    const r = computeRegions(createCentralTriangleFixture(3));
    const small = r.filter((x) => x.area < 30);
    expect(small.length).toBeGreaterThan(0);
    expect(small.every((x) => !isSignificantRegion(x))).toBe(true);
    expect(small.some((x) => isSignificantRegion(x, { areaFraction: 0.0005, minWidth: 0.5 }))).toBe(true);
  });
});

afterEach(() => vi.unstubAllEnvs());

function DOUGH_RADIUS_MINUS(t: number): number {
  return 48 - t;
}
