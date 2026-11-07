/**
 * Cooking operation T9 (Issue #784), C-A': the CUT step's "armed two-point" alternative input, as a PURE state machine (unwired, no UI, Production OFF).
 *
 * The natural gesture (a real drag, committed as the straight line the finger showed) is untouched. This is an OPTIONAL second door: turn "point cut" ON
 * (ARM), tap a start point, tap an end point, then press 切る. The committed line is `buildTracedCutLine([start, end])` -- the same function a two-point swipe
 * ends in -- so it is run out to the rim exactly as a swipe is, and nothing else (evaluation, pieces, save, scoring) can tell the two apart.
 *
 * #418 is kept by construction: CUT has "no tap outcome". While NOT armed, POINT returns the very same state (a stray tap places nothing). Armed mode is
 * retained after a cut so several cuts can follow (Owner-provisional, #784), is dropped automatically when the cut limit is reached, and is dropped by
 * CANCEL (blur / hidden / resize / lost capture). No edge snapping (Owner-provisional): the two points are exactly where the taps landed. The explicit
 * commit is 切る; a second tap never commits by itself.
 *
 * Pure: no DOM, no React, no reducer, no storage, never reads the clock, never mutates its input. Committing the line stays the existing ADD_CUT_LINE /
 * `onAddCutLine`, which this file does not know about. The keyboard-cursor way of producing points is a separate design (it would simply feed POINT).
 */
import { DOUGH_CENTER, DOUGH_RADIUS, type DoughPoint } from "../pizzaCoordinates";
import { TRACE_MIN_LENGTH, buildTracedCutLine } from "../cut/trace";
import type { CutLine } from "../cut/types";

export interface CutAltState {
  /** Point-cut mode. Default OFF; while OFF, taps do nothing (#418). */
  readonly armed: boolean;
  readonly a: DoughPoint | null;
  readonly b: DoughPoint | null;
  /** Set when the last accepted-looking tap was too close to the start (shorter than the swipe minimum); shown as words, never as a failure. */
  readonly hint: "too-short" | null;
  /** The round / step this state belongs to; an INVALIDATE with another revision starts over. */
  readonly revision: number;
}

export type CutAltEvent =
  | { type: "ARM" }
  | { type: "DISARM" }
  | { type: "POINT"; x: number; y: number }
  /** Forget the two points but stay armed. */
  | { type: "CLEAR_POINTS" }
  /** blur / visibilitychange hidden / resize / lost pointer capture: drop everything, including armed mode. */
  | { type: "CANCEL" }
  | { type: "INVALIDATE"; revision: number };

export interface CutAltContext {
  /** Lines already on the pizza. */
  readonly linesUsed: number;
  /** The CUT step's cap (`cutRequiredCount + 2` in PizzaStage). */
  readonly limit: number;
}

export function createCutAltState(revision = 0): CutAltState {
  return { armed: false, a: null, b: null, hint: null, revision };
}

function isOnPizza(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x - DOUGH_CENTER, y - DOUGH_CENTER) <= DOUGH_RADIUS;
}

function dist(p: DoughPoint, x: number, y: number): number {
  return Math.hypot(x - p.x, y - p.y);
}

export function cutAltReduce(state: CutAltState, event: CutAltEvent): CutAltState {
  switch (event.type) {
    case "ARM":
      return state.armed ? state : { ...state, armed: true, a: null, b: null, hint: null };
    case "DISARM":
      return !state.armed && state.a === null && state.b === null && state.hint === null ? state : { ...state, armed: false, a: null, b: null, hint: null };
    case "POINT": {
      // #418: a tap does nothing until the player has turned point-cut ON.
      if (!state.armed) return state;
      if (!isOnPizza(event.x, event.y)) return state;
      const p: DoughPoint = { x: event.x, y: event.y };
      if (state.a === null) return { ...state, a: p, b: null, hint: null };
      // Too close to the start to be a cut (shorter than a swipe may be): keep the start, say so, place no end.
      if (dist(state.a, p.x, p.y) < TRACE_MIN_LENGTH) return state.hint === "too-short" ? state : { ...state, hint: "too-short" };
      return { ...state, b: p, hint: null };
    }
    case "CLEAR_POINTS":
      return state.a === null && state.b === null && state.hint === null ? state : { ...state, a: null, b: null, hint: null };
    case "CANCEL":
      return !state.armed && state.a === null && state.b === null && state.hint === null ? state : { ...state, armed: false, a: null, b: null, hint: null };
    case "INVALIDATE":
      return Number.isFinite(event.revision) && event.revision !== state.revision ? createCutAltState(event.revision) : state;
    default:
      return state;
  }
}

/** What to draw before the commit: the two markers (start = circle, end = square: shapes, not only colours) and the straight line between them. */
export function cutAltPreview(state: CutAltState): { start: DoughPoint | null; end: DoughPoint | null; line: { from: DoughPoint; to: DoughPoint } | null } {
  return { start: state.a, end: state.b, line: state.a && state.b ? { from: state.a, to: state.b } : null };
}

/** The line 切る would commit, or null (not armed, a point missing, too short, or the line misses the pizza). Same function a two-point swipe ends in. */
export function cutAltLine(state: CutAltState): CutLine | null {
  if (!state.armed || !state.a || !state.b) return null;
  return buildTracedCutLine([state.a, state.b]);
}

/** Whether 切る can be pressed right now (the button's enabled state). */
export function canCommitCutAlt(state: CutAltState, ctx: CutAltContext): boolean {
  return ctx.linesUsed < ctx.limit && cutAltLine(state) !== null;
}

/**
 * The explicit 切る. Returns the line to hand to the existing `onAddCutLine` (or null when nothing can be committed -- the state is then unchanged) and
 * the next state: the two points are cleared, armed mode is RETAINED, unless that cut reaches the limit, in which case armed mode ends too.
 */
export function commitCutAlt(state: CutAltState, ctx: CutAltContext): { state: CutAltState; line: CutLine | null } {
  if (!canCommitCutAlt(state, ctx)) return { state, line: null };
  const line = cutAltLine(state);
  if (!line) return { state, line: null };
  const reached = ctx.linesUsed + 1 >= ctx.limit;
  return { state: { ...state, armed: reached ? false : state.armed, a: null, b: null, hint: null }, line };
}

export type CutAltPhase = "off" | "need-start" | "need-end" | "too-short" | "ready";

/** One word for the words shown / read aloud. */
export function cutAltPhase(state: CutAltState): CutAltPhase {
  if (!state.armed) return "off";
  if (state.a === null) return "need-start";
  if (state.b === null) return state.hint === "too-short" ? "too-short" : "need-end";
  return "ready";
}

export const CUT_ALT_PHASE_TEXT_JA: Readonly<Record<CutAltPhase, string>> = {
  off: "点で切る: オフ",
  "need-start": "始点を押してください",
  "need-end": "終点を押してください",
  "too-short": "もう少し離れた場所を押してください",
  ready: "「切る」を押すと線を引きます",
};
