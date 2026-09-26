import { describe, expect, it } from "vitest";
import { gameReducer, type GameState } from "./gameReducer";
import type { CookingProfile } from "../data/cookingProfiles";
import { DEFAULT_COOKING_PROFILE } from "../data/cookingProfiles";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import { createGuidedInitialState } from "./testSupport/guidedRound";

/**
 * Recipe Cooking Steps 1.0 Phase 1A (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §8/§18):
 * focused reducer-level coverage for the generalized making-sequence walk (`nextStepWithin`,
 * driven by `preBakeSteps`/`postBakeSteps` instead of the old fixed module constant) and the new
 * `POST_BAKE` phase. The default-profile assertions here are a second, narrower pin of the exact
 * same zero-behavior-change contract `onewayFlow.test.ts` already covers end-to-end; the
 * future-fixture assertions exercise the POST_BAKE machinery no shipped recipe's profile
 * activates yet, by constructing a `GameState` with a non-default `cookingProfile` directly --
 * `COOKING_PROFILES` (../data/cookingProfiles.ts) itself stays empty; no production recipe data
 * changes for this file to pass.
 */

function preparedState(): GameState {
  return gameReducer(createGuidedInitialState(), { type: "BEGIN_PREPARE" });
}

/** Overrides the round's `cookingProfile` with a test fixture -- mirrors how a future recipe's
 *  real `CookingProfile` entry would flow through `buildOrderState`, without touching production
 *  data. */
function withProfile(state: GameState, profile: CookingProfile): GameState {
  return { ...state, cookingProfile: profile };
}

function confirm(state: GameState): GameState {
  return gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
}

/** Pizza Cutting 1.0 Phase 2: commits `count` ideal (evenly-spaced, through-center) cut lines
 *  via ADD_CUT_LINE, so a fixture's own CUT step can satisfy CONFIRM_MAKING_STEP's
 *  `requiredCutCount` gate. Mirrors ../testSupport/postBakeFlow.ts's own fixture shape. */
function idealCutLinesState(state: GameState, count: number): GameState {
  let next = state;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * i) / count;
    const dx = Math.cos(angle) * DOUGH_RADIUS;
    const dy = Math.sin(angle) * DOUGH_RADIUS;
    next = gameReducer(next, {
      type: "ADD_CUT_LINE",
      line: {
        start: { x: DOUGH_CENTER - dx, y: DOUGH_CENTER - dy },
        end: { x: DOUGH_CENTER + dx, y: DOUGH_CENTER + dy },
      },
    });
  }
  return next;
}

function baked(state: GameState): GameState {
  const preppedThroughTopping = confirm(confirm(confirm(state))); // -> TOPPING
  const baking = gameReducer(preppedThroughTopping, { type: "START_BAKE" });
  return gameReducer(baking, { type: "CONFIRM_BAKE", value: 70 });
}

/** A canonical, Completion-Gate-PASSing Margherita pizza -- same direct-injection pattern as
 *  gameReducer.completionGate.test.ts's own `idealPizzaFor`/`playToResultForRecipe` (reference
 *  Sauce fixture + reference piece groups, bypassing the PREPARE walk entirely). Needed only by
 *  the REGISTER_TO_DEX boundary tests below, which care about whether registration actually
 *  *succeeds* (reaches DISCOVERED), not just whether CONFIRM_BAKE's phase transition is correct. */
function idealMargheritaPizza(bakeResult: number): PizzaState {
  const reference = getReferencePizza("margherita")!;
  return {
    ...createEmptyPizza(),
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((group, gi) =>
      group.positions.map((p, i) => ({
        id: `ideal-${gi}-${i}`,
        ingredientId: group.ingredientId,
        ...p,
      })),
    ),
    bakeResult,
  };
}

/** Like `baked`, but injects `idealMargheritaPizza` directly (bypassing PREPARE) so the result
 *  actually PASSes the Completion Gate. */
function idealBaked(state: GameState): GameState {
  const withIdealPizza = { ...state, pizza: idealMargheritaPizza(70) };
  const baking = gameReducer(withIdealPizza, { type: "START_BAKE" });
  return gameReducer(baking, { type: "CONFIRM_BAKE", value: 70 });
}

describe("Making sequence (nextStepWithin, driven by CookingProfile)", () => {
  it("default profile: walks the fixed DOUGH -> SAUCE -> CHEESE -> TOPPING sequence, one step per confirm", () => {
    let state = preparedState();
    expect(state.makingStep).toBe("DOUGH");
    state = confirm(state);
    expect(state.makingStep).toBe("SAUCE");
    state = confirm(state);
    expect(state.makingStep).toBe("CHEESE");
    state = confirm(state);
    expect(state.makingStep).toBe("TOPPING");
  });

  it("default profile: confirming at the final PREPARE step (TOPPING) is a no-op -- BAKE is reached only via START_BAKE", () => {
    let state = preparedState();
    state = confirm(confirm(confirm(state))); // DOUGH -> SAUCE -> CHEESE -> TOPPING
    expect(state.makingStep).toBe("TOPPING");
    const after = confirm(state);
    expect(after).toBe(state);
    expect(after.makingStep).toBe("TOPPING");
    expect(after.phase).toBe("PREPARE");
  });

  it("future fixture: a longer pre-BAKE sequence (DOUGH/SAUCE/CHEESE/TOPPING/FOLD/SEAL) walks every extra step, still gated to PREPARE", () => {
    const fixture: CookingProfile = {
      steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL"],
    };
    let state = withProfile(preparedState(), fixture);
    for (const expected of ["SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL"]) {
      state = confirm(state);
      expect(state.makingStep).toBe(expected);
      expect(state.phase).toBe("PREPARE");
    }
    // Final step (SEAL) -- same no-op-at-the-end contract as the default profile's TOPPING.
    const after = confirm(state);
    expect(after).toBe(state);
    expect(after.makingStep).toBe("SEAL");
  });

  it("CONFIRM_MAKING_STEP outside PREPARE/POST_BAKE (e.g. ORDER) is a no-op regardless of profile", () => {
    const orderState = createGuidedInitialState();
    expect(orderState.phase).toBe("ORDER");
    expect(confirm(orderState)).toBe(orderState);
  });
});

describe("POST_BAKE (CONFIRM_BAKE / CONFIRM_MAKING_STEP)", () => {
  it("default recipe (no post-BAKE steps): CONFIRM_BAKE lands directly on RESULT, exactly as before this phase", () => {
    // Pizza Cutting 1.0 Phase 2: the round's *initial* recipe (createInitialGameState prefers
    // margherita, ../data/orders.ts) now carries margherita's own CUT-enabled profile -- this
    // test is about the `DEFAULT_COOKING_PROFILE` shape itself (any recipe without a post-BAKE
    // step), so the profile is overridden directly, exactly like every other fixture in this
    // file already does, rather than relying on whichever recipe happens to be "first".
    const state = withProfile(preparedState(), DEFAULT_COOKING_PROFILE);
    expect(state.cookingProfile).toBe(DEFAULT_COOKING_PROFILE);
    const result = baked(state);
    expect(result.phase).toBe("RESULT");
    // makingStep is left completely untouched by CONFIRM_BAKE, same as pre-Phase-1A behavior.
    expect(result.makingStep).toBe("TOPPING");
    expect(result.score).not.toBeNull();
  });

  it("future-profile fixture with one post-BAKE step (CUT): CONFIRM_BAKE lands on POST_BAKE at that step", () => {
    const fixture: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "CUT"] };
    const state = withProfile(preparedState(), fixture);
    const result = baked(state);
    expect(result.phase).toBe("POST_BAKE");
    expect(result.makingStep).toBe("CUT");
    // Scoring/completion/inventory are computed exactly as usual at CONFIRM_BAKE, independent of
    // which phase the round lands on afterward.
    expect(result.score).not.toBeNull();
    expect(result.completion).not.toBeNull();
  });

  it("POST_BAKE completion (confirming the last post-BAKE step) transitions to RESULT", () => {
    // Generic post-BAKE-step-walking mechanism under test here, not CUT's own specific
    // confirm gate (pinned separately below and in gameReducer.cutStep.test.ts) -- FINISH has
    // no completion requirement of its own, so it stays the right fixture step for this.
    const fixture: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"] };
    const state = withProfile(preparedState(), fixture);
    const atPostBake = baked(state);
    expect(atPostBake.phase).toBe("POST_BAKE");
    const afterConfirm = confirm(atPostBake);
    expect(afterConfirm.phase).toBe("RESULT");
    // The score/completion computed back at CONFIRM_BAKE survive the POST_BAKE -> RESULT hop
    // untouched -- POST_BAKE's own confirm never recomputes them.
    expect(afterConfirm.score).toBe(atPostBake.score);
  });

  it("future-profile fixture with two post-BAKE steps (FINISH then CUT): confirms walk FINISH -> CUT -> RESULT", () => {
    const fixture: CookingProfile = {
      steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"],
      cutConfig: { requestedSliceCount: 6 },
    };
    const state = withProfile(preparedState(), fixture);
    const atFinish = baked(state);
    expect(atFinish.phase).toBe("POST_BAKE");
    expect(atFinish.makingStep).toBe("FINISH");

    const atCut = confirm(atFinish);
    expect(atCut.phase).toBe("POST_BAKE");
    expect(atCut.makingStep).toBe("CUT");

    // Pizza Cutting 1.0 Phase 2: CUT's own confirm is gated on `requiredCutCount` (§15.3) --
    // commit the 3 required lines (6 slices) before the final confirm can reach RESULT.
    const withLines = idealCutLinesState(atCut, 3);
    const atResult = confirm(withLines);
    expect(atResult.phase).toBe("RESULT");
  });

  it("CONFIRM_MAKING_STEP is rejected outside PREPARE/POST_BAKE even for a post-BAKE-carrying fixture once RESULT is reached", () => {
    // FINISH again -- this test is about the terminal-RESULT idempotency guard, independent of
    // CUT's own confirm gate.
    const fixture: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"] };
    const state = withProfile(preparedState(), fixture);
    const atResult = confirm(baked(state));
    expect(atResult.phase).toBe("RESULT");
    expect(confirm(atResult)).toBe(atResult);
  });
});

/**
 * REGISTER_TO_DEX / mission-serve orchestration boundary (Pizza Cutting 1.0 Fresh Design §12):
 * App.tsx's `handleConfirmBake` dispatches CONFIRM_BAKE then REGISTER_TO_DEX back-to-back,
 * assuming CONFIRM_BAKE always lands on "RESULT". This pins the exact risk that finding names --
 * and confirms it is currently a no-op, not a silent bug, precisely because no production recipe
 * ever activates a post-BAKE profile this phase. Relocating the call site itself is out of scope
 * for Phase 1A and deferred to CUT Phase 2 (see the Result Report's dependency note) since this
 * test demonstrates there is nothing to fix yet -- REGISTER_TO_DEX's own phase guard already
 * rejects the premature call safely.
 */
describe("REGISTER_TO_DEX / mission-serve orchestration boundary (Pizza Cutting 1.0 §12)", () => {
  it("default recipe: App.tsx's CONFIRM_BAKE + REGISTER_TO_DEX back-to-back dispatch registers normally (unchanged)", () => {
    // Pizza Cutting 1.0 Phase 2: forced to DEFAULT_COOKING_PROFILE, same reasoning as the
    // "default recipe (no post-BAKE steps)" test above -- this test is about a recipe whose
    // profile has no post-BAKE steps, and the round's actual initial recipe (margherita) no
    // longer is one.
    const state = withProfile(preparedState(), DEFAULT_COOKING_PROFILE);
    const afterBake = idealBaked(state);
    expect(afterBake.phase).toBe("RESULT");
    expect(afterBake.completion?.status).toBe("PASS");
    const afterRegister = gameReducer(afterBake, { type: "REGISTER_TO_DEX" });
    expect(afterRegister.phase).toBe("DISCOVERED");
  });

  it("future-profile fixture: the same back-to-back dispatch silently no-ops while the round is at POST_BAKE, never registers early", () => {
    const fixture: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "CUT"] };
    const state = withProfile(preparedState(), fixture);
    const afterBake = idealBaked(state);
    expect(afterBake.phase).toBe("POST_BAKE");
    expect(afterBake.completion?.status).toBe("PASS");
    // Mirrors App.tsx's handleConfirmBake: REGISTER_TO_DEX dispatched immediately after
    // CONFIRM_BAKE, unconditionally -- its own `state.phase !== "RESULT"` guard is what makes
    // this safe today (see gameReducer.ts's REGISTER_TO_DEX case).
    const afterRegisterAttempt = gameReducer(afterBake, { type: "REGISTER_TO_DEX" });
    expect(afterRegisterAttempt).toBe(afterBake);
    expect(afterRegisterAttempt.phase).toBe("POST_BAKE");
    expect(afterRegisterAttempt.justDiscovered).toBe(false);
  });
});
