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
import { getIngredient } from "./ingredients";
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
  // Progression 2.0 W1 I5b-3: PIZZA DB evidence ids from the W1 authoring matrix (#221 `evidenceId`,
  // read as reference; docs/reports/TETO_PROGRESS2_W1_I5B_FRESH-AUDIT.md §1).
  "melanzane-pizza": "melanzane-pizza-pizzadb-p13",
  "parmigiana-pizza": "parmigiana-pizza-pizzadb-p7",
  bambino: "bambino-pizzadb-p7",
  hawaiian: "hawaiian-pizzadb-row",
  "pizza-portuguesa": "pizza-portuguesa-pizzadb-p9",
  "pesto-tonno": "pesto-tonno-pizzadb-p12",
  "new-haven-apizza": "new-haven-apizza-pizzadb",
  "pesto-caprese": "pesto-caprese-pizzadb-p11",
  "pesto-patate": "pesto-patate-pizzadb-p12",
  "puttanesca-pizza": "puttanesca-pizza-pizzadb-p10",
  // Discovery 3.0 PR-4b-B: a production-only target (no Phase-2 row); distinct from `calabrese`.
  "brazilian-calabresa": "brazilian-calabresa",
  // Discovery 3.0 No.27: PIZZA DB evidence id from the 172 matrix (`pesto-pollo-pizzadb-p12`).
  "pesto-pollo": "pesto-pollo-pizzadb-p12",
  // Expansion Slice 1: PIZZA DB evidence id from the 172 matrix (`pesto-gamberi-pizzadb-p11`).
  "pesto-gamberi": "pesto-gamberi-pizzadb-p11",
  // Expansion Wave 2: PIZZA DB evidence ids from the 172 master evidence matrix.
  vongole: "vongole-pizzadb",
  "pesto-vegetariana": "pesto-vegetariana-pizzadb-p12",
  "ratatouille-pizza": "ratatouille-pizza-pizzadb-p13",
  // Expansion Slice 3: PIZZA DB evidence id from the 172 matrix (`pesto-trapanese-pizzadb-p11`).
  "pesto-trapanese": "pesto-trapanese-pizzadb-p11",
  // Expansion Batch 1: PIZZA DB evidence ids from the 172 matrix.
  "baba-ganoush-pizza": "baba-ganoush-pizza-pizzadb-p7",
  "prosciutto-funghi": "prosciutto-funghi-pizzadb-p11",
  "veggie-supreme-pizza": "veggie-supreme-pizza-pizzadb-p11",
  // Expansion Batch 2: PIZZA DB evidence ids from the 172 matrix.
  "vegan-cashew-cheese-pizza": "vegan-cashew-cheese-pizza-pizzadb-p1",
  "calabresa-argentina": "calabresa-argentina-pizzadb",
  "jamon-serrano-pizza": "jamon-serrano-pizza-pizzadb-p7",
  "rucola-e-grana": "rucola-e-grana-pizzadb-p13",
  "pesto-salmone": "pesto-salmone-pizzadb-p11",
  // Expansion Batch 3: PIZZA DB evidence ids from the 172 matrix.
  bacalhau: "bacalhau-pizzadb",
  "full-english-pizza": "full-english-pizza-pizzadb-p10",
  "palmito-pizza": "palmito-pizza-pizzadb-p7",
  "polish-kielbasa": "polish-kielbasa-pizzadb-p12",
  "porchetta-pizza": "porchetta-pizza-pizzadb-p12",
  "salsiccia-e-friarielli": "salsiccia-e-friarielli-pizzadb-p3",
  // TQ-1D: the first NO_SAUCE recipe (PIZZA DB evidence id from the 172 matrix).
  aussie: "aussie-pizzadb",
};

export const RECIPE_DISCOVERY_CATALOG: readonly RecipeDiscoveryTarget[] = RECIPES.map((recipe) => ({
  targetId: RECIPE_DISCOVERY_TARGET_IDS[recipe.id],
  recipeId: recipe.id,
  items: [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))].sort(),
  sauceBase: [
    ...new Set(
      recipe.requiredIngredients
        .map((r) => r.ingredientId)
        .filter((id) => getIngredient(id)?.category === "sauce"),
    ),
  ].sort(),
  capabilities: [],
  identityDimensions: DEFAULT_IDENTITY_DIMENSIONS,
  eligibility: { status: "ELIGIBLE" },
}));
