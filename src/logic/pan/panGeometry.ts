/**
 * Square-Pan Dough A (Issue #534): the pan-shape interface -- the one place a caller asks "is this point on the pan, where does an
 * off-pan point land, how big is the pan, where may sauce go" instead of reaching for the circular helpers directly.
 *
 * Round is a THIN WRAPPER over the existing functions (`isInsideDough`, `clampToDough`, `DOUGH_RADIUS`, `SAUCE_TARGET_RADIUS`): it adds no
 * logic, so it cannot change a round pizza's behaviour. Square is new and lives only here. Nothing in the game calls this module yet
 * (no recipe is square); Epic #532's steps B-D route their square-only code through it.
 *
 * Coordinates are the unchanged 0-100 percent of the `.pizza-dough` box (centre 50), so the box and every pointer mapping stay as they are.
 */
import { DEFAULT_PAN_SHAPE, type PanShape } from "../../data/panShape";
import { clampToDough, CLAMP_INSET_EPSILON, DOUGH_CENTER, DOUGH_RADIUS, isInsideDough, type DoughPoint } from "../pizzaCoordinates";
import { SAUCE_TARGET_RADIUS } from "../sauceField";

export interface PanBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Where sauce is meant to go (the Reference target): the region the scored "stay off the rim" signal is measured against. */
export interface PanTargetArea {
  kind: "circle" | "rect";
  /** Whether the point is inside the target region. */
  contains(x: number, y: number): boolean;
  /** Area in dough-percent squared units. */
  area: number;
}

export interface PanGeometry {
  shape: PanShape;
  /** Whether the point lies on the pan / dough (boundary inclusive). */
  contains(x: number, y: number): boolean;
  /** An off-pan point projected back onto the rim (a hair inside it); an on-pan point is returned unchanged. */
  clamp(x: number, y: number): DoughPoint;
  /** The pan's axis-aligned bounding box. */
  bounds(): PanBounds;
  /** The sauce target region (see `PanTargetArea`). */
  targetArea(): PanTargetArea;
}

/** Square pan: half the side of the pan, centred on the dough box. Side 88 (area 7744) is about the round dough's area (pi * 48^2 = 7238). */
export const SQUARE_PAN_HALF_SIDE = 44;
/**
 * Square sauce target: half the side of the square the sauce should stay inside. Defined for the square on its own -- it is NOT derived from the
 * circular `SAUCE_TARGET_RADIUS`. Side 72 leaves an 8-unit rim margin, the same margin the round target leaves (48 - 40), and covers about 67% of
 * the pan (the round target covers about 69% of the dough). Provisional: step D tunes it with the square Reference on real screens.
 */
export const SQUARE_SAUCE_TARGET_HALF_SIDE = 36;

const SQUARE_MIN = DOUGH_CENTER - SQUARE_PAN_HALF_SIDE;
const SQUARE_MAX = DOUGH_CENTER + SQUARE_PAN_HALF_SIDE;

/** The four corners of the square pan, top-left, top-right, bottom-left, bottom-right (dough percent). */
export const SQUARE_PAN_CORNERS: readonly DoughPoint[] = [
  { x: SQUARE_MIN, y: SQUARE_MIN },
  { x: SQUARE_MAX, y: SQUARE_MIN },
  { x: SQUARE_MIN, y: SQUARE_MAX },
  { x: SQUARE_MAX, y: SQUARE_MAX },
];

// Constant objects: steps B-D call these per pointer move / per sauce cell, so nothing is allocated per call.
const ROUND_BOUNDS: PanBounds = { minX: DOUGH_CENTER - DOUGH_RADIUS, minY: DOUGH_CENTER - DOUGH_RADIUS, maxX: DOUGH_CENTER + DOUGH_RADIUS, maxY: DOUGH_CENTER + DOUGH_RADIUS };
const ROUND_TARGET: PanTargetArea = {
  kind: "circle",
  contains: (x, y) => Math.hypot(x - DOUGH_CENTER, y - DOUGH_CENTER) <= SAUCE_TARGET_RADIUS,
  area: Math.PI * SAUCE_TARGET_RADIUS * SAUCE_TARGET_RADIUS,
};
const SQUARE_BOUNDS: PanBounds = { minX: SQUARE_MIN, minY: SQUARE_MIN, maxX: SQUARE_MAX, maxY: SQUARE_MAX };
const SQUARE_TARGET_LO = DOUGH_CENTER - SQUARE_SAUCE_TARGET_HALF_SIDE;
const SQUARE_TARGET_HI = DOUGH_CENTER + SQUARE_SAUCE_TARGET_HALF_SIDE;
const SQUARE_TARGET: PanTargetArea = {
  kind: "rect",
  contains: (x, y) => x >= SQUARE_TARGET_LO && x <= SQUARE_TARGET_HI && y >= SQUARE_TARGET_LO && y <= SQUARE_TARGET_HI,
  area: (2 * SQUARE_SAUCE_TARGET_HALF_SIDE) ** 2,
};

export const roundPanGeometry: PanGeometry = {
  shape: "round",
  contains: isInsideDough,
  clamp: clampToDough,
  bounds: () => ROUND_BOUNDS,
  targetArea: () => ROUND_TARGET,
};

function clampAxis(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return DOUGH_CENTER; // the square clamp never returns a non-finite coordinate (a NaN / Infinity lands on the pan's centre line)
  if (v < min) return min + CLAMP_INSET_EPSILON;
  if (v > max) return max - CLAMP_INSET_EPSILON;
  return v;
}

export const squarePanGeometry: PanGeometry = {
  shape: "square",
  contains: (x, y) => x >= SQUARE_MIN && x <= SQUARE_MAX && y >= SQUARE_MIN && y <= SQUARE_MAX,
  clamp: (x, y) => ({ x: clampAxis(x, SQUARE_MIN, SQUARE_MAX), y: clampAxis(y, SQUARE_MIN, SQUARE_MAX) }),
  bounds: () => SQUARE_BOUNDS,
  targetArea: () => SQUARE_TARGET,
};

/** The geometry for a pan shape (`round` is the default and the only shape a recipe uses today). */
export function panGeometryFor(shape: PanShape = DEFAULT_PAN_SHAPE): PanGeometry {
  return shape === "square" ? squarePanGeometry : roundPanGeometry;
}
