import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX } from "./dex";
import { getRecipe, type RecipeId } from "../data/recipes";
import { findOrderForRecipe } from "../data/orders";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { getCookingProfile } from "../data/cookingProfiles";
import { createCutState } from "../logic/cut/state";
import { createGuidedInitialState } from "./testSupport/guidedRound";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";
import { startCookingTiming } from "../logic/cookingTiming";

/**
 * Gameplay UX / Scoring 3.0 PR-A (Dynamic Cooking Steps, see
 * docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md Audit F): reducer-level integration
 * coverage for the real production `getCookingProfile` derivation against real recipes that skip
 * CHEESE (marinara/fugazza/pizza-bianca) or TOPPING (quattro-formaggi), confirming
 * `CONFIRM_MAKING_STEP`/`nextStepWithin` walks each recipe's own derived sequence with no
 * meaningless blank step and still reaches CUT via POST_BAKE exactly like every other recipe.
 * Complements ../data/cookingProfiles.test.ts (pure `getCookingProfile` derivation, no reducer)
 * and gameReducer.cookingSteps.test.ts (generic POST_BAKE machinery, hand-built fixtures) -- this
 * file exercises real recipe ids end to end, the same "override recipe/cookingProfile/cutState
 * directly, bypass unlock gating" pattern gameReducer.completionGate.test.ts's own
 * `playToResultForRecipe` and gameReducer.cutStep.test.ts already use.
 */

function preparedFor(recipeId: RecipeId): GameState {
  // Discovery 2.0: a guided margherita PREPARE (then re-targeted to `recipeId` below).
  const base = gameReducer(createGuidedInitialState(), { type: "BEGIN_PREPARE" });
  const recipe = getRecipe(recipeId);
  if (!recipe) throw new Error(`${recipeId} fixture missing`);
  const cookingProfile = getCookingProfile(recipeId);
  return {
    ...base,
    recipe,
    cookingProfile,
    cutState: createCutState(cookingProfile.cutConfig),
  };
}

function confirm(state: GameState): GameState {
  return gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
}

/** An ideal, Completion-Gate-PASSing pizza for `recipeId`, built purely from that recipe's own
 *  `ReferencePizza` (../data/referencePizza.ts) -- for a no-CHEESE/no-TOPPING recipe this
 *  naturally has zero cheese/topping pieces, since the reference itself only ever lists what the
 *  recipe actually requires (same fixture shape gameReducer.completionGate.test.ts's own
 *  `idealPizzaFor` uses). */
function idealPizzaFor(recipeId: RecipeId, bakeResult: number): PizzaState {
  const reference = getReferencePizza(recipeId)!;
  return {
    ...createEmptyPizza(),
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((group, gi) =>
      group.positions.map((p, i) => ({
        id: `${recipeId}-ideal-${gi}-${i}`,
        ingredientId: group.ingredientId,
        ...p,
      })),
    ),
    bakeResult,
  };
}

function playToResultForRecipe(recipeId: RecipeId): GameState {
  const recipe = getRecipe(recipeId)!;
  const order = findOrderForRecipe(recipeId)!;
  const pizza = idealPizzaFor(recipeId, recipe.bakeTarget.start);
  const cookingProfile = getCookingProfile(recipeId);
  let state = createInitialGameState(EMPTY_DEX, [...STARTER_INGREDIENT_IDS, "onion", "mushroom"]);
  // Discovery 2.0: an injected guided round (a Dex-0 initial state is a Free Cooking round now).
  state = { ...state, recipe, order, pizza, cookingProfile, cutState: createCutState(cookingProfile.cutConfig), freeCook: false };
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: pizza.bakeResult! });
  return walkPostBakeToResult(state);
}

describe("marinara (no required cheese): DOUGH -> SAUCE -> TOPPING, CHEESE never visited", () => {
  it("walks DOUGH -> SAUCE -> TOPPING with no CHEESE stop in between", () => {
    let state = preparedFor("marinara");
    expect(state.makingStep).toBe("DOUGH");
    state = confirm(state);
    expect(state.makingStep).toBe("SAUCE");
    state = confirm(state);
    expect(state.makingStep).toBe("TOPPING");
  });

  it("confirming at TOPPING (marinara's own last PREPARE step) is a no-op -- same contract as every other recipe's own last step", () => {
    let state = preparedFor("marinara");
    state = confirm(confirm(state)); // DOUGH -> SAUCE -> TOPPING
    expect(state.makingStep).toBe("TOPPING");
    const after = confirm(state);
    expect(after).toBe(state);
    expect(after.phase).toBe("PREPARE");
  });

  it("BAKE -> POST_BAKE/CUT -> RESULT works with zero cheese ever placed", () => {
    let state = preparedFor("marinara");
    state = confirm(confirm(state)); // -> TOPPING
    expect(state.phase).toBe("PREPARE");
    state = gameReducer(state, { type: "START_BAKE" });
    expect(state.phase).toBe("BAKE");
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 55 });
    expect(state.phase).toBe("POST_BAKE");
    expect(state.makingStep).toBe("CUT");
    state = walkPostBakeToResult(state);
    expect(state.phase).toBe("RESULT");
    expect(state.score).not.toBeNull();
  });

  it("a full PASS round scores normally with no CHEESE ingredient ever required by the Completion Gate", () => {
    const result = playToResultForRecipe("marinara");
    expect(result.phase).toBe("RESULT");
    expect(result.completion?.status).toBe("PASS");
    expect(result.score).not.toBeNull();
  });
});

describe("quattro-formaggi (no required topping): DOUGH -> SAUCE -> CHEESE, TOPPING never visited", () => {
  it("walks DOUGH -> SAUCE -> CHEESE with no TOPPING stop in between", () => {
    let state = preparedFor("quattro-formaggi");
    expect(state.makingStep).toBe("DOUGH");
    state = confirm(state);
    expect(state.makingStep).toBe("SAUCE");
    state = confirm(state);
    expect(state.makingStep).toBe("CHEESE");
  });

  it("confirming at CHEESE (quattro-formaggi's own last PREPARE step) is a no-op", () => {
    let state = preparedFor("quattro-formaggi");
    state = confirm(confirm(state)); // DOUGH -> SAUCE -> CHEESE
    expect(state.makingStep).toBe("CHEESE");
    const after = confirm(state);
    expect(after).toBe(state);
    expect(after.phase).toBe("PREPARE");
  });

  it("BAKE -> POST_BAKE/CUT -> RESULT works with zero topping ever placed", () => {
    let state = preparedFor("quattro-formaggi");
    state = confirm(confirm(state)); // -> CHEESE
    state = gameReducer(state, { type: "START_BAKE" });
    expect(state.phase).toBe("BAKE");
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 75 });
    expect(state.phase).toBe("POST_BAKE");
    expect(state.makingStep).toBe("CUT");
    state = walkPostBakeToResult(state);
    expect(state.phase).toBe("RESULT");
    expect(state.score).not.toBeNull();
  });

  it("a full PASS round scores normally with no TOPPING ingredient ever required by the Completion Gate", () => {
    const result = playToResultForRecipe("quattro-formaggi");
    expect(result.phase).toBe("RESULT");
    expect(result.completion?.status).toBe("PASS");
    expect(result.score).not.toBeNull();
  });
});

describe("margherita (full-step recipe, regression baseline): DOUGH -> SAUCE -> CHEESE -> TOPPING unchanged", () => {
  it("walks every one of the 4 PREPARE steps, still ending at CUT via POST_BAKE", () => {
    let state = preparedFor("margherita");
    expect(state.makingStep).toBe("DOUGH");
    state = confirm(state);
    expect(state.makingStep).toBe("SAUCE");
    state = confirm(state);
    expect(state.makingStep).toBe("CHEESE");
    state = confirm(state);
    expect(state.makingStep).toBe("TOPPING");
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    expect(state.phase).toBe("POST_BAKE");
    expect(state.makingStep).toBe("CUT");
  });
});

describe("CUT eligibility (Pizza Cutting 1.0 Phase 4B) is unaffected by dynamic PREPARE steps", () => {
  it.each([
    ["margherita", "full-step recipe"],
    ["marinara", "no-CHEESE recipe"],
    ["quattro-formaggi", "no-TOPPING recipe"],
    ["capricciosa", "topping-heavy recipe (6 required ingredients)"],
  ] as const)("%s (%s): normal/dynamic steps -> BAKE -> CUT still reachable", (recipeId, _label) => {
    const state = playToResultForRecipe(recipeId);
    expect(state.phase).toBe("RESULT");
    expect(state.completion?.status).toBe("PASS");
    // walkPostBakeToResult only exercises ADD_CUT_LINE/CONFIRM_MAKING_STEP if the round actually
    // landed on POST_BAKE/CUT after CONFIRM_BAKE -- reaching RESULT at all here already proves
    // that happened for every one of these CUT-eligible recipes (a non-CUT recipe would still
    // reach RESULT, but never via a POST_BAKE detour).
    expect(state.cutState.evaluation).not.toBeNull();
  });

  it("an unknown/future recipe id preserves the current non-CUT fallback (DEFAULT_COOKING_PROFILE, no CUT)", () => {
    const profile = getCookingProfile("not-a-real-recipe-id" as RecipeId);
    expect(profile.steps).not.toContain("CUT");
  });
});

describe("Timing regression: skipping a step creates no phantom timing", () => {
  it("marinara's cookingTiming never records a CHEESE entry (the step never opened)", () => {
    let state = preparedFor("marinara");
    state = { ...state, cookingTiming: startCookingTiming(0, "DOUGH") };
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 5_000 }); // DOUGH -> SAUCE
    expect(state.makingStep).toBe("SAUCE");
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 9_000 }); // SAUCE -> TOPPING (CHEESE skipped)
    expect(state.makingStep).toBe("TOPPING");
    expect(state.cookingTiming?.perStepElapsedMs.CHEESE).toBeUndefined();
    expect(state.cookingTiming?.perStepElapsedMs.DOUGH).toBe(5_000);
    expect(state.cookingTiming?.perStepElapsedMs.SAUCE).toBe(4_000);
    expect(state.cookingTiming?.activeStep).toBe("TOPPING");
  });

  it("quattro-formaggi's cookingTiming never records a TOPPING entry (the step never opened)", () => {
    let state = preparedFor("quattro-formaggi");
    state = { ...state, cookingTiming: startCookingTiming(0, "DOUGH") };
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 5_000 }); // DOUGH -> SAUCE
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 10_000 }); // SAUCE -> CHEESE
    expect(state.makingStep).toBe("CHEESE");
    expect(state.cookingTiming?.perStepElapsedMs.TOPPING).toBeUndefined();
    state = gameReducer(state, { type: "START_BAKE", now: 16_000 });
    // Whole-round completedMs (efficiency's own reader) is finalized at START_BAKE regardless of
    // which steps were actually visited -- no artificial duration added for the skipped step.
    expect(state.cookingTiming?.completedMs).toBe(16_000);
  });
});
