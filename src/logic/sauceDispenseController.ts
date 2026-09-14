/**
 * Phase 4A-1A: framework-independent "how long has the dispenser been squeezed" state
 * machine. PizzaStage only wires pointer events and an animation-frame loop to this --
 * every rule about "does holding longer add sauce, at a rate independent of pointer-event
 * frequency or refresh rate, at a position that follows the finger without adding sauce
 * on every move" lives here, so it can be unit tested with plain function calls and fake
 * timestamps instead of a real DOM/React render (this repo has no component-test harness
 * -- see docs/reports/PIZZA_GAME_Phase4A-1A_Reference-Sauce-Quantity_Result.md).
 */
import {
  createDispenseAccumulator,
  nextDepositAmount,
  stepDispenseTicks,
  type DispenseAccumulator,
} from "./sauceQuantity";

export interface SauceDispensePoint {
  x: number;
  y: number;
}

export interface SauceDeposit extends SauceDispensePoint {
  amount: number;
}

export interface SauceDispenseControllerOptions {
  /** Called once per generated tick with the deposit to commit to game state. */
  onDeposit: (deposit: SauceDeposit) => void;
  /** Sum of every deposit's `amount` already committed for this sauce application
   *  (inside the dough plus overflow), read fresh on every tick. The controller holds no
   *  running total of its own so it can never drift from the caller's own state
   *  (`PizzaState.sauceDeposits`, see ../state/pizzaState.ts). */
  getTotalDispensed: () => number;
}

/**
 * One dispense session runs from `start()` to `stop()`. `stop()` is always safe to call,
 * including when the session was never started or has already been stopped -- pointerup,
 * pointercancel, `lostpointercapture`, a BAKE-triggered abort, and component unmount all
 * call it unconditionally as their cleanup.
 */
export class SauceDispenseController {
  private acc: DispenseAccumulator = createDispenseAccumulator();
  private lastTickAt = 0;
  private position: SauceDispensePoint | null = null;
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
   * (pointerdown immediately followed by pointerup, no time for `step()` to ever run)
   * still lays down a small dab of sauce, matching the pre-4A-1A "tap applies sauce"
   * affordance, rather than requiring a deliberate hold to see anything happen at all.
   */
  start(now: number, pos: SauceDispensePoint): void {
    this.active = true;
    this.acc = createDispenseAccumulator();
    this.lastTickAt = now;
    this.position = pos;
    this.depositTicks(1);
  }

  /**
   * Updates the position the *next* tick will deposit at. Deliberately never deposits by
   * itself -- quantity comes only from time-based ticks in `step()`, so a drag that fires
   * many move events produces exactly as much sauce as a still hold of the same duration.
   */
  move(pos: SauceDispensePoint): void {
    if (!this.active) return;
    this.position = pos;
  }

  /**
   * Advances the fixed-timestep simulation by the real elapsed time since the session
   * started or last stepped, depositing one tick's worth of sauce (at the current tracked
   * position) for every full `SAUCE_TICK_MS` that elapsed. Intended to be called from a
   * requestAnimationFrame loop while `isActive`; a no-op once stopped.
   */
  step(now: number): void {
    if (!this.active) return;
    const elapsed = now - this.lastTickAt;
    this.lastTickAt = now;
    const { ticks, next } = stepDispenseTicks(elapsed, this.acc);
    this.acc = next;
    if (ticks > 0) this.depositTicks(ticks);
  }

  /** Ends the session. Idempotent and safe at any time (see class doc comment). */
  stop(): void {
    this.active = false;
    this.position = null;
  }

  private depositTicks(ticks: number): void {
    if (!this.position) return;
    const amount = nextDepositAmount(ticks, this.options.getTotalDispensed());
    if (amount <= 0) return;
    this.options.onDeposit({ x: this.position.x, y: this.position.y, amount });
  }
}
