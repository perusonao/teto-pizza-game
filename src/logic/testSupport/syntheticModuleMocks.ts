import type * as RecipesModule from "../../data/recipes";
import type * as CatalogModule from "../../data/discoveryCatalog";
import { FROZEN_PRODUCTION_25_IDS, SYNTH_BRANCH_B, SYNTH_BRANCH_B_ID } from "./syntheticPopulation";

/**
 * Discovery 3.0 PR-4a: `vi.mock` factories that extend the recipe population INSIDE ONE TEST FILE's module
 * graph with the synthetic branching recipe, so the real reducer / matcher / hint sheet run over it. No
 * production data file is edited. Use from a test file:
 *
 *   vi.mock("../data/recipes", async (orig) => (await import("../logic/testSupport/syntheticModuleMocks")).mockRecipes(await orig()));
 *   vi.mock("../data/discoveryCatalog", async (orig) => (await import("../logic/testSupport/syntheticModuleMocks")).mockCatalog(await orig()));
 */

export const SYNTH_BRANCH_B_TARGET_ID = "synthetic:branch-b";

export function mockRecipes(m: typeof RecipesModule): typeof RecipesModule {
  // Frozen 25 + the synthetic recipe: a production recipe added later is not part of this population.
  const RECIPES = [...m.RECIPES.filter((r) => FROZEN_PRODUCTION_25_IDS.includes(r.id)), SYNTH_BRANCH_B] as unknown as typeof m.RECIPES;
  return {
    ...m,
    RECIPES,
    getRecipe: (id: string) => RECIPES.find((r) => r.id === id),
    getRecipeIndex: (id: string) => RECIPES.findIndex((r) => r.id === id),
    countsTowardLadder: (id: string, recipes: readonly { id: string; ladderCredit?: false }[] = RECIPES) =>
      recipes.find((r) => r.id === id)?.ladderCredit !== false,
  } as typeof RecipesModule;
}

export function mockCatalog(m: typeof CatalogModule): typeof CatalogModule {
  return {
    ...m,
    RECIPE_DISCOVERY_CATALOG: m.RECIPE_DISCOVERY_CATALOG.map((t) =>
      (t.recipeId as string) === SYNTH_BRANCH_B_ID ? { ...t, targetId: SYNTH_BRANCH_B_TARGET_ID } : t,
    ),
  };
}
