/**
 * Issue #33 D1: pure shape math for the DOUGH making step (radial stretch, N=8 control
 * points -- see docs/reports/TETO_ISSUE-33_DOUGH-D0_Fresh-Audit.md §3/§4). Mirrors
 * sauceQuantity.ts/sauceField.ts's own pure-module convention: no DOM, no React, no timing --
 * every function here is a deterministic function of its inputs, safe to unit test directly
 * and to call from both PizzaStage's live gesture preview and the reducer's own validation.
 */

import { DOUGH_CENTER, DOUGH_RADIUS } from "./pizzaCoordinates";

/** Number of angular control points -- chosen (D0 §3, Candidate C) so the boundary can look
 *  organically hand-stretched from day one and so later roundness/evenness/distortion
 *  scoring (D3) can derive directly from the same array without a shape-model rewrite. */
export const DOUGH_SHAPE_POINTS = 8;

/** "小さく厚い丸い生地" -- a fresh dough starts as a small, uniform circle well inside the
 *  full DOUGH_RADIUS target (D0 §4.1). Provisional, tunable during D2 Human Feel. */
export const INITIAL_DOUGH_RADIUS_FRACTION = 0.38;
export const INITIAL_DOUGH_RADIUS = DOUGH_RADIUS * INITIAL_DOUGH_RADIUS_FRACTION;

/** "ピザとして十分な大きさ" -- size-only D1 completion gate (D0 §8). Provisional, tunable
 *  during D2 Human Feel; deliberately does not evaluate roundness/evenness/symmetry. */
export const DOUGH_COMPLETION_THRESHOLD = 0.75;

export interface DoughShape {
  /** Radius (dough-percent units, 0..DOUGH_RADIUS) at each of the N control points, indexed
   *  by angle `i * (2*PI/DOUGH_SHAPE_POINTS)` measured the same way `applyStretchPoint`
   *  projects a touch point below -- index 0 is angle 0 (dough-local +x, "east"), increasing
   *  clockwise in screen space (standard atan2/canvas convention). */
  radii: number[];
}

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

/** A committed shape is only ever valid with exactly N finite radii, each within
 *  [0, DOUGH_RADIUS] -- the same "stale/late/corrupted action" guard shape every other
 *  reducer action's payload validator (isValidSauceDepositBatch, etc.) already follows. */
export function isValidDoughShape(shape: DoughShape): boolean {
  return (
    Array.isArray(shape.radii) &&
    shape.radii.length === DOUGH_SHAPE_POINTS &&
    shape.radii.every((r) => isFiniteNumber(r) && r >= 0 && r <= DOUGH_RADIUS)
  );
}

export function createInitialDoughShape(): DoughShape {
  return { radii: new Array(DOUGH_SHAPE_POINTS).fill(INITIAL_DOUGH_RADIUS) };
}

function lerpTowardAtLeast(current: number, distance: number, weight: number): number {
  // Monotonic by construction (D0 §4.6): the target is never below `current`, so blending
  // toward it by any weight in [0, 1] can never shrink the point -- "pulling always helps,
  // never hurts," with no separate clamp-against-shrinking check needed anywhere else.
  const target = Math.max(current, distance);
  return Math.min(current + (target - current) * weight, DOUGH_RADIUS);
}

/** Issue #33 D2 Human Feel Fix: how far a stretch's influence spreads across the ring of 8
 *  control points, keyed by continuous circular distance (in control-point-index units) from
 *  the touch angle. D1 moved only the two bracketing points, so a single full-reach pull
 *  could jump one point from its initial radius straight to DOUGH_RADIUS while its immediate
 *  neighbor stayed untouched -- a ~30-unit gap over one 45° step that read as a sharp
 *  spike/polygon-vertex rather than stretched dough. `1.0` at the touch itself, `0.45` one
 *  control point away, `0.12` two away, `0` beyond that (D0/D2 audit's own example range:
 *  adjacent ~0.35-0.55, next ~0-0.15) -- linearly interpolated between those anchors so a
 *  touch between two control points doesn't snap discontinuously from one weight profile to
 *  another. Deliberately a simple piecewise-linear falloff, not a physics/spring model. */
const STRETCH_ADJACENT_WEIGHT = 0.45;
const STRETCH_NEXT_WEIGHT = 0.12;

/** Issue #33 D2: the spike-suppression constraint (D0/D2 audit §3) -- within one
 *  `applyStretchPoint` call, a point may jump at most this far above the average of its two
 *  immediate neighbors' *pre-call* radii. This is a local, neighbor-aware clamp (never a
 *  global average, never forced toward a perfect circle): a point that was already a valid
 *  outlier from earlier gestures is never pulled back down (see the `Math.max` floor in
 *  `applyStretchPoint` below, which keeps every point's own monotonic non-decrease intact),
 *  and a point far from the current touch is never touched by it at all. Reaching
 *  DOUGH_RADIUS at one exact spot now takes a few gestures in roughly the same area (each one
 *  also raises that area's neighbors, which raises the next pull's own cap) rather than one
 *  instant full-reach drag -- "progressive and controllable," not "rubbery snap." */
const STRETCH_SPIKE_MAX_DELTA = 12;

function circularIndexDistance(a: number, b: number, count: number): number {
  const raw = Math.abs(a - b) % count;
  return raw > count / 2 ? count - raw : raw;
}

/** Piecewise-linear falloff: 1 at d=0, STRETCH_ADJACENT_WEIGHT at d=1,
 *  STRETCH_NEXT_WEIGHT at d=2, 0 beyond -- see STRETCH_ADJACENT_WEIGHT's own doc comment. */
function stretchFalloff(circularDistance: number): number {
  if (circularDistance <= 1) {
    return 1 + (STRETCH_ADJACENT_WEIGHT - 1) * circularDistance;
  }
  if (circularDistance <= 2) {
    return STRETCH_ADJACENT_WEIGHT + (STRETCH_NEXT_WEIGHT - STRETCH_ADJACENT_WEIGHT) * (circularDistance - 1);
  }
  return 0;
}

/**
 * Projects one touch/drag point (dough-percent coordinates, same space as
 * `pizzaCoordinates.ts`) onto the shape (D0 §4.2, D2 Human Feel Fix). The touch angle's
 * closest control point receives the strongest pull; its immediate neighbors (circular
 * indices i-1/i+1) follow with a meaningful fraction, and the next ring out (i-2/i+2) with a
 * smaller fraction, per `stretchFalloff` above -- "neighboring dough regions stretch somewhat
 * together" rather than only the two points nearest the touch moving in isolation. Each
 * point's own per-call increase is then capped relative to its pre-call neighbors
 * (`STRETCH_SPIKE_MAX_DELTA`) so one drag can't spike a single point far past its
 * surroundings, while a `Math.max` floor against that point's own pre-call value keeps every
 * point strictly monotonic non-decreasing across calls (D0 §4.6, unchanged) -- the clamp can
 * only soften *this* gesture's own reach, never undo growth a previous gesture already
 * committed. A point outside the dough (distance > DOUGH_RADIUS) is clamped to the rim first,
 * matching every other gesture family's own `isInsideDough`/`clampToDough` convention.
 * Returns a new shape; never mutates `shape`.
 */
export function applyStretchPoint(shape: DoughShape, xDough: number, yDough: number): DoughShape {
  const dx = xDough - DOUGH_CENTER;
  const dy = yDough - DOUGH_CENTER;
  const distance = Math.min(Math.hypot(dx, dy), DOUGH_RADIUS);
  if (distance <= 0) return shape;

  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI * 2;

  const n = shape.radii.length;
  const step = (Math.PI * 2) / n;
  const rawIndex = angle / step;

  const original = shape.radii;
  const propagated = original.slice();
  for (let i = 0; i < n; i += 1) {
    const weight = stretchFalloff(circularIndexDistance(i, rawIndex, n));
    if (weight <= 0) continue;
    propagated[i] = lerpTowardAtLeast(original[i], distance, weight);
  }

  const radii = propagated.map((value, i) => {
    const prevNeighbor = original[(i - 1 + n) % n];
    const nextNeighbor = original[(i + 1) % n];
    const cap = (prevNeighbor + nextNeighbor) / 2 + STRETCH_SPIKE_MAX_DELTA;
    return Math.max(original[i], Math.min(value, cap));
  });

  return { radii };
}

/** mean(radii) / DOUGH_RADIUS -- the one and only D1 completion signal (size, not
 *  roundness/evenness/symmetry -- see DOUGH_COMPLETION_THRESHOLD's own doc comment). */
export function doughSizeProgress(shape: DoughShape): number {
  const sum = shape.radii.reduce((total, r) => total + r, 0);
  return sum / shape.radii.length / DOUGH_RADIUS;
}

export function isDoughShapeComplete(
  shape: DoughShape,
  threshold: number = DOUGH_COMPLETION_THRESHOLD,
): boolean {
  return doughSizeProgress(shape) >= threshold;
}

/**
 * Turns the raw 8-point radial array into a smoothed, closed SVG path (Catmull-Rom-to-Bezier
 * through every control point) so the rendered boundary reads as an organic hand-stretched
 * shape rather than a visible octagon -- the same "smooth a coarse control structure for
 * display only, never for the underlying metrics" idea `smoothSauceFieldForDisplay`
 * (sauceField.ts) already uses for the sauce heatmap.
 *
 * `scale` remaps the (DOUGH_CENTER/DOUGH_RADIUS-based, 0-100) coordinate space this shape is
 * stored in: the default `1` keeps 0-100 dough-percent (for a `viewBox="0 0 100 100"` SVG,
 * matching every other pizza-stage overlay's own convention), while `0.01` produces 0-1
 * fractional coordinates for an `objectBoundingBox`-unit `<clipPath>` (PizzaStage's
 * carry-through clip -- see its own file for why that unit is used).
 */
export function smoothDoughShapeForDisplay(shape: DoughShape, scale = 1): string {
  const n = shape.radii.length;
  const step = (Math.PI * 2) / n;
  const points = shape.radii.map((radius, i) => {
    const angle = i * step;
    return {
      x: (DOUGH_CENTER + radius * Math.cos(angle)) * scale,
      y: (DOUGH_CENTER + radius * Math.sin(angle)) * scale,
    };
  });
  const at = (i: number) => points[((i % n) + n) % n];

  const start = at(0);
  let d = `M ${start.x.toFixed(4)} ${start.y.toFixed(4)}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(4)} ${cp1y.toFixed(4)} ${cp2x.toFixed(4)} ${cp2y.toFixed(4)} ${p2.x.toFixed(4)} ${p2.y.toFixed(4)}`;
  }
  return `${d} Z`;
}
