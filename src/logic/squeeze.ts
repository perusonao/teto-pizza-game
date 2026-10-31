/**
 * Expansion Batch 13 (Issue #708; Owner decision 2026-10-31, "案A"): a squeezable topping (mayonnaise) is placed by ONE stroke across the
 * dough in the TOPPING step -- one stroke = one piece. A tap (no real movement) places the ordinary single piece (drawn as a droplet).
 *
 * Pure helpers shared by the stage (live preview), the reducer (the authoritative sanitising + the piece's anchor) and the renderer. Every
 * coordinate is a dough percent (the same 0-100 space as `PlacedTopping.x / y`). A stroke never costs more than one piece of stock and
 * counts as exactly ONE piece for scoring (which reads only the piece's anchor `x / y`, never the trail).
 */
import { DOUGH_RADIUS } from "./pizzaCoordinates";

/** Ingredient ids placed by a stroke (a squeezed bead) rather than a single drop. */
const SQUEEZE_INGREDIENT_IDS: ReadonlySet<string> = new Set(["mayo"]);

export function isSqueezeIngredientId(ingredientId: unknown): boolean {
  return typeof ingredientId === "string" && SQUEEZE_INGREDIENT_IDS.has(ingredientId);
}

/** The longest stroke, as a fraction of the dough's diameter (Owner: 60%). */
export const SQUEEZE_MAX_LENGTH_RATIO = 0.6;
/** The dough's diameter in dough percent (the round pan's circle). */
export const SQUEEZE_DOUGH_DIAMETER = 2 * DOUGH_RADIUS;
/** The longest stroke, in dough percent. */
export const SQUEEZE_MAX_LENGTH = SQUEEZE_MAX_LENGTH_RATIO * SQUEEZE_DOUGH_DIAMETER;
/** A stroke shorter than this (dough percent) is a tap: it places the single droplet piece. */
export const SQUEEZE_MIN_LENGTH = 4;
/** Samples closer than this (dough percent) to the previous kept sample are dropped. */
export const SQUEEZE_MIN_STEP = 1.2;
/** A stored trail never has more points than this. */
export const SQUEEZE_MAX_POINTS = 48;

export interface TrailPoint {
  x: number;
  y: number;
}

const isFinitePoint = (p: unknown): p is TrailPoint =>
  typeof p === "object" && p !== null && Number.isFinite((p as TrailPoint).x) && Number.isFinite((p as TrailPoint).y);

/** The polyline's length (dough percent). */
export function trailLength(points: readonly TrailPoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return length;
}

/** Cuts the polyline where its length reaches `maxLength` (the last point is interpolated on the segment that crosses it). */
export function capTrailLength(points: readonly TrailPoint[], maxLength: number = SQUEEZE_MAX_LENGTH): TrailPoint[] {
  const out: TrailPoint[] = [];
  let length = 0;
  for (let i = 0; i < points.length; i += 1) {
    if (i === 0) {
      out.push({ ...points[0] });
      continue;
    }
    const prev = points[i - 1];
    const segment = Math.hypot(points[i].x - prev.x, points[i].y - prev.y);
    if (length + segment <= maxLength) {
      out.push({ ...points[i] });
      length += segment;
      continue;
    }
    const remaining = maxLength - length;
    if (remaining > 0 && segment > 0) {
      const t = remaining / segment;
      out.push({ x: prev.x + (points[i].x - prev.x) * t, y: prev.y + (points[i].y - prev.y) * t });
    }
    break;
  }
  return out;
}

/** Drops samples closer than `minStep` to the previous kept one (the last sample is always kept, so the stroke's end is exact). */
export function thinTrail(points: readonly TrailPoint[], minStep: number = SQUEEZE_MIN_STEP): TrailPoint[] {
  if (points.length <= 2) return points.map((p) => ({ ...p }));
  const out: TrailPoint[] = [{ ...points[0] }];
  for (let i = 1; i < points.length - 1; i += 1) {
    const last = out[out.length - 1];
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= minStep) out.push({ ...points[i] });
  }
  out.push({ ...points[points.length - 1] });
  return out;
}

/** Keeps at most `max` points, evenly spread (always including the first and the last). */
function limitPoints(points: readonly TrailPoint[], max: number): TrailPoint[] {
  if (points.length <= max) return points.map((p) => ({ ...p }));
  const out: TrailPoint[] = [];
  for (let i = 0; i < max; i += 1) out.push({ ...points[Math.round((i * (points.length - 1)) / (max - 1))] });
  return out;
}

/**
 * The reducer's boundary: anything that is not a clean stroke (not an array, a non-finite point, too short to be more than a tap) is `null`
 * (the piece is then placed as the ordinary single drop). Otherwise the points are thinned, the length is capped at `SQUEEZE_MAX_LENGTH`
 * and the point count at `SQUEEZE_MAX_POINTS`. `clamp` (the pan's own) keeps every point on the dough.
 */
export function normalizeTrail(raw: unknown, clamp: (x: number, y: number) => TrailPoint = (x, y) => ({ x, y })): TrailPoint[] | null {
  if (!Array.isArray(raw)) return null;
  const finite = raw.filter(isFinitePoint).slice(0, 4 * SQUEEZE_MAX_POINTS).map((p) => clamp(p.x, p.y));
  if (finite.length < 2) return null;
  const capped = limitPoints(capTrailLength(thinTrail(finite)), SQUEEZE_MAX_POINTS);
  if (capped.length < 2 || trailLength(capped) < SQUEEZE_MIN_LENGTH) return null;
  return capped;
}

/** The point halfway along the polyline (by length): where the piece is anchored (what scoring and the open-spot check see). */
export function trailAnchor(points: readonly TrailPoint[]): TrailPoint {
  if (points.length === 0) return { x: 50, y: 50 };
  const half = trailLength(points) / 2;
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    const segment = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (segment > 0 && length + segment >= half) {
      const t = (half - length) / segment;
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
    }
    length += segment;
  }
  return { ...points[points.length - 1] };
}

/** The same stroke moved by (dx, dy), each point clamped back by `clamp` (used when the open-spot search nudged the anchor). */
export function shiftTrail(points: readonly TrailPoint[], dx: number, dy: number, clamp: (x: number, y: number) => TrailPoint = (x, y) => ({ x, y })): TrailPoint[] {
  return points.map((p) => clamp(p.x + dx, p.y + dy));
}

/** An SVG path (`M x y L x y ...`, dough percent) for the stroke. */
export function trailPathD(points: readonly TrailPoint[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}
