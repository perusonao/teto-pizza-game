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

/**
 * Projects one touch/drag point (dough-percent coordinates, same space as
 * `pizzaCoordinates.ts`) onto the shape, moving the two angular control points bracketing
 * that point's angle toward the touch distance -- weighted by angular closeness, so a touch
 * exactly at a control point's own angle moves only that point, and a touch halfway between
 * two moves both equally (D0 §4.2). A point outside the dough (distance > DOUGH_RADIUS) is
 * clamped to the rim first, matching every other gesture family's own `isInsideDough`/
 * `clampToDough` convention. Returns a new shape; never mutates `shape`.
 */
export function applyStretchPoint(shape: DoughShape, xDough: number, yDough: number): DoughShape {
  const dx = xDough - DOUGH_CENTER;
  const dy = yDough - DOUGH_CENTER;
  const distance = Math.min(Math.hypot(dx, dy), DOUGH_RADIUS);
  if (distance <= 0) return shape;

  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI * 2;

  const step = (Math.PI * 2) / DOUGH_SHAPE_POINTS;
  const rawIndex = angle / step;
  const index0 = Math.floor(rawIndex) % DOUGH_SHAPE_POINTS;
  const index1 = (index0 + 1) % DOUGH_SHAPE_POINTS;
  const weight1 = rawIndex - Math.floor(rawIndex);
  const weight0 = 1 - weight1;

  const radii = shape.radii.slice();
  radii[index0] = lerpTowardAtLeast(radii[index0], distance, weight0);
  radii[index1] = lerpTowardAtLeast(radii[index1], distance, weight1);
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
