import { describe, expect, it } from "vitest";
import {
  advanceStepTiming,
  finishCookingTiming,
  pauseCookingTiming,
  resumeCookingTiming,
  startCookingTiming,
  type CookingTimingState,
} from "./cookingTiming";

/**
 * Recipe Cooking Steps 1.0 Phase 1A-T (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §22.2):
 * pure clock-math tests for `advanceStepTiming`, mirroring cookingTiming.test.ts's own shape --
 * hand-picked numeric `now` values, never `vi.useFakeTimers`/`Date.now()`. `startCookingTiming`'s
 * own additive fields (`activeStep`/`stepStartedAt`/`stepStartAccumulatedPauseMs`/
 * `perStepElapsedMs`) are covered here; `completedMs`/`finishCookingTiming`'s pre-existing
 * behavior is untouched and already covered by cookingTiming.test.ts.
 */

describe("startCookingTiming (Phase 1A-T additive fields)", () => {
  it("begins timing the given initial step immediately, with an empty perStepElapsedMs", () => {
    const timing = startCookingTiming(1_000, "DOUGH");
    expect(timing.activeStep).toBe("DOUGH");
    expect(timing.stepStartedAt).toBe(1_000);
    expect(timing.stepStartAccumulatedPauseMs).toBe(0);
    expect(timing.perStepElapsedMs).toEqual({});
  });
});

describe("advanceStepTiming", () => {
  it("finalizes the active step's elapsed ms and starts the next step", () => {
    const timing = startCookingTiming(0, "DOUGH");
    const advanced = advanceStepTiming(timing, 5_000, "SAUCE");
    expect(advanced.perStepElapsedMs).toEqual({ DOUGH: 5_000 });
    expect(advanced.activeStep).toBe("SAUCE");
    expect(advanced.stepStartedAt).toBe(5_000);
  });

  it("walks a full DOUGH -> SAUCE -> CHEESE -> TOPPING sequence, accumulating each step independently", () => {
    let timing = startCookingTiming(0, "DOUGH");
    timing = advanceStepTiming(timing, 5_000, "SAUCE"); // DOUGH: 5s
    timing = advanceStepTiming(timing, 9_000, "CHEESE"); // SAUCE: 4s
    timing = advanceStepTiming(timing, 12_000, "TOPPING"); // CHEESE: 3s
    timing = advanceStepTiming(timing, 20_000, null); // TOPPING: 8s, BAKE boundary -- no next step
    expect(timing.perStepElapsedMs).toEqual({
      DOUGH: 5_000,
      SAUCE: 4_000,
      CHEESE: 3_000,
      TOPPING: 8_000,
    });
    expect(timing.activeStep).toBeNull();
    expect(timing.stepStartedAt).toBeNull();
  });

  it("closing out the active step (nextStep: null) never invents a BAKE entry", () => {
    const timing = startCookingTiming(0, "TOPPING");
    const closed = advanceStepTiming(timing, 8_000, null);
    expect(Object.keys(closed.perStepElapsedMs)).toEqual(["TOPPING"]);
    expect(closed.activeStep).toBeNull();
  });

  it("starting a step from a closed (activeStep: null) timing does not finalize anything, just starts", () => {
    const timing = advanceStepTiming(startCookingTiming(0, "TOPPING"), 8_000, null); // closed, BAKE boundary
    const started = advanceStepTiming(timing, 30_000, "CUT"); // e.g. CONFIRM_BAKE landing on POST_BAKE
    expect(started.perStepElapsedMs).toEqual({ TOPPING: 8_000 }); // unchanged, nothing to finalize
    expect(started.activeStep).toBe("CUT");
    expect(started.stepStartedAt).toBe(30_000);
  });

  it("is a true no-op (referentially unchanged) when there is nothing to finalize and nothing to start", () => {
    const timing = advanceStepTiming(startCookingTiming(0, "TOPPING"), 8_000, null);
    expect(advanceStepTiming(timing, 999_000, null)).toBe(timing);
  });

  it("subtracts only the pause time that occurred during the active step, not the whole round's", () => {
    let timing = startCookingTiming(0, "DOUGH");
    timing = advanceStepTiming(timing, 5_000, "SAUCE"); // DOUGH: 5s, no pause yet
    timing = pauseCookingTiming(timing, 7_000); // 2s into SAUCE
    timing = resumeCookingTiming(timing, 10_000); // paused 3s
    timing = advanceStepTiming(timing, 15_000, "CHEESE"); // SAUCE window: 5000->15000 minus 3000 paused = 7s
    expect(timing.perStepElapsedMs.SAUCE).toBe(7_000);
    // The pause happened entirely inside SAUCE's own window -- DOUGH's already-finalized entry
    // must be completely unaffected by a pause that occurred after it left.
    expect(timing.perStepElapsedMs.DOUGH).toBe(5_000);
  });

  it("finalizes at the pause's own start if still paused when the step boundary fires", () => {
    let timing = startCookingTiming(0, "DOUGH");
    timing = pauseCookingTiming(timing, 4_000);
    const advanced = advanceStepTiming(timing, 999_000, "SAUCE");
    expect(advanced.perStepElapsedMs.DOUGH).toBe(4_000);
  });

  it("clamps to zero rather than negative for an out-of-order `now`", () => {
    const timing = startCookingTiming(5_000, "DOUGH");
    const advanced = advanceStepTiming(timing, 1_000, "SAUCE");
    expect(advanced.perStepElapsedMs.DOUGH).toBe(0);
  });

  it("re-visiting the same step key later in the round accumulates rather than overwrites (defensive -- not exercised by any current reducer path)", () => {
    let timing = startCookingTiming(0, "DOUGH");
    timing = advanceStepTiming(timing, 5_000, "SAUCE"); // DOUGH: 5s
    timing = advanceStepTiming(timing, 8_000, "DOUGH"); // SAUCE: 3s, back to DOUGH (hypothetical)
    timing = advanceStepTiming(timing, 10_000, null); // DOUGH: +2s = 7s total
    expect(timing.perStepElapsedMs.DOUGH).toBe(7_000);
  });

  it("per-step sum equals finishCookingTiming's completedMs for a representative pause-free PREPARE walkthrough (Phase 1A-T acceptance criterion §22.13 #2)", () => {
    let timing = startCookingTiming(0, "DOUGH");
    timing = advanceStepTiming(timing, 5_000, "SAUCE");
    timing = advanceStepTiming(timing, 9_000, "CHEESE");
    timing = advanceStepTiming(timing, 12_000, "TOPPING");
    timing = advanceStepTiming(timing, 20_000, null);
    const finished: CookingTimingState = finishCookingTiming(timing, 20_000);
    const sum = Object.values(finished.perStepElapsedMs).reduce((a, b) => a + (b ?? 0), 0);
    expect(sum).toBe(finished.completedMs);
  });

  it("per-step sum equals completedMs across a pause too (pause-aware on both sides)", () => {
    let timing = startCookingTiming(0, "DOUGH");
    timing = advanceStepTiming(timing, 5_000, "SAUCE");
    timing = pauseCookingTiming(timing, 8_000);
    timing = resumeCookingTiming(timing, 13_000); // 5s paused, inside SAUCE
    timing = advanceStepTiming(timing, 18_000, "CHEESE"); // SAUCE window 5000->18000 minus 5000 = 8s
    timing = advanceStepTiming(timing, 25_000, null); // CHEESE: 7s
    const finished = finishCookingTiming(timing, 25_000); // whole round: 25000 - 5000 paused = 20000
    const sum = Object.values(finished.perStepElapsedMs).reduce((a, b) => a + (b ?? 0), 0);
    expect(sum).toBe(finished.completedMs);
    expect(finished.completedMs).toBe(20_000);
  });
});
