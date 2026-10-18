/**
 * Square-Pan Dough D (Issue #537): the sauce heatmap's DISPLAY rasterizer for the square pan -- the counterpart of
 * `buildSauceDisplayPixels` (../sauceDisplay.ts), which masks to a round `DoughShape` silhouette.
 *
 * Same Gaussian splat, same density -> alpha curve, same constants (imported, not copied), so a deposit reads the same
 * on a square pan as on a round one; only the boundary differs:
 *  - each deposit is weighted by `insidePanFraction` (the on-pan share, ./squareSauce.ts);
 *  - the result is masked to the square pan, anti-aliased over one pixel, so the four corners are reached and are
 *    never rounded off (a circular mask would clip them);
 *  - beyond the square Reference region (the crust band) a deposit's kernel is tapered exactly as on the round pizza.
 *
 * Pure and deterministic. Inert: no caller yet. It keeps no cross-call cache (the round one's incremental cache is an
 * optimisation, not behaviour) -- the wiring slice can add one if profiling asks for it.
 */
import { DOUGH_CENTER } from "../pizzaCoordinates";
import {
  SAUCE_DISPLAY_GRID,
  SAUCE_DISPLAY_RIM_TAPER_END_CELLS,
  SAUCE_DISPLAY_RIM_TAPER_START_CELLS,
  SAUCE_DISPLAY_SIGMA_CELLS,
  SAUCE_DISPLAY_VISIBLE_VALUE,
} from "../sauceDisplay";
import { SAUCE_FIELD_SIZE, sauceDensityToAlpha, type SauceDepositLike } from "../sauceField";
import { SQUARE_PAN_HALF_SIDE, SQUARE_TARGET_HALF_SIDE } from "./panGeometry";
import { insidePanFraction } from "./squareSauce";

/** Same values as the round rasterizer's private ones (pinned by squareSauceDisplay.test.ts via a pixel parity check). */
const KERNEL_SIGMAS = 2.8;
const BRUSH_MASS = 1 + 4 * (1 / 2) + 4 * (1 / (1 + Math.SQRT2));

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** How much of the display pixel lies on the square pan, 0-255, anti-aliased over one pixel (like the round mask). */
export function squarePanMask(grid: number): Uint8Array {
  const mask = new Uint8Array(grid * grid);
  const pixel = 100 / grid;
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      const px = ((x + 0.5) / grid) * 100;
      const py = ((y + 0.5) / grid) * 100;
      const extent = Math.max(Math.abs(px - DOUGH_CENTER), Math.abs(py - DOUGH_CENTER));
      const inside = (SQUARE_PAN_HALF_SIDE - extent) / pixel + 0.25;
      mask[y * grid + x] = Math.round(Math.min(1, Math.max(0, inside)) * 255);
    }
  }
  return mask;
}

export function buildSquareSauceDisplayPixels(
  deposits: readonly SauceDepositLike[],
  colorHex: string,
  grid: number = SAUCE_DISPLAY_GRID,
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(grid * grid * 4);
  const cell = grid / SAUCE_FIELD_SIZE;
  const sigmaPx = SAUCE_DISPLAY_SIGMA_CELLS * cell;
  const radius = Math.ceil(sigmaPx * KERNEL_SIGMAS) + 1;
  const norm = (cell * cell) / (2 * Math.PI * sigmaPx * sigmaPx);
  const density = new Float32Array(grid * grid);
  let any = false;

  for (const deposit of deposits) {
    if (!Number.isFinite(deposit.x) || !Number.isFinite(deposit.y)) continue;
    const amount = deposit.amount * insidePanFraction(deposit.x, deposit.y) * BRUSH_MASS;
    if (!(amount > 0)) continue;
    any = true;
    const cx = (deposit.x / 100) * grid; // deposit position in pixel units (pixel centres at index + 0.5)
    const cy = (deposit.y / 100) * grid;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(grid - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(grid - 1, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        let value = norm * Math.exp(-(dx * dx + dy * dy) / (2 * sigmaPx * sigmaPx));
        const px = ((x + 0.5) / grid) * 100;
        const py = ((y + 0.5) / grid) * 100;
        const inTarget =
          Math.abs(px - DOUGH_CENTER) <= SQUARE_TARGET_HALF_SIDE && Math.abs(py - DOUGH_CENTER) <= SQUARE_TARGET_HALF_SIDE;
        if (!inTarget) {
          const distanceCells = Math.hypot(dx, dy) / cell;
          const t = Math.min(
            1,
            Math.max(
              0,
              (distanceCells - SAUCE_DISPLAY_RIM_TAPER_START_CELLS) /
                (SAUCE_DISPLAY_RIM_TAPER_END_CELLS - SAUCE_DISPLAY_RIM_TAPER_START_CELLS),
            ),
          );
          value *= 1 - t * t * (3 - 2 * t);
        }
        density[y * grid + x] += amount * value;
      }
    }
  }
  if (!any) return pixels;

  const mask = squarePanMask(grid);
  const color = hexToRgb(colorHex);
  for (let p = 0; p < grid * grid; p += 1) {
    const value = density[p];
    if (value <= SAUCE_DISPLAY_VISIBLE_VALUE || mask[p] === 0) continue;
    const i = p * 4;
    pixels[i] = color.r;
    pixels[i + 1] = color.g;
    pixels[i + 2] = color.b;
    pixels[i + 3] = Math.round(sauceDensityToAlpha(value) * (mask[p] / 255) * 255);
  }
  return pixels;
}
