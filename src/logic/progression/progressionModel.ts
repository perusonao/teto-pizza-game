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
 * - `SHOP_PROGRESSION` is a Phase 1a placeholder: it returns the legacy outputs under the id `"shop"`. The shop rules
 *   (reputation, `MENU_CATALOG`) arrive in Phase 1b / 2a; until then selecting it (Preview / DEV only) changes nothing.
 *
 * Phase 1a adds no state: `ProgressionInputs` has no `shop` field yet (Phase 1b adds `ShopProgressState`).
 */
import type { Recipe, RecipeId } from "../../data/recipes";
import { discoveredRecipeIds, type DexState } from "../../state/dex";
import type { InventoryState } from "../../state/inventory";
import {
  creditedDiscoveredCount,
  ingredientUnlockStep,
  resolveShopEntitlement,
  type ShopEntitlementResult,
} from "../../state/materialEntitlement";
import { legacyRecipeChapter } from "../../state/recipeChapters";
import { PROGRESSION_MODEL_ID, type ProgressionModelId } from "./progressionModelFlag";

export interface ProgressionInputs {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  unlockedForShopIngredientIds: readonly string[];
  inventory: InventoryState;
}

/**
 * What the technique affordance can supply today (its callers hold only the Dex). Phase 1b / 2a widen this when the shop
 * rule needs more (e.g. reputation); the legacy rule reads the Dex only.
 */
export type MaterialReachInputs = Pick<ProgressionInputs, "dex">;

export interface ProgressionModel {
  id: ProgressionModelId;
  /** The material Shop entitlement (a union: never re-locks). Replaces direct `resolveShopEntitlement` calls. */
  resolveEntitlement(inputs: ProgressionInputs): ShopEntitlementResult;
  /** A recipe's chapter number (1-based). */
  chapterOf(recipe: Recipe): number;
  /** Whether a chapter is open (legacy: always; chapters are only a display partition there). */
  isChapterOpen(chapter: number, inputs: ProgressionInputs): boolean;
  /** The recipes orders / guided rounds / Lunch Rush / Dinner may use (the "menu"). No caller is switched in Phase 1a. */
  menuRecipeIds(inputs: ProgressionInputs): readonly RecipeId[];
  /** For the technique affordance: whether this material has been reached. */
  isMaterialReached(ingredientId: string, inputs: MaterialReachInputs): boolean;
}

export const LEGACY_PROGRESSION: ProgressionModel = {
  id: "legacy",
  resolveEntitlement: (inputs) =>
    resolveShopEntitlement(inputs.dex, inputs.ownedIngredientIds, inputs.unlockedForShopIngredientIds),
  chapterOf: (recipe) => legacyRecipeChapter(recipe),
  isChapterOpen: () => true,
  menuRecipeIds: (inputs) => discoveredRecipeIds(inputs.dex) as RecipeId[],
  // The technique affordance's legacy rule: the material's ladder step (0 for a starter, null when no step sells it)
  // is at or below the credited discovered count (OD-TQ1D-2).
  isMaterialReached: (ingredientId, inputs) => {
    const step = ingredientUnlockStep(ingredientId);
    return step !== null && creditedDiscoveredCount(inputs.dex) >= step;
  },
};

/** Phase 1a placeholder (see the header): the legacy outputs under the id `"shop"`. Implemented in Phase 2a. */
export const SHOP_PROGRESSION: ProgressionModel = { ...LEGACY_PROGRESSION, id: "shop" };

export function progressionModelFor(id: ProgressionModelId): ProgressionModel {
  return id === "shop" ? SHOP_PROGRESSION : LEGACY_PROGRESSION;
}

/** The model this page load uses (the flag; Production: legacy). */
export function activeProgressionModel(): ProgressionModel {
  return progressionModelFor(PROGRESSION_MODEL_ID);
}
