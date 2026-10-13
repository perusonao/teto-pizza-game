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
  // Sanitize each total on its own so an invalid (negative / non-finite) one can never cancel
  // legitimate usage carried by the other.
  const clean = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
  const remaining = 1 - (clean(committedTotal) + clean(pendingTotal)) / SAUCE_MAX_QUANTITY;
  return Math.min(1, Math.max(0, remaining));
}
