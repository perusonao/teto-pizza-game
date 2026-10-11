import type { CompletionPolicy } from "../logic/completionGate";

/**
 * Dinner Mission DM-2 (Issue #239): the explicit round authority. Every round `buildOrderState`
 * (./gameReducer.ts) creates carries exactly one kind, set once when the round starts:
 *
 * - `GUIDED`:     a recipe-first round from Pizza Select / FREE orders / retry.
 * - `FREE_COOK`:  a Free Cooking (discovery) round.
 * - `LUNCH_RUSH`: a Lunch Rush order.
 * - `DINNER`:     a Dinner Mission target, or the Dinner target-selection round between targets.
 *
 * The older booleans stay for the Lunch Rush / Free Cooking code that already reads them, and are
 * pinned to agree with this field (`isMissionRound` <=> LUNCH_RUSH, `freeCook` <=> FREE_COOK). New
 * code decides by these predicates, never by `isMissionRound` -- Dinner in particular is not a
 * Lunch Rush round and must not inherit any of its branches.
 */
export type RoundKind = "GUIDED" | "FREE_COOK" | "LUNCH_RUSH" | "DINNER";

export interface HasRoundKind {
  roundKind: RoundKind;
}

export function isDinnerRound(state: HasRoundKind): boolean {
  return state.roundKind === "DINNER";
}

export function isLunchRushRound(state: HasRoundKind): boolean {
  return state.roundKind === "LUNCH_RUSH";
}

/**
 * Issue #476 (S1): tray drag-and-drop of a piece is on for Guided, Free Cooking (Research is a Free Cooking round) and
 * Dinner, and stays off in Lunch Rush (the Owner's UD-A line, the same one the 1つ戻す button draws). Round authority
 * only: it does not read the recipe, so it cannot depend on whether a Reference exists.
 */
export function allowsPieceDragInRound(state: HasRoundKind): boolean {
  return !isLunchRushRound(state);
}

export function isFreeCookingRound(state: HasRoundKind): boolean {
  return state.roundKind === "FREE_COOK";
}

export function isGuidedRound(state: HasRoundKind): boolean {
  return state.roundKind === "GUIDED";
}

/** Rounds that register to the Dex (and earn FREE Pitz) at RESULT through `REGISTER_TO_DEX`. */
export function registersToDexAtResult(state: HasRoundKind): boolean {
  return state.roundKind === "GUIDED" || state.roundKind === "FREE_COOK";
}

/**
 * Completion Gate policy: Lunch Rush orders and Dinner targets need the full ordered quantity
 * (`minCount`); guided and Free Cooking rounds complete with one piece of each ingredient.
 */
export function completionPolicyForRound(state: HasRoundKind): CompletionPolicy {
  return state.roundKind === "LUNCH_RUSH" || state.roundKind === "DINNER" ? "order" : "recipe";
}

/** The kind `buildOrderState`'s existing (isMissionRound, freeCook) arguments stand for. */
export function roundKindFor(isMissionRound: boolean, freeCook: boolean): RoundKind {
  if (isMissionRound) return "LUNCH_RUSH";
  return freeCook ? "FREE_COOK" : "GUIDED";
}
