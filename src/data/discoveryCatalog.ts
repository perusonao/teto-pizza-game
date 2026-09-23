/**
 * Progression 2.0 Phase 3-1 (Issue #192): the runtime discovery catalog -- the targets a
 * completed pizza can actually be matched against and written to the Dex.
 *
 * Only production recipes are here, because the Dex (and its save sanitizer) only knows
 * `RecipeId`s. Each target is derived from `RECIPES` itself, so the ingredient set can never
 * drift from what the game actually cooks; `discoveryCatalog.test.ts` checks it against the
 * Phase-2 JSON (`docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json`):
 *
 * - 14 recipes are Phase-2 `shipped:<id>` targets (SHIPPED_KEEP, decisions A-01/A-02 option 1).
 * - `tonno-e-cipolla` is the PIZZA DB row that corroborates it (`tonno-e-cipolla-pizzadb`).
 *
 * The 86 other Phase-2 targets have no production recipe, Dex card or (mostly) ingredient yet,
 * so they are not runtime targets in this slice. The 85 blocked Phase-2 rows are never targets.
 * No shipped recipe requires a capability, so every target uses the default dimensions.
 */
import { DEFAULT_IDENTITY_DIMENSIONS } from "../logic/discovery/signature";
import type { RecipeDiscoveryTarget } from "../logic/discovery/matcher";
import { RECIPES, type RecipeId } from "./recipes";

/** Phase-2 target id for every production recipe. A `Record` so adding a recipe without a
 *  discovery identity is a type error. */
export const RECIPE_DISCOVERY_TARGET_IDS: Readonly<Record<RecipeId, string>> = {
  margherita: "shipped:margherita",
  marinara: "shipped:marinara",
  "quattro-formaggi": "shipped:quattro-formaggi",
  genovese: "shipped:genovese",
  bismarck: "shipped:bismarck",
  funghi: "shipped:funghi",
  fugazza: "shipped:fugazza",
  salsiccia: "shipped:salsiccia",
  pepperoni: "shipped:pepperoni",
  napoletana: "shipped:napoletana",
  "tonno-e-cipolla": "tonno-e-cipolla-pizzadb",
  "pizza-bianca": "shipped:pizza-bianca",
  "breakfast-pizza": "shipped:breakfast-pizza",
  capricciosa: "shipped:capricciosa",
  "meat-lovers": "shipped:meat-lovers",
};

export const RECIPE_DISCOVERY_CATALOG: readonly RecipeDiscoveryTarget[] = RECIPES.map((recipe) => ({
  targetId: RECIPE_DISCOVERY_TARGET_IDS[recipe.id],
  recipeId: recipe.id,
  items: [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))].sort(),
  capabilities: [],
  identityDimensions: DEFAULT_IDENTITY_DIMENSIONS,
  eligibility: { status: "ELIGIBLE" },
}));
