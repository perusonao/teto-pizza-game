/**
 * Cooking Prep Phase 1B: the pan timing rule (pure). Issue #696. Design: docs/reports/TETO_COOKING-PREP_PHASE1B_Fresh-Audit.md §4.1,
 * docs/reports/TETO_COOKING-PREP_PHASE1B_Gameplay-Visual_Research.md §15.
 *
 * The player watches the beef and presses "取り出す！". The grade comes from the elapsed time of the press alone:
 *
 *   early     0 <= t < BEST_START_MS
 *   best      BEST_START_MS <= t < BEST_END_MS     (half-open: 4200ms exactly is overdone -- Owner decision 2026-10-29)
 *   overdone  t >= BEST_END_MS                     (t >= PAN_TOTAL_MS is the time-out, also overdone)
 *
 * No React, no DOM, no clock: every time is an argument, so a render delay can never change a grade. The numbers are the initial design
 * values (Owner: tune in the iPhone HV) and live only here; the display stages below are derived from them, so a tuned value carries over.
 * Nothing here is shown as a gauge, bar, ring, number or countdown (Q3): the player reads the beef, the sheen, the steam and the smoke.
 */

/** The pan closes by itself here (counts as overdone). */
export const PAN_TOTAL_MS = 6000;
/** The first moment of "best" (inclusive). */
export const BEST_START_MS = 2100;
/** The first moment of "overdone" (so "best" ends just before it). */
export const BEST_END_MS = 4200;
/** "取り出す！" ignores a press this soon after the pan opened (the finger that pressed the pill). */
export const PAN_ARM_MS = 300;
/** Display only: the smoke starts this long before BEST_END_MS (reaction time ~330ms + margin). */
export const SMOKE_LEAD_MS = 600;
/** Display only: the first sizzle starts this long before BEST_START_MS. */
export const ONSET_LEAD_MS = 300;

export type PanGrade = "early" | "best" | "overdone";
/** 0 raw, 1 starting to sear, 2 best, 3 about to burn (still best), 4 burnt. */
export type PanStage = 0 | 1 | 2 | 3 | 4;

/** Elapsed time as the rules read it: NaN, +-Infinity and negatives (a clock that went backwards) count as 0. */
export function sanitizeElapsed(elapsedMs: number): number {
  return Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
}

/** 0..1 over the whole pan time. */
export function progressAt(elapsedMs: number): number {
  return Math.min(1, sanitizeElapsed(elapsedMs) / PAN_TOTAL_MS);
}

export function gradeAt(elapsedMs: number): PanGrade {
  const t = sanitizeElapsed(elapsedMs);
  if (t >= BEST_END_MS) return "overdone";
  if (t >= BEST_START_MS) return "best";
  return "early";
}

/** The display stage at `elapsedMs`. Every edge is derived from the constants above. */
export function panStageAt(elapsedMs: number): PanStage {
  const t = sanitizeElapsed(elapsedMs);
  if (t >= BEST_END_MS) return 4;
  if (t >= BEST_END_MS - SMOKE_LEAD_MS) return 3;
  if (t >= BEST_START_MS) return 2;
  if (t >= BEST_START_MS - ONSET_LEAD_MS) return 1;
  return 0;
}

/** The moments (ms after the start) at which the display stage changes, ascending. */
export function panStageEdges(): readonly number[] {
  return [BEST_START_MS - ONSET_LEAD_MS, BEST_START_MS, BEST_END_MS - SMOKE_LEAD_MS, BEST_END_MS];
}

export type PanFinish = "take" | "timeout";

export type PanState =
  | { status: "idle" }
  | { status: "running"; startedAt: number }
  | { status: "finished"; grade: PanGrade; progress: number; elapsedMs: number; by: PanFinish };

export type PanEvent =
  | { type: "START"; now: number }
  | { type: "TAKE"; now: number }
  | { type: "TICK"; now: number }
  | { type: "CANCEL" };

export const PAN_IDLE: PanState = { status: "idle" };

function finishByTimeout(): PanState {
  return { status: "finished", grade: "overdone", progress: 1, elapsedMs: PAN_TOTAL_MS, by: "timeout" };
}

/**
 * idle --START--> running --TAKE--> finished{grade}
 *                 running --TICK(t >= PAN_TOTAL_MS)--> finished{overdone, timeout}
 *                 any --CANCEL--> idle
 *
 * Every refused event returns the SAME state object. TAKE inside PAN_ARM_MS is ignored (a mis-tap, not a grade). Time-out wins a tie: a TAKE
 * stamped at or after PAN_TOTAL_MS is the time-out. A clock that went backwards counts as elapsed 0. A finished pan ignores everything but CANCEL.
 */
export function panReducer(state: PanState, event: PanEvent): PanState {
  switch (event.type) {
    case "CANCEL":
      return state.status === "idle" ? state : PAN_IDLE;
    case "START":
      return state.status === "idle" ? { status: "running", startedAt: Number.isFinite(event.now) ? event.now : 0 } : state;
    case "TICK": {
      if (state.status !== "running") return state;
      return sanitizeElapsed(event.now - state.startedAt) >= PAN_TOTAL_MS ? finishByTimeout() : state;
    }
    case "TAKE": {
      if (state.status !== "running") return state;
      const elapsedMs = sanitizeElapsed(event.now - state.startedAt);
      if (elapsedMs >= PAN_TOTAL_MS) return finishByTimeout();
      if (elapsedMs < PAN_ARM_MS) return state;
      return { status: "finished", grade: gradeAt(elapsedMs), progress: progressAt(elapsedMs), elapsedMs, by: "take" };
    }
  }
}

export interface PanResultCopy {
  /** The one line shown right away. */
  label: string;
}

/** The result line. It names what to look at, never the recipe or a target (AC-12). */
export function panResultCopy(grade: PanGrade, by: PanFinish): PanResultCopy {
  if (grade === "best") return { label: "ちょうどいい！" };
  if (grade === "early") return { label: "まだ赤みが残ってる" };
  return { label: by === "timeout" ? "出し遅れた…" : "焦げちゃった…（煙が出る前に！）" };
}
