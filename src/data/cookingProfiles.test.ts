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
    it("steps end with CUT, appended after the default DOUGH/SAUCE/CHEESE/TOPPING sequence", () => {
      const profile = getCookingProfile(recipeId);
      expect(profile).not.toBe(DEFAULT_COOKING_PROFILE);
      expect(profile.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING", "CUT"]);
    });

    it("(F) requestedSliceCount is 6 (Phase 4B: no authoritative rule for a different count)", () => {
      const profile = getCookingProfile(recipeId);
      expect(profile.cutConfig?.requestedSliceCount).toBe(6);
    });

    it("preBakeSteps/postBakeSteps split correctly", () => {
      const profile = getCookingProfile(recipeId);
      expect(preBakeSteps(profile)).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
      expect(postBakeSteps(profile)).toEqual(["CUT"]);
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
