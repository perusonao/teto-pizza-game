import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX, registerScoreToDex } from "./dex";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

const MARGHERITA_DISCOVERED_DEX = registerScoreToDex(EMPTY_DEX, "margherita", {
  total: 80,
  stars: 4,
  sauce: 20,
  pieces: 20,
  recipe: 20,
  bake: 20,
}).dex;

/**
 * Cooking Time CT1: `GameState.cookingTiming`, the deterministic FREE-only
 * `BEGIN_PREPARE`-equivalent -> `START_BAKE` measurement foundation (../logic/cookingTiming.ts).
 * See docs/reports/TETO_COOKING-TIME_CT1_Implementation-Result.md for the full contract this
 * suite enforces.
 */

function beginFreePrepare(now: number, state: GameState = createInitialGameState()): GameState {
  return gameReducer(state, { type: "BEGIN_PREPARE", now });
}

describe("FREE round: BEGIN_PREPARE starts cookingTiming", () => {
  it("starts a fresh, unpaused, uncompleted timing at the given `now`", () => {
    const state = beginFreePrepare(1_000);
    expect(state.cookingTiming).toEqual({
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

  it("stays null when `now` is omitted (back-compat dispatch, timing simply not measured)", () => {
    const state = gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" });
    expect(state.cookingTiming).toBeNull();
  });
});

describe("START_BAKE finalizes completedMs, excluding BAKE itself", () => {
  it("30 seconds of PREPARE (start=1000, finish=31000) -> completedMs = 30000", () => {
    let state = beginFreePrepare(1_000);
    state = gameReducer(state, { type: "START_BAKE", now: 31_000 });
    expect(state.cookingTiming?.completedMs).toBe(30_000);
  });

  it("time elapsed during BAKE itself never changes completedMs", () => {
    let state = beginFreePrepare(1_000);
    state = gameReducer(state, { type: "START_BAKE", now: 31_000 });
    const completedAtBakeStart = state.cookingTiming?.completedMs;

    // A long, in-BAKE pause/resume signal (e.g. Reference popover toggled while BAKE's own
    // needle overlay is up) must be inert here -- PAUSE/RESUME_COOKING_TIMING's own reducer
    // guard is phase === "PREPARE" only.
    state = gameReducer(state, { type: "PAUSE_COOKING_TIMING", now: 40_000 });
    state = gameReducer(state, { type: "RESUME_COOKING_TIMING", now: 999_000 });
    expect(state.cookingTiming?.completedMs).toBe(completedAtBakeStart);

    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    expect(state.cookingTiming?.completedMs).toBe(30_000);
  });

  it("finalizes at the pause's own start if still paused the instant START_BAKE fires", () => {
    let state = beginFreePrepare(0);
    state = gameReducer(state, { type: "PAUSE_COOKING_TIMING", now: 10_000 });
    state = gameReducer(state, { type: "START_BAKE", now: 500_000 });
    expect(state.cookingTiming?.completedMs).toBe(10_000);
  });
});

describe("pause boundary (Reference popover / Dex / Shop / Inventory overlay)", () => {
  it("excludes a paused span from completedMs", () => {
    let state = beginFreePrepare(0);
    state = gameReducer(state, { type: "PAUSE_COOKING_TIMING", now: 5_000 }); // 5s active so far
    state = gameReducer(state, { type: "RESUME_COOKING_TIMING", now: 20_000 }); // 15s paused
    state = gameReducer(state, { type: "START_BAKE", now: 25_000 }); // +5s active
    expect(state.cookingTiming?.completedMs).toBe(10_000);
  });

  it("is a no-op outside PREPARE (e.g. a stray dispatch during BAKE/RESULT)", () => {
    let state = beginFreePrepare(0);
    state = gameReducer(state, { type: "START_BAKE", now: 10_000 });
    const beforePause = state.cookingTiming;
    state = gameReducer(state, { type: "PAUSE_COOKING_TIMING", now: 20_000 });
    expect(state.cookingTiming).toEqual(beforePause);
  });
});

describe("RESET_PIZZA (CT2): same run, timer continues uninterrupted -- not a fresh timer", () => {
  it("leaves cookingTiming completely untouched (no restart, no pause)", () => {
    let state = beginFreePrepare(1_000);
    const beforeReset = state.cookingTiming;
    state = gameReducer(state, { type: "RESET_PIZZA" });
    expect(state.cookingTiming).toEqual(beforeReset);
  });

  it("total active time across a mid-round reset is the full elapsed span, not re-rolled to zero", () => {
    let state = beginFreePrepare(0);
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // some active time on a bad start
    state = gameReducer(state, { type: "RESET_PIZZA" }); // discard and redo from DOUGH
    expect(state.makingStep).toBe("DOUGH");
    state = gameReducer(state, { type: "START_BAKE", now: 45_000 });
    // 45s of total active PREPARE time spanning the reset -- resetting never re-rolls the clock,
    // closing CT1's own explicitly-flagged "reset to re-roll a slow start" gap.
    expect(state.cookingTiming?.completedMs).toBe(45_000);
  });

  it("a reset while paused (an overlay open) keeps the same pause running across the reset", () => {
    let state = beginFreePrepare(0);
    state = gameReducer(state, { type: "PAUSE_COOKING_TIMING", now: 5_000 }); // 5s active so far
    state = gameReducer(state, { type: "RESET_PIZZA" });
    state = gameReducer(state, { type: "RESUME_COOKING_TIMING", now: 20_000 }); // 15s paused
    state = gameReducer(state, { type: "START_BAKE", now: 25_000 }); // +5s active
    expect(state.cookingTiming?.completedMs).toBe(10_000);
  });
});

describe("RETRY_SAME_RECIPE / SELECT_RECIPE start a fresh timing (no BEGIN_PREPARE in this path)", () => {
  function playToDiscovered(): GameState {
    let state = beginFreePrepare(1_000);
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "START_BAKE", now: 20_000 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 5 });
    state = gameReducer(state, { type: "REGISTER_TO_DEX" });
    return state;
  }

  it("RETRY_SAME_RECIPE: fresh timing at the given `now`", () => {
    const discovered = playToDiscovered();
    const retried = gameReducer(discovered, { type: "RETRY_SAME_RECIPE", now: 100_000 });
    expect(retried.phase).toBe("PREPARE");
    expect(retried.cookingTiming).toEqual({
      startedAt: 100_000,
      pausedAt: null,
      accumulatedPauseMs: 0,
      completedMs: null,
      activeStep: "DOUGH",
      stepStartedAt: 100_000,
      stepStartAccumulatedPauseMs: 0,
      perStepElapsedMs: {},
    });
  });

  it("SELECT_RECIPE: fresh timing at the given `now`", () => {
    // Progression 2.0 Phase 3-3: SELECT_RECIPE only guided-selects an undiscovered recipe once
    // something has ever been discovered -- `playToDiscovered` bakes an empty/underbaked pizza
    // (this suite only cares about timing, not completion), so it never actually reaches the
    // Dex. Seed a discovered margherita directly so this stays a pure timing-reset check (see
    // gameReducer.selectRecipeDiscoveryGate.test.ts for the gate's own dedicated coverage).
    const discovered = {
      ...playToDiscovered(),
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3 as const, timesMade: 1 }],
    };
    const selected = gameReducer(discovered, {
      type: "SELECT_RECIPE",
      recipeId: "margherita",
      now: 200_000,
    });
    expect(selected.phase).toBe("PREPARE");
    expect(selected.cookingTiming?.startedAt).toBe(200_000);
  });
});

describe("HOME (PLAY_AGAIN) clears timing entirely", () => {
  it("a fresh order built by PLAY_AGAIN has cookingTiming null until its own BEGIN_PREPARE", () => {
    let state = beginFreePrepare(1_000);
    state = gameReducer(state, { type: "START_BAKE", now: 30_000 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 5 });
    state = gameReducer(state, { type: "PLAY_AGAIN" });
    expect(state.cookingTiming).toBeNull();
  });
});

describe("DISCOVERED keeps the same completedMs the round just produced", () => {
  it("REGISTER_TO_DEX (RESULT -> DISCOVERED) does not clear cookingTiming", () => {
    // Completion Gate Phase 1: this must be a real, PASSing pizza -- an empty one (no sauce/
    // cheese/topping) is now a FAILED round (../logic/completionGate.ts), for which
    // REGISTER_TO_DEX is a complete no-op (phase stays "RESULT", never reaches "DISCOVERED" --
    // see gameReducer.pitzReward.test.ts's own Completion Gate coverage for that behavior).
    // This test is only about cookingTiming surviving that transition, so it needs the
    // transition to actually happen.
    let state = beginFreePrepare(0);
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 60, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 50, y: 30 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 50, y: 65 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 35, y: 65 });
    state = gameReducer(state, { type: "START_BAKE", now: 15_000 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    expect(state.completion?.status).toBe("PASS");
    expect(state.cookingTiming?.completedMs).toBe(15_000);
    state = walkPostBakeToResult(state);
    state = gameReducer(state, { type: "REGISTER_TO_DEX" });
    expect(state.phase).toBe("DISCOVERED");
    expect(state.cookingTiming?.completedMs).toBe(15_000);
  });
});

describe("Lunch Rush: Cooking Time never starts for a Mission round", () => {
  it("BEGIN_PREPARE stays null once a round is flagged isMissionRound", () => {
    let state = createInitialGameState(MARGHERITA_DISCOVERED_DEX);
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    expect(state.isMissionRound).toBe(true);
    state = gameReducer(state, { type: "BEGIN_PREPARE", now: 1_000 });
    expect(state.cookingTiming).toBeNull();
  });

  it("MISSION_NEXT_ORDER's own round transition never carries a Cooking Time forward", () => {
    let state = createInitialGameState(MARGHERITA_DISCOVERED_DEX);
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    state = gameReducer(state, { type: "BEGIN_PREPARE", now: 1_000 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "START_BAKE", now: 5_000 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 5 });
    expect(state.cookingTiming).toBeNull();
    state = gameReducer(state, { type: "MISSION_NEXT_ORDER" });
    expect(state.isMissionRound).toBe(true);
    expect(state.cookingTiming).toBeNull();
    state = gameReducer(state, { type: "BEGIN_PREPARE", now: 9_999 });
    expect(state.cookingTiming).toBeNull();
  });

  it("lastPitzCredit stays null for a Mission round -- Cooking Time never touches Pitz/Scoring", () => {
    let state = createInitialGameState(MARGHERITA_DISCOVERED_DEX);
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    state = gameReducer(state, { type: "BEGIN_PREPARE", now: 1_000 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "START_BAKE", now: 5_000 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    const scoreBefore = state.score;
    state = gameReducer(state, { type: "MISSION_NEXT_ORDER" });
    expect(scoreBefore).not.toBeNull();
    expect(state.lastPitzCredit).toBeNull();
  });
});

describe("a fresh initial GameState never has a stale cookingTiming", () => {
  it("createInitialGameState starts with cookingTiming null (ORDER phase, before any BEGIN_PREPARE)", () => {
    expect(createInitialGameState().cookingTiming).toBeNull();
  });
});
