import { describe, expect, it } from "vitest";
import { SEAM_BAND, SEAM_BINS } from "./foldSealConstants";
import { circleGeometry } from "./foldSealGeometry";
import { countSealed, coverageOf, emptyBins, fillBins, seamAngleInBand, seamAngleOf, seamBinIndex, unsealedRuns, visibleGapRuns } from "./foldSealSeam";

describe("seam angle and bins", () => {
  it("phi runs 0 (west) .. PI (east) along the lower half and is null above the fold line", () => {
    expect(seamAngleOf(2, 50)).toBeCloseTo(0, 10);
    expect(seamAngleOf(50, 98)).toBeCloseTo(Math.PI / 2, 10);
    expect(seamAngleOf(98, 50)).toBeCloseTo(Math.PI, 10);
    expect(seamAngleOf(50, 49.9)).toBeNull();
    expect(seamAngleOf(NaN, 70)).toBeNull();
  });
  it("bin index covers 0..SEAM_BINS-1 with the ends clamped", () => {
    expect(seamBinIndex(0)).toBe(0);
    expect(seamBinIndex(Math.PI)).toBe(SEAM_BINS - 1);
    expect(seamBinIndex(Math.PI / 2)).toBe(SEAM_BINS / 2);
    expect(seamBinIndex(-1)).toBe(0);
    expect(seamBinIndex(99)).toBe(SEAM_BINS - 1);
  });
  it("the band is symmetric around the edge", () => {
    const g = circleGeometry();
    expect(seamAngleInBand(g, 50, 50 + 48)).not.toBeNull();
    expect(seamAngleInBand(g, 50, 50 + 48 + SEAM_BAND)).not.toBeNull();
    expect(seamAngleInBand(g, 50, 50 + 48 - SEAM_BAND)).not.toBeNull();
    expect(seamAngleInBand(g, 50, 50 + 48 + SEAM_BAND + 0.5)).toBeNull();
    expect(seamAngleInBand(g, 50, 50 + 48 - SEAM_BAND - 0.5)).toBeNull();
  });
});

describe("bin helpers", () => {
  it("fillBins copies, clamps, accepts either order, and returns the same array when nothing changes", () => {
    const e = emptyBins();
    const f = fillBins(e, 3, 5);
    expect(f).not.toBe(e);
    expect(countSealed(e)).toBe(0);
    expect(countSealed(f)).toBe(3);
    expect(fillBins(f, 5, 3)).toBe(f);
    expect(countSealed(fillBins(e, -10, 999))).toBe(SEAM_BINS);
  });
  it("coverage and runs", () => {
    const bins = fillBins(fillBins(emptyBins(), 0, 9), 12, 30);
    expect(coverageOf(bins)).toBeCloseTo((10 + 19) / SEAM_BINS, 10);
    expect(unsealedRuns(bins)).toEqual([{ from: 10, to: 11 }, { from: 31, to: 35 }]);
    expect(visibleGapRuns(bins)).toEqual([{ from: 31, to: 35 }]);
    expect(unsealedRuns(fillBins(emptyBins(), 0, SEAM_BINS - 1))).toEqual([]);
    expect(unsealedRuns(emptyBins())).toEqual([{ from: 0, to: SEAM_BINS - 1 }]);
  });
});
