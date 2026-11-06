/**
 * DRIZZLE (Issue #579), D1: the trail geometry (pure, deterministic, unwired). No clock, randomness, DOM or storage: the same input always gives the same output.
 * Points live in the production dough space (`../pizzaCoordinates.ts`); every point this file returns is finite and inside the dough.
 */
import { DOUGH_CENTER, DOUGH_RADIUS, clampToDough, clientPointToDoughPercent, isInsideDough } from "../pizzaCoordinates";
import {
  COORD_ABS_MAX,
  QUANT_STEP,
  TAP_LINE_ANGLE,
  TAP_LINE_LENGTH,
  type TrailPoint,
} from "./postBakeLiquid";

/** True for a point-shaped object with finite, plausible coordinates. */
export function isTrailPoint(p: unknown): p is TrailPoint {
  if (typeof p !== "object" || p === null) return false;
  const { x, y } = p as { x?: unknown; y?: unknown };
  return typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= COORD_ABS_MAX && Math.abs(y) <= COORD_ABS_MAX;
}

/** Rounds to `QUANT_STEP` (and never returns -0). */
export function quantize(v: number): number {
  const r = Math.round(v / QUANT_STEP) * QUANT_STEP;
  // Re-round through a fixed decimal so 0.1 * 3 style float noise cannot leak into the saved number.
  const fixed = Math.round(r * 10) / 10;
  return fixed === 0 ? 0 : fixed;
}

/**
 * Projects a point into the dough and quantizes it. Quantizing can push a rim point a hair outside, so a point that is no longer inside is pulled
 * in by `QUANT_STEP` and quantized again (the result is then at most DOUGH_RADIUS - 0.1 + 0.071 from the centre, inside). Not finite / implausible -> null.
 */
export function clampTrailPoint(x: number, y: number): TrailPoint | null {
  if (!isTrailPoint({ x, y })) return null;
  const c = clampToDough(x, y);
  let qx = quantize(c.x);
  let qy = quantize(c.y);
  if (!isInsideDough(qx, qy)) {
    const dx = qx - DOUGH_CENTER;
    const dy = qy - DOUGH_CENTER;
    const k = (DOUGH_RADIUS - QUANT_STEP) / Math.hypot(dx, dy);
    qx = quantize(DOUGH_CENTER + dx * k);
    qy = quantize(DOUGH_CENTER + dy * k);
  }
  return { x: qx, y: qy };
}

export function trailLength(points: readonly TrailPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

/** Keeps at most `max` points (min 2, floored), always the first and last, evenly thinned in between. A short trail is returned as a copy. */
export function thinTrail(points: readonly TrailPoint[], max: number): TrailPoint[] {
  const cap = Number.isFinite(max) ? Math.max(2, Math.floor(max)) : 2;
  if (points.length <= cap) return points.slice();
  const out: TrailPoint[] = [];
  for (let i = 0; i < cap; i++) out.push(points[Math.round((i * (points.length - 1)) / (cap - 1))]);
  return out;
}

/** Drops a point closer than `minDistance` to the last kept one; the final point is always kept (so the stroke still ends where the finger did). */
export function resampleTrail(points: readonly TrailPoint[], minDistance: number): TrailPoint[] {
  if (points.length <= 2) return points.slice();
  const out: TrailPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1];
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= minDistance) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Removes a point equal to the one before it (after quantizing, a slow finger repeats points). */
export function dropRepeats(points: readonly TrailPoint[]): TrailPoint[] {
  const out: TrailPoint[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  return out;
}

/**
 * The deterministic short line a tap makes: a slanted segment of `TAP_LINE_LENGTH`, centred on the tap, never a dot. The centre is first pulled in far
 * enough that the WHOLE segment stays inside the dough, so a tap at the rim still gives the full length (the lab, #746, clamps the two ends separately and
 * can shorten the line there). Not finite -> null.
 */
export function tapTrail(at: { x: number; y: number }): TrailPoint[] | null {
  if (!isTrailPoint(at)) return null;
  const half = TAP_LINE_LENGTH / 2;
  const dx = at.x - DOUGH_CENTER;
  const dy = at.y - DOUGH_CENTER;
  const dist = Math.hypot(dx, dy);
  const maxCentre = DOUGH_RADIUS - half - QUANT_STEP;
  const k = dist > maxCentre ? maxCentre / dist : 1;
  const cx = DOUGH_CENTER + dx * k;
  const cy = DOUGH_CENTER + dy * k;
  const hx = Math.cos(TAP_LINE_ANGLE) * half;
  const hy = Math.sin(TAP_LINE_ANGLE) * half;
  const a = clampTrailPoint(cx - hx, cy - hy);
  const b = clampTrailPoint(cx + hx, cy + hy);
  return a && b ? [a, b] : null;
}

/** A pointer's client position in dough percent (production space), clamped into the dough. A degenerate box or a non-finite input -> null. */
export function clientToTrailPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): TrailPoint | null {
  if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) return null;
  if (rect.width <= 0 || rect.height <= 0) return null;
  // `clientPointToDoughPercent` reads only left / top / width / height, so the plain box is enough (it is typed as a DOMRect).
  const p = clientPointToDoughPercent(clientX, clientY, rect as DOMRect);
  return clampTrailPoint(p.x, p.y);
}
