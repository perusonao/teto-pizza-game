import { sauceHeadroom, sauceUsedByKind, sauceUsedTotal, type SauceLedgerPizza } from "../state/sauceLedger";
import { SAUCE_CAP_EPSILON, SAUCE_MAX_QUANTITY, SAUCE_TOTAL_MAX_QUANTITY } from "./sauceQuantity";

/**
 * Issue #489 (Sauce Remaining Gauge, stage 1): how much sauce can still be dispensed in the
 * current sauce application, as a fraction in [0, 1].
 *
 * `committedTotal + pendingTotal` is exactly what the dispense controller clamps against
 * (PizzaStage's `getTotalDispensed`), so the gauge can never disagree with the real cap. The
 * value is derived, read-only and unit-less: it is not inventory, coverage or score, and
 * switching the sauce type does not reset it (consumption is never reset here).
 */
export function sauceRemainingFraction(committedTotal: number, pendingTotal: number): number {
  // Sanitize each total on its own so an invalid (negative / non-finite) one can never cancel
  // legitimate usage carried by the other.
  const clean = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
  const remaining = 1 - (clean(committedTotal) + clean(pendingTotal)) / SAUCE_MAX_QUANTITY;
  return Math.min(1, Math.max(0, remaining));
}

/**
 * Sauce B3: what the gauge treats as already "used" for `ingredientId` -- the part of the one-bottle scale that the
 * binding cap (the kind's own 100% or the pizza-wide total, see `sauceHeadroom`) has already taken. Paired with the
 * in-progress stroke in `sauceRemainingFraction`, the gauge shows exactly the dispenser's headroom / `SAUCE_MAX_QUANTITY`.
 */
export function sauceGaugeUsed(pizza: SauceLedgerPizza, ingredientId: string): number {
  return SAUCE_MAX_QUANTITY - sauceHeadroom(pizza, ingredientId, 0);
}

export interface SauceGaugeDetail {
  /** What the dispenser can still give right now, as a fraction of one bottle in [0, 1] -- exactly `sauceHeadroom / SAUCE_MAX_QUANTITY`. */
  usable: number;
  /** The part of the kind's OWN remaining bottle that the pizza-wide cap (provisional 200%) keeps from being used; 0 unless that cap binds. */
  capBlocked: number;
}

/**
 * Sauce B3 (Owner Decision on PR #494): the gauge's two numbers for `ingredientId`. `usable` is the dispenser's headroom (the kind's own
 * 100% and the pizza-wide cap, whichever is smaller), the stroke in progress (`pending`) counted against both. `capBlocked` is how much
 * of the kind's own bottle is still full but cannot be used because the pizza-wide cap got there first -- so "this sauce is empty" (usable 0,
 * capBlocked 0) can be told apart from "the pizza has reached its total limit" (usable 0, capBlocked > 0). With one or two sauce kinds
 * the cap (2.0) cannot bind before the kinds' own 100%, so capBlocked is only ever non-zero from the third kind on.
 */
export function sauceGaugeDetail(pizza: SauceLedgerPizza, ingredientId: string, pending = 0): SauceGaugeDetail {
  const clean = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
  const kindLeft = Math.max(0, SAUCE_MAX_QUANTITY - ((sauceUsedByKind(pizza)[ingredientId] ?? 0) + clean(pending)));
  const totalLeft = Math.max(0, SAUCE_TOTAL_MAX_QUANTITY - (sauceUsedTotal(pizza) + clean(pending)));
  const usable = Math.min(kindLeft, totalLeft);
  const blocked = kindLeft - usable > SAUCE_CAP_EPSILON ? kindLeft - usable : 0;
  return { usable: Math.min(1, usable / SAUCE_MAX_QUANTITY), capBlocked: Math.min(1, blocked / SAUCE_MAX_QUANTITY) };
}
