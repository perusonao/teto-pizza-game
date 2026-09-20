import { describe, expect, it } from "vitest";
import {
  finishCookingTiming,
  isAnyCookingTimingPauseReasonActive,
  pauseCookingTiming,
  resumeCookingTiming,
  startCookingTiming,
  type CookingTimingState,
} from "./cookingTiming";

/**
 * Cooking Time CT1: pure clock-math tests mirroring ../mission/lunchRush.test.ts's own shape --
 * hand-picked numeric `now` values, never `vi.useFakeTimers`/`Date.now()`.
 */

describe("startCookingTiming", () => {
  it("starts unpaused, with zero accumulated pause and no completedMs yet, and begins timing the given initial step", () => {
    expect(startCookingTiming(1_000, "DOUGH")).toEqual({
      startedAt: 1_000,
      pausedAt: null,
      accumulatedPauseMs: 0,
      completedMs: null,
      activeStep: "DOUGH",
      stepStartedAt: 1_000,
      stepStartAccumulatedPauseMs: 0,
      perStepElapsedMs: {},
    });
  });
});

describe("finishCookingTiming", () => {
  it("computes exactly 30000ms for a start=1000, finish=31000 run with no pause", () => {
    const timing = startCookingTiming(1_000, "DOUGH");
    const finished = finishCookingTiming(timing, 31_000);
    expect(finished.completedMs).toBe(30_000);
  });

  it("is zero when finished at the exact same instant it started (immediate START_BAKE)", () => {
    const timing = startCookingTiming(5_000, "DOUGH");
    expect(finishCookingTiming(timing, 5_000).completedMs).toBe(0);
  });

  it("clamps to zero rather than going negative for an out-of-order `now`", () => {
    const timing = startCookingTiming(5_000, "DOUGH");
    expect(finishCookingTiming(timing, 1_000).completedMs).toBe(0);
  });

  it("is a no-op once already completed -- a stray second finish never overwrites completedMs", () => {
    const timing = finishCookingTiming(startCookingTiming(0, "DOUGH"), 10_000);
    expect(finishCookingTiming(timing, 99_999)).toBe(timing);
  });

  it("subtracts a single pause/resume cycle's duration from the elapsed total", () => {
    let timing = startCookingTiming(0, "DOUGH");
    timing = pauseCookingTiming(timing, 10_000); // 0 -> 10s active
    timing = resumeCookingTiming(timing, 15_000); // paused 5s
    const finished = finishCookingTiming(timing, 25_000); // +10s active
    expect(finished.completedMs).toBe(20_000);
  });

  it("subtracts multiple pause/resume cycles cumulatively", () => {
    let timing = startCookingTiming(0, "DOUGH");
    timing = pauseCookingTiming(timing, 5_000);
    timing = resumeCookingTiming(timing, 8_000); // +3s paused
    timing = pauseCookingTiming(timing, 12_000);
    timing = resumeCookingTiming(timing, 20_000); // +8s paused (11s total)
    const finished = finishCookingTiming(timing, 30_000);
    expect(finished.completedMs).toBe(30_000 - 11_000);
  });

  it("treats a pause spanning the entire window as zero active time", () => {
    let timing = startCookingTiming(0, "DOUGH");
    timing = pauseCookingTiming(timing, 0);
    const finished = finishCookingTiming(timing, 100_000);
    expect(finished.completedMs).toBe(0);
  });

  it("finalizes at the pause's own start if still paused when finish fires -- the open pause is never counted", () => {
    let timing = startCookingTiming(0, "DOUGH");
    timing = pauseCookingTiming(timing, 10_000);
    const finished = finishCookingTiming(timing, 999_000);
    expect(finished.completedMs).toBe(10_000);
  });
});

describe("pauseCookingTiming / resumeCookingTiming", () => {
  it("resume is a no-op when not currently paused", () => {
    const timing = startCookingTiming(0, "DOUGH");
    expect(resumeCookingTiming(timing, 5_000)).toBe(timing);
  });

  it("pause is a no-op when already paused -- a duplicate signal keeps the original pausedAt", () => {
    let timing = startCookingTiming(0, "DOUGH");
    timing = pauseCookingTiming(timing, 10_000);
    const dupe = pauseCookingTiming(timing, 20_000);
    expect(dupe).toBe(timing);
    expect(dupe.pausedAt).toBe(10_000);
  });

  it("pause/resume are no-ops once completed", () => {
    const finished: CookingTimingState = finishCookingTiming(startCookingTiming(0, "DOUGH"), 1_000);
    expect(pauseCookingTiming(finished, 2_000)).toBe(finished);
    expect(resumeCookingTiming(finished, 3_000)).toBe(finished);
  });
});

describe("isAnyCookingTimingPauseReasonActive (CT2)", () => {
  it("is false when every reason is false", () => {
    expect(isAnyCookingTimingPauseReasonActive(false, false, false)).toBe(false);
    expect(isAnyCookingTimingPauseReasonActive()).toBe(false);
  });

  it("is true when any single reason is true", () => {
    expect(isAnyCookingTimingPauseReasonActive(true, false, false)).toBe(true);
    expect(isAnyCookingTimingPauseReasonActive(false, true, false)).toBe(true);
    expect(isAnyCookingTimingPauseReasonActive(false, false, true)).toBe(true);
  });

  it("stays true for every combination of overlapping reasons", () => {
    expect(isAnyCookingTimingPauseReasonActive(true, true, false)).toBe(true);
    expect(isAnyCookingTimingPauseReasonActive(true, true, true)).toBe(true);
  });

  it("models the overlap scenario the task specifically calls out: Reference open -> app backgrounds -> foregrounds -> Reference still open never reads as resumed", () => {
    // reasons: [referencePopoverOpen, appBackgrounded]
    expect(isAnyCookingTimingPauseReasonActive(true, false)).toBe(true); // Reference opens
    expect(isAnyCookingTimingPauseReasonActive(true, true)).toBe(true); // app also backgrounds
    expect(isAnyCookingTimingPauseReasonActive(true, false)).toBe(true); // app foregrounds -- Reference still open, still paused
    expect(isAnyCookingTimingPauseReasonActive(false, false)).toBe(false); // Reference finally closes -- now it may resume
  });
});
