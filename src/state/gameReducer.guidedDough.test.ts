import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P3-a1 (#577, Owner D5): a Guided round starts from the dough kind its RECIPE fixes. No shipped recipe sets `doughKind` (Pinsa is P3-b, HOLD), so
 * the recipe under test is a real one (`jamon-serrano-pizza`) given `doughKind` by this mock only -- the data files are untouched. What is pinned:
 *  - SELECT_RECIPE / RETRY_SAME_RECIPE / RESET_PIZZA start (or restart) the pizza with `dough` set, through the real reducer;
 *  - the dough survives the whole round and the pending-round journal, and the pizza's identity axis reads it;
 *  - the chips never offer a choice in a Guided round and SELECT_DOUGH cannot change it;
 *  - every other round (a standard recipe, Free Cooking) is exactly the pizza it was before: no `dough` key.
 */
const PINSA = "material-multigrain-long-ferment";
const FIXED = "jamon-serrano-pizza";

vi.mock("../data/recipes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/recipes")>();
  const patch = <R extends { id: string }>(r: R): R => (r.id === "jamon-serrano-pizza" ? { ...r, doughKind: "material-multigrain-long-ferment" } : r);
  return { ...actual, RECIPES: actual.RECIPES.map(patch), getRecipe: (id: string) => { const r = actual.getRecipe(id as never); return r ? patch(r) : r; } };
});

import { resetDoughKindPreviewForTest } from "../preview/doughKindPreview";
import { signatureOfPizza } from "../logic/discovery/signature";
import { resolveDoughKind } from "../logic/dough/doughKind";
import { createEmptyPizza } from "./pizzaState";
import { doughSwitchOffered, startingPizzaFor } from "./doughSelection";
import { buildPendingRound, pizzaFromJournal, readStoredPendingRound } from "./pendingRound";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { createGuidedInitialState } from "./testSupport/guidedRound";

function setSearch(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
  resetDoughKindPreviewForTest();
}
beforeEach(() => setSearch(""));
afterEach(() => setSearch(""));

function guided(recipeId: "jamon-serrano-pizza" | "margherita"): GameState {
  return gameReducer(createGuidedInitialState(recipeId), { type: "SELECT_RECIPE", recipeId, now: 0 });
}

function freeCook(): GameState {
  return gameReducer(gameReducer(createInitialGameState(), { type: "START_FREE_COOK", now: 0 }), { type: "BEGIN_PREPARE", now: 0 });
}

describe("the mock is the only source of the dough kind", () => {
  it("the fixed recipe resolves to Pinsa; a standard recipe and the Free Cooking sentinel resolve to standard", () => {
    expect(resolveDoughKind(guided(FIXED).recipe)).toBe(PINSA);
    expect(resolveDoughKind(guided("margherita").recipe)).toBe("standard");
    expect(resolveDoughKind(freeCook().recipe)).toBe("standard");
  });
});

describe("startingPizzaFor", () => {
  it("is createEmptyPizza() with no dough key for a standard recipe, an unknown kind, null and undefined", () => {
    for (const recipe of [{}, { doughKind: "standard" }, { doughKind: "pinsa" }, { doughKind: 3 }, null, undefined]) {
      const pizza = startingPizzaFor(recipe);
      expect(pizza).toEqual(createEmptyPizza());
      expect("dough" in pizza).toBe(false);
    }
  });

  it("is the empty pizza plus the recipe's dough kind otherwise (nothing else differs)", () => {
    expect(startingPizzaFor({ doughKind: PINSA })).toEqual({ ...createEmptyPizza(), dough: PINSA });
  });
});

describe("SELECT_RECIPE (Guided start)", () => {
  it("starts the pizza with the recipe's dough kind and nothing else added", () => {
    const state = guided(FIXED);
    expect(state.phase).toBe("PREPARE");
    expect(state.freeCook).toBe(false);
    expect(state.pizza).toEqual({ ...createEmptyPizza(), dough: PINSA });
  });

  it("a standard recipe's Guided pizza is the same empty pizza as before: no dough key", () => {
    const state = guided("margherita");
    expect(state.pizza).toEqual(createEmptyPizza());
    expect("dough" in state.pizza).toBe(false);
  });

  it("the identity axis reads the recipe's dough, and no other axis moves", () => {
    const fixed = signatureOfPizza(guided(FIXED).pizza);
    const standard = signatureOfPizza(guided("margherita").pizza);
    expect(fixed.dimensions.dough.value).toBe(PINSA);
    expect(standard.dimensions.dough.value).toBe("standard");
    const { dough: _a, ...fixedRest } = fixed.dimensions;
    const { dough: _b, ...standardRest } = standard.dimensions;
    expect(fixedRest).toEqual(standardRest);
  });

  it("does not change the cooking profile, the CUT state or the pan (dough is independent of the pan)", () => {
    const fixed = guided(FIXED);
    expect(fixed.pizza.pan).toBeUndefined();
    expect(fixed.pizza.squareDough).toBeUndefined();
    expect(fixed.cookingProfile.steps).toEqual(createGuidedInitialState(FIXED).cookingProfile.steps);
  });
});

describe("RETRY_SAME_RECIPE (Guided)", () => {
  it("a retried round starts again from the recipe's dough with a fresh pizza", () => {
    let state = guided(FIXED);
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    expect(state.pizza.sauceIds.length).toBeGreaterThan(0);
    const retried = gameReducer(state, { type: "RETRY_SAME_RECIPE", now: 1 });
    expect(retried.phase).toBe("PREPARE");
    expect(retried.pizza).toEqual({ ...createEmptyPizza(), dough: PINSA });
    expect(retried.makingStep).toBe("DOUGH");
  });

  it("a standard recipe's retry is unchanged: no dough key", () => {
    const state = guided("margherita");
    const retried = gameReducer(state, { type: "RETRY_SAME_RECIPE", now: 1 });
    expect(retried.pizza).toEqual(createEmptyPizza());
    expect("dough" in retried.pizza).toBe(false);
  });
});

describe("RESET_PIZZA (作り直す)", () => {
  it("restarts from the recipe's dough: the placed pieces go, the recipe's own dough kind stays", () => {
    let state = guided(FIXED);
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    const reset = gameReducer(state, { type: "RESET_PIZZA" });
    expect(reset.makingStep).toBe("DOUGH");
    expect(reset.pizza).toEqual({ ...createEmptyPizza(), dough: PINSA });
  });

  it("a standard Guided recipe resets to exactly createEmptyPizza() (deep-equal, no dough key)", () => {
    const state = guided("margherita");
    const reset = gameReducer(state, { type: "RESET_PIZZA" });
    expect(reset.pizza).toEqual(createEmptyPizza());
    expect("dough" in reset.pizza).toBe(false);
  });

  it("a Free Cooking reset never gains a dough key", () => {
    const state = freeCook();
    const reset = gameReducer(state, { type: "RESET_PIZZA" });
    expect(reset.pizza).toEqual(createEmptyPizza());
    expect("dough" in reset.pizza).toBe(false);
  });
});

describe("Free Cooking, Research and the other rounds are unchanged", () => {
  it("a Free Cooking round starts with no dough key", () => {
    const state = freeCook();
    expect(state.pizza).toEqual(createEmptyPizza());
    expect("dough" in state.pizza).toBe(false);
  });

  it("the initial ORDER state of a new game has no dough key", () => {
    expect("dough" in createInitialGameState().pizza).toBe(false);
  });
});

describe("a Guided round that fixes its dough offers no choice", () => {
  it("the chips are not offered in a Guided round, even with the Preview opt-in open", () => {
    setSearch("?doughSwitch=open");
    const state = guided(FIXED);
    const round = { phase: state.phase, makingStep: state.makingStep, isMissionRound: state.isMissionRound, isDinnerRound: false, freeCook: state.freeCook, recipe: state.recipe, dex: state.dex };
    expect(doughSwitchOffered(round)).toBe(false);
  });

  it("SELECT_DOUGH cannot change a Guided round's dough (no-op, same state object)", () => {
    setSearch("?doughSwitch=open");
    const state = guided(FIXED);
    expect(gameReducer(state, { type: "SELECT_DOUGH", dough: "standard" })).toBe(state);
    const guidedStandard = guided("margherita");
    expect(gameReducer(guidedStandard, { type: "SELECT_DOUGH", dough: PINSA })).toBe(guidedStandard);
  });
});

describe("the dough survives the round and the pending-round journal", () => {
  it("is still on the pizza after the DOUGH step is confirmed, and when the pizza is baked", () => {
    let state = guided(FIXED);
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
    expect(state.pizza.dough).toBe(PINSA);
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 });
    expect(state.pizza.dough).toBe(PINSA);
    expect(signatureOfPizza(state.pizza).dimensions.dough.value).toBe(PINSA);
  });

  it("the journal of a Guided Pinsa round stores the dough and rebuilds it after a JSON round trip (reload)", () => {
    const state = guided(FIXED);
    const round = buildPendingRound({ recipe: state.recipe, roundKind: state.roundKind, pizza: state.pizza, researchTargetId: null, researchTargetValidAtStart: false, cookingProfile: state.cookingProfile }, "r1", 70, 1);
    expect(round.pizza.dough).toBe(PINSA);
    const read = readStoredPendingRound(JSON.parse(JSON.stringify(round)));
    expect(read.kind).toBe("round");
    if (read.kind !== "round") throw new Error("unreachable");
    expect(pizzaFromJournal(read.round.pizza).dough).toBe(PINSA);
  });

  it("the journal of a standard Guided round carries no dough key (the stored shape is unchanged)", () => {
    const state = guided("margherita");
    const round = buildPendingRound({ recipe: state.recipe, roundKind: state.roundKind, pizza: state.pizza, researchTargetId: null, researchTargetValidAtStart: false, cookingProfile: state.cookingProfile }, "r1", 70, 1);
    expect("dough" in round.pizza).toBe(false);
    expect("dough" in pizzaFromJournal(round.pizza)).toBe(false);
  });
});
