/**
 * Cooking Steam Phase 1 (Issue #726), S1: when the "♨ 蒸す" pill is offered (pure). The reducer guard (a later slice) is the real backstop; this only decides
 * whether the UI shows the pill / the "✓ 蒸し済み" mark. It reads the selected ingredient id and the round's own state, never the recipe or a target, so it
 * cannot hint at one. Same kind of inputs as the other treatments' offers, plus the ingredients already steamed this round.
 */
import { canSteamIngredient } from "../../data/steamIngredients";
import type { RoundKind } from "../../state/roundKind";

export interface SteamOfferInput {
  enabled: boolean;
  phase: string;
  makingStep: string;
  roundKind: RoundKind;
  /** The stage accepts input right now (not paused, no overlay, no pending abandon). */
  active: boolean;
  selectedIngredientId: string | null;
  ownedIngredientIds: readonly string[];
  /** Ingredient ids already steamed this round (the keys of the kept looks). */
  steamedIngredientIds: readonly string[];
}

export interface SteamOffer {
  ingredientId: string;
  /** Already steamed this round: show the mark, not the pill. */
  done: boolean;
}

export function steamOffer(input: SteamOfferInput): SteamOffer | null {
  if (!input.enabled || !input.active) return null;
  if (input.phase !== "PREPARE" || input.makingStep !== "TOPPING") return null;
  // Lunch Rush (ranking fairness) and Dinner (no fixed recipe until START_BAKE) never offer it.
  if (input.roundKind !== "GUIDED" && input.roundKind !== "FREE_COOK") return null;
  const id = input.selectedIngredientId;
  if (id === null || !canSteamIngredient(id) || !input.ownedIngredientIds.includes(id)) return null;
  return { ingredientId: id, done: input.steamedIngredientIds.includes(id) };
}
