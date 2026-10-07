/**
 * Issue #418 (Pizza Cutting Human Feel): the player's traced finger path is the authority for a
 * cut. Pure helpers -- no DOM, no React -- that turn raw dough-percent pointer samples into the
 * committed trace. Deliberately NOT a straightening step: the only filtering is dropping samples
 * closer than `TRACE_SAMPLE_MIN_DISTANCE` to the previous one (sensor jitter); the path is never
 * smoothed, fitted or snapped to an ideal centre/angle/slice.
 */
import { DOUGH_CENTER, DOUGH_RADIUS, isInsideDough, type DoughPoint } from "../pizzaCoordinates";
import { buildRimToRimCutLine, type CutLine } from "./types";

/** Samples closer than this (dough-percent) to the last kept sample are sensor jitter. */
export const TRACE_SAMPLE_MIN_DISTANCE = 1;
/**
 * Straight is the default shape of a cut. A stroke whose every point stays within
 * `max(TRACE_STRAIGHT_FLOOR, TRACE_STRAIGHT_RATIO * chordLength)` (dough-percent) of its own
 * start->end chord, without doubling back, is one intended straight cut: an arm's natural arc and
 * hand shake scale with how far the finger travels, so the allowance does too. Only a bend beyond
 * that (a deliberate curve or change of direction) keeps the traced path.
 */
export const TRACE_STRAIGHT_FLOOR = 2.5;
export const TRACE_STRAIGHT_RATIO = 0.12;
/** A traced path shorter than this (dough-percent) is a tap, not a cut, and is discarded. */
export const TRACE_MIN_LENGTH = 8;

export function tracePathLength(path: readonly DoughPoint[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return total;
}

/**
 * Absorbs hand shake only: returns `[start, end]` when the whole path hugs its own start->end chord
 * (see `TRACE_STRAIGHT_RATIO`), else the path untouched. Never fits, snaps to an ideal angle
 * or extends the ends -- start and end stay exactly where the finger put them.
 */
export function stabilizeTrace(path: readonly DoughPoint[]): readonly DoughPoint[] {
  if (path.length < 3) return path;
  const a = path[0];
  const b = path[path.length - 1];
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < TRACE_MIN_LENGTH) return path;
  const tolerance = Math.max(TRACE_STRAIGHT_FLOOR, TRACE_STRAIGHT_RATIO * length);
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  for (let i = 1; i < path.length - 1; i += 1) {
    const rx = path[i].x - a.x;
    const ry = path[i].y - a.y;
    const along = rx * ux + ry * uy;
    const across = Math.abs(rx * uy - ry * ux);
    if (across > tolerance) return path;
    if (along < -tolerance || along > length + tolerance) return path;
  }
  return [a, b];
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
  const path = stabilizeTrace(rawPath);
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
