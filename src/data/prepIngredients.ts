/**
 * Cooking Prep Phase 1 (下ごしらえ「炒める」), PR-A S1: the PURE target rule. Spec: docs/design/TETO_COOKING-PREP_PHASE1_SPEC_2026-10-28.md §5.
 *
 *   canPrepIngredient(id) = id is on the prep target list  AND  that ingredient has a dedicated piece visual (`pieceVisual`)
 *
 * - Derived from the ingredient id alone and never stored: no recipe, target, round or mode is an input, so whether the prep is offered can
 *   never hint at a Research / Free Cooking target (AC-12). Round-kind and flag rules live in the reducer, not here.
 * - The `pieceVisual` clause is the dormancy guard: until an ingredient has its dedicated drawing, the prep cannot be offered for it.
 * - Phase 1 targets beef only. This module only READS `ingredients.ts` (a hot file owned by the catalog lanes) and never changes it.
 */
import { getIngredient } from "./ingredients";

/** Ingredient ids the prep applies to (Phase 1: beef, the 炒める step). */
export const PREP_TARGET_INGREDIENT_IDS: readonly string[] = ["beef"];

export function canPrepIngredient(ingredientId: string): boolean {
  if (!PREP_TARGET_INGREDIENT_IDS.includes(ingredientId)) return false;
  return getIngredient(ingredientId)?.pieceVisual !== undefined;
}
