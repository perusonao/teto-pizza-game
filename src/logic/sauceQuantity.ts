/**
 * Phase 4A-1A (Post-Codex-Fix): Tomato Sauce dispense model for the Margherita Reference
 * prototype.
 *
 * The whole point of this module is "how much sauce comes out while the player holds
 * pointerdown, and exactly when each bit of it lands" -- and specifically, that both
 * answers depend on *wall-clock time* only, never on how many pointer events fired during
 * that hold, and never on how the real time between two `step()` calls happened to be
 * chunked (a slow frame that skips 4 ticks' worth of real time must still produce 4
 * separately-timestamped ticks, not one 4x-sized tick at a single instant -- see
 * sauceDispenseController.ts's position interpolation, which needs each tick's own
 * timestamp to place it correctly along the path the finger actually traveled).
 *
 * IMPORTANT -- units: every quantity here is a normalized internal value in [0, 1]
 * (`SAUCE_MAX_QUANTITY` is the hard cap, "the bottle is empty"). The PIZZA DB has no
 * quantity evidence for any ingredient (no grams/ml), so nothing in this file, or in
 * anything downstream of it (sauceField.ts, referencePizza.ts), is or ever should become
 * a real-world unit. It is a game-balance constant, not a measured fact.
 */

/** Fixed simulation timestep (ms). Ticks are due at `sessionStart + k * SAUCE_TICK_MS` for
 *  k = 1, 2, 3, ... -- never derived from counting pointermove events -- so quantity (and,
 *  with per-tick timestamps, *where* it lands) is independent of pointer-event frequency
 *  and display refresh rate alike. */
export const SAUCE_TICK_MS = 50;

/** Normalized quantity added per fixed tick while the dispenser is held down. */
export const SAUCE_RATE_PER_TICK = 0.02;

/** Hard cap on total normalized quantity dispensed by one sauce application (the sum of
 *  every deposit's `amount`, inside the dough *and* overflowed outside it -- see
 *  sauceField.ts). Once reached, further holding is a no-op: the dispenser is "empty". */
export const SAUCE_MAX_QUANTITY = 1.0;

/**
 * Safety cap (Codex Broad Review MUST FIX 3 -- Background/Stall): the maximum number of
 * ticks a single `computeDueTicks` call will ever produce, however large the real elapsed
 * time it's given is. Without this, a backgrounded tab (`visibilitychange`/`blur` -- see
 * SauceDispenseController/PizzaStage, which also abort the session outright on those events
 * as a second, independent layer of defense) or any other long stall (a debugger pause, a
 * dropped/late animation frame) resuming after several real seconds would otherwise deposit
 * that entire gap as one enormous burst the instant it resumes. Ticks beyond this cap are
 * dropped, not queued -- lost time is lost, never "caught up" later.
 */
export const MAX_TICKS_PER_STEP = 10; // 10 * SAUCE_TICK_MS = 500ms worth per step() call.

export interface DueTicksResult {
  /** Absolute timestamps (same clock as `now`) of every tick that is now due, oldest first,
   *  capped at `MAX_TICKS_PER_STEP` entries. */
  dueAts: number[];
  /** The timestamp the *next* call should treat as "the previous due time" -- always
   *  `dueAts[last] + SAUCE_TICK_MS` when nothing was capped; reset to `now + SAUCE_TICK_MS`
   *  when ticks were dropped, so a capped stall never leaves a backlog to "catch up" on the
   *  following call either. */
  nextDueAt: number;
  /** How many ticks beyond `MAX_TICKS_PER_STEP` were dropped this call (0 in the overwhelming
   *  majority of real frames) -- exposed purely so tests can pin the cap's exact behavior. */
  droppedTicks: number;
}

/**
 * Pure function of two timestamps (`prevDueAt`, `now`) and nothing else -- no pointer/event
 * data can appear in this signature, which is what makes "quantity/placement from event
 * count" structurally impossible to reintroduce here by accident. Returns every tick due in
 * (`prevDueAt`, `now`], each with its own exact timestamp so the caller can place it at the
 * finger's *interpolated* position at that instant rather than lumping every due tick onto
 * wherever the finger happens to be at `now` (Codex Broad Review MUST FIX 4).
 */
export function computeDueTicks(prevDueAt: number, now: number): DueTicksResult {
  if (now < prevDueAt) return { dueAts: [], nextDueAt: prevDueAt, droppedTicks: 0 };

  const rawCount = Math.floor((now - prevDueAt) / SAUCE_TICK_MS);
  const count = Math.min(rawCount, MAX_TICKS_PER_STEP);
  const dueAts: number[] = [];
  for (let i = 1; i <= count; i += 1) dueAts.push(prevDueAt + i * SAUCE_TICK_MS);

  const droppedTicks = rawCount - count;
  const nextDueAt = droppedTicks > 0 ? now + SAUCE_TICK_MS : prevDueAt + count * SAUCE_TICK_MS;
  return { dueAts, nextDueAt, droppedTicks };
}

export function clampQuantity(quantity: number): number {
  return Math.min(SAUCE_MAX_QUANTITY, Math.max(0, quantity));
}

/**
 * How much a *single* tick should actually deposit, given `alreadyDispensedTotal` (the sum
 * of every deposit so far for this sauce application, inside dough + overflow both -- see
 * sauceField.ts's `totalDispensed`). Clamps to whatever headroom remains under
 * `SAUCE_MAX_QUANTITY`, so a long hold (or a hold that continues after the cap is reached)
 * can never push the total past the cap. Callers processing several due ticks in one batch
 * must call this once per tick, updating `alreadyDispensedTotal` by the result before
 * computing the next tick's amount, so a cap reached partway through a batch is respected
 * for the remaining ticks in that same batch.
 */
export function tickDepositAmount(alreadyDispensedTotal: number): number {
  const remaining = Math.max(0, SAUCE_MAX_QUANTITY - alreadyDispensedTotal);
  return Math.min(SAUCE_RATE_PER_TICK, remaining);
}
