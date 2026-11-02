/**
 * Cooking Sear Phase 1 (焼き目をつける・長押し炙り, Issue #724): the PURE target rule.
 *
 *   canSearIngredient(id) = id is on the sear target list  AND  that ingredient has a dedicated piece visual (`pieceVisual`)
 *
 * Same shape as ../data/prepIngredients.ts (the 炒める prep) but a separate list and a separate state: this never touches the prep. Derived from the
 * ingredient id alone, so whether the sear is offered can never hint at a target. Phase 1 targets sausage only (Owner 2026-11-02). Reads `ingredients.ts`
 * (a catalog hot file) and never changes it.
 */
import { getIngredient } from "./ingredients";

export const SEAR_TARGET_INGREDIENT_IDS: readonly string[] = ["sausage"];

export function canSearIngredient(ingredientId: string): boolean {
  if (!SEAR_TARGET_INGREDIENT_IDS.includes(ingredientId)) return false;
  return getIngredient(ingredientId)?.pieceVisual !== undefined;
}
