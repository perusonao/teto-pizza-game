import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cookingProfileForPan } from "../logic/pan/panProfile";
import { getCookingProfile } from "../data/cookingProfiles";
import { resetPreviewPanShapeForTest } from "../preview/panShapePreview";
import { postBakeSteps } from "../data/cookingProfiles";
import { gameReducer, type GameState } from "./gameReducer";
import { createGuidedInitialState } from "./testSupport/guidedRound";

/**
 * #537 D1-b: cheese / topping placement and CUT through the real reducer, for a square-pan round. The pan is the Preview / DEV
 * switch (`?pan=square`, B1) or the recipe's own `panShape` -- both are read through `activePanShape`, as COMMIT_SQUARE_DOUGH does.
 */
const OWNED = ["tomato-sauce", "mozzarella", "basil"];

function setSearch(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
  resetPreviewPanShapeForTest();
}
beforeEach(() => setSearch(""));
afterEach(() => setSearch(""));

function atCheese(square: boolean): GameState {
  let state = createGuidedInitialState("margherita", { ownedIngredientIds: OWNED });
  if (square) state = { ...state, recipe: { ...state.recipe, panShape: "square" } };
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
  expect(state.makingStep).toBe("CHEESE");
  return state;
}
const place = (state: GameState, x: number, y: number) => gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x, y });

describe("PLACE_TOPPING on a square pan", () => {
  it("accepts the four corners (outside the round dough circle) and rejects a point off the pan", () => {
    const state = atCheese(true);
    for (const [x, y] of [[8, 8], [92, 8], [8, 92], [92, 92]]) {
      const after = place(state, x, y);
      expect(after.pizza.toppings).toHaveLength(1);
      expect(after.pizza.toppings[0]).toMatchObject({ x, y });
    }
    expect(place(state, 97, 50)).toBe(state);
    expect(place(state, 50, 3)).toBe(state);
  });

  it("nudges a crowded drop to a free spot that is still on the pan", () => {
    let state = atCheese(true);
    state = place(state, 10, 10);
    state = place(state, 10, 10);
    expect(state.pizza.toppings).toHaveLength(2);
    const [, second] = state.pizza.toppings;
    expect(Math.hypot(second.x - 10, second.y - 10)).toBeGreaterThanOrEqual(9);
    expect(second.x).toBeGreaterThanOrEqual(6);
    expect(second.y).toBeGreaterThanOrEqual(6);
  });

  it("works under the Preview / DEV switch too", () => {
    setSearch("?pan=square");
    const state = atCheese(false);
    expect(place(state, 92, 92).pizza.toppings).toHaveLength(1);
  });
});

describe("PLACE_TOPPING on a round pan is unchanged", () => {
  it("still rejects the corners and a point past the rim, still accepts the rim", () => {
    const state = atCheese(false);
    expect(place(state, 8, 8)).toBe(state);
    expect(place(state, 92, 92)).toBe(state);
    expect(place(state, 98.5, 50)).toBe(state);
    expect(place(state, 50 + 47.9, 50).pizza.toppings).toHaveLength(1);
    expect(place(state, 50, 50 + 47.9).pizza.toppings).toHaveLength(1);
  });
});

describe("a square pan has no CUT", () => {
  it("margherita is CUT-eligible on the round pan and loses CUT only on the square pan (?pan=square)", () => {
    expect(getCookingProfile("margherita").steps).toContain("CUT");
    const round = gameReducer(createGuidedInitialState("margherita", { ownedIngredientIds: OWNED }), { type: "SELECT_RECIPE", recipeId: "margherita" });
    expect(round.cookingProfile.steps).toContain("CUT");
    expect(postBakeSteps(round.cookingProfile)).toContain("CUT");

    setSearch("?pan=square");
    const square = gameReducer(createGuidedInitialState("margherita", { ownedIngredientIds: OWNED }), { type: "SELECT_RECIPE", recipeId: "margherita" });
    expect(square.recipe.id).toBe("margherita");
    expect(square.cookingProfile.steps).not.toContain("CUT");
    expect(square.cookingProfile.cutConfig).toBeUndefined();
    expect(postBakeSteps(square.cookingProfile)).not.toContain("CUT");
  });
});

describe("cookingProfileForPan", () => {
  it("returns the very same profile for the round pan and for a profile without CUT", () => {
    const profile = getCookingProfile("margherita");
    expect(cookingProfileForPan(profile, "round")).toBe(profile);
    const noCut = { steps: ["DOUGH", "SAUCE"] as const };
    expect(cookingProfileForPan(noCut, "square")).toBe(noCut);
  });

  it("drops CUT and its config for the square pan, keeping the other steps in order", () => {
    const profile = getCookingProfile("margherita");
    const square = cookingProfileForPan(profile, "square");
    expect(square.steps).toEqual(profile.steps.filter((s) => s !== "CUT"));
    expect("cutConfig" in square).toBe(false);
  });
});
