/**
 * Phase 4A-1A (Post-Codex-Fix): framework-independent "how long has the dispenser been
 * squeezed, and where was the finger at each instant" state machine. PizzaStage only wires
 * pointer events and an animation-frame loop to this -- every rule about "does holding
 * longer add sauce, at a rate independent of pointer-event frequency or refresh rate, at a
 * position that follows the finger's actual path rather than wherever it happens to be when
 * a batch of ticks is processed" lives here, so it can be unit tested with plain function
 * calls and fake timestamps instead of a real DOM/React render (this repo has no
 * component-test harness).
 *
 * Codex Broad Review MUST FIX 4 (Spatial Sampling): a slow frame can leave several ticks due
 * at once. Depositing all of them at the *current* position (wherever the finger is by the
 * time the batch is processed) would make the sauce's spatial distribution depend on frame
 * cadence -- a fast device deposits along a smooth path, a slow one dumps clumps at fewer,
 * further-apart points, even though *total* quantity (already frame-rate-independent) is
 * identical. Each due tick is instead placed by linearly interpolating the finger's recorded
 * path at that tick's own exact timestamp.
 */
import {
  clampQuantity,
  computeDueTicks,
  SAUCE_TICK_MS,
  tickDepositAmount,
  type DueTicksResult,
} from "./sauceQuantity";

export interface SauceDispensePoint {
  x: number;
  y: number;
}

export interface SauceDeposit extends SauceDispensePoint {
  amount: number;
}

interface TimedPoint extends SauceDispensePoint {
  t: number;
}

export interface SauceDispenseControllerOptions {
  /** Called once per generated tick with the deposit to commit. Phase 4A-1A's cancel-
   *  transaction model (MUST FIX 7) means this appends to a *local, uncommitted* buffer,
   *  not canonical game state directly -- see PizzaStage's session handling. */
  onDeposit: (deposit: SauceDeposit) => void;
  /** Sum of every deposit's `amount` already accounted for this sauce application --
   *  already-committed strokes plus whatever this in-progress session has buffered so far
   *  (inside the dough plus overflow both), read fresh at the start of every `step()`/
   *  `start()` call. The controller holds no running total of its own so it can never drift
   *  from the caller's own bookkeeping. */
  getTotalDispensed: () => number;
}

/**
 * One dispense session runs from `start()` to `stop()`. `stop()` is always safe to call,
 * including when the session was never started or has already been stopped -- pointerup,
 * pointercancel, `lostpointercapture`, `visibilitychange`/`blur`, a BAKE-triggered abort, an
 * ingredient change mid-hold, opening the Reference overlay, and component unmount all call
 * it unconditionally as their cleanup (see PizzaStage's `DispenseSession` wrapper, which
 * also invalidates any in-flight `requestAnimationFrame` callback via a session token so a
 * stale frame can never call back into a stopped or superseded controller).
 */
export class SauceDispenseController {
  private path: TimedPoint[] = [];
  private nextDueAt = 0;
  private active = false;
  private readonly options: SauceDispenseControllerOptions;

  constructor(options: SauceDispenseControllerOptions) {
    this.options = options;
  }

  get isActive(): boolean {
    return this.active;
  }

  /**
   * Begins a session and immediately deposits one starter tick at `pos` -- so a quick tap
   * (pointerdown immediately followed by pointerup, no time for `step()` to ever run) still
   * lays down a small dab of sauce, matching the pre-4A-1A "tap applies sauce" affordance,
   * rather than requiring a deliberate hold to see anything happen at all.
   */
  start(now: number, pos: SauceDispensePoint): void {
    this.active = true;
    this.path = [{ t: now, x: pos.x, y: pos.y }];
    this.nextDueAt = now + SAUCE_TICK_MS; // the first *regular* tick, one full period out.

    const amount = tickDepositAmount(this.options.getTotalDispensed());
    if (amount > 0) this.options.onDeposit({ x: pos.x, y: pos.y, amount });
  }

  /**
   * Records where the finger is *now*, timestamped. Deliberately never deposits by itself --
   * quantity is produced only by time-based ticks in `step()`, so a drag firing many move
   * events produces exactly as much sauce as a still hold of the same duration; the
   * timestamped path exists solely so `step()` can place each due tick where the finger
   * actually was at that instant (see class doc comment).
   */
  move(pos: SauceDispensePoint, now: number): void {
    if (!this.active) return;
    this.path.push({ t: now, x: pos.x, y: pos.y });
  }

  /**
   * Advances the fixed-timestep simulation to `now`, depositing one tick's worth of sauce
   * for every tick due since the last call -- each at its own interpolated position, each
   * checked against the dispensed-total cap in order (so a cap reached partway through a
   * multi-tick batch is respected for the rest of that same batch). At most
   * `MAX_TICKS_PER_STEP` ticks are ever produced by one call, however large the gap since
   * the last one -- see ./sauceQuantity.ts's `computeDueTicks` for the background/stall
   * safety this guarantees independent of PizzaStage's own visibilitychange/blur abort.
   */
  step(now: number): void {
    if (!this.active) return;
    const { dueAts, nextDueAt }: DueTicksResult = computeDueTicks(this.nextDueAt, now);
    this.nextDueAt = nextDueAt;
    if (dueAts.length === 0) return;

    let runningTotal = this.options.getTotalDispensed();
    for (const dueAt of dueAts) {
      const amount = tickDepositAmount(runningTotal);
      if (amount <= 0) break; // total is monotonic -- once capped, stays capped this batch.
      const pos = this.interpolate(dueAt);
      this.options.onDeposit({ x: pos.x, y: pos.y, amount });
      runningTotal = clampQuantity(runningTotal + amount);
    }

    this.trimPath();
  }

  /** Ends the session. Idempotent and safe at any time (see class doc comment). */
  stop(): void {
    this.active = false;
    this.path = [];
  }

  /** Linear interpolation of the recorded path at time `t`. Before the first sample or
   *  after the last one, holds at that end's position (a still hold, or a tick due before
   *  any move() has been recorded yet). */
  private interpolate(t: number): SauceDispensePoint {
    const path = this.path;
    if (path.length === 0) return { x: 0, y: 0 }; // unreachable: start() always seeds path.
    if (t <= path[0].t) return { x: path[0].x, y: path[0].y };

    for (let i = 1; i < path.length; i += 1) {
      if (t <= path[i].t) {
        const a = path[i - 1];
        const b = path[i];
        const span = b.t - a.t;
        const ratio = span <= 0 ? 1 : (t - a.t) / span;
        return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
      }
    }

    const last = path[path.length - 1];
    return { x: last.x, y: last.y };
  }

  /** Drops path samples old enough that no future tick can ever need them as an
   *  interpolation bracket, keeping the buffer bounded across a long hold. Always leaves at
   *  least one sample so `interpolate` never runs out of anchors. */
  private trimPath(): void {
    const cutoff = this.nextDueAt - SAUCE_TICK_MS * 2; // a little slack past one tick period.
    while (this.path.length > 1 && this.path[1].t <= cutoff) {
      this.path.shift();
    }
  }
}
