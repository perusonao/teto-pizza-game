import { describe, expect, it } from "vitest";
import { W1_RECIPE_IDS } from "./w1ReferenceFixtures";
import { RECIPES, type RecipeId } from "./recipes";
import { getReferencePizza } from "./referencePizza";
import { RECIPE_SAUCE_PROFILES } from "./recipeSauceProfiles";
import { RECIPE_DISCOVERY_TARGET_IDS } from "./discoveryCatalog";
import { ORDERS } from "./orders";
import { isCutEligible } from "./cookingProfiles";
import { DISCOVERY_LADDER, SHIPPED_15_DISCOVERY_LADDER } from "./discoveryLadder";
import { INGREDIENTS } from "./ingredients";
import { obtainableIngredientIds } from "../state/materialEntitlement";

/**
 * Progression 2.0 W1 I5b-2 no-runtime-change guard: the W1 fixtures exist, but none of the
 * production tables that would make them live (I5b-3) knows about them yet.
 */
describe("I5b-2: the W1 fixtures are not wired into the runtime", () => {
  it("production still ships 15 recipes, each with its shipped Reference, and no W1 Reference", () => {
    expect(RECIPES).toHaveLength(15);
    for (const recipe of RECIPES) expect(getReferencePizza(recipe.id)?.recipeId).toBe(recipe.id);
    for (const id of W1_RECIPE_IDS) expect(getReferencePizza(id)).toBeNull();
  });

  it("no W1 id in RECIPES, sauce profiles, discovery targets, ORDERS or the CUT allowlist", () => {
    const recipeIds = new Set<string>(RECIPES.map((r) => r.id));
    for (const id of W1_RECIPE_IDS) {
      expect(recipeIds.has(id)).toBe(false);
      expect(Object.keys(RECIPE_SAUCE_PROFILES)).not.toContain(id);
      expect(Object.keys(RECIPE_DISCOVERY_TARGET_IDS)).not.toContain(id);
      expect(ORDERS.some((o) => (o.recipeId as string) === id)).toBe(false);
      expect(isCutEligible(id as RecipeId)).toBe(false);
    }
    expect(Object.keys(RECIPE_SAUCE_PROFILES)).toHaveLength(15);
    expect(ORDERS).toHaveLength(15);
  });

  it("the runtime ladder, catalog and obtainable count are unchanged (14 steps / 29 / 22)", () => {
    expect(DISCOVERY_LADDER).toBe(SHIPPED_15_DISCOVERY_LADDER);
    expect(DISCOVERY_LADDER.steps).toHaveLength(14);
    expect(INGREDIENTS).toHaveLength(29);
    expect(obtainableIngredientIds()).toHaveLength(22);
  });

  it("no production module imports the W1 fixture module", () => {
    const sources = import.meta.glob<string>(["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!../**/testSupport/**"], {
      query: "?raw",
      import: "default",
      eager: true,
    });
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    const importers = Object.entries(sources)
      .filter(([, text]) => /from\s+["'][^"']*w1ReferenceFixtures["']/.test(text))
      .map(([path]) => path);
    expect(importers).toEqual([]);
  });
});
