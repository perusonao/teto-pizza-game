import { describe, expect, it } from "vitest";
import * as bakeProgress from "./bakeProgress";
import {
  BAKE_DURATION_S,
  BAKE_MAX_FRAME_DT_S,
  bakePositionAt,
  clampBakeFrameDt,
} from "./bakeProgress";
import { GUIDE_FADE_END_S, GUIDE_FADE_START_S } from "./bakeGuideFade";

describe("bakePositionAt (one-way clock)", () => {
  it("is 0 at the start and exactly 100 after BAKE_DURATION_S (3s)", () => {
    expect(BAKE_DURATION_S).toBe(3);
    expect(bakePositionAt(0)).toBe(0);
    expect(bakePositionAt(BAKE_DURATION_S / 2)).toBeCloseTo(50);
    expect(bakePositionAt(BAKE_DURATION_S)).toBe(100);
  });

  it("holds at 100 and never returns", () => {
    expect(bakePositionAt(BAKE_DURATION_S + 1)).toBe(100);
    expect(bakePositionAt(1e6)).toBe(100);
  });

  it("is monotonic non-decreasing over time", () => {
    let previous = -1;
    for (let t = 0; t <= 15; t += 0.05) {
      const value = bakePositionAt(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("treats invalid elapsed time as the start", () => {
    expect(bakePositionAt(-3)).toBe(0);
    expect(bakePositionAt(Number.NaN)).toBe(0);
  });
});

describe("clampBakeFrameDt (no time jump on return from background)", () => {
  it("passes ordinary frame times through", () => {
    expect(clampBakeFrameDt(0.016)).toBeCloseTo(0.016);
  });

  it("caps a huge frame delta", () => {
    expect(clampBakeFrameDt(60)).toBe(BAKE_MAX_FRAME_DT_S);
  });

  it("ignores negative / non-finite deltas", () => {
    expect(clampBakeFrameDt(-1)).toBe(0);
    expect(clampBakeFrameDt(Number.NaN)).toBe(0);
    expect(clampBakeFrameDt(Infinity)).toBe(0);
  });
});

describe("BAKE target zone has no fade (Owner decision: plan A, supersedes Issue #419 fade)", () => {
  it("exports no zone-fade constants or opacity function", () => {
    expect(Object.keys(bakeProgress).filter((k) => /FADE|Opacity/i.test(k))).toEqual([]);
  });

  it("keeps CUT's shared guide-fade constants unchanged (3.6s / 7.2s)", () => {
    expect(GUIDE_FADE_START_S).toBe(3.6);
    expect(GUIDE_FADE_END_S).toBe(7.2);
  });
});
