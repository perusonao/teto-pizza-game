/**
 * Square-Pan Dough A (Issue #534, Epic #532): the shape interface the dough, sauce, topping and cheese
 * boundaries will read once a recipe can use a non-round pan (D, #537). No caller reads it yet.
 *
 * Coordinate space is unchanged: percent (0-100) of `.pizza-dough`'s own box, centre 50 (../pizzaCoordinates.ts).
 *
 * - `ROUND_PAN_GEOMETRY` is **the existing functions, by reference** (`isInsideDough`, `clampToDough`), not a
 *   re-implementation, so the round pizza cannot drift from what ships. panGeometry.test.ts pins the identity.
 * - `SQUARE_PAN_GEOMETRY` is new. Its constants are provisional layout values (final numbers come from Owner
 *   on-device HV, D5); they are named so a later phase can retune them in one place.
 */
import {
  CLAMP_INSET_EPSILON,
  DOUGH_CENTER,
  DOUGH_RADIUS,
  clampToDough,
  isInsideDough,
  type DoughPoint,
} from "../pizzaCoordinates";
import { SAUCE_TARGET_RADIUS } from "../sauceField";
import type { PanShape } from "./panShape";

/** Axis-aligned extent in dough-percent. */
export interface PanBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** A region of the pan, e.g. the area a Reference sauce target covers. */
export interface PanRegion {
  contains(x: number, y: number): boolean;
  /** Area in dough-percent squared (so round and square are comparable). */
  readonly area: number;
}

export interface PanGeometry {
  readonly shape: PanShape;
  /** Whether a dough-percent point lies on the pan (boundary inclusive, like `isInsideDough`). */
  contains(x: number, y: number): boolean;
  /** Projects a point that drifted off the pan back onto its rim, keeping its direction from the centre. */
  clamp(x: number, y: number): DoughPoint;
  readonly bounds: PanBounds;
  /** The region a Reference sauce spread is measured against (round: the existing `SAUCE_TARGET_RADIUS` disc). */
  readonly targetArea: PanRegion;
}

/**
 * Half of the square pan's side. 44 gives a pan area (88 x 88 = 7744) close to the round dough disc
 * (pi x 48^2 = ~7238), so a recipe's quantities keep a comparable amount of dough to cover, and the corners
 * (distance ~62.2 from the centre) stay inside the dough box (corner distance ~70.7). Provisional.
 */
export const SQUARE_PAN_HALF_SIDE = 44;

/** The square target region keeps the round pizza's target-to-dough proportion (40 / 48). Provisional. */
export const SQUARE_TARGET_HALF_SIDE = SQUARE_PAN_HALF_SIDE * (SAUCE_TARGET_RADIUS / DOUGH_RADIUS);

/** The four pan corners, clockwise from the north-west: NW, NE, SE, SW. */
export const SQUARE_PAN_CORNERS: readonly DoughPoint[] = [
  { x: DOUGH_CENTER - SQUARE_PAN_HALF_SIDE, y: DOUGH_CENTER - SQUARE_PAN_HALF_SIDE },
  { x: DOUGH_CENTER + SQUARE_PAN_HALF_SIDE, y: DOUGH_CENTER - SQUARE_PAN_HALF_SIDE },
  { x: DOUGH_CENTER + SQUARE_PAN_HALF_SIDE, y: DOUGH_CENTER + SQUARE_PAN_HALF_SIDE },
  { x: DOUGH_CENTER - SQUARE_PAN_HALF_SIDE, y: DOUGH_CENTER + SQUARE_PAN_HALF_SIDE },
];

function isFinitePoint(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y);
}

function squareContains(halfSide: number): (x: number, y: number) => boolean {
  return (x, y) => isFinitePoint(x, y) && Math.abs(x - DOUGH_CENTER) <= halfSide && Math.abs(y - DOUGH_CENTER) <= halfSide;
}

function squareClamp(x: number, y: number): DoughPoint {
  // Mirrors `clampToDough`'s contract (inside -> unchanged; outside -> same direction, scaled onto the rim, a hair
  // inside so `contains` accepts it). A non-finite point has no direction: it lands on the centre.
  if (!isFinitePoint(x, y)) return { x: DOUGH_CENTER, y: DOUGH_CENTER };
  const dx = x - DOUGH_CENTER;
  const dy = y - DOUGH_CENTER;
  const extent = Math.max(Math.abs(dx), Math.abs(dy));
  if (extent <= SQUARE_PAN_HALF_SIDE) return { x, y };
  const scale = (SQUARE_PAN_HALF_SIDE - CLAMP_INSET_EPSILON) / extent;
  return { x: DOUGH_CENTER + dx * scale, y: DOUGH_CENTER + dy * scale };
}

export const ROUND_PAN_GEOMETRY: PanGeometry = {
  shape: "round",
  contains: isInsideDough,
  clamp: clampToDough,
  bounds: {
    minX: DOUGH_CENTER - DOUGH_RADIUS,
    minY: DOUGH_CENTER - DOUGH_RADIUS,
    maxX: DOUGH_CENTER + DOUGH_RADIUS,
    maxY: DOUGH_CENTER + DOUGH_RADIUS,
  },
  targetArea: {
    contains: (x, y) => Math.hypot(x - DOUGH_CENTER, y - DOUGH_CENTER) <= SAUCE_TARGET_RADIUS,
    area: Math.PI * SAUCE_TARGET_RADIUS * SAUCE_TARGET_RADIUS,
  },
};

export const SQUARE_PAN_GEOMETRY: PanGeometry = {
  shape: "square",
  contains: squareContains(SQUARE_PAN_HALF_SIDE),
  clamp: squareClamp,
  bounds: {
    minX: DOUGH_CENTER - SQUARE_PAN_HALF_SIDE,
    minY: DOUGH_CENTER - SQUARE_PAN_HALF_SIDE,
    maxX: DOUGH_CENTER + SQUARE_PAN_HALF_SIDE,
    maxY: DOUGH_CENTER + SQUARE_PAN_HALF_SIDE,
  },
  targetArea: {
    contains: squareContains(SQUARE_TARGET_HALF_SIDE),
    area: (2 * SQUARE_TARGET_HALF_SIDE) ** 2,
  },
};

export function getPanGeometry(shape: PanShape): PanGeometry {
  return shape === "square" ? SQUARE_PAN_GEOMETRY : ROUND_PAN_GEOMETRY;
}
