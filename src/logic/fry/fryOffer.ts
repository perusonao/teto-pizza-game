/**
 * Cooking Fry Phase 1 (Issue #749), F1: when the "揚げる" pill is offered (pure). The reducer guard (a later, separately approved slice) is the real backstop;
 * this only decides whether the UI shows the pill / the "✓ 揚げ済み" mark. It reads the selected ingredient id and the round's own state, never the recipe or a
 * target, so it cannot hint at one.
 */
import { canFryIngredient } from "../../data/fryIngredients";
import type { RoundKind } from "../../state/roundKind";

export interface FryOfferInput {
  enabled: boolean;
  phase: string;
  makingStep: string;
  roundKind: RoundKind;
  /** The stage accepts input right now (not paused, no overlay, no pending abandon). */
  active: boolean;
  selectedIngredientId: string | null;
  ownedIngredientIds: readonly string[];
  /** Ingredient ids already fried this round (the keys of the kept looks). */
  friedIngredientIds: readonly string[];
  /** Test seam (what the catalog says about the dedicated drawing); production callers leave it out. */
  pieceVisualOf?: (id: string) => string | undefined;
}

export interface FryOffer {
  ingredientId: string;
  /** Already fried this round: show the mark, not the pill. */
  done: boolean;
}

export function fryOffer(input: FryOfferInput): FryOffer | null {
  if (!input.enabled || !input.active) return null;
  if (input.phase !== "PREPARE" || input.makingStep !== "TOPPING") return null;
  // Lunch Rush (ranking fairness) and Dinner (no fixed recipe until START_BAKE) never offer it.
  if (input.roundKind !== "GUIDED" && input.roundKind !== "FREE_COOK") return null;
  const id = input.selectedIngredientId;
  if (id === null || !canFryIngredient(id, input.pieceVisualOf) || !input.ownedIngredientIds.includes(id)) return null;
  return { ingredientId: id, done: input.friedIngredientIds.includes(id) };
}
