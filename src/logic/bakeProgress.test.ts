import { describe, expect, it } from "vitest";
import {
  BAKE_DURATION_S,
  BAKE_MAX_FRAME_DT_S,
  BAKE_ZONE_FADE_END_S,
  BAKE_ZONE_FADE_START_S,
  bakePositionAt,
  clampBakeFrameDt,
  computeBakeZoneOpacity,
} from "./bakeProgress";
import { GUIDE_FADE_END_S, GUIDE_FADE_START_S } from "./bakeGuideFade";

describe("bakePositionAt (one-way clock)", () => {
  it("is 0 at the start and exactly 100 after BAKE_DURATION_S (7s)", () => {
    expect(BAKE_DURATION_S).toBe(7);
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

describe("computeBakeZoneOpacity (0-2s shown, 2-3.5s fade, 3.5s+ hidden)", () => {
  it("is fully visible through 2s", () => {
    expect(computeBakeZoneOpacity(0)).toBe(1);
    expect(computeBakeZoneOpacity(BAKE_ZONE_FADE_START_S)).toBe(1);
  });

  it("fades linearly between 2s and 3.5s", () => {
    expect(computeBakeZoneOpacity(2.75)).toBeCloseTo(0.5);
    expect(computeBakeZoneOpacity(2.375)).toBeCloseTo(0.75);
  });

  it("is hidden from 3.5s on and never comes back", () => {
    expect(BAKE_ZONE_FADE_START_S).toBe(2);
    expect(BAKE_ZONE_FADE_END_S).toBe(3.5);
    let previous = Infinity;
    for (let t = 0; t <= 20; t += 0.05) {
      const value = computeBakeZoneOpacity(t);
      expect(value).toBeLessThanOrEqual(previous + 1e-9);
      previous = value;
    }
    expect(computeBakeZoneOpacity(BAKE_ZONE_FADE_END_S)).toBe(0);
    expect(computeBakeZoneOpacity(100)).toBe(0);
  });

  it("keeps CUT's shared guide-fade constants unchanged (3.6s / 7.2s)", () => {
    expect(GUIDE_FADE_START_S).toBe(3.6);
    expect(GUIDE_FADE_END_S).toBe(7.2);
  });
});
