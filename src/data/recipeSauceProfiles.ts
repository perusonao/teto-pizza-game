import type { RecipeId } from "./recipes";

/**
 * The player-facing sauce gesture for a recipe. All profiles use the same field-based
 * dispenser/rendering pipeline; the profile changes the ingredient, not the basic action.
 *
 * Olive oil is intentionally explicit rather than being silently treated as tomato sauce.
 * A true line/amount-oriented DRIZZLE gesture is a later interaction family and would expand
 * this parity PR beyond the existing, proven paint controller.
 */
export type SauceInteractionKind = "PAINT" | "PAINT_TEMPORARY";

export interface RecipeSauceProfile {
  recipeId: RecipeId;
  ingredientId: "tomato-sauce" | "pesto" | "olive-oil";
  interaction: SauceInteractionKind;
}

/**
 * TQ-1D: `null` means "this recipe is made without a spread sauce" (the Technique `no-sauce`). It is
 * authored here, next to every other recipe's sauce mapping, and nothing derives it from a target
 * identity at runtime. The set of NO_SAUCE recipes is exactly the `null` entries (`NoSauceRecipeId` /
 * `noSauceRecipeIds()` below derive it; nothing else lists them). `satisfies` (not an annotation) keeps each
 * entry's literal `null`, so the type-level set can be derived from this one table.
 */
export const RECIPE_SAUCE_PROFILES = {
  margherita: {
    recipeId: "margherita",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  marinara: {
    recipeId: "marinara",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "quattro-formaggi": {
    recipeId: "quattro-formaggi",
    ingredientId: "olive-oil",
    // TODO: olive-oil -> DRIZZLE candidate.
    interaction: "PAINT_TEMPORARY",
  },
  genovese: {
    recipeId: "genovese",
    ingredientId: "pesto",
    interaction: "PAINT",
  },
  bismarck: {
    recipeId: "bismarck",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  funghi: {
    recipeId: "funghi",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  fugazza: {
    recipeId: "fugazza",
    ingredientId: "olive-oil",
    // TODO: olive-oil -> DRIZZLE candidate.
    interaction: "PAINT_TEMPORARY",
  },
  // Recipe Expansion Batch 1A: all 4 new recipes use tomato-sauce/PAINT, per the Fresh Recipe
  // Master Catalog's own `sauce: "tomato-sauce"` field for each (see ../data/recipes.ts).
  salsiccia: {
    recipeId: "salsiccia",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  pepperoni: {
    recipeId: "pepperoni",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  napoletana: {
    recipeId: "napoletana",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "tonno-e-cipolla": {
    recipeId: "tonno-e-cipolla",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  // Recipe Expansion Batch 1B-A: pizza-bianca uses olive-oil (like quattro-formaggi/fugazza
  // above), breakfast-pizza uses tomato-sauce, per the Fresh Recipe Master Catalog's own
  // `sauce` field for each (see ../data/recipes.ts).
  "pizza-bianca": {
    recipeId: "pizza-bianca",
    ingredientId: "olive-oil",
    // TODO: olive-oil -> DRIZZLE candidate.
    interaction: "PAINT_TEMPORARY",
  },
  "breakfast-pizza": {
    recipeId: "breakfast-pizza",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  // Recipe Expansion Batch 1B-B: capricciosa uses tomato-sauce, per the Fresh Recipe Master
  // Catalog's own `sauce` field (see ../data/recipes.ts).
  capricciosa: {
    recipeId: "capricciosa",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  // Recipe Expansion Batch 1B-C: meat-lovers uses tomato-sauce, per the Fresh Recipe Master
  // Catalog's own `sauce` field (see ../data/recipes.ts).
  "meat-lovers": {
    recipeId: "meat-lovers",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  // Progression 2.0 W1 I5b-3: the 10 W1 recipes. Each follows the shipped profile for its sauce:
  // tomato-sauce / pesto PAINT, olive-oil PAINT_TEMPORARY (quattro-formaggi / fugazza /
  // pizza-bianca). New Haven's olive-oil keeps that existing behaviour -- no new mechanic.
  "melanzane-pizza": {
    recipeId: "melanzane-pizza",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "parmigiana-pizza": {
    recipeId: "parmigiana-pizza",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  bambino: {
    recipeId: "bambino",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  hawaiian: {
    recipeId: "hawaiian",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "pizza-portuguesa": {
    recipeId: "pizza-portuguesa",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "pesto-tonno": {
    recipeId: "pesto-tonno",
    ingredientId: "pesto",
    interaction: "PAINT",
  },
  "new-haven-apizza": {
    recipeId: "new-haven-apizza",
    ingredientId: "olive-oil",
    // TODO: olive-oil -> DRIZZLE candidate.
    interaction: "PAINT_TEMPORARY",
  },
  "pesto-caprese": {
    recipeId: "pesto-caprese",
    ingredientId: "pesto",
    interaction: "PAINT",
  },
  "pesto-patate": {
    recipeId: "pesto-patate",
    ingredientId: "pesto",
    interaction: "PAINT",
  },
  "puttanesca-pizza": {
    recipeId: "puttanesca-pizza",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "brazilian-calabresa": {
    recipeId: "brazilian-calabresa",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "pesto-pollo": {
    recipeId: "pesto-pollo",
    ingredientId: "pesto",
    interaction: "PAINT",
  },
  "pesto-gamberi": {
    recipeId: "pesto-gamberi",
    ingredientId: "pesto",
    interaction: "PAINT",
  },
  // Expansion Wave 2. vongole's olive-oil is its OWN existing sauce-slot mapping (PAINT_TEMPORARY,
  // like pizza-bianca) -- NOT a general "no-sauce family = olive-oil sauce" rule; TQ-1D / NO_SAUCE
  // authority is unchanged.
  vongole: {
    recipeId: "vongole",
    ingredientId: "olive-oil",
    // TODO: olive-oil -> DRIZZLE candidate.
    interaction: "PAINT_TEMPORARY",
  },
  "pesto-vegetariana": {
    recipeId: "pesto-vegetariana",
    ingredientId: "pesto",
    interaction: "PAINT",
  },
  "ratatouille-pizza": {
    recipeId: "ratatouille-pizza",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  // Expansion Slice 3: pesto, the existing standard PAINT sauce (no cheese; nothing new).
  "pesto-trapanese": {
    recipeId: "pesto-trapanese",
    ingredientId: "pesto",
    interaction: "PAINT",
  },
  // Expansion Batch 1: baba-ganoush's olive-oil reuses vongole's own PAINT_TEMPORARY sauce-slot mapping (not a
  // NO_SAUCE Technique); the other two use the standard tomato PAINT.
  "baba-ganoush-pizza": {
    recipeId: "baba-ganoush-pizza",
    ingredientId: "olive-oil",
    interaction: "PAINT_TEMPORARY",
  },
  "prosciutto-funghi": {
    recipeId: "prosciutto-funghi",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "veggie-supreme-pizza": {
    recipeId: "veggie-supreme-pizza",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  // Expansion Batch 2: the standard PAINT mapping (tomato-sauce / pesto), no new sauce behaviour.
  "vegan-cashew-cheese-pizza": {
    recipeId: "vegan-cashew-cheese-pizza",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "calabresa-argentina": {
    recipeId: "calabresa-argentina",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "jamon-serrano-pizza": {
    recipeId: "jamon-serrano-pizza",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "rucola-e-grana": {
    recipeId: "rucola-e-grana",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "pesto-salmone": {
    recipeId: "pesto-salmone",
    ingredientId: "pesto",
    interaction: "PAINT",
  },
  // TQ-1D: the first no-sauce recipe. Not an olive-oil mapping (unlike vongole / pizza-bianca): it uses no sauce.
  aussie: null,
  // Expansion Batch 3: NO_SAUCE recipes (the existing TQ-1D `null` mapping, like aussie); no new sauce behaviour.
  "porchetta-pizza": null,
  "salsiccia-e-friarielli": null,
  "polish-kielbasa": null,
  "palmito-pizza": null,
  "full-english-pizza": null,
  bacalhau: null,
  "tsukimi-pizza": null,
} as const satisfies Readonly<Record<RecipeId, RecipeSauceProfile | null>>;

/** The recipes made without a spread sauce (their profile is `null`): derived from the table above. */
export type NoSauceRecipeId = { [K in RecipeId]: (typeof RECIPE_SAUCE_PROFILES)[K] extends null ? K : never }[RecipeId];

export function getRecipeSauceProfile(recipeId: RecipeId): RecipeSauceProfile | null {
  return RECIPE_SAUCE_PROFILES[recipeId];
}

/** The NO_SAUCE recipe ids, derived from the sauce-profile authority (every `null` entry). */
export function noSauceRecipeIds(): readonly NoSauceRecipeId[] {
  return (Object.keys(RECIPE_SAUCE_PROFILES) as RecipeId[]).filter((id): id is NoSauceRecipeId => RECIPE_SAUCE_PROFILES[id] === null);
}
