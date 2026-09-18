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
 *  during D2 Human Feel; deliberately does not evaluate roundness/evenness/symmetry.
 *
 *  Issue #33 D3A: this remains the *ideal/reference* boundary (mean radius / DOUGH_RADIUS) --
 *  a UI-only CTA gate, never a hard-stop on the gesture itself (see DOUGH_SHAPE_TECHNICAL_MAX_
 *  RADIUS below for the one real hard-stop, and the D3A Fresh Audit §2 for why those two were
 *  never actually the same constraint even before this change). */
export const DOUGH_COMPLETION_THRESHOLD = 0.75;

/** Issue #33 D3A (reversible dough shaping): the floor a control point's radius may shrink to
 *  when the player drags inward -- "縮めすぎ防止のminimum". Set well below INITIAL_DOUGH_RADIUS
 *  (~18.24) so a real, meaningful shrink range exists, but comfortably above 0 so the boundary
 *  can never collapse to a degenerate point or produce a self-intersecting rendered path. */
export const DOUGH_SHAPE_MIN_RADIUS = 10;

/** Issue #33 D3A (free boundary): the *technical* safety ceiling on an individual control
 *  point's own radius -- distinct from DOUGH_RADIUS (48), which stays the *ideal/reference*
 *  target the dashed guide ring shows and DOUGH_COMPLETION_THRESHOLD measures against.
 *  Before D3A, DOUGH_RADIUS silently played both roles at once: a player could never stretch a
 *  region past the guide ring at all, because the guide ring's own radius was also the hard
 *  clamp. D3A's own instruction is to allow exceeding the ideal size while keeping a real
 *  technical bound against breaking the interaction canvas -- see the D3A Fresh Audit §2's
 *  clip-path analysis for why a control point's rendered radius already can't paint past
 *  `.pizza-dough-shape`'s own box edge (a silent, free technical clamp on the 4 cardinal
 *  control points at radius 50) and why this ceiling only needs to stay safely under the box's
 *  diagonal-corner distance (~70.7) to remain visible, meaningful overshoot on the 4 diagonal
 *  control points rather than an invisible one. */
export const DOUGH_SHAPE_TECHNICAL_MAX_RADIUS = 58;

/** Issue #33 D3A: below this per-point delta (in dough-percent units, the same units as every
 *  radius here), a gesture's implied change at its own nearest control point is treated as
 *  "accidental tiny gesture" and the whole call is a no-op -- see the D3A Fresh Audit §4 item 4
 *  for why this is defined as "touch position already close to the shape's own current value"
 *  rather than as a drag-distance/tap-duration heuristic (which would also suppress the
 *  existing, still-desired "a deliberate tap far from center registers instantly" behavior). */
export const DOUGH_TINY_GESTURE_EPSILON = 0.5;

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
 *  [DOUGH_SHAPE_MIN_RADIUS, DOUGH_SHAPE_TECHNICAL_MAX_RADIUS] -- the same "stale/late/corrupted
 *  action" guard shape every other reducer action's payload validator (isValidSauceDepositBatch,
 *  etc.) already follows. Issue #33 D3A: was `[0, DOUGH_RADIUS]`; see DOUGH_SHAPE_MIN_RADIUS/
 *  DOUGH_SHAPE_TECHNICAL_MAX_RADIUS's own doc comments for why the bounds moved. */
export function isValidDoughShape(shape: DoughShape): boolean {
  return (
    Array.isArray(shape.radii) &&
    shape.radii.length === DOUGH_SHAPE_POINTS &&
    shape.radii.every(
      (r) => isFiniteNumber(r) && r >= DOUGH_SHAPE_MIN_RADIUS && r <= DOUGH_SHAPE_TECHNICAL_MAX_RADIUS,
    )
  );
}

export function createInitialDoughShape(): DoughShape {
  return { radii: new Array(DOUGH_SHAPE_POINTS).fill(INITIAL_DOUGH_RADIUS) };
}

/** Issue #33 D3A: true bidirectional lerp toward `target` -- replaces the D1/D2-era
 *  `lerpTowardAtLeast`, which special-cased `target = Math.max(current, distance)` so a touch
 *  closer to center than the point's current radius was a guaranteed no-op there. D3A's whole
 *  point is that the touch position directly represents "desired local radius" in either
 *  direction (see the Fresh Audit §3's "root-cause finding") -- so this is now a plain,
 *  unconditional lerp, with no floor and no clamp of its own (the caller clamps afterward). */
function lerpToward(current: number, target: number, weight: number): number {
  return current + (target - current) * weight;
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

/** Issue #33 D2/D3A: the spike-suppression constraint (D0/D2 audit §3) -- within one
 *  `applyStretchPoint` call, a touched point may move at most this far above *or* below the
 *  average of its two immediate neighbors' *pre-call* radii. This is a local, neighbor-aware
 *  clamp (never a global average, never forced toward a perfect circle) applied **only** to
 *  points this call's own falloff weight is nonzero for -- a point outside the touch's
 *  influence is passed through byte-for-byte unchanged, never re-clamped against neighbors that
 *  may have drifted asymmetric from some earlier, unrelated gesture (Fresh Audit §5: applying
 *  this clamp to every point unconditionally, as D1/D2 did, was harmless only because the old
 *  monotonic floor happened to make it a no-op for untouched points -- removing that floor
 *  without this fix would have let one gesture silently reshape an untouched part of the dough
 *  elsewhere). D3A made this bound symmetric (was: growth-only, since there was no shrink to
 *  guard against yet) so "progressive and controllable, not a rubbery snap/instant flip" now
 *  holds in both directions -- reaching either extreme at one exact spot still takes a few
 *  gestures in roughly the same area, never one instant full-reach drag. */
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
 * `pizzaCoordinates.ts`) onto the shape (D0 §4.2, D2 Human Feel Fix, D3A reversible/
 * free-boundary rewrite). The touch position directly represents the *desired* local radius
 * for its own angular region -- dragging from center outward stretches that direction;
 * dragging from the rim inward shrinks it back (Issue #33 D3A, Fresh Audit §3). The touch
 * angle's closest control point receives the strongest pull; its immediate neighbors (circular
 * indices i-1/i+1) follow with a meaningful fraction, and the next ring out (i-2/i+2) with a
 * smaller fraction, per `stretchFalloff` above -- "neighboring dough regions move somewhat
 * together" rather than only the two points nearest the touch moving in isolation.
 *
 * A touch whose implied target is already within `DOUGH_TINY_GESTURE_EPSILON` of the nearest
 * control point's *current* value is treated as an accidental tiny gesture and is a complete
 * no-op (returns `shape` unchanged) -- see that constant's own doc comment for why this is
 * defined as "already close to the current shape," not a drag-distance heuristic.
 *
 * Each point this call actually touches (nonzero falloff weight) is then re-clamped to within
 * `STRETCH_SPIKE_MAX_DELTA` of its own pre-call neighbor average, in *both* directions (D3A:
 * was growth-only), so one drag can't spike -- or collapse -- a single point far past its
 * surroundings in one call; a point this call's weight is zero for is passed through completely
 * untouched (Fresh Audit §5). The final per-point value is clamped to
 * `[DOUGH_SHAPE_MIN_RADIUS, DOUGH_SHAPE_TECHNICAL_MAX_RADIUS]` (D3A: was `[0, DOUGH_RADIUS]` --
 * see those constants' own doc comments for why the bounds moved and what they now mean). A
 * touch point beyond the technical ceiling is clamped to it first, matching every other gesture
 * family's own `isInsideDough`/`clampToDough` convention of projecting an out-of-range point
 * back onto a boundary rather than rejecting it. Returns a new shape; never mutates `shape`.
 *
 * D3A intentionally removed the D1/D2-era monotonic-non-decrease guarantee: a committed shape
 * can now shrink as well as grow, by design (this is the whole point of "reversible" shaping).
 */
export function applyStretchPoint(shape: DoughShape, xDough: number, yDough: number): DoughShape {
  const dx = xDough - DOUGH_CENTER;
  const dy = yDough - DOUGH_CENTER;
  const distance = Math.min(Math.hypot(dx, dy), DOUGH_SHAPE_TECHNICAL_MAX_RADIUS);
  if (distance <= 0) return shape;

  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI * 2;

  const n = shape.radii.length;
  const step = (Math.PI * 2) / n;
  const rawIndex = angle / step;

  const original = shape.radii;
  const nearestIndex = Math.round(rawIndex) % n;
  if (Math.abs(distance - original[nearestIndex]) < DOUGH_TINY_GESTURE_EPSILON) return shape;

  const radii = original.map((currentValue, i) => {
    const weight = stretchFalloff(circularIndexDistance(i, rawIndex, n));
    if (weight <= 0) return currentValue;

    const blended = lerpToward(currentValue, distance, weight);
    const prevNeighbor = original[(i - 1 + n) % n];
    const nextNeighbor = original[(i + 1) % n];
    const neighborAverage = (prevNeighbor + nextNeighbor) / 2;
    const spikeClamped = Math.max(
      neighborAverage - STRETCH_SPIKE_MAX_DELTA,
      Math.min(blended, neighborAverage + STRETCH_SPIKE_MAX_DELTA),
    );
    return Math.max(
      DOUGH_SHAPE_MIN_RADIUS,
      Math.min(spikeClamped, DOUGH_SHAPE_TECHNICAL_MAX_RADIUS),
    );
  });

  return { radii };
}

/**
 * Sauce Free Boundary: the dough's own local radius at an arbitrary angle (radians, same
 * atan2/canvas convention as `applyStretchPoint`), linearly interpolated between the two
 * bracketing control points -- a straight-edged N-gon reading of the shape, not the smoothed
 * Catmull-Rom curve `smoothDoughShapeForDisplay` renders. Deliberately the simpler of the two:
 * this is a boundary *test* (is this point inside the dough), not a display path, and an
 * octagon-accurate boundary is more than close enough for "does sauce painting respect the
 * player's actual hand-shaped dough" -- see `isInsideDoughShape` below, the only thing that
 * calls this.
 */
export function doughShapeRadiusAtAngle(shape: DoughShape, angle: number): number {
  const n = shape.radii.length;
  const step = (Math.PI * 2) / n;
  let normalizedAngle = angle % (Math.PI * 2);
  if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;

  const rawIndex = normalizedAngle / step;
  const lowerIndex = Math.floor(rawIndex) % n;
  const upperIndex = (lowerIndex + 1) % n;
  const fraction = rawIndex - Math.floor(rawIndex);

  return shape.radii[lowerIndex] + (shape.radii[upperIndex] - shape.radii[lowerIndex]) * fraction;
}

/**
 * Sauce Free Boundary (Issue #37 M2 sibling task): whether a dough-percent point sits inside
 * the *current, possibly D3A-distorted* dough silhouette -- never a fixed `DOUGH_RADIUS`
 * circle. Used only by the sauce render path (`../sauceField.ts`'s shape-aware variants); the
 * fixed-circle `isInsideDough` (./pizzaCoordinates.ts) remains what Scoring 2.0's
 * `computeSauceMetrics` and topping placement (`PLACE_TOPPING`) both read, unchanged -- see the
 * Fresh Audit's explicit reasoning for keeping those on the old boundary.
 */
export function isInsideDoughShape(shape: DoughShape, x: number, y: number): boolean {
  const dx = x - DOUGH_CENTER;
  const dy = y - DOUGH_CENTER;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return true;
  return distance <= doughShapeRadiusAtAngle(shape, Math.atan2(dy, dx));
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
