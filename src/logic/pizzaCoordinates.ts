/**
 * Canonical coordinate space for all pizza-dough interaction: percent (0-100) within
 * .pizza-dough's own bounding box. The dough, the sauce spread, and the paint-trail SVG
 * all key off this same box so they never drift apart the way .pizza-dough vs. the inset
 * .pizza-sauce-layer did in Phase 2C.
 */

export const DOUGH_CENTER = 50;
export const DOUGH_RADIUS = 48;

/**
 * Independent Review Final P2 (PR #26, discussion_r4017391946): `clampToDough` projects a
 * point back onto the rim by scaling it by `DOUGH_RADIUS / distance`, but recomputing
 * `Math.hypot` on that scaled result doesn't always invert the scale exactly -- at many
 * non-axis angles in the piece-drop edge-grace annulus it rounds to a hair over `DOUGH_RADIUS`
 * (e.g. `48.00000000000001`), which `isInsideDough`'s reducer-side `<= DOUGH_RADIUS` boundary
 * then rejects even though `resolvePieceDrop` already showed the drop as valid. Scaling to a
 * hair inside `DOUGH_RADIUS` instead absorbs that rounding error -- worst observed overflow
 * without this margin is ~2.8e-14 (well under this), and shifting the clamped point inward by
 * up to `CLAMP_INSET_EPSILON` dough-percent is many orders of magnitude below anything visible
 * or gameplay-relevant.
 */
export const CLAMP_INSET_EPSILON = 1e-9;

export interface DoughPoint {
  x: number;
  y: number;
}

/** Converts a client-space point (from a pointer/mouse event) into dough-local percent. */
export function clientPointToDoughPercent(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): DoughPoint {
  return {
    x: ((clientX - rect.left) / rect.width) * 100,
    y: ((clientY - rect.top) / rect.height) * 100,
  };
}

export function distanceFromCenter(x: number, y: number): number {
  return Math.hypot(x - DOUGH_CENTER, y - DOUGH_CENTER);
}

export function isInsideDough(x: number, y: number): boolean {
  return distanceFromCenter(x, y) <= DOUGH_RADIUS;
}

/** Projects a point that has drifted outside the dough back onto its rim, keeping the same
 * direction from center. Used so a drag that releases just past the edge still commits. */
export function clampToDough(x: number, y: number): DoughPoint {
  const dx = x - DOUGH_CENTER;
  const dy = y - DOUGH_CENTER;
  const distance = Math.hypot(dx, dy);
  if (distance <= DOUGH_RADIUS || distance === 0) return { x, y };
  const scale = (DOUGH_RADIUS - CLAMP_INSET_EPSILON) / distance;
  return { x: DOUGH_CENTER + dx * scale, y: DOUGH_CENTER + dy * scale };
}

/** .pizza-sauce-layer sits inset 6% inside the dough box (see App.css), so its own clip-path
 * origin needs a dough-percent coordinate re-projected into that inset box's local percent. */
const SAUCE_LAYER_INSET_PERCENT = 6;

export function toSauceLayerPercent(doughPercent: number): number {
  return (
    ((doughPercent - SAUCE_LAYER_INSET_PERCENT) / (100 - 2 * SAUCE_LAYER_INSET_PERCENT)) * 100
  );
}
