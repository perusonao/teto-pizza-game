/**
 * Square-Pan Dough B1 (Issue #535, Epic #532) + C (#536): the tap / long-press / drag state machine for the square dough. Pure: it never reads a
 * clock or a DOM -- every event carries its own timestamp (ms) and position -- so a gesture can be replayed exactly, with no
 * timers, in tests, and its result does not depend on the frame rate of the device it ran on.
 *
 * What it decides (the squares' pixels are ./squareDoughSpread.ts's job):
 *   - pointer down  -> a TAP effect right away (no waiting to see whether it will turn into a hold);
 *   - still down, within MOVE_SLOP_PX, after HOLD_START_MS -> HOLD: a spread effect per tick, growing with the time held;
 *   - the finger moves more than MOVE_SLOP_PX -> the press ends *as a spread* (nothing more is applied; what was done stays) --
 *     unless the movement is a DRAG (C, #536), decided from the distance moved, where the finger went down's role and how long it had
 *     been down:
 *       STEP 1 (`dragPrimary`, the drag is the main operation): any movement past the slop is a drag;
 *       STEP 2 (tap / long press are the main operations): a drag only after 24 px (HOLD_TO_DRAG_PX), or 16 px (DRAG_FAST_PX) within
 *       the first HOLD_START_MS -- a quick deliberate stroke -- so a trembling finger or a drifting hold stays a press.
 *     A drag is never also a press: if the hold had not begun, the tap applied at pointer-down is reverted (a "revert" effect) before
 *     the drag effects replay the path from where the finger went down; if a hold had already spread the dough, that spread stays
 *     (it was real) and only the drag continues. From then on only drag effects are produced -- no more tap / hold ticks;
 *   - pointer up -> commit what was applied; pointer cancel / blur / hidden tab -> discard it all;
 *   - a second finger is ignored while one is down.
 * Every threshold is an initial value for Owner on-device HV.
 */
import type { DoughPoint } from "../pizzaCoordinates";
import type { GestureEffect } from "./squareDoughDrag";

/** Holding this long (ms) turns a press into a hold. */
export const HOLD_START_MS = 200;
/** A finger that moves farther than this (CSS px) from where it went down is no longer pressing: it is dragging. */
export const MOVE_SLOP_PX = 10;
/** STEP 2: a quick stroke of at least this many px within HOLD_START_MS is a drag. */
export const DRAG_FAST_PX = 16;
/** STEP 2 (and a held finger in either step): a finger that has moved at least this far from where it went down is dragging. */
export const HOLD_TO_DRAG_PX = 24;

export type PressPhase = "idle" | "pressing" | "holding" | "moved" | "dragging";

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
  /** True when the drag is this step's main operation (STEP 1): any movement past the slop is a drag. */
  readonly dragPrimary: boolean;
  /** True once a hold effect has spread the dough in this gesture (a later drag then keeps it instead of reverting the tap). */
  readonly holdApplied: boolean;
  /** Dough-percent point of the latest drag position (the next drag segment starts here). */
  readonly lastPoint: DoughPoint | null;
}

export const IDLE_PRESS_GESTURE: PressGestureState = {
  phase: "idle",
  pointerId: null,
  downAt: 0,
  downClientX: 0,
  downClientY: 0,
  center: null,
  lastStepAt: 0,
  dragPrimary: false,
  holdApplied: false,
  lastPoint: null,
};

export type PressEvent =
  | {
      readonly type: "down";
      readonly pointerId: number;
      readonly at: number;
      readonly clientX: number;
      readonly clientY: number;
      readonly center: DoughPoint;
      /** STEP 1: the drag is the main operation. Default false. */
      readonly dragPrimary?: boolean;
    }
  | {
      readonly type: "move";
      readonly pointerId: number;
      readonly at: number;
      readonly clientX: number;
      readonly clientY: number;
      /** Where the finger is now, in dough-percent. Without it a movement past the slop can only stop the press, never drag. */
      readonly point?: DoughPoint;
    }
  | { readonly type: "tick"; readonly at: number }
  | { readonly type: "up"; readonly pointerId: number; readonly at: number }
  /** `pointerId` omitted = any gesture (window blur, the tab hidden, a step change). */
  | { readonly type: "cancel"; readonly pointerId?: number; readonly at: number };

export interface PressStep {
  readonly state: PressGestureState;
  /** To apply, in order, to the working dough. */
  readonly effects: readonly GestureEffect[];
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
function holdEffect(state: PressGestureState, at: number): { effect: GestureEffect | null; lastStepAt: number } {
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
        dragPrimary: event.dragPrimary === true,
        holdApplied: false,
        lastPoint: null,
      };
      return { state: next, effects: [{ kind: "press", center: event.center }], end: null };
    }

    case "move": {
      if (state.phase === "idle") return NOTHING(state);
      if (event.pointerId !== state.pointerId) return NOTHING(state);
      if (!isFiniteNumber(event.clientX) || !isFiniteNumber(event.clientY) || !isFiniteNumber(event.at)) return NOTHING(state);
      const point = event.point !== undefined && isFiniteNumber(event.point.x) && isFiniteNumber(event.point.y) ? event.point : null;

      if (state.phase === "dragging") {
        if (point === null || state.lastPoint === null) return NOTHING(state);
        return { state: { ...state, lastPoint: point }, effects: [{ kind: "drag", from: state.lastPoint, to: point }], end: null };
      }

      const distance = Math.hypot(event.clientX - state.downClientX, event.clientY - state.downClientY);
      if (distance <= MOVE_SLOP_PX) return NOTHING(state);
      const elapsed = event.at - state.downAt;
      const isDrag = state.dragPrimary || distance >= HOLD_TO_DRAG_PX || (distance >= DRAG_FAST_PX && elapsed < HOLD_START_MS);

      if (isDrag && point !== null && state.center !== null) {
        // Account for the hold up to this instant (it counts, even before a tick), then drag: never a press and a drag on the same stroke.
        const live = state.phase === "pressing" || state.phase === "holding";
        const { effect } = live ? holdEffect(state, event.at) : { effect: null };
        const holdApplied = state.holdApplied || effect !== null;
        const effects: GestureEffect[] = [];
        if (effect) effects.push(effect);
        if (!holdApplied) effects.push({ kind: "revert" });
        effects.push({ kind: "drag", from: state.center, to: point });
        return { state: { ...state, phase: "dragging", holdApplied, lastPoint: point }, effects, end: null };
      }

      if (state.phase !== "pressing" && state.phase !== "holding") return NOTHING(state);
      // A small wander: account for the hold up to this instant -- even if no tick has arrived since it began (phase is still
      // "pressing") -- then stop: the finger is no longer pressing (and, below the drag distance, not dragging either).
      const { effect } = holdEffect(state, event.at);
      return { state: { ...state, phase: "moved", holdApplied: state.holdApplied || effect !== null }, effects: effect ? [effect] : [], end: null };
    }

    case "tick": {
      if (state.phase !== "pressing" && state.phase !== "holding") return NOTHING(state);
      if (!isFiniteNumber(event.at)) return NOTHING(state);
      const { effect, lastStepAt } = holdEffect(state, event.at);
      const holding = event.at >= holdBeginsAt(state);
      if (!effect) return NOTHING(holding && state.phase === "pressing" ? { ...state, phase: "holding" } : state);
      return { state: { ...state, phase: "holding", lastStepAt, holdApplied: true }, effects: [effect], end: null };
    }

    case "up": {
      if (state.phase === "idle" || event.pointerId !== state.pointerId) return NOTHING(state);
      // A release must always end the gesture, or a stuck "live" press would swallow every later touch: with a time that is not a
      // finite number it ends at the last moment already accounted for, adding no hold time and never a non-finite effect.
      const at = isFiniteNumber(event.at) ? event.at : state.lastStepAt;
      // The last moment of a hold still counts, whatever the frame timing was.
      const { effect } = state.phase === "pressing" || state.phase === "holding" ? holdEffect(state, at) : { effect: null };
      return { state: IDLE_PRESS_GESTURE, effects: effect ? [effect] : [], end: "commit" };
    }

    case "cancel": {
      if (state.phase === "idle") return NOTHING(state);
      if (event.pointerId !== undefined && event.pointerId !== state.pointerId) return NOTHING(state);
      return { state: IDLE_PRESS_GESTURE, effects: [], end: "discard" };
    }
  }
}
