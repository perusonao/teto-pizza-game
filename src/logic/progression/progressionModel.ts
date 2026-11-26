/**
 * B案再構成 Phase 1a (Issue #901): the progression port. Design:
 * docs/design/TETO_SHOP-GROWTH-RESTRUCTURE_PHASE0-1_DESIGN_2026-11-25.md §3.2.2.
 *
 * Every progression derivation (material entitlement, chapters, the menu, the technique affordance's "material reached")
 * goes through one `ProgressionModel`, so the reducer branches nowhere and the model is switched by one flag
 * (./progressionModelFlag.ts).
 *
 * - `LEGACY_PROGRESSION` only delegates to the existing functions. It writes no new logic, so its outputs are the current
 *   ones (pinned by ./progressionModel.legacyEquivalence.test.ts and ../../state/gameReducer.progressionFlagOff.test.ts).
 * - `SHOP_PROGRESSION` (Phase 2a) is the shop model: chapters from the reputation, materials from the chapters, the menu
 *   from the first menu / grants / Dex (./shopProgression.ts). Selectable on Preview / DEV only (`?progression=shop`); it
 *   runs only while the reputation table is complete (R8), else the legacy model stands in.
 *
 * Phase 1b (Issue #901) adds `ProgressionInputs.shop` (./shopProgress.ts). The legacy model never reads it, so every legacy
 * output is unchanged; the reducer passes it automatically (`{ ...state, dex }`), startup passes `save.shopProgress`.
 */
import { RECIPES, type Recipe, type RecipeId } from "../../data/recipes";
import { discoveredRecipeIds, isDiscovered, type DexState } from "../../state/dex";
import type { InventoryState } from "../../state/inventory";
import {
  creditedDiscoveredCount,
  ingredientUnlockStep,
  resolveShopEntitlement,
  type ShopEntitlementResult,
} from "../../state/materialEntitlement";
import { legacyRecipeChapter } from "../../state/recipeChapters";
import { PROGRESSION_MODEL_ID, type ProgressionModelId } from "./progressionModelFlag";
import { REPUTATION_TABLE, isReputationTableComplete, type CompleteReputationTable } from "./reputationTable";
import { EMPTY_SHOP_PROGRESS, type ShopProgressState } from "./shopProgress";
import {
  activeShopCatalog,
  catalogChapterOf,
  catalogRecipes,
  chapterForReputation,
  isMaterialOpenAt,
  isOnShopMenu,
  resolveShopModelEntitlement,
  shopMenuRecipeIds,
} from "./shopProgression";

export interface ProgressionInputs {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  unlockedForShopIngredientIds: readonly string[];
  inventory: InventoryState;
  /** Phase 1b: the shop model's state (reputation, granted menu recipes, seed). The legacy model does not read it. */
  shop: ShopProgressState;
}

/**
 * What the technique affordance can supply: the Dex, plus (Phase 2a) the shop state. The legacy rule reads the Dex only; the
 * shop rule reads the reputation (a material is reached once its chapter is open). `shop` is optional so a caller that holds
 * only the Dex keeps compiling; without it the shop rule reads the default state (reputation 0).
 */
export interface MaterialReachInputs {
  dex: DexState;
  shop?: ShopProgressState;
}

/** What the menu is derived from (a `GameState` satisfies it). `shop` is optional like in `MaterialReachInputs`. */
export interface MenuInputs {
  dex: DexState;
  shop?: ShopProgressState;
}

export interface ProgressionModel {
  id: ProgressionModelId;
  /** The material Shop entitlement (a union: never re-locks). Replaces direct `resolveShopEntitlement` calls. */
  resolveEntitlement(inputs: ProgressionInputs): ShopEntitlementResult;
  /** A recipe's chapter number (1-based). */
  chapterOf(recipe: Recipe): number;
  /** Whether a chapter is open (legacy: always; chapters are only a display partition there). */
  isChapterOpen(chapter: number, inputs: ProgressionInputs): boolean;
  /** The recipes orders / guided rounds / Lunch Rush may use (the "menu"), in `RECIPES` order. */
  menuRecipeIds(inputs: MenuInputs): readonly RecipeId[];
  /** Whether one recipe is on the menu (the same rule as `menuRecipeIds`). */
  isOnMenu(recipeId: string, inputs: MenuInputs): boolean;
  /** For the technique affordance: whether this material has been reached. */
  isMaterialReached(ingredientId: string, inputs: MaterialReachInputs): boolean;
  /**
   * Phase 3a: the recipes the Dex, HOME's Dex pill and Pizza Select list and count, in `RECIPES` order. Legacy: `RECIPES`
   * itself (the same array). Shop: the adopted recipes (`MENU_CATALOG`).
   */
  catalogRecipes(): readonly Recipe[];
}

export const LEGACY_PROGRESSION: ProgressionModel = {
  id: "legacy",
  resolveEntitlement: (inputs) =>
    resolveShopEntitlement(inputs.dex, inputs.ownedIngredientIds, inputs.unlockedForShopIngredientIds),
  chapterOf: (recipe) => legacyRecipeChapter(recipe),
  isChapterOpen: () => true,
  menuRecipeIds: (inputs) => discoveredRecipeIds(inputs.dex) as RecipeId[],
  isOnMenu: (recipeId, inputs) => isDiscovered(inputs.dex, recipeId),
  // The technique affordance's legacy rule: the material's ladder step (0 for a starter, null when no step sells it)
  // is at or below the credited discovered count (OD-TQ1D-2).
  isMaterialReached: (ingredientId, inputs) => {
    const step = ingredientUnlockStep(ingredientId);
    return step !== null && creditedDiscoveredCount(inputs.dex) >= step;
  },
  catalogRecipes: () => RECIPES,
};

/** The shop model bound to a complete table and the active catalog (./shopProgression.ts). */
export function shopProgressionFor(table: CompleteReputationTable): ProgressionModel {
  const shopOf = (inputs: { shop?: ShopProgressState }) => inputs.shop ?? EMPTY_SHOP_PROGRESS;
  let adopted: readonly Recipe[] | null = null;
  return {
    id: "shop",
    resolveEntitlement: (inputs) => resolveShopModelEntitlement(inputs, table, activeShopCatalog()),
    chapterOf: (recipe) => catalogChapterOf(recipe.id, activeShopCatalog()) ?? legacyRecipeChapter(recipe),
    isChapterOpen: (chapter, inputs) => chapter <= chapterForReputation(shopOf(inputs).reputation, table.chapterFloors),
    menuRecipeIds: (inputs) => shopMenuRecipeIds({ dex: inputs.dex, shop: shopOf(inputs) }, activeShopCatalog()),
    isOnMenu: (recipeId, inputs) => isOnShopMenu(recipeId, { dex: inputs.dex, shop: shopOf(inputs) }, activeShopCatalog()),
    isMaterialReached: (ingredientId, inputs) =>
      isMaterialOpenAt(ingredientId, shopOf(inputs).reputation, table, activeShopCatalog()),
    catalogRecipes: () => (adopted ??= Object.freeze([...catalogRecipes(activeShopCatalog())])),
  };
}

/**
 * The shop model. R8: while the production reputation table has a `null`, the shop rules cannot run on an unset number, so
 * this is the Phase 1a placeholder instead (the legacy outputs under the id `"shop"`). Phase 2a: the table holds the
 * Owner-approved values, so this is the shop model.
 */
export const SHOP_PROGRESSION: ProgressionModel = isReputationTableComplete(REPUTATION_TABLE)
  ? shopProgressionFor(REPUTATION_TABLE)
  : { ...LEGACY_PROGRESSION, id: "shop" };

/** The production table when complete (the reducer reads the reputation gains through it), else `null`. */
export function completeReputationTable(): CompleteReputationTable | null {
  return isReputationTableComplete(REPUTATION_TABLE) ? REPUTATION_TABLE : null;
}

export function progressionModelFor(id: ProgressionModelId): ProgressionModel {
  return id === "shop" ? SHOP_PROGRESSION : LEGACY_PROGRESSION;
}

/** The model this page load uses (the flag; Production: legacy). */
export function activeProgressionModel(): ProgressionModel {
  return progressionModelFor(PROGRESSION_MODEL_ID);
}
