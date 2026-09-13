/**
 * Canonical coordinate space for all pizza-dough interaction: percent (0-100) within
 * .pizza-dough's own bounding box. The dough, the sauce spread, and the paint-trail SVG
 * all key off this same box so they never drift apart the way .pizza-dough vs. the inset
 * .pizza-sauce-layer did in Phase 2C.
 */

export const DOUGH_CENTER = 50;
export const DOUGH_RADIUS = 48;

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
  const scale = DOUGH_RADIUS / distance;
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
