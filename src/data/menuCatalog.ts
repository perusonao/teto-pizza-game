/**
 * B案再構成 Phase 1b (Issue #901): the curated menu catalog (the adopted recipe set). Design §3.2.4 / §6 Q4 / Q10 / Q12.
 *
 * - Recipes are never removed from `RECIPES`; adoption is this list. A recipe not listed here stays in `RECIPES`,
 *   `ORDERS`, the matcher and the Dex, and is simply not part of the shop model's menu, chapters or counts.
 * - Each entry names its chapter explicitly (1..5, Q12). A material's chapter is derived: the lowest chapter of an adopted
 *   recipe that uses it, unless `MATERIAL_CHAPTER_OVERRIDES` says otherwise.
 * - Phase 1b ships it EMPTY: the selection of the 60 recipes and their chapters is the Owner's (Phase 3). Re-issue
 *   `MENU_CATALOG_ID` whenever the list changes (the same idea as the ladder's population id).
 */
import type { RecipeId } from "./recipes";

export interface MenuCatalogEntry {
  recipeId: RecipeId;
  /** 1-based chapter (1..5). */
  chapter: number;
}

export const MENU_CATALOG_ID = "curated-60-v1";

/** The adopted recipes. Empty until the Owner's selection lands (Phase 3). */
export const MENU_CATALOG: readonly MenuCatalogEntry[] = [];

/** Exceptions to the derived material chapter (ingredient id -> chapter). Empty until Phase 3. */
export const MATERIAL_CHAPTER_OVERRIDES: Readonly<Record<string, number>> = {};
