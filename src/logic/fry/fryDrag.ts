/**
 * Cooking Fry Phase 1 (Issue #749), F1: operation B -- drag the piece down into the oil, let go, watch the bubbles, drag it back up (pure).
 *
 * `depth` is 0..1 down the pan (0 = the dish at the top, 1 = the bottom of the oil); the UI turns pointer coordinates into it. The oil's surface is at
 * FRY_OIL_SURFACE_DEPTH: the piece counts as in the oil from the moment a drag takes it there, and it STAYS in when the finger lets go (so the finger never hides
 * the bubbles). Grabbing it again and pulling it above FRY_LIFT_DEPTH takes it out and keeps what the time made. Letting go above the surface drops nothing
 * into the oil. TAP_DOWN / TAP_UP are the required alternative to dragging (buttons and the arrow keys): same states, same result, no precise gesture.
 * Nothing is judged and there is no time-out. The clock is always passed in.
 */
import { fryResultOf, type FryResult } from "./fryPot";

/** A piece dragged down to this depth is in the oil. */
export const FRY_OIL_SURFACE_DEPTH = 0.55;
/** A piece in the oil, grabbed and pulled above this depth, is out (a gap above the surface so a wobble does not lift it). */
export const FRY_LIFT_DEPTH = 0.4;
/** Taking it out sooner than this after it went in keeps nothing (a stray drag). */
export const FRY_DRAG_MIN_MS = 600;

export type FryDrag =
  | { status: "idle"; tooShort?: boolean }
  /** Carrying the piece down from the dish, not in the oil yet. */
  | { status: "carrying"; depth: number; lastAt: number }
  /** In the oil. `grabbed`: a finger holds it right now (so it can be pulled up). */
  | { status: "frying"; startedAt: number; grabbed: boolean; depth: number; lastAt: number }
  | { status: "lifted"; result: FryResult; elapsedMs: number };

export type FryDragAction =
  | { type: "GRAB"; now: number; depth: number }
  /** `timeScale` (MOVE): the HV comparison knob, used if this move takes the piece out; absent / invalid = 1. */
  | { type: "MOVE"; now: number; depth: number; timeScale?: number }
  | { type: "RELEASE"; now: number }
  /** The alternative to dragging down: put it in. */
  | { type: "TAP_DOWN"; now: number }
  /** The alternative to dragging up: take it out. */
  | { type: "TAP_UP"; now: number; timeScale?: number }
  /** The browser cancelled the gesture: let go; a piece already in the oil stays in. */
  | { type: "POINTER_CANCEL" }
  | { type: "CANCEL" }
  /** The control lost focus mid-fry: drop a fry in progress and nothing else. */
  | { type: "INTERRUPT" };

export const FRY_DRAG_IDLE: FryDrag = { status: "idle" };

const okTime = (n: number) => Number.isFinite(n);
const okDepth = (n: number) => Number.isFinite(n);
const clampDepth = (n: number) => Math.min(1, Math.max(0, n));

function takeOut(state: Extract<FryDrag, { status: "frying" }>, now: number, timeScale: number | undefined): FryDrag {
  const elapsedMs = now - state.startedAt;
  if (!Number.isFinite(elapsedMs) || elapsedMs < FRY_DRAG_MIN_MS) return { status: "idle", tooShort: true };
  return { status: "lifted", result: fryResultOf(elapsedMs, timeScale), elapsedMs };
}

export function fryDragReducer(state: FryDrag, action: FryDragAction): FryDrag {
  switch (action.type) {
    case "GRAB": {
      if (!okTime(action.now) || !okDepth(action.depth)) return state;
      const depth = clampDepth(action.depth);
      if (state.status === "idle") return { status: "carrying", depth, lastAt: action.now };
      // Re-grabbing a piece that is in the oil is how it is pulled out.
      if (state.status === "frying" && action.now >= state.lastAt) return { ...state, grabbed: true, depth, lastAt: action.now };
      return state;
    }
    case "MOVE": {
      if (!okTime(action.now) || !okDepth(action.depth)) return state;
      const depth = clampDepth(action.depth);
      if (state.status === "carrying") {
        if (action.now < state.lastAt) return state; // the clock ran backwards
        if (depth >= FRY_OIL_SURFACE_DEPTH) return { status: "frying", startedAt: action.now, grabbed: true, depth, lastAt: action.now };
        return { ...state, depth, lastAt: action.now };
      }
      if (state.status === "frying" && state.grabbed) {
        if (action.now < state.lastAt) return state;
        if (depth <= FRY_LIFT_DEPTH) return takeOut(state, action.now, action.timeScale);
        return { ...state, depth, lastAt: action.now };
      }
      return state;
    }
    case "RELEASE": {
      if (state.status === "carrying") return FRY_DRAG_IDLE; // let go above the oil: nothing went in
      if (state.status === "frying" && state.grabbed) return { ...state, grabbed: false };
      return state;
    }
    case "TAP_DOWN":
      return state.status === "idle" && okTime(action.now) ? { status: "frying", startedAt: action.now, grabbed: false, depth: 1, lastAt: action.now } : state;
    case "TAP_UP":
      return state.status === "frying" && okTime(action.now) && action.now >= state.lastAt ? takeOut(state, action.now, action.timeScale) : state;
    case "POINTER_CANCEL":
      if (state.status === "carrying") return FRY_DRAG_IDLE;
      return state.status === "frying" && state.grabbed ? { ...state, grabbed: false } : state;
    case "CANCEL":
      return FRY_DRAG_IDLE;
    case "INTERRUPT":
      return state.status === "carrying" || state.status === "frying" ? FRY_DRAG_IDLE : state;
  }
}
