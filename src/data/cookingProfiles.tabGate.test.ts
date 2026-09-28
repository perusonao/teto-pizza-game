import { describe, expect, it } from "vitest";
import {
  MAX_VISIBLE_COOKING_TABS,
  getCookingProfile,
  postBakeSteps,
  preBakeSteps,
  visibleCookingTabCount,
  type CookingProfile,
} from "./cookingProfiles";
import { FREE_COOK_RECIPE_ID } from "./freeCook";
import { RECIPES } from "./recipes";

/**
 * Post-W1 Cooking Steps CS-1a -- the Production tab gate (Owner Decision OD-CS-9 (a), see
 * docs/design/TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md §13).
 *
 * Every making-step strip a player can see in Production must fit in `MAX_VISIBLE_COOKING_TABS`
 * (6). When this fails for a new recipe, do NOT raise the ceiling or skip the recipe here: the
 * Owner rule is that a 7+ tab recipe requires the tab-strip redesign (CS-4) first.
 */

interface NamedProfile {
  name: string;
  profile: CookingProfile;
}

function tabViolations(profiles: readonly NamedProfile[]): string[] {
  return profiles
    .filter(({ profile }) => visibleCookingTabCount(profile) > MAX_VISIBLE_COOKING_TABS)
    .map(({ name, profile }) => `${name}: ${visibleCookingTabCount(profile)} tabs`);
}

/** Guided / Lunch Rush rounds use the recipe's own profile. */
const recipeProfiles: NamedProfile[] = RECIPES.map((r) => ({ name: r.id, profile: getCookingProfile(r.id) }));

/** Free Cooking (and a Dinner round before BAKE) runs on the FREE sentinel's profile. */
const freeCookProfile = getCookingProfile(FREE_COOK_RECIPE_ID);

/** A Dinner round keeps the FREE pre-bake steps and appends the identified recipe's post-bake
 *  steps at START_BAKE (gameReducer.ts `dinnerStartBake`); an unidentified pizza gets none. */
const dinnerProfiles: NamedProfile[] = [
  { name: "dinner:unidentified", profile: { steps: preBakeSteps(freeCookProfile) } },
  ...RECIPES.map((r) => ({
    name: `dinner:${r.id}`,
    profile: { steps: [...preBakeSteps(freeCookProfile), ...postBakeSteps(getCookingProfile(r.id))] },
  })),
];

describe("Production tab gate (CS-1a, OD-CS-9 a)", () => {
  it("the ceiling is 6 and is not raised to make a recipe fit", () => {
    expect(MAX_VISIBLE_COOKING_TABS).toBe(6);
  });

  it("counts tabs the way MakingStepTabs renders them: PREPARE steps + 焼く + POST_BAKE steps", () => {
    expect(visibleCookingTabCount({ steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "CUT"] })).toBe(6);
    expect(visibleCookingTabCount({ steps: ["DOUGH", "SAUCE", "TOPPING"] })).toBe(4);
  });

  it("every Production recipe fits in 6 tabs (guided and Lunch Rush)", () => {
    expect(recipeProfiles).toHaveLength(25);
    expect(tabViolations(recipeProfiles)).toEqual([]);
  });

  it("the ceiling is actually reached today, so it is a real constraint (18 recipes at 6, 7 at 5)", () => {
    const counts = recipeProfiles.map(({ profile }) => visibleCookingTabCount(profile));
    expect(Math.max(...counts)).toBe(MAX_VISIBLE_COOKING_TABS);
    expect(counts.filter((n) => n === 6)).toHaveLength(18);
    expect(counts.filter((n) => n === 5)).toHaveLength(7);
  });

  it("the Free Cooking profile fits in 6 tabs", () => {
    expect(tabViolations([{ name: "free-cook", profile: freeCookProfile }])).toEqual([]);
    expect(visibleCookingTabCount(freeCookProfile)).toBe(5);
  });

  it("every Dinner strip fits in 6 tabs (max stays 6)", () => {
    expect(tabViolations(dinnerProfiles)).toEqual([]);
    expect(Math.max(...dinnerProfiles.map(({ profile }) => visibleCookingTabCount(profile)))).toBe(6);
  });

  it("the gate fails a 7-tab profile (a post-bake step added to a full CUT recipe)", () => {
    const sevenTabs: NamedProfile = {
      name: "fixture:late-addition-with-cut",
      profile: { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"] },
    };
    expect(tabViolations([...recipeProfiles, sevenTabs])).toEqual(["fixture:late-addition-with-cut: 7 tabs"]);
  });
});
