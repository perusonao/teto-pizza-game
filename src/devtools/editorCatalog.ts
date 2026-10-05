import { DISCOVERY_LADDER, type DiscoveryLadder } from "../data/discoveryLadder";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { countsTowardLadder, RECIPES } from "../data/recipes";
import { KNOWN_TECHNIQUE_IDS } from "../data/techniques";
import { initialTechniqueLedger } from "../logic/techniques/runtime";
import type { DexState } from "../state/dex";

/**
 * DEV State Editor (Issue #403) S1: the catalog the editor and its presets are derived from.
 *
 * Nothing in ./presets.ts or ./stateModel.ts names a recipe or ingredient count, or a recipe / ingredient id
 * of the shipped game: they read this interface. `productionCatalog()` is the real authority (RECIPES,
 * INGREDIENTS, STARTER_INGREDIENT_IDS, DISCOVERY_LADDER, the technique registry); a test passes a synthetic
 * 172-recipe catalog to prove the builders scale (OD-8). The catalog is only ever read.
 */
export interface CatalogRecipe {
  id: string;
  /** Display name (DEV UI only). Absent in a synthetic catalog: the id is shown instead. */
  nameJa?: string;
  requiredIngredients: readonly { ingredientId: string }[];
  ladderCredit?: false;
}

export interface CatalogIngredient {
  id: string;
  /** Display name (DEV UI only). Absent in a synthetic catalog: the id is shown instead. */
  nameJa?: string;
  /** Present = a finite (purchasable, stocked) material; absent = a starter. */
  unlockCondition?: unknown;
}

export interface EditorCatalog {
  recipes: readonly CatalogRecipe[];
  ingredients: readonly CatalogIngredient[];
  starterIds: readonly string[];
  ladder: DiscoveryLadder;
  techniqueIds: readonly string[];
  countsTowardLadder: (recipeId: string) => boolean;
  /** The technique ledger a save with this Dex must carry (INV-TQ-1: a discovered recipe's technique is known). */
  techniqueLedgerFor: (saved: readonly string[], dex: DexState) => string[];
}

export function productionCatalog(): EditorCatalog {
  return {
    recipes: RECIPES,
    ingredients: INGREDIENTS,
    starterIds: STARTER_INGREDIENT_IDS,
    ladder: DISCOVERY_LADDER,
    techniqueIds: KNOWN_TECHNIQUE_IDS,
    countsTowardLadder,
    techniqueLedgerFor: (saved, dex) => initialTechniqueLedger(saved, dex),
  };
}

export function finiteIngredientIds(catalog: EditorCatalog): string[] {
  return catalog.ingredients.filter((i) => i.unlockCondition !== undefined).map((i) => i.id);
}

/** The recipe a player can make from the starters alone (the onboarding recipe): the first one in catalog order. */
export function onboardingRecipeId(catalog: EditorCatalog): string | null {
  const starters = new Set(catalog.starterIds);
  return catalog.recipes.find((r) => r.requiredIngredients.every((q) => starters.has(q.ingredientId)))?.id ?? null;
}
