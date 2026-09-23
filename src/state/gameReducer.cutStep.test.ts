import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX, registerScoreToDex } from "./dex";
import { DEFAULT_COOKING_PROFILE, getCookingProfile } from "../data/cookingProfiles";
import { requiredCutCount } from "../logic/cut/evaluation";
import { resolveRequestedSliceCount, type CutLine } from "../logic/cut/types";
import { MIN_CUT_ANGULAR_SEPARATION_RADIANS } from "../logic/cut/geometry";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import { buildIdealMargheritaSauceFixture, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { createCutState } from "../logic/cut/state";
import { getRecipe, type Recipe, type RecipeId } from "../data/recipes";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

const MARGHERITA_DISCOVERED_DEX = registerScoreToDex(EMPTY_DEX, "margherita", {
  total: 80,
  stars: 4,
  matchScore: 80,
  ingredientScore: 80,
  placementScore: 80,
  bakeScore: 80,
}).dex;

/** Pizza Cutting 1.0 Phase 4B (Full Recipe Expansion): every real, shipped `RecipeId` is now
 *  CUT-eligible (../data/cookingProfiles.ts's `CUT_ELIGIBLE_RECIPE_IDS`), so no real recipe can
 *  stand in as "a non-CUT recipe" fixture anymore -- this synthetic id (a real Recipe's shape,
 *  funghi's own, with only `id` swapped) stands in for a future not-yet-eligible recipe instead,
 *  the same synthetic-fixture pattern ../../screens/GameScreen.makingStepNav.test.tsx and
 *  ../data/cookingProfiles.test.ts both use for the same reason. `getCookingProfile` resolves it
 *  to `DEFAULT_COOKING_PROFILE` exactly like any other id absent from the allowlist. */
const funghiFixture = getRecipe("funghi");
if (!funghiFixture) throw new Error("funghi fixture missing");
const SYNTHETIC_NON_CUT_RECIPE: Recipe = {
  ...funghiFixture,
  id: "synthetic-non-cut-recipe-not-yet-eligible" as RecipeId,
};

/**
 * Pizza Cutting 1.0 Phase 2 (docs/design/TETO_PIZZA-CUTTING_1.0.md): reducer-level integration
 * coverage for margherita's own real, production `CookingProfile` (../data/cookingProfiles.ts) --
 * `CUT`'s own confirm gate (`requiredCutCount`), `ADD_CUT_LINE`/`UNDO_CUT_LINE`, the
 * `REGISTER_TO_DEX`/Lunch Rush exactly-once orchestration once CUT actually confirms, and the
 * reset/recipe-change semantics `GameState.cutState` must follow. Complements
 * ../logic/cut/{types,geometry,evaluation,state}.test.ts (pure math, Phase 1) and
 * gameReducer.cookingSteps.test.ts (generic POST_BAKE machinery, hand-built fixtures).
 */

const [MOZZARELLA_GROUP, BASIL_GROUP] = MARGHERITA_REFERENCE.pieceGroups;

function idealCutLine(index: number, count: number): CutLine {
  const angle = (Math.PI * index) / count;
  const dx = Math.cos(angle) * DOUGH_RADIUS;
  const dy = Math.sin(angle) * DOUGH_RADIUS;
  return {
    start: { x: DOUGH_CENTER - dx, y: DOUGH_CENTER - dy },
    end: { x: DOUGH_CENTER + dx, y: DOUGH_CENTER + dy },
  };
}

function preparedMargheritaState(): GameState {
  return gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" });
}

/** Plays a full, Reference-quality margherita round through PREPARE -> BAKE -> CONFIRM_BAKE,
 *  landing at POST_BAKE/CUT (never walking the CUT step itself -- callers do that explicitly). */
function bakedMargheritaAtCut(isMissionRound = false): GameState {
  let state: GameState = isMissionRound
    ? gameReducer(createInitialGameState(MARGHERITA_DISCOVERED_DEX), { type: "MISSION_RESET_ORDER" })
    : createInitialGameState();
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
  state = gameReducer(state, {
    type: "COMMIT_SAUCE_DISPENSE",
    ingredientId: "tomato-sauce",
    deposits: buildIdealMargheritaSauceFixture(),
  });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
  for (const p of MOZZARELLA_GROUP.positions) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: p.x, y: p.y });
  }
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
  for (const p of BASIL_GROUP.positions) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: p.x, y: p.y });
  }
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
  return state;
}

describe("1/3. margherita's real production CookingProfile resolves CUT as its post-BAKE step", () => {
  it("BAKE on margherita lands on POST_BAKE at CUT, requestedSliceCount 6", () => {
    const state = bakedMargheritaAtCut();
    expect(state.phase).toBe("POST_BAKE");
    expect(state.makingStep).toBe("CUT");
    expect(state.cutState.config.requestedSliceCount).toBe(6);
  });
});

describe("4/30. non-CUT recipes: BAKE -> RESULT unaffected (regression)", () => {
  it("a synthetic id absent from the CUT-eligibility allowlist still resolves DEFAULT_COOKING_PROFILE (no CUT)", () => {
    // Pizza Cutting 1.0 Phase 4B: every real RecipeId is now CUT-eligible (pinned exhaustively
    // in ../data/cookingProfiles.test.ts) -- this spot-checks the actual reducer-facing
    // `getCookingProfile` boundary against a synthetic not-yet-eligible id instead.
    const profile = getCookingProfile(SYNTHETIC_NON_CUT_RECIPE.id);
    expect(profile).toBe(DEFAULT_COOKING_PROFILE);
    expect(profile.steps).not.toContain("CUT");
  });
});

describe("5. cutState is created fresh every round", () => {
  it("a fresh margherita round starts with empty lines/null evaluation, config from the profile", () => {
    const state = preparedMargheritaState();
    expect(state.cutState.lines).toEqual([]);
    expect(state.cutState.evaluation).toBeNull();
    expect(state.cutState.config.requestedSliceCount).toBe(6);
  });

  it("a non-CUT-eligible recipe still gets a defined (inert) cutState -- never undefined/null", () => {
    // Pizza Cutting 1.0 Phase 4B: no real RecipeId can reach PREPARE via SELECT_RECIPE while
    // resolving to DEFAULT_COOKING_PROFILE anymore (every one is CUT-eligible) -- this instead
    // constructs the same PREPARE-phase shape SELECT_RECIPE produces, directly overriding
    // `recipe`/`cookingProfile`/`cutState` onto a real prepared round the same way
    // ../../screens/GameScreen.makingStepNav.test.tsx's own synthetic-recipe fixture does.
    // `buildOrderState`'s own `createCutState(cookingProfile.cutConfig)` call (gameReducer.ts)
    // is unconditional regardless of which recipe/profile it is given -- this pins that same
    // "always defined, even when cutConfig is absent" contract directly.
    let state = preparedMargheritaState();
    const cookingProfile = getCookingProfile(SYNTHETIC_NON_CUT_RECIPE.id);
    state = {
      ...state,
      recipe: SYNTHETIC_NON_CUT_RECIPE,
      cookingProfile,
      cutState: createCutState(cookingProfile.cutConfig),
    };
    expect(state.phase).toBe("PREPARE");
    expect(state.recipe.id).toBe(SYNTHETIC_NON_CUT_RECIPE.id);
    expect(state.cookingProfile).toBe(DEFAULT_COOKING_PROFILE);
    expect(state.cutState).toBeDefined();
    expect(state.cutState.lines).toEqual([]);
    // Inert: this synthetic recipe's own profile never lists "CUT", so this default config is
    // simply never read by anything -- ADD_CUT_LINE/CONFIRM_MAKING_STEP's own CUT gate is
    // unreachable for it regardless of what this resolves to (see the ADD_CUT_LINE rejection
    // tests below).
    expect(state.cutState.evaluation).toBeNull();
  });
});

describe("10. ADD_CUT_LINE/UNDO_CUT_LINE are no-ops outside POST_BAKE's own CUT step", () => {
  it("ADD_CUT_LINE during PREPARE is rejected", () => {
    const state = preparedMargheritaState();
    const line = idealCutLine(0, 3);
    const after = gameReducer(state, { type: "ADD_CUT_LINE", line });
    expect(after).toBe(state);
  });

  it("ADD_CUT_LINE during BAKE is rejected", () => {
    let state = preparedMargheritaState();
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "START_BAKE" });
    expect(state.phase).toBe("BAKE");
    const after = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    expect(after).toBe(state);
  });

  it("ADD_CUT_LINE during a non-CUT-eligible recipe's PREPARE (no post-BAKE step at all) is rejected", () => {
    // Pizza Cutting 1.0 Phase 4B: every real RecipeId SELECT_RECIPE can actually reach is now
    // CUT-eligible, so this overrides recipe/cookingProfile/cutState directly onto a real
    // prepared round, the same synthetic-fixture pattern used above -- ADD_CUT_LINE's own
    // reducer guard (`phase === "POST_BAKE" && makingStep === "CUT"`) rejects this regardless of
    // profile, but this keeps the fixture itself honestly non-CUT rather than relying on an
    // unrelated phase/unlock-chain accident.
    let state = preparedMargheritaState();
    const cookingProfile = getCookingProfile(SYNTHETIC_NON_CUT_RECIPE.id);
    state = {
      ...state,
      recipe: SYNTHETIC_NON_CUT_RECIPE,
      cookingProfile,
      cutState: createCutState(cookingProfile.cutConfig),
    };
    const after = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    expect(after).toBe(state);
  });

  it("UNDO_CUT_LINE outside CUT is a no-op", () => {
    const state = preparedMargheritaState();
    const after = gameReducer(state, { type: "UNDO_CUT_LINE" });
    expect(after).toBe(state);
  });

  it("a malformed (non-edge-to-edge) line is rejected even during CUT", () => {
    const state = bakedMargheritaAtCut();
    const notEdgeToEdge: CutLine = { start: { x: 50, y: 50 }, end: { x: 55, y: 50 } };
    const after = gameReducer(state, { type: "ADD_CUT_LINE", line: notEdgeToEdge });
    expect(after).toBe(state);
    expect(after.cutState.lines).toHaveLength(0);
  });
});

/** Degrees-based sibling of `idealCutLine` above, used only by the duplicate-rejection tests
 *  below where an exact angle offset (e.g. "5deg off an existing line") reads more directly than
 *  a fraction of a full slice count. */
function cutLineAtAngleDegrees(angleDegrees: number): CutLine {
  const angleRadians = (angleDegrees * Math.PI) / 180;
  const dx = Math.cos(angleRadians) * DOUGH_RADIUS;
  const dy = Math.sin(angleRadians) * DOUGH_RADIUS;
  return {
    start: { x: DOUGH_CENTER - dx, y: DOUGH_CENTER - dy },
    end: { x: DOUGH_CENTER + dx, y: DOUGH_CENTER + dy },
  };
}

describe("10c. ADD_CUT_LINE rejects a near-duplicate of an already-committed line (Phase 4A)", () => {
  it("an exact duplicate (identical start/end) is rejected -- state unchanged, same reference", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: cutLineAtAngleDegrees(0) });
    const rejected = gameReducer(state, { type: "ADD_CUT_LINE", line: cutLineAtAngleDegrees(0) });
    expect(rejected).toBe(state);
    expect(rejected.cutState.lines).toHaveLength(1);
  });

  it("the same line with reversed start/end is rejected (0deg and 180deg are the same orientation)", () => {
    let state = bakedMargheritaAtCut();
    const first = cutLineAtAngleDegrees(0);
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: first });
    const reversed: CutLine = { start: first.end, end: first.start };
    const rejected = gameReducer(state, { type: "ADD_CUT_LINE", line: reversed });
    expect(rejected).toBe(state);
    expect(rejected.cutState.lines).toHaveLength(1);
  });

  it("a near-duplicate a few degrees off an existing line is rejected", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: cutLineAtAngleDegrees(0) });
    const rejected = gameReducer(state, { type: "ADD_CUT_LINE", line: cutLineAtAngleDegrees(5) });
    expect(rejected).toBe(state);
    expect(rejected.cutState.lines).toHaveLength(1);
  });

  it("a line just outside the minimum angular separation is accepted", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: cutLineAtAngleDegrees(0) });
    const thresholdDegrees = (MIN_CUT_ANGULAR_SEPARATION_RADIANS * 180) / Math.PI;
    const accepted = gameReducer(state, {
      type: "ADD_CUT_LINE",
      line: cutLineAtAngleDegrees(thresholdDegrees + 1),
    });
    expect(accepted).not.toBe(state);
    expect(accepted.cutState.lines).toHaveLength(2);
  });

  it("a normal 3-line/6-slice pattern (60deg apart) is entirely unaffected by the duplicate gate", () => {
    let state = bakedMargheritaAtCut();
    for (let i = 0; i < 3; i += 1) {
      state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(i, 3) });
    }
    expect(state.cutState.lines).toHaveLength(3);
  });

  it("a rejected duplicate never increments the committed cut count", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: cutLineAtAngleDegrees(0) });
    for (let i = 0; i < 3; i += 1) {
      state = gameReducer(state, { type: "ADD_CUT_LINE", line: cutLineAtAngleDegrees(2) });
    }
    expect(state.cutState.lines).toHaveLength(1);
  });

  it("undo after a rejected duplicate attempt still removes exactly the last real line", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: cutLineAtAngleDegrees(0) });
    const firstLine = state.cutState.lines[0];
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: cutLineAtAngleDegrees(60) });
    // A rejected duplicate attempt in between -- must not corrupt undo history.
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: cutLineAtAngleDegrees(61) });
    expect(state.cutState.lines).toHaveLength(2);
    state = gameReducer(state, { type: "UNDO_CUT_LINE" });
    expect(state.cutState.lines).toHaveLength(1);
    expect(state.cutState.lines[0]).toEqual(firstLine);
  });

  it("evaluation is deterministic and identical whether or not rejected duplicate attempts were made in between", () => {
    let withoutAttempts = bakedMargheritaAtCut();
    for (let i = 0; i < 3; i += 1) {
      withoutAttempts = gameReducer(withoutAttempts, { type: "ADD_CUT_LINE", line: idealCutLine(i, 3) });
    }
    withoutAttempts = gameReducer(withoutAttempts, { type: "CONFIRM_MAKING_STEP" });

    let withAttempts = bakedMargheritaAtCut();
    withAttempts = gameReducer(withAttempts, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    // A near-duplicate of the just-committed line -- rejected, must not perturb the final result.
    withAttempts = gameReducer(withAttempts, {
      type: "ADD_CUT_LINE",
      line: cutLineAtAngleDegrees(2),
    });
    withAttempts = gameReducer(withAttempts, { type: "ADD_CUT_LINE", line: idealCutLine(1, 3) });
    withAttempts = gameReducer(withAttempts, { type: "ADD_CUT_LINE", line: idealCutLine(2, 3) });
    withAttempts = gameReducer(withAttempts, { type: "CONFIRM_MAKING_STEP" });

    expect(withAttempts.cutState.lines).toHaveLength(3);
    expect(withAttempts.cutState.evaluation).toEqual(withoutAttempts.cutState.evaluation);
  });
});

describe("11. first/second/third line progress", () => {
  it("each ADD_CUT_LINE grows cutState.lines by exactly one, in order", () => {
    let state = bakedMargheritaAtCut();
    expect(state.cutState.lines).toHaveLength(0);
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    expect(state.cutState.lines).toHaveLength(1);
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(1, 3) });
    expect(state.cutState.lines).toHaveLength(2);
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(2, 3) });
    expect(state.cutState.lines).toHaveLength(3);
  });

  it("a committed line invalidates any prior evaluation (set back to null)", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(1, 3) });
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(2, 3) });
    // Confirm computes an evaluation once required lines exist...
    const confirmed = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    expect(confirmed.phase).toBe("RESULT");
  });

  it("undo removes exactly the most recently committed line, no others", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    const firstLine = state.cutState.lines[0];
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(1, 3) });
    state = gameReducer(state, { type: "UNDO_CUT_LINE" });
    expect(state.cutState.lines).toHaveLength(1);
    expect(state.cutState.lines[0]).toEqual(firstLine);
  });

  it("undo below zero lines is a no-op", () => {
    const state = bakedMargheritaAtCut();
    const after = gameReducer(state, { type: "UNDO_CUT_LINE" });
    expect(after.cutState.lines).toHaveLength(0);
  });

  it("the cut limit (requiredCutCount + 2) rejects further lines beyond it", () => {
    let state = bakedMargheritaAtCut();
    const required = requiredCutCount(resolveRequestedSliceCount(state.cutState.config));
    const limit = required + 2;
    for (let i = 0; i < limit; i += 1) {
      state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(i, limit) });
    }
    expect(state.cutState.lines).toHaveLength(limit);
    const rejected = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, limit + 1) });
    expect(rejected).toBe(state);
    expect(rejected.cutState.lines).toHaveLength(limit);
  });
});

describe("10b/15. CONFIRM_MAKING_STEP's own CUT confirm gate + evaluation", () => {
  it("confirming CUT below requiredCutCount is rejected (reducer-level backstop)", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(1, 3) }); // only 2 of 3
    const rejected = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    expect(rejected).toBe(state);
    expect(rejected.phase).toBe("POST_BAKE");
  });

  it("an ideal 3-line CUT confirm computes a defined CutEvaluation, stored on cutState", () => {
    let state = bakedMargheritaAtCut();
    for (let i = 0; i < 3; i += 1) {
      state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(i, 3) });
    }
    const confirmed = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    expect(confirmed.phase).toBe("RESULT");
    expect(confirmed.cutState.evaluation).not.toBeNull();
    expect(confirmed.cutState.evaluation?.requestedSliceCount).toBe(6);
    expect(confirmed.cutState.evaluation?.completedCutCount).toBe(3);
    expect(confirmed.cutState.evaluation?.actualPieceCount).toBe(6);
    // An ideal, evenly-spaced 3-diameter cut should score very well on every signal.
    expect(confirmed.cutState.evaluation?.uniformity).toBeGreaterThan(0.95);
    expect(confirmed.cutState.evaluation?.cutScore).toBeGreaterThan(90);
  });
});

describe("16/17. CUT confirm -> RESULT, finalizes perStepElapsedMs.CUT", () => {
  it("confirming CUT with `now` finalizes CUT's own elapsed ms and lands on RESULT", () => {
    let state = gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE", now: 0 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 1_000 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 2_000 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 3_000 });
    state = gameReducer(state, { type: "START_BAKE", now: 4_000 });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70, now: 5_000 }); // CUT starts at 5000
    expect(state.phase).toBe("POST_BAKE");
    expect(state.cookingTiming?.activeStep).toBe("CUT");
    for (let i = 0; i < 3; i += 1) {
      state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(i, 3) });
    }
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 9_000 });
    expect(state.phase).toBe("RESULT");
    expect(state.cookingTiming?.perStepElapsedMs.CUT).toBe(4_000);
    expect(state.cookingTiming?.activeStep).toBeNull();
  });
});

describe("18. pause boundary (CT1/CT2) is unaffected by CUT -- regression", () => {
  it("PAUSE/RESUME_COOKING_TIMING keep their existing PREPARE-only scope, byte-identical to before this phase", () => {
    let state = gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE", now: 0 });
    state = gameReducer(state, { type: "PAUSE_COOKING_TIMING", now: 1_000 });
    expect(state.cookingTiming?.pausedAt).toBe(1_000);
    state = gameReducer(state, { type: "RESUME_COOKING_TIMING", now: 4_000 }); // 3s paused
    expect(state.cookingTiming?.accumulatedPauseMs).toBe(3_000);
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 4_000 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 4_000 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 4_000 });
    state = gameReducer(state, { type: "START_BAKE", now: 10_000 });
    // completedMs excludes exactly the 3s pause span, same CT1/CT2 math as any pre-CUT round.
    expect(state.cookingTiming?.completedMs).toBe(7_000);
  });
});

describe("19/20/21. REGISTER_TO_DEX orchestration boundary for a CUT-enabled recipe", () => {
  it("BAKE on margherita never registers to Dex (still at POST_BAKE, REGISTER_TO_DEX no-ops)", () => {
    const state = bakedMargheritaAtCut();
    expect(state.phase).toBe("POST_BAKE");
    const attempt = gameReducer(state, { type: "REGISTER_TO_DEX" });
    expect(attempt).toBe(state);
    expect(attempt.justDiscovered).toBe(false);
  });

  it("CUT confirm reaching RESULT lets REGISTER_TO_DEX register exactly once", () => {
    let state = bakedMargheritaAtCut();
    for (let i = 0; i < 3; i += 1) {
      state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(i, 3) });
    }
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    expect(state.phase).toBe("RESULT");
    const discovered = gameReducer(state, { type: "REGISTER_TO_DEX" });
    expect(discovered.phase).toBe("DISCOVERED");
    expect(discovered.justDiscovered).toBe(true);
    const entry = discovered.dex.find((e) => e.recipeId === "margherita");
    expect(entry?.timesMade).toBe(1);
  });

  it("a double REGISTER_TO_DEX dispatch after CUT confirm cannot double-register", () => {
    let state = bakedMargheritaAtCut();
    for (let i = 0; i < 3; i += 1) {
      state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(i, 3) });
    }
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    const first = gameReducer(state, { type: "REGISTER_TO_DEX" });
    const second = gameReducer(first, { type: "REGISTER_TO_DEX" });
    expect(second).toBe(first);
    const entry = second.dex.find((e) => e.recipeId === "margherita");
    expect(entry?.timesMade).toBe(1);
  });
});

describe("23/24. Lunch Rush: serve exactly once, next order clears CUT state", () => {
  it("MISSION_NEXT_ORDER never registers a CUT recipe while it's still at POST_BAKE", () => {
    const state = bakedMargheritaAtCut(true);
    expect(state.isMissionRound).toBe(true);
    expect(state.phase).toBe("POST_BAKE");
    const attempt = gameReducer(state, { type: "MISSION_NEXT_ORDER" });
    expect(attempt).toBe(state);
  });

  it("MISSION_NEXT_ORDER after CUT confirm registers exactly once and starts a fresh cutState", () => {
    let state = bakedMargheritaAtCut(true);
    for (let i = 0; i < 3; i += 1) {
      state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(i, 3) });
    }
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    expect(state.phase).toBe("RESULT");
    expect(state.cutState.lines).toHaveLength(3);

    const next = gameReducer(state, { type: "MISSION_NEXT_ORDER" });
    expect(next.phase).toBe("ORDER");
    const entry = next.dex.find((e) => e.recipeId === "margherita");
    // The Mission fixture starts with Margherita already discovered/timesMade=1 so Lunch Rush
    // can legally order it under Issue #200; serving this round registers exactly one more make.
    expect(entry?.timesMade).toBe(2);
    // The next order's own cutState is fresh -- the previous pizza's committed lines never
    // leak into it, regardless of which recipe the next order happens to be.
    expect(next.cutState.lines).toHaveLength(0);
    expect(next.cutState.evaluation).toBeNull();

    // A stray repeat cannot double-register (same atomicity guarantee as REGISTER_TO_DEX).
    const again = gameReducer(next, { type: "MISSION_NEXT_ORDER" });
    expect(again).toBe(next);
  });
});

describe("12/13/14. reset / recipe change / retry clear CUT transient state", () => {
  it("RETRY_SAME_RECIPE after committing lines starts a fresh, empty cutState", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    expect(state.cutState.lines).toHaveLength(1);
    const retried = gameReducer(state, { type: "RETRY_SAME_RECIPE" });
    expect(retried.phase).toBe("PREPARE");
    expect(retried.cutState.lines).toHaveLength(0);
    expect(retried.cutState.evaluation).toBeNull();
  });

  it("SELECT_RECIPE starts a fresh cutState, even re-selecting the same CUT-enabled recipe", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    expect(state.cutState.lines).toHaveLength(1);
    // margherita is the only recipe available from a fresh, from-scratch dex/ownedIngredientIds
    // (every other recipe's unlockCondition requires margherita discovered first) -- selecting
    // it again still exercises SELECT_RECIPE's own `startPreparingRecipe` -> `buildOrderState`
    // path, the one place `cutState` is (re)created. Progression 2.0 Phase 3-3: SELECT_RECIPE
    // additionally requires *something* to have ever been discovered before it will
    // guided-select an undiscovered recipe (see gameReducer.selectRecipeDiscoveryGate.test.ts)
    // -- `bakedMargheritaAtCut` never dispatches REGISTER_TO_DEX, so the Dex is still empty here;
    // seed a discovered margherita directly so this test stays a pure cutState-reset check.
    state = {
      ...state,
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3 as const, timesMade: 1 }],
    };
    const selected = gameReducer(state, { type: "SELECT_RECIPE", recipeId: "margherita" });
    expect(selected.phase).toBe("PREPARE");
    expect(selected.cutState.lines).toHaveLength(0);
    expect(selected.cutState.evaluation).toBeNull();
    expect(selected.cutState.config.requestedSliceCount).toBe(6);
  });

  it("PLAY_AGAIN starts a fresh cutState for the next round", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    const next = gameReducer(state, { type: "PLAY_AGAIN" });
    expect(next.cutState.lines).toHaveLength(0);
  });

  it("RESET_PIZZA (PREPARE-only) never touches cutState -- it stays at its fresh-round empty value", () => {
    const state = preparedMargheritaState();
    expect(state.cutState.lines).toHaveLength(0);
    const reset = gameReducer(state, { type: "RESET_PIZZA" });
    expect(reset.cutState).toBe(state.cutState);
  });

  it("RESET_PIZZA is a no-op outside PREPARE, so it can never be dispatched from CUT to clear lines mid-step", () => {
    let state = bakedMargheritaAtCut();
    state = gameReducer(state, { type: "ADD_CUT_LINE", line: idealCutLine(0, 3) });
    const attempt = gameReducer(state, { type: "RESET_PIZZA" });
    expect(attempt).toBe(state);
    expect(attempt.cutState.lines).toHaveLength(1);
  });
});

describe("26. Scoring 2.0 total is never perturbed by cutState/cutScore", () => {
  it("state.score.total is byte-identical whether or not any cut lines were committed", () => {
    const withoutLines = bakedMargheritaAtCut();
    let withLines = withoutLines;
    for (let i = 0; i < 3; i += 1) {
      withLines = gameReducer(withLines, { type: "ADD_CUT_LINE", line: idealCutLine(i, 3) });
    }
    withLines = gameReducer(withLines, { type: "CONFIRM_MAKING_STEP" });
    expect(withLines.score?.total).toBe(withoutLines.score?.total);
    expect(withLines.scoringV2Result?.totalScore).toBe(withoutLines.scoringV2Result?.totalScore);
  });
});

describe("27. Completion Gate is never perturbed by CUT", () => {
  it("completion status computed at CONFIRM_BAKE is identical before and after the CUT step confirms", () => {
    const atCut = bakedMargheritaAtCut();
    let afterCut = atCut;
    for (let i = 0; i < 3; i += 1) {
      afterCut = gameReducer(afterCut, { type: "ADD_CUT_LINE", line: idealCutLine(i, 3) });
    }
    afterCut = gameReducer(afterCut, { type: "CONFIRM_MAKING_STEP" });
    expect(afterCut.completion).toEqual(atCut.completion);
    expect(afterCut.completion?.status).toBe("PASS");
  });

  it("CUT never gates completion: a FAILED (empty) margherita pizza still walks CUT to RESULT", () => {
    let state = preparedMargheritaState();
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 5 }); // far outside perfect zone
    expect(state.phase).toBe("POST_BAKE");
    expect(state.completion?.status).toBe("FAILED");
    const result = walkPostBakeToResult(state);
    expect(result.phase).toBe("RESULT");
    expect(result.completion?.status).toBe("FAILED");
  });
});
