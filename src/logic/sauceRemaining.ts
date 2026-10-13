import { SAUCE_MAX_QUANTITY } from "./sauceQuantity";

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
  const used = (Number.isFinite(committedTotal) ? committedTotal : 0) +
    (Number.isFinite(pendingTotal) ? pendingTotal : 0);
  const remaining = 1 - Math.max(0, used) / SAUCE_MAX_QUANTITY;
  return Math.min(1, Math.max(0, remaining));
}
