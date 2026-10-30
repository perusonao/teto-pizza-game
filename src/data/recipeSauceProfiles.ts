import { isInactiveLateRecipeId } from "./lateCatalog";
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
  ingredientId: "tomato-sauce" | "pesto" | "olive-oil" | "fromage-blanc-sauce" | "doubanjiang" | "yuzu-kosho" | "miso-sauce" | "tahini" | "curry-ketchup" | "mustard" | "bbq-sauce" | "soy-sauce" | "fresh-cream-sauce";
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
  // Expansion Batch 4. pizza-feta-eliniki's olive-oil is its OWN sauce-slot mapping (PAINT_TEMPORARY, like pizza-bianca / vongole), not a general rule.
  "pizza-feta-eliniki": {
    recipeId: "pizza-feta-eliniki",
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
  bacalhau: null,
  "full-english-pizza": null,
  "palmito-pizza": null,
  "polish-kielbasa": null,
  "porchetta-pizza": null,
  "salsiccia-e-friarielli": null,
  // Expansion Batch 4: NO_SAUCE (the existing `null` mapping); pizza-feta-eliniki is NOT NO_SAUCE: it keeps olive-oil (its own existing PAINT_TEMPORARY slot mapping, like pizza-bianca / vongole).
  "brazilian-catupiry-corn-pizza": null,
  "jalapeno-popper-pizza": null,
  "pizza-moscow": null,
  // Expansion Batch 5: single-sauce recipes, no new sauce behaviour. pizza-bianca-ricotta's olive-oil is its OWN existing sauce-slot mapping (PAINT_TEMPORARY, like pizza-bianca / vongole / pizza-feta-eliniki); pizza-overload uses tomato-sauce (PAINT).
  "pizza-bianca-ricotta": {
    recipeId: "pizza-bianca-ricotta",
    ingredientId: "olive-oil",
    // TODO: olive-oil -> DRIZZLE candidate.
    interaction: "PAINT_TEMPORARY",
  },
  "pizza-overload": {
    recipeId: "pizza-overload",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  // Batch 6 PR-2: NO_SAUCE (cheese base, no spread sauce; the existing TQ-1D mechanic).
  "california-style-pizza": null,
  "spinach-artichoke-pizza": null,
  // Batch 7a: eggplant-ricotta-pizza's olive-oil is its OWN sauce-slot mapping (PAINT_TEMPORARY, like pizza-bianca-ricotta / pizza-feta-eliniki); new-zealand-lamb-pizza is NO_SAUCE (the existing `null` mapping).
  "eggplant-ricotta-pizza": {
    recipeId: "eggplant-ricotta-pizza",
    ingredientId: "olive-oil",
    interaction: "PAINT_TEMPORARY",
  },
  "new-zealand-lamb-pizza": null,
  // Batch 8a: NO_SAUCE (cheese base, no spread sauce; the existing TQ-1D mechanic).
  "chilean-napolitana": null,
  "spanish-chorizo-pizza": null,
  "frango-catupiry": null,
  // Batch 8b: NO_SAUCE (cheese base, no spread sauce; the existing TQ-1D mechanic).
  "shirasu-pizza": null,
  // New Sauces Phase A (#578): the first recipe of a new sauce; the existing PAINT gesture, no new interaction.
  flammkuchen: {
    recipeId: "flammkuchen",
    ingredientId: "fromage-blanc-sauce",
    interaction: "PAINT",
  },
  // New Sauces Phase B-1 (#578): the second new sauce; the existing PAINT gesture, no new interaction.
  "sichuan-eggplant-pizza": {
    recipeId: "sichuan-eggplant-pizza",
    ingredientId: "doubanjiang",
    interaction: "PAINT",
  },
  // Expansion Batch 10 PR-1: the existing PAINT gesture, no new interaction. rendang / tandoori-paneer use curry-ketchup as a GAMEPLAY ASSUMPTION (D-B3).
  "curry-pizza-japan": {
    recipeId: "curry-pizza-japan",
    ingredientId: "curry-ketchup",
    interaction: "PAINT",
  },
  "rendang-pizza": {
    recipeId: "rendang-pizza",
    ingredientId: "curry-ketchup",
    interaction: "PAINT",
  },
  currywurst: {
    recipeId: "currywurst",
    ingredientId: "curry-ketchup",
    interaction: "PAINT",
  },
  "tandoori-paneer-pizza": {
    recipeId: "tandoori-paneer-pizza",
    ingredientId: "curry-ketchup",
    interaction: "PAINT",
  },
  "cuban-pizza": {
    recipeId: "cuban-pizza",
    ingredientId: "mustard",
    interaction: "PAINT",
  },
  // B11 S1 (PROVISIONAL SPEC, ORIGINAL NOT CONFIRMED; GAMEPLAY ASSUMPTION): boscaiola's olive-oil reuses vongole's own PAINT_TEMPORARY sauce-slot mapping (not a general rule); pescatore uses tomato-sauce only (the olive-oil of the source ingredient set is omitted by Owner decision, a single sauce);
  // porcini-pizza is NO_SAUCE (the existing `null` mapping, like aussie).
  boscaiola: {
    recipeId: "boscaiola",
    ingredientId: "olive-oil",
    interaction: "PAINT_TEMPORARY",
  },
  "porcini-pizza": null,
  pescatore: {
    recipeId: "pescatore",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  // Expansion Batch 12 (PROVISIONAL SPEC, ORIGINAL NOT CONFIRMED; GAMEPLAY ASSUMPTION): both use the tomato-sauce PAINT like the other single-sauce tomato recipes.
  "supreme-pizza": {
    recipeId: "supreme-pizza",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "pizza-alla-norma": {
    recipeId: "pizza-alla-norma",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  // Multi-Sauce S3 / Square Dough E-2: the PRIMARY sauce only (tomato-sauce, the Reference target). The secondary olive-oil has no profile entry and is scored by presence (Design Lock §5.3).
  "grandma-pizza": {
    recipeId: "grandma-pizza",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  // FIN-E4b-ikura (#621, late catalog): NO_SAUCE.
  "ikura-salmon-pizza": null,
  // New Sauces Phase B U1 (late catalog): yuzu-kosho painted before the bake (PROVISIONAL, not confirmed by the original).
  "yuzu-shrimp-pizza": {
    recipeId: "yuzu-shrimp-pizza",
    ingredientId: "yuzu-kosho",
    interaction: "PAINT",
  },
  // New Sauces Phase B U2 (late catalog): miso-sauce painted before the bake (GAMEPLAY ASSUMPTION, not confirmed by the original).
  "eggplant-tahini-pizza": { recipeId: "eggplant-tahini-pizza", ingredientId: "tahini", interaction: "PAINT" },
  // BBQ Chicken (late catalog): bbq-sauce painted before the bake (GAMEPLAY ASSUMPTION, not confirmed by the original).
  "bbq-chicken-pizza": { recipeId: "bbq-chicken-pizza", ingredientId: "bbq-sauce", interaction: "PAINT" },
  // PR-2 late4 (late catalog): the sauces are painted before the bake (GAMEPLAY ASSUMPTION, not confirmed by the original).
  "wasabi-beef-pizza": { recipeId: "wasabi-beef-pizza", ingredientId: "soy-sauce", interaction: "PAINT" },
  "tarako-cream-pizza": { recipeId: "tarako-cream-pizza", ingredientId: "fresh-cream-sauce", interaction: "PAINT" },
  "eggplant-dengaku-pizza": {
    recipeId: "eggplant-dengaku-pizza",
    ingredientId: "miso-sauce",
    interaction: "PAINT",
  },
  // Pinsa Romana (#577 P3-b-1, late catalog; exists only while PINSA_PRODUCTION): same sauce as jamon-serrano-pizza.
  "pinsa-romana": {
    recipeId: "pinsa-romana",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
} as const satisfies Readonly<Record<RecipeId, RecipeSauceProfile | null>>;

/** The recipes made without a spread sauce (their profile is `null`): derived from the table above. */
export type NoSauceRecipeId = { [K in RecipeId]: (typeof RECIPE_SAUCE_PROFILES)[K] extends null ? K : never }[RecipeId];

export function getRecipeSauceProfile(recipeId: RecipeId): RecipeSauceProfile | null {
  return RECIPE_SAUCE_PROFILES[recipeId];
}

/** The NO_SAUCE recipe ids, derived from the sauce-profile authority (every `null` entry). */
export function noSauceRecipeIds(): readonly NoSauceRecipeId[] {
  // A late-catalog recipe has a row in every build (type-keyed) but exists only when that catalog is enabled.
  return (Object.keys(RECIPE_SAUCE_PROFILES) as RecipeId[]).filter((id): id is NoSauceRecipeId => RECIPE_SAUCE_PROFILES[id] === null && !isInactiveLateRecipeId(id));
}
