/**
 * Large Catalog UX LC-R2 (pure, UNWIRED): who may ever see the hand (手元) + pantry (食材庫).
 *
 * Owner Decision OD-1: Large Catalog UX starts with FREE Cooking ONLY. Dinner keeps the current paged tray.
 * The eligibility authority is the explicit round kind -- `roundKind === "FREE_COOK"` (`isFreeCookingRound`)
 * AND `dinner === null` -- never `freeCook` alone and never the tray's `recipeFreeTray`
 * (`state.freeCook || state.dinner !== null`, which is true for Dinner). `dinner` must be exactly `null`
 * (an absent / unknown value fails closed). Guided, Lunch Rush and Dinner rounds are all ineligible.
 */
import { isFreeCookingRound, type HasRoundKind } from "../../state/roundKind";

export interface LargeCatalogRoundGate extends HasRoundKind {
  /** `GameState.dinner`: a Dinner session object, or `null` outside Dinner. */
  dinner: unknown;
}

export function isLargeCatalogEligible(round: LargeCatalogRoundGate): boolean {
  return isFreeCookingRound(round) && round.dinner === null;
}
