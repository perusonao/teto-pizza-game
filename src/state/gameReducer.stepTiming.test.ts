import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import type { CookingProfile } from "../data/cookingProfiles";
import { createDefaultSave } from "./persistence";

/**
 * Recipe Cooking Steps 1.0 Phase 1A-T (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §22):
 * reducer-level integration coverage for per-step timing (`GameState.cookingTiming`'s additive
 * `activeStep`/`stepStartedAt`/`perStepElapsedMs` fields, ../logic/cookingTiming.ts). Mirrors
 * ./gameReducer.cookingTiming.test.ts's own hand-picked-`now` style -- never
 * `vi.useFakeTimers`/`Date.now()`, so every assertion here is deterministic.
 *
 * Companion to ../logic/cookingTiming.stepTiming.test.ts (pure `advanceStepTiming` clock math)
 * and Phase 1A's own ./gameReducer.cookingSteps.test.ts (POST_BAKE machinery, no timing). This
 * file is the one place that exercises both together.
 */

function preparedState(now = 0): GameState {
  return gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE", now });
}

function withProfile(state: GameState, profile: CookingProfile): GameState {
  return { ...state, cookingProfile: profile };
}

function confirmAt(state: GameState, now: number): GameState {
  return gameReducer(state, { type: "CONFIRM_MAKING_STEP", now });
}

describe("1. Timing initial state", () => {
  it("a fresh initial GameState (ORDER, before any BEGIN_PREPARE) has no cookingTiming at all", () => {
    const state = createInitialGameState();
    expect(state.phase).toBe("ORDER");
    expect(state.cookingTiming).toBeNull();
  });
});

describe("2. PREPARE start: DOUGH timing starts", () => {
  it("BEGIN_PREPARE begins timing DOUGH immediately, with an empty perStepElapsedMs", () => {
    const state = preparedState(1_000);
    expect(state.makingStep).toBe("DOUGH");
    expect(state.cookingTiming?.activeStep).toBe("DOUGH");
    expect(state.cookingTiming?.stepStartedAt).toBe(1_000);
    expect(state.cookingTiming?.perStepElapsedMs).toEqual({});
  });

  it("omitting `now` leaves cookingTiming null entirely -- no per-step timing without the whole-round clock", () => {
    const state = gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" });
    expect(state.cookingTiming).toBeNull();
  });
});

describe("3. DOUGH -> SAUCE: DOUGH elapsed captured, SAUCE starts", () => {
  it("captures DOUGH's elapsed ms and opens SAUCE's own window", () => {
    let state = preparedState(0);
    state = confirmAt(state, 5_000);
    expect(state.makingStep).toBe("SAUCE");
    expect(state.cookingTiming?.perStepElapsedMs.DOUGH).toBe(5_000);
    expect(state.cookingTiming?.activeStep).toBe("SAUCE");
    expect(state.cookingTiming?.stepStartedAt).toBe(5_000);
  });

  it("omitting `now` on CONFIRM_MAKING_STEP advances makingStep but leaves cookingTiming's per-step fields untouched", () => {
    let state = preparedState(0);
    const before = state.cookingTiming;
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    expect(state.makingStep).toBe("SAUCE");
    expect(state.cookingTiming).toBe(before);
  });
});

describe("4. SAUCE -> CHEESE", () => {
  it("captures SAUCE's elapsed ms and opens CHEESE's own window", () => {
    let state = preparedState(0);
    state = confirmAt(state, 5_000); // DOUGH: 5s
    state = confirmAt(state, 9_000); // SAUCE: 4s
    expect(state.makingStep).toBe("CHEESE");
    expect(state.cookingTiming?.perStepElapsedMs.SAUCE).toBe(4_000);
    expect(state.cookingTiming?.activeStep).toBe("CHEESE");
    expect(state.cookingTiming?.stepStartedAt).toBe(9_000);
    // DOUGH's already-finalized entry is untouched by SAUCE's own finalization.
    expect(state.cookingTiming?.perStepElapsedMs.DOUGH).toBe(5_000);
  });
});

describe("5. CHEESE -> TOPPING", () => {
  it("captures CHEESE's elapsed ms and opens TOPPING's own window", () => {
    let state = preparedState(0);
    state = confirmAt(state, 5_000);
    state = confirmAt(state, 9_000);
    state = confirmAt(state, 12_000); // CHEESE: 3s
    expect(state.makingStep).toBe("TOPPING");
    expect(state.cookingTiming?.perStepElapsedMs.CHEESE).toBe(3_000);
    expect(state.cookingTiming?.activeStep).toBe("TOPPING");
    expect(state.cookingTiming?.stepStartedAt).toBe(12_000);
  });
});

describe("6. TOPPING -> BAKE: TOPPING elapsed captured", () => {
  it("START_BAKE captures TOPPING's elapsed ms and closes step timing out (no step during BAKE)", () => {
    let state = preparedState(0);
    state = confirmAt(state, 5_000);
    state = confirmAt(state, 9_000);
    state = confirmAt(state, 12_000);
    state = gameReducer(state, { type: "START_BAKE", now: 20_000 }); // TOPPING: 8s
    expect(state.phase).toBe("BAKE");
    expect(state.cookingTiming?.perStepElapsedMs.TOPPING).toBe(8_000);
    expect(state.cookingTiming?.activeStep).toBeNull();
    expect(state.cookingTiming?.stepStartedAt).toBeNull();
    // Whole-round completedMs (CT1/CT2, unchanged) equals the sum of the 4 pre-BAKE steps.
    expect(state.cookingTiming?.completedMs).toBe(20_000);
    const sum = Object.values(state.cookingTiming?.perStepElapsedMs ?? {}).reduce(
      (a, b) => a + (b ?? 0),
      0,
    );
    expect(sum).toBe(state.cookingTiming?.completedMs);
  });
});

describe("7. BAKE time never mixes into per-step elapsed", () => {
  it("a long wall-clock span between START_BAKE and CONFIRM_BAKE never appears in perStepElapsedMs or completedMs", () => {
    let state = preparedState(0);
    state = confirmAt(state, 5_000);
    state = confirmAt(state, 9_000);
    state = confirmAt(state, 12_000);
    state = gameReducer(state, { type: "START_BAKE", now: 20_000 });
    const completedMsAtBakeStart = state.cookingTiming?.completedMs;
    const perStepAtBakeStart = state.cookingTiming?.perStepElapsedMs;
    // A full minute of "BAKE" wall-clock time.
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70, now: 80_000 });
    expect(state.cookingTiming?.completedMs).toBe(completedMsAtBakeStart);
    expect(state.cookingTiming?.perStepElapsedMs).toEqual(perStepAtBakeStart);
    expect(Object.keys(state.cookingTiming?.perStepElapsedMs ?? {}).sort()).toEqual([
      "CHEESE",
      "DOUGH",
      "SAUCE",
      "TOPPING",
    ]);
  });
});

describe("8. default CONFIRM_BAKE: RESULT, existing 15-recipe behavior unchanged", () => {
  it("lands on RESULT with makingStep left untouched, exactly as Phase 1A already established -- per-step data available but not required for it", () => {
    let state = preparedState(0);
    state = confirmAt(state, 5_000);
    state = confirmAt(state, 9_000);
    state = confirmAt(state, 12_000);
    state = gameReducer(state, { type: "START_BAKE", now: 20_000 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70, now: 21_000 });
    expect(state.phase).toBe("RESULT");
    expect(state.makingStep).toBe("TOPPING");
    expect(state.score).not.toBeNull();
    // Phase 1A-T acceptance criterion §22.13 #2: sum(perStepElapsedMs) for the pre-BAKE span
    // equals completedMs for a representative PREPARE walkthrough.
    const sum = Object.values(state.cookingTiming?.perStepElapsedMs ?? {}).reduce(
      (a, b) => a + (b ?? 0),
      0,
    );
    expect(sum).toBe(state.cookingTiming?.completedMs);
    expect(state.cookingTiming?.completedMs).toBe(20_000);
  });
});

describe("9. future fixture: CONFIRM_BAKE -> POST_BAKE starts post-bake timing", () => {
  const postBakeFixture: CookingProfile = {
    steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"],
  };

  function toPostBake(): GameState {
    let state = withProfile(preparedState(0), postBakeFixture);
    state = confirmAt(state, 5_000);
    state = confirmAt(state, 9_000);
    state = confirmAt(state, 12_000);
    state = gameReducer(state, { type: "START_BAKE", now: 20_000 });
    return gameReducer(state, { type: "CONFIRM_BAKE", value: 70, now: 25_000 });
  }

  it("lands on POST_BAKE at the profile's first post-BAKE step (FINISH) and starts timing it", () => {
    const state = toPostBake();
    expect(state.phase).toBe("POST_BAKE");
    expect(state.makingStep).toBe("FINISH");
    expect(state.cookingTiming?.activeStep).toBe("FINISH");
    expect(state.cookingTiming?.stepStartedAt).toBe(25_000);
    // The pre-BAKE completedMs is unaffected by entering POST_BAKE.
    expect(state.cookingTiming?.completedMs).toBe(20_000);
  });

  it("is a byte-identical no-op for every one of the 15 shipped recipes (DEFAULT_COOKING_PROFILE has no post-BAKE steps)", () => {
    let state = preparedState(0);
    state = confirmAt(state, 5_000);
    state = confirmAt(state, 9_000);
    state = confirmAt(state, 12_000);
    state = gameReducer(state, { type: "START_BAKE", now: 20_000 });
    const beforeConfirmBake = state.cookingTiming;
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70, now: 25_000 });
    expect(state.phase).toBe("RESULT");
    expect(state.cookingTiming).toBe(beforeConfirmBake);
  });
});

describe("10. FINISH -> CUT: FINISH captured, CUT starts", () => {
  it("confirming FINISH captures its elapsed ms and opens CUT's own window", () => {
    const postBakeFixture: CookingProfile = {
      steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"],
    };
    let state = withProfile(preparedState(0), postBakeFixture);
    state = confirmAt(state, 5_000);
    state = confirmAt(state, 9_000);
    state = confirmAt(state, 12_000);
    state = gameReducer(state, { type: "START_BAKE", now: 20_000 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70, now: 25_000 }); // FINISH starts at 25000
    state = confirmAt(state, 30_000); // FINISH: 5s
    expect(state.phase).toBe("POST_BAKE");
    expect(state.makingStep).toBe("CUT");
    expect(state.cookingTiming?.perStepElapsedMs.FINISH).toBe(5_000);
    expect(state.cookingTiming?.activeStep).toBe("CUT");
    expect(state.cookingTiming?.stepStartedAt).toBe(30_000);
  });
});

describe("11. CUT -> RESULT: CUT captured", () => {
  it("confirming the last POST_BAKE step (CUT) transitions to RESULT and captures CUT's elapsed ms", () => {
    const postBakeFixture: CookingProfile = {
      steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"],
    };
    let state = withProfile(preparedState(0), postBakeFixture);
    state = confirmAt(state, 5_000);
    state = confirmAt(state, 9_000);
    state = confirmAt(state, 12_000);
    state = gameReducer(state, { type: "START_BAKE", now: 20_000 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70, now: 25_000 });
    state = confirmAt(state, 30_000); // FINISH -> CUT
    state = confirmAt(state, 33_000); // CUT -> RESULT, CUT: 3s
    expect(state.phase).toBe("RESULT");
    expect(state.cookingTiming?.perStepElapsedMs.CUT).toBe(3_000);
    expect(state.cookingTiming?.activeStep).toBeNull();
    expect(state.cookingTiming?.stepStartedAt).toBeNull();
    // §22.3: totalActiveTime (completedMs) stays the pre-BAKE-only span -- POST_BAKE steps are
    // recorded in perStepElapsedMs but never folded into completedMs/efficiency's input.
    expect(state.cookingTiming?.completedMs).toBe(20_000);
    expect(state.cookingTiming?.perStepElapsedMs).toEqual({
      DOUGH: 5_000,
      SAUCE: 4_000,
      CHEESE: 3_000,
      TOPPING: 8_000,
      FINISH: 5_000,
      CUT: 3_000,
    });
  });
});

describe("12. RESET_PIZZA (§22.11): per-step timing carries through untouched, same as the whole-round clock", () => {
  it("leaves cookingTiming referentially unchanged -- not merely equal", () => {
    let state = preparedState(0);
    state = confirmAt(state, 5_000); // DOUGH -> SAUCE, DOUGH: 5s
    const beforeReset = state.cookingTiming;
    state = gameReducer(state, { type: "RESET_PIZZA" });
    expect(state.makingStep).toBe("DOUGH"); // the pizza/UI resets to DOUGH...
    expect(state.cookingTiming).toBe(beforeReset); // ...but the timing clock (whole-round and
    // per-step alike) is untouched by construction -- RESET_PIZZA's own reducer case never
    // mentions `cookingTiming` at all, so `...state` carries the exact same reference through.
    expect(state.cookingTiming?.activeStep).toBe("SAUCE");
    expect(state.cookingTiming?.perStepElapsedMs.DOUGH).toBe(5_000);
  });

  it("total active time across a mid-round reset still equals the full elapsed span, per-step included", () => {
    let state = preparedState(0);
    state = confirmAt(state, 5_000); // DOUGH: 5s
    state = gameReducer(state, { type: "RESET_PIZZA" });
    expect(state.makingStep).toBe("DOUGH");
    state = gameReducer(state, { type: "START_BAKE", now: 45_000 }); // finalizes whatever step
    // timing still considers active (SAUCE, from before the reset) -- the whole-round
    // `completedMs` is unaffected either way (CT2's own pre-existing guarantee).
    expect(state.cookingTiming?.completedMs).toBe(45_000);
  });
});

describe("13. retry / new round via the same recipe (RETRY_SAME_RECIPE / SELECT_RECIPE) start fresh per-step timing", () => {
  it("RETRY_SAME_RECIPE: fresh activeStep=DOUGH, empty perStepElapsedMs, discarding any prior round's data", () => {
    let state = preparedState(0);
    state = confirmAt(state, 5_000); // some DOUGH time on a since-abandoned attempt
    const retried = gameReducer(state, { type: "RETRY_SAME_RECIPE", now: 100_000 });
    expect(retried.phase).toBe("PREPARE");
    expect(retried.cookingTiming?.activeStep).toBe("DOUGH");
    expect(retried.cookingTiming?.stepStartedAt).toBe(100_000);
    expect(retried.cookingTiming?.perStepElapsedMs).toEqual({});
  });

  it("SELECT_RECIPE: fresh activeStep=DOUGH, empty perStepElapsedMs", () => {
    let state = preparedState(0);
    state = confirmAt(state, 5_000);
    const selected = gameReducer(state, {
      type: "SELECT_RECIPE",
      recipeId: "margherita",
      now: 200_000,
    });
    expect(selected.phase).toBe("PREPARE");
    expect(selected.cookingTiming?.activeStep).toBe("DOUGH");
    expect(selected.cookingTiming?.stepStartedAt).toBe(200_000);
    expect(selected.cookingTiming?.perStepElapsedMs).toEqual({});
  });
});

describe("14. NEXT_ORDER (PLAY_AGAIN): clears timing entirely until the next BEGIN_PREPARE", () => {
  it("a fresh order built by PLAY_AGAIN has cookingTiming null, and the next BEGIN_PREPARE starts genuinely fresh per-step state", () => {
    let state = preparedState(0);
    state = confirmAt(state, 5_000);
    state = confirmAt(state, 9_000);
    state = confirmAt(state, 12_000);
    state = gameReducer(state, { type: "START_BAKE", now: 20_000 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70, now: 21_000 });
    state = gameReducer(state, { type: "PLAY_AGAIN" });
    expect(state.phase).toBe("ORDER");
    expect(state.cookingTiming).toBeNull();
    state = gameReducer(state, { type: "BEGIN_PREPARE", now: 500_000 });
    expect(state.cookingTiming?.activeStep).toBe("DOUGH");
    expect(state.cookingTiming?.stepStartedAt).toBe(500_000);
    // No leakage whatsoever from the previous round's DOUGH/SAUCE/CHEESE/TOPPING entries.
    expect(state.cookingTiming?.perStepElapsedMs).toEqual({});
  });
});

describe("15. MISSION_NEXT_ORDER: Lunch Rush never accumulates per-step timing", () => {
  it("cookingTiming (whole-round and per-step alike) stays null across a Mission round's continuous serve loop, even when CONFIRM_MAKING_STEP/CONFIRM_BAKE are dispatched with `now`", () => {
    let state = createInitialGameState();
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    expect(state.isMissionRound).toBe(true);
    state = gameReducer(state, { type: "BEGIN_PREPARE", now: 1_000 });
    expect(state.cookingTiming).toBeNull();
    state = confirmAt(state, 2_000);
    state = confirmAt(state, 3_000);
    state = confirmAt(state, 4_000);
    expect(state.cookingTiming).toBeNull();
    state = gameReducer(state, { type: "START_BAKE", now: 5_000 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70, now: 6_000 });
    expect(state.cookingTiming).toBeNull();
    state = gameReducer(state, { type: "MISSION_NEXT_ORDER" });
    expect(state.isMissionRound).toBe(true);
    expect(state.cookingTiming).toBeNull();
    state = gameReducer(state, { type: "BEGIN_PREPARE", now: 9_999 });
    expect(state.cookingTiming).toBeNull();
  });
});

describe("16. Lunch Rush: MissionClock stays the sole enforced timer, untouched by Step Timing", () => {
  it("GameState carries no Mission-timer-related field this slice touches -- MissionClock lives entirely in ../mission/lunchRush.ts, never imported by ../logic/cookingTiming.ts", () => {
    // Structural guarantee, exercised at the reducer boundary: a Mission round's `score`/
    // `completion`/`lastPitzCredit` (all of which MissionServePanel/missionRunReducer read) are
    // computed identically whether or not per-step `now` payloads are supplied, since per-step
    // timing never gates or feeds any of them (§22.4/§22.6).
    let state = createInitialGameState();
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    state = gameReducer(state, { type: "BEGIN_PREPARE", now: 1_000 });
    state = confirmAt(state, 2_000);
    state = confirmAt(state, 3_000);
    state = confirmAt(state, 4_000);
    state = gameReducer(state, { type: "START_BAKE", now: 5_000 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70, now: 6_000 });
    expect(state.phase).toBe("RESULT");
    expect(state.score).not.toBeNull();
    expect(state.lastPitzCredit).toBeNull(); // Mission rounds never credit FREE's own Pitz path
  });
});

describe("17. existing completedMs unchanged by per-step `now` payloads", () => {
  it("completedMs is byte-identical whether or not CONFIRM_MAKING_STEP is dispatched with `now`", () => {
    let withTiming = preparedState(0);
    withTiming = confirmAt(withTiming, 5_000);
    withTiming = confirmAt(withTiming, 9_000);
    withTiming = confirmAt(withTiming, 12_000);
    withTiming = gameReducer(withTiming, { type: "START_BAKE", now: 25_000 });

    let withoutStepNow = preparedState(0);
    withoutStepNow = gameReducer(withoutStepNow, { type: "CONFIRM_MAKING_STEP" });
    withoutStepNow = gameReducer(withoutStepNow, { type: "CONFIRM_MAKING_STEP" });
    withoutStepNow = gameReducer(withoutStepNow, { type: "CONFIRM_MAKING_STEP" });
    withoutStepNow = gameReducer(withoutStepNow, { type: "START_BAKE", now: 25_000 });

    expect(withTiming.cookingTiming?.completedMs).toBe(withoutStepNow.cookingTiming?.completedMs);
    expect(withTiming.cookingTiming?.completedMs).toBe(25_000);
  });

  it("completedMs still correctly excludes a pause span, exactly as CT1/CT2 established, independent of per-step data", () => {
    let state = preparedState(0);
    state = confirmAt(state, 5_000);
    state = confirmAt(state, 9_000);
    state = confirmAt(state, 12_000);
    state = gameReducer(state, { type: "PAUSE_COOKING_TIMING", now: 15_000 });
    state = gameReducer(state, { type: "RESUME_COOKING_TIMING", now: 18_000 }); // 3s paused
    state = gameReducer(state, { type: "START_BAKE", now: 25_000 });
    expect(state.cookingTiming?.completedMs).toBe(22_000); // 25000 - 3000 paused
  });
});

describe("18. existing efficiency unchanged by per-step timing", () => {
  it("lastEfficiencyCredit is computed from completedMs exactly as CT2 established, unaffected by per-step data being present", () => {
    // A real PASSing pizza (margherita, direct placement -- same pattern as
    // ./gameReducer.cookingTiming.test.ts's own "DISCOVERED keeps the same completedMs" test).
    let withStepTiming = preparedState(0);
    withStepTiming = confirmAt(withStepTiming, 0); // DOUGH -> SAUCE
    withStepTiming = gameReducer(withStepTiming, {
      type: "APPLY_SAUCE",
      ingredientId: "tomato-sauce",
      x: 50,
      y: 50,
    });
    withStepTiming = confirmAt(withStepTiming, 0); // SAUCE -> CHEESE
    withStepTiming = gameReducer(withStepTiming, {
      type: "PLACE_TOPPING",
      ingredientId: "mozzarella",
      x: 40,
      y: 50,
    });
    withStepTiming = gameReducer(withStepTiming, {
      type: "PLACE_TOPPING",
      ingredientId: "mozzarella",
      x: 60,
      y: 50,
    });
    withStepTiming = gameReducer(withStepTiming, {
      type: "PLACE_TOPPING",
      ingredientId: "mozzarella",
      x: 50,
      y: 30,
    });
    withStepTiming = confirmAt(withStepTiming, 0); // CHEESE -> TOPPING
    withStepTiming = gameReducer(withStepTiming, {
      type: "PLACE_TOPPING",
      ingredientId: "basil",
      x: 50,
      y: 65,
    });
    withStepTiming = gameReducer(withStepTiming, {
      type: "PLACE_TOPPING",
      ingredientId: "basil",
      x: 35,
      y: 65,
    });
    withStepTiming = gameReducer(withStepTiming, { type: "START_BAKE", now: 15_000 });
    withStepTiming = gameReducer(withStepTiming, { type: "CONFIRM_BAKE", value: 70, now: 15_500 });
    expect(withStepTiming.completion?.status).toBe("PASS");
    expect(withStepTiming.cookingTiming?.completedMs).toBe(15_000);
    withStepTiming = gameReducer(withStepTiming, { type: "REGISTER_TO_DEX" });
    expect(withStepTiming.phase).toBe("DISCOVERED");
    expect(withStepTiming.lastEfficiencyCredit).not.toBeNull();
    expect(withStepTiming.lastEfficiencyCredit?.cookingTimeMs).toBe(15_000);
  });
});

describe("19. Scoring 2.0 unchanged by per-step timing", () => {
  it("state.score / scoringV2Result are byte-identical whether or not `now` is supplied to CONFIRM_MAKING_STEP/CONFIRM_BAKE", () => {
    function playToResult(withNow: boolean): GameState {
      let state = preparedState(0);
      state = withNow ? confirmAt(state, 5_000) : gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
      state = gameReducer(state, {
        type: "APPLY_SAUCE",
        ingredientId: "tomato-sauce",
        x: 50,
        y: 50,
      });
      state = withNow ? confirmAt(state, 9_000) : gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
      state = gameReducer(state, {
        type: "PLACE_TOPPING",
        ingredientId: "mozzarella",
        x: 40,
        y: 50,
      });
      state = withNow
        ? confirmAt(state, 12_000)
        : gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
      state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 50, y: 65 });
      state = withNow
        ? gameReducer(state, { type: "START_BAKE", now: 20_000 })
        : gameReducer(state, { type: "START_BAKE" });
      return gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    }
    const withTimingNows = playToResult(true);
    const withoutTimingNows = playToResult(false);
    expect(withTimingNows.score).toEqual(withoutTimingNows.score);
    expect(withTimingNows.scoringV2Result).toEqual(withoutTimingNows.scoringV2Result);
    expect(withTimingNows.completion).toEqual(withoutTimingNows.completion);
  });
});

describe("20. save schema unchanged by Step Timing", () => {
  it("createDefaultSave() stays schemaVersion 2, with no cookingTiming/per-step field of any kind", () => {
    const save = createDefaultSave();
    expect(save.schemaVersion).toBe(2);
    expect(Object.keys(save)).not.toContain("cookingTiming");
    expect(Object.keys(save)).not.toContain("activeStep");
    expect(Object.keys(save)).not.toContain("perStepElapsedMs");
  });
});

describe("21. Fresh Merge Gate fix: a CONFIRM_MAKING_STEP dispatched mid-pause never lets the pause leak into the next step once resumed", () => {
  it("reducer-level reproduction of the pause-boundary finding -- DOUGH=4000, SAUCE=5000, not clamped to 0", () => {
    let state = preparedState(0);
    state = gameReducer(state, { type: "PAUSE_COOKING_TIMING", now: 4_000 });
    // A CONFIRM_MAKING_STEP dispatched while still paused (the UI itself gates interaction while
    // paused via PizzaStage's `interactive` prop, but the reducer must still be correct against a
    // stray/test dispatch that reaches it anyway).
    state = confirmAt(state, 999_000);
    expect(state.makingStep).toBe("SAUCE");
    expect(state.cookingTiming?.perStepElapsedMs.DOUGH).toBe(4_000);
    state = gameReducer(state, { type: "RESUME_COOKING_TIMING", now: 1_000_000 });
    state = confirmAt(state, 1_005_000); // 5s of real SAUCE activity after resume
    expect(state.makingStep).toBe("CHEESE");
    expect(state.cookingTiming?.perStepElapsedMs.DOUGH).toBe(4_000);
    expect(state.cookingTiming?.perStepElapsedMs.SAUCE).toBe(5_000);
  });
});
