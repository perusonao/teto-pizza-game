/**
 * Cooking Steam Phase 1 (Issue #726), S1: the PURE target rule for 蒸す.
 *
 *   canSteamIngredient(id) = id is on the steam target list  AND  that ingredient has a dedicated piece visual (`pieceVisual`)
 *
 * Same shape as the other two cooking treatments' target rules, but its own list (and, in later slices, its own state). Derived from the ingredient id
 * alone -- no recipe, target, round or mode is an input -- so whether the steam is offered can never hint at a Research / Free Cooking target. Phase 1
 * targets clam and mussel only (Owner 2026-11-02). Reads `ingredients.ts` (a catalog hot file) and never changes it.
 */
import { getIngredient } from "./ingredients";

export const STEAM_TARGET_INGREDIENT_IDS: readonly string[] = ["clam", "mussel"];

export function canSteamIngredient(ingredientId: string): boolean {
  if (!STEAM_TARGET_INGREDIENT_IDS.includes(ingredientId)) return false;
  return getIngredient(ingredientId)?.pieceVisual !== undefined;
}
