/**
 * Square-Pan Dough B1 (Issue #535, Epic #532): the tap / long-press state machine for the square dough. Pure: it never reads a
 * clock or a DOM -- every event carries its own timestamp (ms) and position -- so a gesture can be replayed exactly, with no
 * timers, in tests, and its result does not depend on the frame rate of the device it ran on.
 *
 * What it decides (the squares' pixels are ./squareDoughSpread.ts's job):
 *   - pointer down  -> a TAP effect right away (no waiting to see whether it will turn into a hold);
 *   - still down, within MOVE_SLOP_PX, after HOLD_START_MS -> HOLD: a spread effect per tick, growing with the time held;
 *   - the finger moves more than MOVE_SLOP_PX -> the press ends *as a spread* (nothing more is applied; what was done stays).
 *     That movement is a drag, which belongs to C (#536); B only guarantees a held finger that wanders cannot smear the dough;
 *   - pointer up -> commit what was applied; pointer cancel / blur / hidden tab -> discard it all;
 *   - a second finger is ignored while one is down.
 * Every threshold is an initial value for Owner on-device HV.
 */
import type { DoughPoint } from "../pizzaCoordinates";
import type { PressEffect } from "./squareDoughSpread";

/** Holding this long (ms) turns a press into a hold. */
export const HOLD_START_MS = 200;
/** A finger that moves farther than this (CSS px) from where it went down is no longer pressing: it is dragging. */
export const MOVE_SLOP_PX = 10;

export type PressPhase = "idle" | "pressing" | "holding" | "moved";

export interface PressGestureState {
  readonly phase: PressPhase;
  readonly pointerId: number | null;
  /** Timestamp (ms) of the pointer down. */
  readonly downAt: number;
  readonly downClientX: number;
  readonly downClientY: number;
  /** Where the dough was pressed (dough-percent); every effect of one gesture uses this point. */
  readonly center: DoughPoint | null;
  /** Timestamp of the last time a hold step was accounted for. */
  readonly lastStepAt: number;
}

export const IDLE_PRESS_GESTURE: PressGestureState = {
  phase: "idle",
  pointerId: null,
  downAt: 0,
  downClientX: 0,
  downClientY: 0,
  center: null,
  lastStepAt: 0,
};

export type PressEvent =
  | { readonly type: "down"; readonly pointerId: number; readonly at: number; readonly clientX: number; readonly clientY: number; readonly center: DoughPoint }
  | { readonly type: "move"; readonly pointerId: number; readonly at: number; readonly clientX: number; readonly clientY: number }
  | { readonly type: "tick"; readonly at: number }
  | { readonly type: "up"; readonly pointerId: number; readonly at: number }
  /** `pointerId` omitted = any gesture (window blur, the tab hidden, a step change). */
  | { readonly type: "cancel"; readonly pointerId?: number; readonly at: number };

export interface PressStep {
  readonly state: PressGestureState;
  /** To apply, in order, to the working dough. */
  readonly effects: readonly PressEffect[];
  /** `"commit"`: keep the working dough. `"discard"`: throw it away. `null`: the gesture goes on. */
  readonly end: "commit" | "discard" | null;
}

const NOTHING = (state: PressGestureState): PressStep => ({ state, effects: [], end: null });

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

/** The time at which the hold starts (never before the press itself). */
function holdBeginsAt(state: PressGestureState): number {
  return state.downAt + HOLD_START_MS;
}

/** The hold effect covering [lastStepAt, at], if the hold has begun by `at` and any time has passed. */
function holdEffect(state: PressGestureState, at: number): { effect: PressEffect | null; lastStepAt: number } {
  const begins = holdBeginsAt(state);
  if (state.center === null || at <= begins) return { effect: null, lastStepAt: state.lastStepAt };
  const from = Math.max(state.lastStepAt, begins);
  if (at <= from) return { effect: null, lastStepAt: state.lastStepAt };
  return { effect: { kind: "hold", center: state.center, elapsedMs: at - begins, dtMs: at - from }, lastStepAt: at };
}

export function stepPressGesture(state: PressGestureState, event: PressEvent): PressStep {
  switch (event.type) {
    case "down": {
      // One finger at a time: a second down while a gesture is live (or a malformed event) changes nothing.
      if (state.phase !== "idle") return NOTHING(state);
      if (![event.at, event.clientX, event.clientY, event.center.x, event.center.y].every(isFiniteNumber)) return NOTHING(state);
      const next: PressGestureState = {
        phase: "pressing",
        pointerId: event.pointerId,
        downAt: event.at,
        downClientX: event.clientX,
        downClientY: event.clientY,
        center: event.center,
        lastStepAt: event.at,
      };
      return { state: next, effects: [{ kind: "press", center: event.center }], end: null };
    }

    case "move": {
      if (state.phase !== "pressing" && state.phase !== "holding") return NOTHING(state);
      if (event.pointerId !== state.pointerId) return NOTHING(state);
      if (!isFiniteNumber(event.clientX) || !isFiniteNumber(event.clientY) || !isFiniteNumber(event.at)) return NOTHING(state);
      if (Math.hypot(event.clientX - state.downClientX, event.clientY - state.downClientY) <= MOVE_SLOP_PX) return NOTHING(state);
      // Account for the hold up to this instant, then stop: the finger is dragging, not pressing.
      const { effect } = state.phase === "holding" ? holdEffect(state, event.at) : { effect: null };
      return { state: { ...state, phase: "moved" }, effects: effect ? [effect] : [], end: null };
    }

    case "tick": {
      if (state.phase !== "pressing" && state.phase !== "holding") return NOTHING(state);
      if (!isFiniteNumber(event.at)) return NOTHING(state);
      const { effect, lastStepAt } = holdEffect(state, event.at);
      const holding = event.at >= holdBeginsAt(state);
      if (!effect) return NOTHING(holding && state.phase === "pressing" ? { ...state, phase: "holding" } : state);
      return { state: { ...state, phase: "holding", lastStepAt }, effects: [effect], end: null };
    }

    case "up": {
      if (state.phase === "idle" || event.pointerId !== state.pointerId) return NOTHING(state);
      // The last moment of a hold still counts, whatever the frame timing was.
      const { effect } = state.phase === "pressing" || state.phase === "holding" ? holdEffect(state, event.at) : { effect: null };
      return { state: IDLE_PRESS_GESTURE, effects: effect ? [effect] : [], end: "commit" };
    }

    case "cancel": {
      if (state.phase === "idle") return NOTHING(state);
      if (event.pointerId !== undefined && event.pointerId !== state.pointerId) return NOTHING(state);
      return { state: IDLE_PRESS_GESTURE, effects: [], end: "discard" };
    }
  }
}
