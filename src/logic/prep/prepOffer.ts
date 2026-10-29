/**
 * Cooking Prep Phase 1 PR-B S4: when the "🍳 炒める" pill is offered (pure). The reducer's PREP_INGREDIENT guard (../../state/gameReducer.ts) is the real
 * backstop; this only decides whether the UI shows the pill / the "✓ 炒め済み" mark. It reads the selected ingredient id and the round's own
 * state, never the recipe or a target, so it cannot hint at one (AC-12).
 */
import { canPrepIngredient } from "../../data/prepIngredients";
import type { RoundKind } from "../../state/roundKind";

export const PREP_TOSSES = 3;
/** Taps closer together than this count once (iOS double-tap detection, double counting). */
export const PREP_TOSS_DEBOUNCE_MS = 120;
/** The "ジュッ！" moment before the pan screen closes by itself. */
export const PREP_DONE_MS = 700;
/** After the third toss the stage / dock ignore input for this long (AC-16 c; an initial design value, tuned in the iPhone HV). */
export const PREP_GUARD_MS = 300;

export interface PrepOfferInput {
  enabled: boolean;
  phase: string;
  makingStep: string;
  roundKind: RoundKind;
  /** The stage accepts input right now (not paused, no overlay, no pending abandon). */
  active: boolean;
  selectedIngredientId: string | null;
  ownedIngredientIds: readonly string[];
}

/** The ingredient the pill is about, or `null` when nothing is offered. */
export function prepOfferedIngredient(input: PrepOfferInput): string | null {
  if (!input.enabled || !input.active) return null;
  if (input.phase !== "PREPARE" || input.makingStep !== "TOPPING") return null;
  if (input.roundKind !== "GUIDED" && input.roundKind !== "FREE_COOK") return null;
  const id = input.selectedIngredientId;
  if (id === null || !canPrepIngredient(id) || !input.ownedIngredientIds.includes(id)) return null;
  return id;
}
