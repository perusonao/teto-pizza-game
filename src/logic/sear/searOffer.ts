/**
 * Cooking Sear Phase 1 (Issue #724): when the "🔥 炙る" pill is offered (pure). The reducer's SEAR_INGREDIENT guard is the real backstop; this only
 * decides whether the UI shows the pill / the "✓ 炙り済み" mark. It reads the selected ingredient id and the round's own state, never the recipe or a
 * target, so it cannot hint at one.
 */
import { canSearIngredient } from "../../data/searIngredients";
import type { RoundKind } from "../../state/roundKind";

/** After a hold is released the result words show this long before the sear screen closes by itself. */
export const SEAR_DONE_MS = 900;
/** After the player keeps the result the stage ignores input for this long (a late tap must not reach the dough). */
export const SEAR_GUARD_MS = 300;

export interface SearOfferInput {
  enabled: boolean;
  phase: string;
  makingStep: string;
  roundKind: RoundKind;
  /** The stage accepts input right now (not paused, no overlay, no pending abandon). */
  active: boolean;
  selectedIngredientId: string | null;
  ownedIngredientIds: readonly string[];
}

export function searOfferedIngredient(input: SearOfferInput): string | null {
  if (!input.enabled || !input.active) return null;
  if (input.phase !== "PREPARE" || input.makingStep !== "TOPPING") return null;
  if (input.roundKind !== "GUIDED" && input.roundKind !== "FREE_COOK") return null;
  const id = input.selectedIngredientId;
  if (id === null || !canSearIngredient(id) || !input.ownedIngredientIds.includes(id)) return null;
  return id;
}
