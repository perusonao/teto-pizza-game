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

/** Consumption bookkeeping across sauce switches (Issue #489 Phase 2, Owner Decision on PR #494). */
export interface SauceCarryState {
  /** `pizza.sauceToken` last seen (the reducer bumps it on every fresh application = sauce switch). */
  token: number;
  /** Sum of the canonical `sauceDeposits` last seen (the CURRENT sauce's committed usage). */
  total: number;
  /** Usage of every sauce already replaced by a switch. Never reset by a switch. */
  carried: number;
}

/**
 * COMMIT_SAUCE_DISPENSE replaces `sauceDeposits` with the new sauce's batch on a switch, so a sauce's
 * usage would vanish from the canonical deposits. This keeps it: when the token advances with deposits
 * present, the previously seen total is added to `carried`. Emptied deposits (RESET / a fresh pizza)
 * clear it. The dispense cap and the gauge both read `total + carried`, so they can never disagree.
 */
export function advanceSauceCarry(prev: SauceCarryState, token: number, total: number, depositCount: number): SauceCarryState {
  if (prev.token === token && prev.total === total) return prev;
  if (depositCount === 0) return { token, total, carried: 0 };
  const freshApplication = token > prev.token;
  return { token, total, carried: prev.carried + (freshApplication ? prev.total : 0) };
}
