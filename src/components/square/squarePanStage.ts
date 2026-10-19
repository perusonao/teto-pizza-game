/**
 * Square-Pan Dough D2-a1 (Issue #537, Epic #532): the pure helpers behind the square pan's stage components in this folder.
 *
 * Inert: nothing in the game imports this folder yet (the PizzaStage / GameScreen / App wiring is D2-a2, after C #558). Every number
 * comes from `SQUARE_PAN_GEOMETRY` (A, #534) -- nothing is re-derived here -- and the round pizza's code is never edited: the square
 * components sit beside the round ones and are mounted only when a caller passes `panShape === "square"`.
 *
 * Coordinates are dough-percent (0-100 of `.pizza-dough`'s border box, centre 50), the unit every sauce / topping / cheese position uses.
 */
import { cheesePoolReachPercent } from "../CheesePoolCanvas";
import { alphaPlaneOf, dimWhereOverlapping, overlapAlphaFactorFor } from "../../logic/sauceDisplay";
import type { SauceDepositLike } from "../../logic/sauceField";
import { DOUGH_CENTER } from "../../logic/pizzaCoordinates";
import { SQUARE_PAN_GEOMETRY, SQUARE_PAN_HALF_SIDE, SQUARE_TARGET_HALF_SIDE, type PanBounds } from "../../logic/pan/panGeometry";
import { buildSquareSauceDisplayPixels } from "../../logic/pan/squareSauceDisplay";

/** Space between the stage box's edge and the pan's edge, in percent of the box (50 - half side). The CSS `clip-path: inset(...)` equals this (pinned by a test). */
export const SQUARE_PAN_INSET_PERCENT = DOUGH_CENTER - SQUARE_PAN_HALF_SIDE;

/** The sauce Reference region as an SVG rect (viewBox 0 0 100 100) -- the square counterpart of the round guide's `<circle r=SAUCE_TARGET_RADIUS>`. */
export function squareTargetGuideRect(): { x: number; y: number; width: number; height: number } {
  return {
    x: DOUGH_CENTER - SQUARE_TARGET_HALF_SIDE,
    y: DOUGH_CENTER - SQUARE_TARGET_HALF_SIDE,
    width: 2 * SQUARE_TARGET_HALF_SIDE,
    height: 2 * SQUARE_TARGET_HALF_SIDE,
  };
}

export interface SquareSauceRasterOptions {
  /** Every deposit of the layers BELOW this one: where this layer overlaps them it is dimmed, as on the round pizza (#494 / #519). */
  underDeposits?: readonly SauceDepositLike[];
  /** The sauce kind that laid this layer; only picks the overlap factor (olive oil is dimmed harder). */
  ingredientId?: string;
}

/**
 * One square sauce layer as RGBA pixels (SAUCE_DISPLAY_GRID square), exactly what the round `SauceHeatmapCanvas` draws but masked to the
 * square pan. Reuses D1-a's `buildSquareSauceDisplayPixels` and the round overlap dimming unchanged.
 */
export function buildSquareSauceLayerPixels(
  deposits: readonly SauceDepositLike[],
  color: string,
  options: SquareSauceRasterOptions = {},
): Uint8ClampedArray {
  const pixels = buildSquareSauceDisplayPixels(deposits, color);
  const { underDeposits, ingredientId } = options;
  if (underDeposits && underDeposits.length > 0) {
    dimWhereOverlapping(pixels, alphaPlaneOf(buildSquareSauceDisplayPixels(underDeposits, "#000000")), overlapAlphaFactorFor(ingredientId));
  }
  return pixels;
}

/** The square pool's half-width in dough-percent: the round pool's own reach, unchanged (the pool is a canvas box, not a circle). */
export const squareCheesePoolReach = cheesePoolReachPercent;

/**
 * The part of a melted cheese pool (a box of half-width `reach` centred on a piece at `(x, y)`) that lies on the square pan, as the box's own
 * bounds; `null` when none of it does. A piece near an edge or corner keeps its pool up to the pan's edge and loses what would hang over it.
 */
export function squareCheeseReachBounds(x: number, y: number, reach: number): PanBounds | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(reach > 0)) return null;
  const pan = SQUARE_PAN_GEOMETRY.bounds;
  const bounds = {
    minX: Math.max(pan.minX, x - reach),
    minY: Math.max(pan.minY, y - reach),
    maxX: Math.min(pan.maxX, x + reach),
    maxY: Math.min(pan.maxY, y + reach),
  };
  return bounds.minX < bounds.maxX && bounds.minY < bounds.maxY ? bounds : null;
}

const pct = (value: number) => `${(Math.round(value * 1000) / 1000).toString()}%`;

/**
 * `clip-path: inset(...)` for a pool box centred on `(x, y)` with half-width `reach`, so the pool never shows past the pan (percent of the box
 * itself). `null` when the whole pool is off the pan (nothing to draw).
 */
export function squareCheesePoolClipPath(x: number, y: number, reach: number): string | null {
  const bounds = squareCheeseReachBounds(x, y, reach);
  if (!bounds) return null;
  const size = 2 * reach;
  const top = ((bounds.minY - (y - reach)) / size) * 100;
  const left = ((bounds.minX - (x - reach)) / size) * 100;
  const right = (((x + reach) - bounds.maxX) / size) * 100;
  const bottom = (((y + reach) - bounds.maxY) / size) * 100;
  return `inset(${pct(top)} ${pct(right)} ${pct(bottom)} ${pct(left)})`;
}
