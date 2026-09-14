/**
 * Phase 4A-1A: Tomato Sauce dispense model for the Margherita Reference prototype.
 *
 * The whole point of this module is "how much sauce comes out while the player holds
 * pointerdown" -- and specifically, that the answer depends on *wall-clock hold time*
 * only, never on how many pointer events fired during that hold. A 120Hz screen firing
 * 4x as many pointermove events over the same 1-second hold as a 30Hz one must produce
 * the exact same quantity. See sauceDispenseController.ts, which is the only caller of
 * `stepDispenseTicks`/`nextDepositAmount` and owns turning real timestamps into ticks.
 *
 * IMPORTANT -- units: every quantity here is a normalized internal value in [0, 1]
 * (`SAUCE_MAX_QUANTITY` is the hard cap, "the bottle is empty"). The PIZZA DB has no
 * quantity evidence for any ingredient (no grams/ml), so nothing in this file, or in
 * anything downstream of it (sauceField.ts, referencePizza.ts), is or ever should become
 * a real-world unit. It is a game-balance constant, not a measured fact.
 */

/** Fixed simulation timestep (ms). Ticks are produced by dividing *elapsed wall-clock
 *  time* by this constant -- never by counting pointermove events -- so quantity is
 *  independent of both pointer-event frequency and display refresh rate. */
export const SAUCE_TICK_MS = 50;

/** Normalized quantity added per fixed tick while the dispenser is held down. */
export const SAUCE_RATE_PER_TICK = 0.02;

/** Hard cap on total normalized quantity dispensed by one sauce application (the sum of
 *  every deposit's `amount`, inside the dough *and* overflowed outside it -- see
 *  sauceField.ts). Once reached, further holding is a no-op: the dispenser is "empty". */
export const SAUCE_MAX_QUANTITY = 1.0;

export interface DispenseAccumulator {
  /** Leftover elapsed ms that hasn't yet accumulated into a full SAUCE_TICK_MS tick. */
  carryMs: number;
}

export function createDispenseAccumulator(): DispenseAccumulator {
  return { carryMs: 0 };
}

/**
 * Converts elapsed real time into a whole number of fixed-size ticks, carrying the
 * remainder forward so ticks never bunch up or get lost across calls (e.g. one rAF frame
 * arriving late still eventually accounts for the time it skipped, and a frame arriving
 * early doesn't manufacture an extra tick). Deliberately takes only a duration -- there is
 * no pointer/event data anywhere in this function's signature, which is what makes "quantity
 * from event count" structurally impossible to reintroduce here by accident.
 */
export function stepDispenseTicks(
  elapsedMs: number,
  acc: DispenseAccumulator,
): { ticks: number; next: DispenseAccumulator } {
  const total = acc.carryMs + Math.max(0, elapsedMs);
  const ticks = Math.floor(total / SAUCE_TICK_MS);
  return { ticks, next: { carryMs: total - ticks * SAUCE_TICK_MS } };
}

export function clampQuantity(quantity: number): number {
  return Math.min(SAUCE_MAX_QUANTITY, Math.max(0, quantity));
}

/**
 * How much a batch of `ticks` should actually deposit, given `alreadyDispensedTotal` (the
 * sum of every deposit so far for this sauce application, inside dough + overflow both --
 * see sauceField.ts's `computeSauceMetrics`). Clamps to whatever headroom remains under
 * `SAUCE_MAX_QUANTITY` so a long hold (or a hold that continues after the cap is reached)
 * can never push the total past the cap, however many ticks land in one step.
 */
export function nextDepositAmount(ticks: number, alreadyDispensedTotal: number): number {
  if (ticks <= 0) return 0;
  const remaining = Math.max(0, SAUCE_MAX_QUANTITY - alreadyDispensedTotal);
  return Math.min(ticks * SAUCE_RATE_PER_TICK, remaining);
}
