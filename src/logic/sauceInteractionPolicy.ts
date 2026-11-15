import { SAUCE_RATE_PER_TICK } from "./sauceQuantity";
import type { SauceDeposit } from "../state/pizzaState";

/**
 * T25 I-7 runtime gate. Yogurt sauce is a presence mark, not a second paint pass:
 * the existing dispenser may create its starter tick, then this cap closes the
 * session's headroom. Keeping the rule here lets the content train wire the
 * ingredient later without adding a second gesture family.
 */
export const PRESENCE_DAB_SAUCE_ID = "yogurt-sauce";
export const PRESENCE_DAB_QUANTITY = SAUCE_RATE_PER_TICK;

export function sauceQuantityCap(ingredientId: string): number {
  return ingredientId === PRESENCE_DAB_SAUCE_ID ? PRESENCE_DAB_QUANTITY : 1;
}

/** Canonical-boundary guard; UI/controller limits are never trusted alone. */
export function isAllowedSauceDepositBatch(
  ingredientId: string,
  alreadyUsed: number,
  deposits: readonly SauceDeposit[],
): boolean {
  if (ingredientId !== PRESENCE_DAB_SAUCE_ID) return true;
  return alreadyUsed === 0 && deposits.length === 1 && deposits[0].amount === PRESENCE_DAB_QUANTITY;
}
