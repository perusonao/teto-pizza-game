import { describe, expect, it } from "vitest";
import { gameReducer, type GameState } from "./gameReducer";
import { startCookingTiming, finishCookingTiming, advanceStepTiming } from "../logic/cookingTiming";
import { createGuidedInitialState } from "./testSupport/guidedRound";

/** Issue #453 (PR #454 review): a cancelled HOME-leave confirmation during CUT must not count
 *  toward the CUT step's elapsed time. */
function cutState(): GameState {
  const timing = advanceStepTiming(finishCookingTiming(startCookingTiming(0, "DOUGH"), 1_000), 1_000, "CUT");
  return { ...createGuidedInitialState(), phase: "POST_BAKE", makingStep: "CUT", cookingTiming: timing };
}

describe("EXCLUDE_STEP_SPAN", () => {
  it("shifts the CUT window so only the time outside the dialog counts", () => {
    const state = gameReducer(cutState(), { type: "EXCLUDE_STEP_SPAN", now: 6_000, spanMs: 4_000 });
    expect(state.cookingTiming?.stepStartedAt).toBe(5_000);
    expect(state.cookingTiming?.completedMs).toBe(1_000);
  });

  it("is a no-op outside POST_BAKE and without cookingTiming", () => {
    const prepare = { ...cutState(), phase: "PREPARE" as const };
    expect(gameReducer(prepare, { type: "EXCLUDE_STEP_SPAN", now: 6_000, spanMs: 4_000 })).toBe(prepare);
    const mission = { ...cutState(), cookingTiming: null };
    expect(gameReducer(mission, { type: "EXCLUDE_STEP_SPAN", now: 6_000, spanMs: 4_000 })).toBe(mission);
  });

  it("is a no-op for a zero span", () => {
    const state = cutState();
    expect(gameReducer(state, { type: "EXCLUDE_STEP_SPAN", now: 6_000, spanMs: 0 })).toBe(state);
  });
});
