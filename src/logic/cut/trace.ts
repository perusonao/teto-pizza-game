/**
 * Issue #418 (Pizza Cutting Human Feel): the player's traced finger path is the authority for a
 * cut. Pure helpers -- no DOM, no React -- that turn raw dough-percent pointer samples into the
 * committed trace. Deliberately NOT a straightening step: the only filtering is dropping samples
 * closer than `TRACE_SAMPLE_MIN_DISTANCE` to the previous one (sensor jitter); the path is never
 * straightened or snapped to an ideal centre/angle/slice -- the traced path is exactly where the
 * pizza is cut. The only way a stroke becomes straight is the player's explicit "hold still"
 * (`straightenTrace`, below), which is shown before the finger lifts.
 */
import { DOUGH_CENTER, DOUGH_RADIUS, isInsideDough, type DoughPoint } from "../pizzaCoordinates";
import { buildRimToRimCutLine, type CutLine } from "./types";

/** Samples closer than this (dough-percent) to the last kept sample are sensor jitter. */
export const TRACE_SAMPLE_MIN_DISTANCE = 1;
/**
 * Explicit straight-line assist (Pilot values, tuned on Owner HV). Holding the finger still for
 * `STRAIGHT_HOLD_MS` (it may wobble by up to `STRAIGHT_HOLD_TOLERANCE` dough-percent) turns the
 * stroke drawn so far into the straight start->tip line -- visibly, before the finger lifts. A
 * stroke that is too short, or clearly curved (sag over `STRAIGHT_MAX_SAG_RATIO` of its length),
 * is never straightened, so a pause in a deliberate curve cannot flatten it.
 */
export const STRAIGHT_HOLD_MS = 400;
export const STRAIGHT_HOLD_TOLERANCE = 2;
export const STRAIGHT_MIN_LENGTH = 25;
export const STRAIGHT_MAX_SAG_RATIO = 0.06;

/** `[start, tip]` for a stroke that may be straightened by a hold, else `null`. Pure. */
export function straightenTrace(trace: readonly DoughPoint[]): readonly DoughPoint[] | null {
  if (trace.length < 2) return null;
  const a = trace[0];
  const b = trace[trace.length - 1];
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < STRAIGHT_MIN_LENGTH) return null;
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  for (const p of trace) {
    const along = (p.x - a.x) * ux + (p.y - a.y) * uy;
    const across = Math.abs((p.x - a.x) * uy - (p.y - a.y) * ux);
    if (across > STRAIGHT_MAX_SAG_RATIO * length) return null;
    if (along < -STRAIGHT_HOLD_TOLERANCE || along > length + STRAIGHT_HOLD_TOLERANCE) return null; // doubled back
  }
  return [a, b];
}

/** A traced path shorter than this (dough-percent) is a tap, not a cut, and is discarded. */
export const TRACE_MIN_LENGTH = 8;

export function tracePathLength(path: readonly DoughPoint[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return total;
}

/** Where the segment `inside -> outside` crosses the dough's rim (either direction of travel). */
export function rimCrossing(inside: DoughPoint, outside: DoughPoint): DoughPoint {
  const dx = outside.x - inside.x;
  const dy = outside.y - inside.y;
  const ox = inside.x - DOUGH_CENTER;
  const oy = inside.y - DOUGH_CENTER;
  const a = dx * dx + dy * dy;
  if (a === 0) return inside;
  const b = 2 * (ox * dx + oy * dy);
  const c = ox * ox + oy * oy - DOUGH_RADIUS * DOUGH_RADIUS;
  const t = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
  return { x: inside.x + t * dx, y: inside.y + t * dy };
}

/**
 * A fast flick can jump from outside the pizza to outside the other side between two samples.
 * If the segment a->b crosses the dough, returns its two rim crossings (entry, exit), else null.
 */
export function segmentRimChord(a: DoughPoint, b: DoughPoint): [DoughPoint, DoughPoint] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const A = dx * dx + dy * dy;
  if (A === 0) return null;
  const ox = a.x - DOUGH_CENTER;
  const oy = a.y - DOUGH_CENTER;
  const B = 2 * (ox * dx + oy * dy);
  const C = ox * ox + oy * oy - DOUGH_RADIUS * DOUGH_RADIUS;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return null;
  const root = Math.sqrt(disc);
  const t1 = (-B - root) / (2 * A);
  const t2 = (-B + root) / (2 * A);
  if (t1 < 0 || t2 > 1) return null;
  return [
    { x: a.x + t1 * dx, y: a.y + t1 * dy },
    { x: a.x + t2 * dx, y: a.y + t2 * dy },
  ];
}

export interface TraceAppendResult {
  readonly path: readonly DoughPoint[];
  /** True once the finger left the dough: the cut ends on the rim and later samples are ignored. */
  readonly exited: boolean;
}

/** Adds one raw sample to an in-progress trace (which must already hold its inside-dough start). */
export function appendTraceSample(path: readonly DoughPoint[], sample: DoughPoint): TraceAppendResult {
  const last = path[path.length - 1];
  if (!isInsideDough(sample.x, sample.y)) {
    return { path: [...path, rimCrossing(last, sample)], exited: true };
  }
  if (Math.hypot(sample.x - last.x, sample.y - last.y) < TRACE_SAMPLE_MIN_DISTANCE) {
    return { path, exited: false };
  }
  return { path: [...path, sample], exited: false };
}

/**
 * Builds the committed cut from a completed trace, or `null` for a tap-length path. `path` is the
 * authority (what is drawn and kept); `start`/`end` is only the straight chord the legacy,
 * non-scoring preview evaluation (./evaluation.ts) still requires -- a transitional input until
 * #288 defines CUT scoring on traces. It uses the sample farthest from the start so a path that
 * curls back near its start still has a direction.
 */
export function buildTracedCutLine(rawPath: readonly DoughPoint[]): CutLine | null {
  if (rawPath.length < 2 || tracePathLength(rawPath) < TRACE_MIN_LENGTH) return null;
  const path = rawPath;
  const first = path[0];
  let farthest = path[1];
  let best = -1;
  for (const p of path) {
    const d = Math.hypot(p.x - first.x, p.y - first.y);
    if (d > best) {
      best = d;
      farthest = p;
    }
  }
  const chord = buildRimToRimCutLine(first, farthest);
  return chord ? { ...chord, path } : null;
}
