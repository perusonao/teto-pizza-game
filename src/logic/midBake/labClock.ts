import { BAKE_DURATION_S, clampBakeFrameDt } from "../bakeProgress";
import { DEFAULT_MID_BAKE_WINDOW, isValidMidBakeWindow, type MidBakeWindow } from "./midBakeTiming";

/**
 * MID_BAKE Lab clock (Issue #795, stage C-1): the one-way bake clock plus the "hold at the window start" policy
 * (decision table Q1 = proposal P, "止めて足す"). Pure and unwired: it imports only the shared bake constants and
 * the MID_BAKE window; no React, state, PREP or FRY.
 *
 * - While running it advances exactly like `BakeOverlay`: linear, one-way, each frame limited by `clampBakeFrameDt`
 *   (a backgrounded tab never jumps ahead). `elapsedMs` is the *active bake clock*, never wall-clock time; feed
 *   `labClockEngineNow` to the MID_BAKE engine as `now`.
 * - When the clock reaches the window start it stops there once ("holding"). While holding, `elapsedMs` is constant, so
 *   an `ADD` carries `now === lastAt`, which the engine accepts (a stale or non-finite `now` is a no-op).
 * - The hold ends when the additions are complete, the player closes it, or the hold timeout elapses; then the clock
 *   resumes to the end of the bake. The hold happens at most once per bake.
 *
 * The hold timeout is a PROVISIONAL Lab value (Owner decision: not a Production specification). Do not hard-code it
 * elsewhere; Lab sessions may pass their own value.
 */
export const LAB_HOLD_TIMEOUT_MS_PROVISIONAL = 6000;

export type LabClockStatus = "running" | "holding" | "finished";
export type LabHoldRelease = "complete" | "closed" | "timeout";

export interface LabClockConfig {
  /** Active bake time from 0% to 100% (defaults to the shared `BAKE_DURATION_S`). */
  readonly totalBakeMs: number;
  readonly window: MidBakeWindow;
  /** `false` keeps the plain bake clock (used to compare against an unmodified BAKE). */
  readonly holdAtWindowStart: boolean;
  /** Active (frame-clamped) hold time after which the clock resumes by itself. PROVISIONAL, Lab only. */
  readonly holdTimeoutMs: number;
}

export interface LabClockState {
  readonly config: LabClockConfig;
  readonly status: LabClockStatus;
  /** Active bake clock in ms, 0..totalBakeMs. */
  readonly elapsedMs: number;
  /** Active time spent holding, 0..holdTimeoutMs. */
  readonly holdElapsedMs: number;
  /** The one hold has started (it is never started twice). */
  readonly holdUsed: boolean;
  /** Why the hold ended; `null` while no hold has ended. */
  readonly released: LabHoldRelease | null;
}

export type LabClockEvent =
  | { readonly type: "FRAME"; readonly dtMs: number }
  | { readonly type: "RELEASE"; readonly reason: Exclude<LabHoldRelease, "timeout"> };

export function createLabClock(config: Partial<LabClockConfig> = {}): LabClockState {
  const full: LabClockConfig = {
    totalBakeMs: config.totalBakeMs ?? BAKE_DURATION_S * 1000,
    window: config.window ?? DEFAULT_MID_BAKE_WINDOW,
    holdAtWindowStart: config.holdAtWindowStart ?? true,
    holdTimeoutMs: config.holdTimeoutMs ?? LAB_HOLD_TIMEOUT_MS_PROVISIONAL,
  };
  if (!Number.isFinite(full.totalBakeMs) || full.totalBakeMs <= 0) throw new Error("Invalid Lab clock total");
  if (!isValidMidBakeWindow(full.window)) throw new Error("Invalid Lab clock window");
  if (!Number.isFinite(full.holdTimeoutMs) || full.holdTimeoutMs <= 0) throw new Error("Invalid Lab clock hold timeout");
  return { config: full, status: "running", elapsedMs: 0, holdElapsedMs: 0, holdUsed: false, released: null };
}

/** The `now` to hand to the MID_BAKE engine: the active bake clock, never wall-clock time. */
export function labClockEngineNow(state: LabClockState): number {
  return state.elapsedMs;
}

/** Bake gauge position 0..100 for the clock. */
export function labClockPositionPct(state: LabClockState): number {
  return (state.elapsedMs / state.config.totalBakeMs) * 100;
}

function frameMs(dtMs: number): number {
  return clampBakeFrameDt(dtMs / 1000) * 1000;
}

function advanceRunning(state: LabClockState, ms: number): LabClockState {
  const { config } = state;
  const next = state.elapsedMs + ms;
  const holdAt = config.window.start * config.totalBakeMs;
  if (config.holdAtWindowStart && !state.holdUsed && next >= holdAt) {
    // Stop exactly at the window start; the rest of this frame is dropped so the hold is deterministic.
    return { ...state, status: "holding", elapsedMs: holdAt, holdUsed: true };
  }
  if (next >= config.totalBakeMs) return { ...state, status: "finished", elapsedMs: config.totalBakeMs };
  return { ...state, elapsedMs: next };
}

function advanceHolding(state: LabClockState, ms: number): LabClockState {
  const next = state.holdElapsedMs + ms;
  if (next >= state.config.holdTimeoutMs) {
    return { ...state, status: "running", holdElapsedMs: state.config.holdTimeoutMs, released: "timeout" };
  }
  return { ...state, holdElapsedMs: next };
}

/** Pure reducer. Invalid, zero or negative frames and events that do not apply return the same state object. */
export function labClockReducer(state: LabClockState, event: LabClockEvent): LabClockState {
  if (state.status === "finished") return state;
  if (event.type === "RELEASE") {
    if (state.status !== "holding") return state;
    return { ...state, status: "running", released: event.reason };
  }
  const ms = frameMs(event.dtMs);
  if (ms <= 0) return state;
  return state.status === "holding" ? advanceHolding(state, ms) : advanceRunning(state, ms);
}
