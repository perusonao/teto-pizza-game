/**
 * Cooking Fry Phase 1 (Issue #749), F1: the PURE target rule for 揚げる.
 *
 *   canFryIngredient(id) = id is on the fry target list  AND  that ingredient has a dedicated piece visual (`pieceVisual`)
 *
 * Same shape as the 炒める / 炙り / 蒸す target rules, but its own list (and, in later slices, its own state). Derived from the ingredient id alone -- no recipe,
 * target, round or mode is an input -- so whether the fry is offered can never hint at a Research / Free Cooking target. Phase 1 targets eggplant only (Owner
 * 2026-11-04; shrimp / hot-dog are out of scope).
 *
 * DORMANT BY DESIGN: eggplant has no dedicated drawing yet (emoji only), so the rule returns false for it today -- exactly the guard the other treatments use.
 * Giving eggplant a drawing is a separate Owner decision (it edits `ingredients.ts`, which Batch 18 / #748 holds); this file never edits the catalog.
 */
import { getIngredient } from "./ingredients";

export const FRY_TARGET_INGREDIENT_IDS: readonly string[] = ["eggplant"];

/** `pieceVisualOf` is a test seam (what the catalog says about the dedicated drawing); production callers pass only the id. */
export function canFryIngredient(ingredientId: string, pieceVisualOf: (id: string) => string | undefined = (id) => getIngredient(id)?.pieceVisual): boolean {
  if (!FRY_TARGET_INGREDIENT_IDS.includes(ingredientId)) return false;
  return pieceVisualOf(ingredientId) !== undefined;
}
