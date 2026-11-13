import { describe, expect, it } from "vitest";
import { DEFAULT_MID_BAKE_WINDOW, midBakeStageAt, progressFromElapsed, sanitizeBakeProgress } from "./midBakeTiming";

describe("MID_BAKE timing", () => {
  it("maps the shared bake progress to a half-open addition window", () => {
    expect(DEFAULT_MID_BAKE_WINDOW).toEqual({ start: 0.65, end: 0.9 });
    expect(midBakeStageAt(0.649999)).toBe("before-window");
    expect(midBakeStageAt(0.65)).toBe("window-open");
    expect(midBakeStageAt(0.899999)).toBe("window-open");
    expect(midBakeStageAt(0.9)).toBe("rebaking");
    expect(midBakeStageAt(1)).toBe("done");
  });

  it("sanitizes external progress and elapsed time", () => {
    expect([sanitizeBakeProgress(-1), sanitizeBakeProgress(0.4), sanitizeBakeProgress(2), sanitizeBakeProgress(NaN)]).toEqual([0, 0.4, 1, 0]);
    expect(progressFromElapsed(6500, 10000)).toBe(0.65);
    expect(progressFromElapsed(Infinity, 10000)).toBe(0);
    expect(progressFromElapsed(1, 0)).toBe(0);
  });

  it("rejects malformed windows instead of silently changing the contract", () => {
    expect(() => midBakeStageAt(0.5, { start: 0.9, end: 0.2 })).toThrow("Invalid MID_BAKE window");
  });
});
