/**
 * Issue #418 (Pizza Cutting Human Feel): a cut is the straight line the player drags -- pressed at
 * a start point, released at an end point -- and nothing else. Pure helpers, no DOM, no React.
 *
 * Deliberately no smoothing, auto-straightening, curve fitting, timers or snapping: the line runs
 * exactly through the point where the finger went down and the point where it is (or lifted),
 * clipped to the pizza. The live preview and the commit are one function of the same two points,
 * so what is drawn while dragging is exactly where the pizza is cut.
 */
import { DOUGH_CENTER, DOUGH_RADIUS, type DoughPoint } from "../pizzaCoordinates";
import { buildRimToRimCutLine, type CutLine } from "./types";

/** A drag shorter than this (dough-percent, measured inside the pizza) is a tap, not a cut. */
export const TRACE_MIN_LENGTH = 8;

export function tracePathLength(path: readonly DoughPoint[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return total;
}

/**
 * The part of the straight drag `start -> end` that lies on the pizza: `[from, to]` in drag order,
 * or `null` if the drag misses the pizza or is shorter than `TRACE_MIN_LENGTH` there. Either point
 * may be outside the pizza (a stroke may start or end past the rim); the cut is then clipped to
 * the rim along the same line, never bent or extended. A point inside the pizza is kept exactly.
 */
export function buildDragCutPath(start: DoughPoint, end: DoughPoint): readonly [DoughPoint, DoughPoint] | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const ox = start.x - DOUGH_CENTER;
  const oy = start.y - DOUGH_CENTER;
  const b = 2 * (ox * dx + oy * dy);
  const c = ox * ox + oy * oy - DOUGH_RADIUS * DOUGH_RADIUS;
  const disc = b * b - 4 * a * c;
  if (disc <= 0) return null;
  const root = Math.sqrt(disc);
  const lo = Math.max(0, (-b - root) / (2 * a));
  const hi = Math.min(1, (-b + root) / (2 * a));
  if (hi <= lo) return null;
  const from = lo === 0 ? start : { x: start.x + lo * dx, y: start.y + lo * dy };
  const to = hi === 1 ? end : { x: start.x + hi * dx, y: start.y + hi * dy };
  if (Math.hypot(to.x - from.x, to.y - from.y) < TRACE_MIN_LENGTH) return null;
  return [from, to];
}

/**
 * Builds the committed cut from a drag path, or `null` for a tap-length path. `path` is the cut
 * as drawn (always the two points of a straight drag, see `buildDragCutPath`); `start`/`end` is
 * the same line run out to the rim, which is what evaluation and the piece regions use.
 */
export function buildTracedCutLine(path: readonly DoughPoint[]): CutLine | null {
  if (path.length < 2 || tracePathLength(path) < TRACE_MIN_LENGTH) return null;
  const chord = buildRimToRimCutLine(path[0], path[path.length - 1]);
  return chord ? { ...chord, path } : null;
}

/**
 * #427: the CUT contract is straight cuts only. A line whose `path` has more than two points
 * (the gesture never produces one; only a direct dispatch can carry one) is committed as the
 * straight segment between the path's first and last point -- the same two points
 * `chordOf` (./regions.ts) already reads -- so drawing, pieces and scoring describe one line.
 * `start`/`end` and every other field are kept. A path of two points or fewer, or none, is
 * returned as the same object. Never mutates `line`.
 */
export function normalizeCutLine(line: CutLine): CutLine {
  const path = line.path;
  if (!path || path.length <= 2) return line;
  return { ...line, path: [path[0], path[path.length - 1]] };
}
