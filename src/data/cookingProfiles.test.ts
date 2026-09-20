import { describe, expect, it } from "vitest";
import {
  DEFAULT_COOKING_PROFILE,
  getCookingProfile,
  isPostBakeStep,
  postBakeSteps,
  preBakeSteps,
  type CookingProfile,
} from "./cookingProfiles";
import { RECIPES, type RecipeId } from "./recipes";

/**
 * Recipe Cooking Steps 1.0 Phase 1A (docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md §7/§18):
 * focused coverage for the `CookingProfile` lookup itself -- "profile absent = today's exact
 * flow" is the whole zero-behavior-change contract this file exists to pin, plus the pre/
 * post-BAKE sequence split `gameReducer.ts`'s POST_BAKE plumbing depends on.
 */
describe("CookingProfile lookup (Recipe Cooking Steps 1.0 Phase 1A)", () => {
  it("an unknown recipe id resolves to DEFAULT_COOKING_PROFILE", () => {
    expect(getCookingProfile("not-a-real-recipe-id" as RecipeId)).toBe(DEFAULT_COOKING_PROFILE);
  });

  it("every recipe but margherita has no profile entry -- all resolve to DEFAULT_COOKING_PROFILE", () => {
    // Pizza Cutting 1.0 Phase 2 (docs/design/TETO_PIZZA-CUTTING_1.0.md §18): margherita is the
    // one deliberate, minimal real activation -- its own profile is asserted separately below.
    for (const recipe of RECIPES) {
      if (recipe.id === "margherita") continue;
      expect(getCookingProfile(recipe.id)).toBe(DEFAULT_COOKING_PROFILE);
    }
  });

  it("margherita is the sole CUT-enabled recipe: CUT appended after TOPPING, requestedSliceCount 6", () => {
    const profile = getCookingProfile("margherita" as RecipeId);
    expect(profile).not.toBe(DEFAULT_COOKING_PROFILE);
    expect(profile.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING", "CUT"]);
    expect(profile.cutConfig?.requestedSliceCount).toBe(6);
    expect(preBakeSteps(profile)).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    expect(postBakeSteps(profile)).toEqual(["CUT"]);
  });

  it("every recipe but margherita: BAKE -> RESULT is still direct (no post-BAKE steps)", () => {
    for (const recipe of RECIPES) {
      if (recipe.id === "margherita") continue;
      expect(postBakeSteps(getCookingProfile(recipe.id))).toEqual([]);
    }
  });

  it("DEFAULT_COOKING_PROFILE is exactly today's fixed DOUGH -> SAUCE -> CHEESE -> TOPPING flow", () => {
    expect(DEFAULT_COOKING_PROFILE.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
  });

  it("a present (test-fixture) profile is returned as-is, not silently replaced by the default", () => {
    const fixture: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "CUT"] };
    // getCookingProfile itself only ever resolves from the production COOKING_PROFILES map
    // (empty this phase, see that file's own header) -- this test instead pins that a profile
    // object handed directly to the pre/post-BAKE helpers below is respected unchanged, exactly
    // the shape gameReducer.ts's own `GameState.cookingProfile` field carries per round.
    expect(preBakeSteps(fixture)).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    expect(postBakeSteps(fixture)).toEqual(["CUT"]);
  });
});

describe("pre/post-BAKE step classification", () => {
  it("CUT and FINISH are the only POST_BAKE steps", () => {
    expect(isPostBakeStep("CUT")).toBe(true);
    expect(isPostBakeStep("FINISH")).toBe(true);
    expect(isPostBakeStep("DOUGH")).toBe(false);
    expect(isPostBakeStep("SAUCE")).toBe(false);
    expect(isPostBakeStep("CHEESE")).toBe(false);
    expect(isPostBakeStep("TOPPING")).toBe(false);
    expect(isPostBakeStep("FOLD")).toBe(false);
    expect(isPostBakeStep("SEAL")).toBe(false);
    expect(isPostBakeStep("EDGE_FILL")).toBe(false);
  });

  it("DEFAULT_COOKING_PROFILE has an empty post-BAKE sub-sequence (POST_BAKE is always skipped)", () => {
    expect(postBakeSteps(DEFAULT_COOKING_PROFILE)).toEqual([]);
    expect(preBakeSteps(DEFAULT_COOKING_PROFILE)).toEqual(DEFAULT_COOKING_PROFILE.steps);
  });

  it("a fixture profile with FOLD/SEAL ahead of BAKE keeps them in the pre-BAKE sub-sequence", () => {
    const fixture: CookingProfile = {
      steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL"],
    };
    expect(preBakeSteps(fixture)).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FOLD", "SEAL"]);
    expect(postBakeSteps(fixture)).toEqual([]);
  });

  it("a fixture profile with a post-BAKE step splits pre/post correctly regardless of declared order", () => {
    const fixture: CookingProfile = {
      steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"],
    };
    expect(preBakeSteps(fixture)).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    expect(postBakeSteps(fixture)).toEqual(["FINISH", "CUT"]);
  });
});
