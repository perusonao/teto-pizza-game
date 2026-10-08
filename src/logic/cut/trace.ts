/**
 * Issue #418 (Pizza Cutting Human Feel): the player's traced finger path is the authority for a
 * cut. Pure helpers -- no DOM, no React -- that turn raw dough-percent pointer samples into the
 * committed trace. Deliberately NOT a straightening step: the only filtering is dropping samples
 * closer than `TRACE_SAMPLE_MIN_DISTANCE` to the previous one (sensor jitter); the path is never
 * snapped to an ideal centre/angle/slice. The one correction is `shapeTrace` (below): a bounded,
 * continuous pull towards the start->tip line that is shared by the live preview and the commit,
 * so what is drawn is exactly where the pizza is cut.
 */
import { DOUGH_CENTER, DOUGH_RADIUS, isInsideDough, type DoughPoint } from "../pizzaCoordinates";
import { buildRimToRimCutLine, type CutLine } from "./types";

/** Samples closer than this (dough-percent) to the last kept sample are sensor jitter. */
export const TRACE_SAMPLE_MIN_DISTANCE = 1;
/**
 * Straight-line assist (Pilot values, tuned on Owner HV). A stroke whose sag from its own
 * start->tip line is small relative to its length (`s = maxSag / length`) is a stroke meant to be
 * straight: every point is pulled onto that line by `lambda`, which is 1 up to `SHAPE_S1`, falls
 * linearly to 0 at `SHAPE_S2` and stays 0 beyond (a deliberate arc / S keeps its shape).
 * Below `SHAPE_MIN_LENGTH` nothing is corrected; the assist then fades in over `SHAPE_RAMP`.
 * Because `lambda` is continuous in `s` and the length, the line never switches on or off.
 */
export const SHAPE_S1 = 0.025;
export const SHAPE_S2 = 0.045;
export const SHAPE_MIN_LENGTH = 25;
export const SHAPE_RAMP = 10;

/**
 * Pure and deterministic: the same samples always give the same path, so the live preview
 * (`shapeTrace` of the trace so far) and the commit (`shapeTrace` of the whole trace) are one line.
 * The first and last points -- where the stroke began and where the finger is -- never move.
 */
export function shapeTrace(raw: readonly DoughPoint[]): readonly DoughPoint[] {
  if (raw.length < 3) return raw;
  const a = raw[0];
  const b = raw[raw.length - 1];
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length <= SHAPE_MIN_LENGTH) return raw;
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  let sag = 0;
  const offsets = raw.map((p) => {
    const across = (p.x - a.x) * uy - (p.y - a.y) * ux;
    sag = Math.max(sag, Math.abs(across));
    return across;
  });
  const s = sag / length;
  const fit = s <= SHAPE_S1 ? 1 : s >= SHAPE_S2 ? 0 : 1 - (s - SHAPE_S1) / (SHAPE_S2 - SHAPE_S1);
  const lambda = fit * Math.min(1, (length - SHAPE_MIN_LENGTH) / SHAPE_RAMP);
  if (lambda <= 0) return raw;
  const last = raw.length - 1;
  return raw.map((p, i) =>
    i === 0 || i === last ? p : { x: p.x - lambda * offsets[i] * uy, y: p.y + lambda * offsets[i] * ux },
  );
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
  const path = shapeTrace(rawPath);
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
