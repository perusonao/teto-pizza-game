/**
 * Cooking Fry Phase 1 (Issue #749), F1: operation A -- two taps: put it in, lift it out (pure).
 *
 * START puts the piece in the oil and the bubbles run with time alone; LIFT takes it out and keeps whatever the time made. Nothing is judged and there is no
 * time-out. A lift that comes too early is a stray tap and keeps nothing. The clock is always passed in (this file never reads the time).
 */
import { fryResultOf, type FryResult } from "./fryPot";

/** Lifting sooner than this keeps nothing. */
export const FRY_TAP_MIN_MS = 600;

export type FryTap =
  | { status: "idle"; tooShort?: boolean }
  | { status: "frying"; startedAt: number }
  | { status: "lifted"; result: FryResult; elapsedMs: number };

export type FryTapAction =
  | { type: "START"; now: number }
  /** `timeScale` (LIFT): the HV comparison knob; absent / invalid = 1. */
  | { type: "LIFT"; now: number; timeScale?: number }
  | { type: "CANCEL" }
  /** The button lost focus mid-fry: drop a fry in progress and nothing else (a kept result must survive the button being removed). */
  | { type: "INTERRUPT" };

export const FRY_TAP_IDLE: FryTap = { status: "idle" };

export function fryTapReducer(state: FryTap, action: FryTapAction): FryTap {
  switch (action.type) {
    case "START":
      return state.status === "idle" && Number.isFinite(action.now) ? { status: "frying", startedAt: action.now } : state;
    case "LIFT": {
      if (state.status !== "frying") return state;
      const elapsedMs = action.now - state.startedAt;
      if (!Number.isFinite(elapsedMs) || elapsedMs < FRY_TAP_MIN_MS) return { status: "idle", tooShort: true };
      return { status: "lifted", result: fryResultOf(elapsedMs, action.timeScale), elapsedMs };
    }
    case "CANCEL":
      return FRY_TAP_IDLE;
    case "INTERRUPT":
      return state.status === "frying" ? FRY_TAP_IDLE : state;
  }
}
