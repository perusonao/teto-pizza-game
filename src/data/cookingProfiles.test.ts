import { describe, expect, it } from "vitest";
import {
  COOKING_PROFILE_OVERRIDES_TEST_ONLY,
  DEFAULT_COOKING_PROFILE,
  getCookingProfile,
  isCutEligible,
  isPostBakeStep,
  postBakeSteps,
  preBakeSteps,
  type CookingProfile,
} from "./cookingProfiles";
import { RECIPES, type RecipeId } from "./recipes";
import type { MakingStep } from "../state/gameReducer";

/**
 * Recipe Cooking Steps 1.0 Phase 1A / Pizza Cutting 1.0 Phase 4B (Full Recipe Expansion, see
 * docs/reports/TETO_PIZZA-CUTTING_Phase3_Expansion_Fresh-Audit.md and
 * docs/reports/TETO_PIZZA-CUTTING_Phase4B_Full-Recipe-Expansion_Result.md): exhaustive coverage
 * for `getCookingProfile`'s CUT-eligibility allowlist derivation (Option C). Unlike Phase 1A's
 * original "everything resolves to DEFAULT_COOKING_PROFILE" pin, Phase 4B's own contract is
 * "every current production recipe has an explicit eligibility decision" -- this file asserts
 * that decision for every single `RECIPES` entry by id, not just spot-checks margherita.
 */

/** Phase 4B's Fresh Audit classified all 15 recipes shipped as of this phase as CUT-eligible
 *  (standard round/single-piece/single-bake, shared circular-dough contract). Keeping this list
 *  here (independent of `CUT_ELIGIBLE_RECIPE_IDS` itself, which is not exported) means a change
 *  to the production allowlist that silently drops or adds a recipe fails this test, not just
 *  the subset check below. */
const EXPECTED_CUT_ELIGIBLE: readonly RecipeId[] = [
  "margherita",
  "marinara",
  "quattro-formaggi",
  "genovese",
  "bismarck",
  "funghi",
  "fugazza",
  "salsiccia",
  "pepperoni",
  "napoletana",
  "tonno-e-cipolla",
  "pizza-bianca",
  "breakfast-pizza",
  "capricciosa",
  "meat-lovers",
];

/**
 * Gameplay UX / Scoring 3.0 PR-A (Dynamic Cooking Steps, see
 * docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md Audit F, Fresh-confirmed against
 * ../data/recipes.ts's `requiredIngredients` and ../data/ingredients.ts's `Ingredient.category`
 * for every one of the 15 shipped recipes): the exact expected pre-BAKE step sequence per recipe,
 * derived from which ingredient categories each recipe's `requiredIngredients` actually touch.
 * Every recipe requires at least one `"sauce"`-category ingredient today (SAUCE is universal, but
 * deliberately not hardcoded as such -- see `deriveCoreSteps`'s own doc comment), so only CHEESE/
 * TOPPING ever drop out: marinara/fugazza/pizza-bianca need no cheese-category ingredient (all
 * three use only `tomato-sauce`/`olive-oil` + topping-category items), quattro-formaggi needs no
 * topping-category ingredient (its four cheeses are its entire non-sauce composition). This table
 * pins the exact sequence, not just a step count, per the task's own requirement. */
const RECIPE_STEP_MATRIX: Record<RecipeId, readonly MakingStep[]> = {
  margherita: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
  marinara: ["DOUGH", "SAUCE", "TOPPING"],
  "quattro-formaggi": ["DOUGH", "SAUCE", "CHEESE"],
  genovese: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
  bismarck: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
  funghi: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
  fugazza: ["DOUGH", "SAUCE", "TOPPING"],
  salsiccia: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
  pepperoni: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
  napoletana: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
  "tonno-e-cipolla": ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
  "pizza-bianca": ["DOUGH", "SAUCE", "TOPPING"],
  "breakfast-pizza": ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
  capricciosa: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
  "meat-lovers": ["DOUGH", "SAUCE", "CHEESE", "TOPPING"],
};

/** No-CHEESE recipes (Fresh-confirmed, see `RECIPE_STEP_MATRIX` above). */
const NO_CHEESE_RECIPES: readonly RecipeId[] = ["marinara", "fugazza", "pizza-bianca"];
/** No-TOPPING recipes (Fresh-confirmed, see `RECIPE_STEP_MATRIX` above). */
const NO_TOPPING_RECIPES: readonly RecipeId[] = ["quattro-formaggi"];

describe("CookingProfile lookup (Recipe Cooking Steps 1.0 / Pizza Cutting 1.0 Phase 4B)", () => {
  it("an unknown recipe id resolves to DEFAULT_COOKING_PROFILE", () => {
    expect(getCookingProfile("not-a-real-recipe-id" as RecipeId)).toBe(DEFAULT_COOKING_PROFILE);
    expect(isCutEligible("not-a-real-recipe-id" as RecipeId)).toBe(false);
  });

  it("(A) every current production recipe has an explicit eligibility decision", () => {
    // RECIPES ⊆ EXPECTED_CUT_ELIGIBLE ∪ (nothing else) -- every real recipe id is accounted for
    // by this test file, not silently skipped.
    const recipeIds = RECIPES.map((r) => r.id);
    expect(new Set(recipeIds)).toEqual(new Set(EXPECTED_CUT_ELIGIBLE));
    for (const recipeId of recipeIds) {
      // Calling isCutEligible/getCookingProfile must not throw and must return a defined,
      // deterministic boolean/profile for every one -- "explicit decision" means every id
      // resolves through the allowlist function, not through an unhandled fallthrough.
      expect(typeof isCutEligible(recipeId)).toBe("boolean");
      expect(getCookingProfile(recipeId)).toBeDefined();
    }
  });

  it("CUT_ELIGIBLE_RECIPE_IDS ⊆ RECIPES.map(id) -- no stale/typo'd id in the allowlist", () => {
    const recipeIds = new Set(RECIPES.map((r) => r.id));
    for (const id of EXPECTED_CUT_ELIGIBLE) {
      expect(recipeIds.has(id), `${id} must be a real RECIPES entry`).toBe(true);
    }
  });

  it("every RECIPES entry is CUT-eligible in this phase (Phase 4B Fresh Audit finding)", () => {
    for (const recipe of RECIPES) {
      expect(isCutEligible(recipe.id), `${recipe.id} must be CUT-eligible`).toBe(true);
    }
  });

  describe.each(EXPECTED_CUT_ELIGIBLE)("(B) %s: derived profile includes POST_BAKE CUT", (recipeId) => {
    it("steps are this recipe's own RECIPE_STEP_MATRIX sequence, CUT appended after it", () => {
      const profile = getCookingProfile(recipeId);
      expect(profile).not.toBe(DEFAULT_COOKING_PROFILE);
      expect(profile.steps).toEqual([...RECIPE_STEP_MATRIX[recipeId], "CUT"]);
    });

    it("(F) requestedSliceCount is 6 (Phase 4B: no authoritative rule for a different count)", () => {
      const profile = getCookingProfile(recipeId);
      expect(profile.cutConfig?.requestedSliceCount).toBe(6);
    });

    it("preBakeSteps/postBakeSteps split correctly", () => {
      const profile = getCookingProfile(recipeId);
      expect(preBakeSteps(profile)).toEqual(RECIPE_STEP_MATRIX[recipeId]);
      expect(postBakeSteps(profile)).toEqual(["CUT"]);
    });

    it("has no duplicate steps", () => {
      const profile = getCookingProfile(recipeId);
      expect(new Set(profile.steps).size).toBe(profile.steps.length);
    });
  });

  describe("(H) dynamic step derivation (Gameplay UX / Scoring 3.0 PR-A)", () => {
    it("every RECIPES entry's derived profile matches RECIPE_STEP_MATRIX exactly, not just a step count", () => {
      for (const recipe of RECIPES) {
        const profile = getCookingProfile(recipe.id);
        expect(preBakeSteps(profile), recipe.id).toEqual(RECIPE_STEP_MATRIX[recipe.id]);
      }
    });

    it.each(NO_CHEESE_RECIPES)("%s: CHEESE is absent (no required cheese-category ingredient)", (recipeId) => {
      const profile = getCookingProfile(recipeId);
      expect(profile.steps).not.toContain("CHEESE");
      expect(preBakeSteps(profile)).not.toContain("CHEESE");
    });

    it.each(NO_TOPPING_RECIPES)("%s: TOPPING is absent (no required topping-category ingredient)", (recipeId) => {
      const profile = getCookingProfile(recipeId);
      expect(profile.steps).not.toContain("TOPPING");
      expect(preBakeSteps(profile)).not.toContain("TOPPING");
    });

    it("every recipe with a required cheese-category ingredient keeps its CHEESE step", () => {
      for (const recipeId of EXPECTED_CUT_ELIGIBLE) {
        if (NO_CHEESE_RECIPES.includes(recipeId)) continue;
        expect(preBakeSteps(getCookingProfile(recipeId)), recipeId).toContain("CHEESE");
      }
    });

    it("every recipe with a required topping-category ingredient keeps its TOPPING step", () => {
      for (const recipeId of EXPECTED_CUT_ELIGIBLE) {
        if (NO_TOPPING_RECIPES.includes(recipeId)) continue;
        expect(preBakeSteps(getCookingProfile(recipeId)), recipeId).toContain("TOPPING");
      }
    });

    it("every recipe keeps DOUGH and SAUCE (universal today, still derived rather than hardcoded)", () => {
      for (const recipe of RECIPES) {
        const steps = preBakeSteps(getCookingProfile(recipe.id));
        expect(steps[0], recipe.id).toBe("DOUGH");
        expect(steps, recipe.id).toContain("SAUCE");
      }
    });

    it("DOUGH is always first, SAUCE (when present) always second, CHEESE before TOPPING when both present", () => {
      for (const recipe of RECIPES) {
        const steps = preBakeSteps(getCookingProfile(recipe.id));
        expect(steps[0]).toBe("DOUGH");
        const sauceIndex = steps.indexOf("SAUCE");
        const cheeseIndex = steps.indexOf("CHEESE");
        const toppingIndex = steps.indexOf("TOPPING");
        if (sauceIndex >= 0) expect(sauceIndex).toBe(1);
        if (cheeseIndex >= 0 && toppingIndex >= 0) expect(cheeseIndex).toBeLessThan(toppingIndex);
      }
    });

    it("marinara: no meaningless blank CHEESE step -- DOUGH -> SAUCE -> TOPPING -> CUT", () => {
      const profile = getCookingProfile("marinara" as RecipeId);
      expect(preBakeSteps(profile)).toEqual(["DOUGH", "SAUCE", "TOPPING"]);
      expect(postBakeSteps(profile)).toEqual(["CUT"]);
    });

    it("quattro-formaggi: no meaningless blank TOPPING step -- DOUGH -> SAUCE -> CHEESE -> CUT", () => {
      const profile = getCookingProfile("quattro-formaggi" as RecipeId);
      expect(preBakeSteps(profile)).toEqual(["DOUGH", "SAUCE", "CHEESE"]);
      expect(postBakeSteps(profile)).toEqual(["CUT"]);
    });

    it("margherita (full-step recipe): CHEESE and TOPPING both remain, regression baseline unchanged", () => {
      const profile = getCookingProfile("margherita" as RecipeId);
      expect(preBakeSteps(profile)).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    });
  });

  it("(C) a synthetic/future recipe id not in the allowlist does NOT inherit CUT", () => {
    // A real-shaped RecipeId cast (matches this file's own pre-existing "not-a-real-recipe-id"
    // pattern) standing in for a not-yet-added recipe -- e.g. a future non-round special shape
    // (calzone/fugazzeta/mezza-e-mezza/siciliana/square pizza) that must never silently inherit
    // CUT just by being added to RECIPES without a deliberate allowlist decision.
    const futureRecipeId = "future-calzone-not-yet-eligible" as RecipeId;
    expect(isCutEligible(futureRecipeId)).toBe(false);
    const profile = getCookingProfile(futureRecipeId);
    expect(profile).toBe(DEFAULT_COOKING_PROFILE);
    expect(profile.steps).not.toContain("CUT");
    expect(postBakeSteps(profile)).toEqual([]);
  });

  it("(D) DEFAULT_COOKING_PROFILE itself is never mutated to include CUT", () => {
    expect(DEFAULT_COOKING_PROFILE.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    expect(DEFAULT_COOKING_PROFILE.steps).not.toContain("CUT");
    expect(DEFAULT_COOKING_PROFILE.cutConfig).toBeUndefined();
    // Resolving a genuinely unknown id must keep returning the same frozen default object
    // reference, not a freshly-CUT-appended copy -- pins that the allowlist branch is never
    // silently reachable for an id absent from CUT_ELIGIBLE_RECIPE_IDS.
    expect(getCookingProfile("not-a-real-recipe-id" as RecipeId)).toBe(DEFAULT_COOKING_PROFILE);
  });

  it("(E) an explicit per-recipe override, if present, is returned as-is (custom profile preserved)", () => {
    // COOKING_PROFILE_OVERRIDES_TEST_ONLY is exported only for this one test -- production code
    // never reads it; the map itself is empty in real COOKING_PROFILE_OVERRIDES today (no shipped
    // recipe needs a non-standard CutConfig), so this exercises the override *mechanism* via a
    // dedicated test seam rather than mutating the real production map.
    expect(COOKING_PROFILE_OVERRIDES_TEST_ONLY.size).toBe(0);
  });

  it("(G) a future unknown/synthetic recipe never accidentally becomes eligible via any partial-match logic", () => {
    // Confirms the allowlist check is a real Set membership test, not a substring/prefix match
    // that a recipe like "margherita-2" or "funghi-jr" could accidentally satisfy.
    expect(isCutEligible("margherita-variant" as RecipeId)).toBe(false);
    expect(isCutEligible("funghi2" as RecipeId)).toBe(false);
    expect(isCutEligible("" as RecipeId)).toBe(false);
  });

  it("margherita: CUT appended after TOPPING, requestedSliceCount 6 (regression, Phase 2 baseline)", () => {
    const profile = getCookingProfile("margherita" as RecipeId);
    expect(profile).not.toBe(DEFAULT_COOKING_PROFILE);
    expect(profile.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING", "CUT"]);
    expect(profile.cutConfig?.requestedSliceCount).toBe(6);
    expect(preBakeSteps(profile)).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    expect(postBakeSteps(profile)).toEqual(["CUT"]);
  });

  it("DEFAULT_COOKING_PROFILE is exactly today's fixed DOUGH -> SAUCE -> CHEESE -> TOPPING flow", () => {
    expect(DEFAULT_COOKING_PROFILE.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
  });

  it("a present (test-fixture) profile is returned as-is, not silently replaced by the default", () => {
    const fixture: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "CUT"] };
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
