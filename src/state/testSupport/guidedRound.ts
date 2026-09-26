/**
 * Progression 2.0 W1 Discovery 2.0 (W1-a2 STEP A): test-only fixtures for the guided-round
 * contract. A guided (recipe-first, reference-shown) round starts only from a DISCOVERED recipe
 * that is cookable right now (`canStartGuidedRound`, ../recipeDiscoveryState.ts). Tests that used
 * the Dex-0 initial ORDER (an undiscovered margherita) as a generic cooking fixture seed the
 * recipe as discovered and cookable here instead.
 */
import { getIngredient, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { getRecipe, type RecipeId } from "../../data/recipes";
import { findOrderForRecipe } from "../../data/orders";
import { getCookingProfile } from "../../data/cookingProfiles";
import { createCutState } from "../../logic/cut/state";
import { createInitialGameState, gameReducer, type GameState } from "../gameReducer";
import type { DexEntry, DexState } from "../dex";
import type { InventoryState } from "../inventory";

/** A discovered Dex entry with no BEST yet (★1 / 0 points, never made) -- the weakest possible
 *  record, so a test's first round still sets a new BEST exactly as before. */
export function discoveredEntry(recipeId: string): DexEntry {
  return { recipeId, discovered: true, bestScore: 0, bestStars: 1, timesMade: 0 };
}

export function discoveredDex(recipeIds: readonly string[], base: DexState = []): DexState {
  const known = new Set(base.map((e) => e.recipeId));
  return [...base, ...recipeIds.filter((id) => !known.has(id)).map(discoveredEntry)];
}

export interface GuidedFixtureOptions {
  /** Extra Dex entries (the recipe itself is always added as discovered). */
  dex?: DexState;
  ownedIngredientIds?: readonly string[];
  inventory?: InventoryState;
  pitzBalance?: number;
  unlockedForShopIngredientIds?: readonly string[];
}

/** An ORDER-phase FREE round for `recipeId`, discovered and fully cookable (every finite
 *  required ingredient owned with 99 in stock unless `inventory` says otherwise). */
export function createGuidedInitialState(
  recipeId: RecipeId = "margherita",
  options: GuidedFixtureOptions = {},
): GameState {
  const recipe = getRecipe(recipeId);
  if (!recipe) throw new Error(`unknown recipe ${recipeId}`);
  const finite = recipe.requiredIngredients
    .map((q) => q.ingredientId)
    .filter((id) => !!getIngredient(id)?.unlockCondition);
  const owned = [...new Set([...STARTER_INGREDIENT_IDS, ...finite, ...(options.ownedIngredientIds ?? [])])];
  const inventory = options.inventory ?? Object.fromEntries(finite.map((id) => [id, 99]));
  const dex = discoveredDex([recipeId], options.dex ?? []);
  const state = createInitialGameState(
    dex,
    owned,
    options.pitzBalance ?? 0,
    inventory,
    [],
    options.unlockedForShopIngredientIds ?? [],
  );
  if (state.recipe.id === recipeId && !state.freeCook) return state;
  // The initial pick is margherita-first; re-target the fresh ORDER round to `recipeId` exactly
  // as `buildOrderState` would have built it.
  const order = findOrderForRecipe(recipeId);
  if (!order) throw new Error(`no order for ${recipeId}`);
  const cookingProfile = getCookingProfile(recipeId);
  return { ...state, recipe, order, cookingProfile, cutState: createCutState(cookingProfile.cutConfig), freeCook: false };
}

/** The same round advanced to PREPARE (`BEGIN_PREPARE`). */
export function startGuidedPrepare(
  recipeId: RecipeId = "margherita",
  options: GuidedFixtureOptions = {},
  now?: number,
): GameState {
  return gameReducer(createGuidedInitialState(recipeId, options), { type: "BEGIN_PREPARE", now });
}
