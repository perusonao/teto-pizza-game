/**
 * Square-Pan Dough C balance pass (Issue #536): the 16x16 thickness grid as ONE smooth sheet -- pure, no DOM.
 *
 * A grid of rectangles reads as a checkerboard however it is blurred. Here the grid is only the data: the thickness is interpolated
 * with a bicubic (Catmull-Rom) surface into a RASTER_SIZE x RASTER_SIZE image (RGBA), coloured by the ball ramp
 * (squareDoughView.ts) and lit as a relief (light from the top left: slopes facing it are a little brighter, the others a little
 * darker), so a thick lump looks like a soft mound and the thin film like a flat sheet. The component (SquareDoughCanvas) draws that
 * image once per change into a small <canvas> that the browser scales up smoothly, which is cheap on a phone (no SVG filter).
 *
 * Details that matter:
 *   - the surface is sampled on the ON-PAN cells only, with the edge cells repeated outward, so a sheet that fills the pan fills it
 *     to the rim (an off-pan cell is 0 in the data and would fade the rim out);
 *   - an uncovered cell (< SQUARE_COVER_MIN_THICKNESS, or not finite) is thickness 0 and transparent. Whether a pixel is dough is its own
 *     interpolated COVERAGE mask (1 for a covered cell, 0 for an uncovered one) through a smoothstep, so the edge of the sheet rolls
 *     off over a few pixels, never a hard step, and a covered cell is always opaque however thin it is;
 *   - the interpolation is separable (rows, then columns), so one image costs ~75 k multiply-adds.
 */
import { SQUARE_PAN_HALF_SIDE } from "./panGeometry";
import {
  SQUARE_COVER_MIN_THICKNESS,
  SQUARE_DOUGH_GRID,
  isSquareCellOnPan,
  squareCellIndex,
  type SquareDough,
} from "./squareDough";
import { thicknessRgb, type SquareDoughRamp } from "./squareDoughView";
import { DOUGH_CENTER } from "../pizzaCoordinates";

/** Side of the raster in pixels (Owner-approved: 128 x 128). */
export const RASTER_SIZE = 128;
/** How strongly a slope brightens / darkens the colour (per unit of thickness change per raster pixel), and the most it may. */
export const RELIEF_STRENGTH = 1.6;
export const RELIEF_LIMIT = 0.18;
/** Direction the light comes from (unit vector in image space: up and to the left). */
const LIGHT: readonly [number, number] = (() => {
  const x = -0.62;
  const y = -0.78;
  const n = Math.hypot(x, y);
  return [x / n, y / n];
})();

const CELL = 100 / SQUARE_DOUGH_GRID;
const PAN_MIN = DOUGH_CENTER - SQUARE_PAN_HALF_SIDE;
const PAN_SIDE = SQUARE_PAN_HALF_SIDE * 2;

/** The block of on-pan cells (a square: the pan is square). */
const GRID = (() => {
  let lo = SQUARE_DOUGH_GRID;
  let hi = -1;
  for (let row = 0; row < SQUARE_DOUGH_GRID; row++) {
    for (let col = 0; col < SQUARE_DOUGH_GRID; col++) {
      if (isSquareCellOnPan(row, col)) {
        lo = Math.min(lo, row, col);
        hi = Math.max(hi, row, col);
      }
    }
  }
  return { lo, n: hi - lo + 1 };
})();

/** Catmull-Rom weights of the four neighbours of a position `t` (0..1) between the middle two. */
function catmullRom(t: number): [number, number, number, number] {
  const t2 = t * t;
  const t3 = t2 * t;
  return [-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1, -1.5 * t3 + 2 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2];
}

interface Taps {
  /** Four grid indices (clamped to the block) and weights, per pixel along one axis. */
  idx: Int16Array;
  w: Float32Array;
}

const tapsCache = new Map<number, Taps>();
function axisTaps(size: number): Taps {
  const cached = tapsCache.get(size);
  if (cached) return cached;
  const idx = new Int16Array(size * 4);
  const w = new Float32Array(size * 4);
  for (let p = 0; p < size; p++) {
    const x = PAN_MIN + ((p + 0.5) / size) * PAN_SIDE; // dough-percent of the pixel centre
    const f = x / CELL - 0.5 - GRID.lo; // position in cell-centre units, 0 = the first on-pan cell's centre
    const base = Math.floor(f);
    const weights = catmullRom(f - base);
    for (let k = 0; k < 4; k++) {
      idx[p * 4 + k] = Math.min(GRID.n - 1, Math.max(0, base - 1 + k));
      w[p * 4 + k] = weights[k];
    }
  }
  const taps = { idx, w };
  tapsCache.set(size, taps);
  return taps;
}

const LUT_STEPS = 1024;
const lutCache = new Map<SquareDoughRamp, Uint8ClampedArray>();
function colourLut(ramp: SquareDoughRamp): Uint8ClampedArray {
  const cached = lutCache.get(ramp);
  if (cached) return cached;
  const lut = new Uint8ClampedArray((LUT_STEPS + 1) * 3);
  for (let i = 0; i <= LUT_STEPS; i++) {
    const [r, g, b] = thicknessRgb(i / LUT_STEPS, ramp);
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  lutCache.set(ramp, lut);
  return lut;
}

function smoothstep(lo: number, hi: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

function coveredValue(dough: SquareDough, j: number, i: number): number {
  const v = dough.thickness[squareCellIndex(GRID.lo + j, GRID.lo + i)];
  return Number.isFinite(v) && v >= SQUARE_COVER_MIN_THICKNESS ? v : 0;
}

/** The interpolated thickness surface, `size` x `size`, row-major (never negative: Catmull-Rom can undershoot). */
export function thicknessSurface(dough: SquareDough, size: number = RASTER_SIZE): Float32Array {
  const n = GRID.n;
  const grid = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) grid[j * n + i] = coveredValue(dough, j, i);
  return interpolate(grid, size, 0);
}

/** The interpolated coverage mask (1 = dough, 0 = none), clamped to 0..1. */
export function coverageMask(dough: SquareDough, size: number = RASTER_SIZE): Float32Array {
  const n = GRID.n;
  const grid = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) grid[j * n + i] = coveredValue(dough, j, i) > 0 ? 1 : 0;
  return interpolate(grid, size, 1);
}

/** Bicubic interpolation of the n x n block onto size x size pixels (separable: rows, then columns); clamped to [0, maxValue] (0 = no upper limit). */
function interpolate(grid: Float32Array, size: number, maxValue: number): Float32Array {
  const { idx, w } = axisTaps(size);
  const n = GRID.n;
  // rows -> columns
  const tmp = new Float32Array(size * n);
  for (let py = 0; py < size; py++) {
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += w[py * 4 + k] * grid[idx[py * 4 + k] * n + i];
      tmp[py * n + i] = sum;
    }
  }
  const out = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += w[px * 4 + k] * tmp[py * n + idx[px * 4 + k]];
      out[py * size + px] = sum > 0 ? (maxValue > 0 && sum > maxValue ? maxValue : sum) : 0;
    }
  }
  return out;
}

/** RGBA pixels of the sheet (transparent where there is no dough), row-major, `size` x `size`. */
export function rasterizeSquareDough(dough: SquareDough, ramp: SquareDoughRamp = "ball", size: number = RASTER_SIZE): Uint8ClampedArray<ArrayBuffer> {
  const h = thicknessSurface(dough, size);
  const mask = coverageMask(dough, size);
  const lut = colourLut(ramp);
  const out: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(size * size * 4);
  const at = (x: number, y: number) => h[Math.min(size - 1, Math.max(0, y)) * size + Math.min(size - 1, Math.max(0, x))];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = h[y * size + x];
      const alpha = smoothstep(0.3, 0.7, mask[y * size + x]);
      const o = (y * size + x) * 4;
      if (alpha <= 0) continue; // stays transparent
      const lutIndex = Math.round(Math.min(1, t) * LUT_STEPS) * 3;
      // relief: the slope of the surface against the light
      const gx = (at(x + 1, y) - at(x - 1, y)) / 2;
      const gy = (at(x, y + 1) - at(x, y - 1)) / 2;
      const lit = Math.min(RELIEF_LIMIT, Math.max(-RELIEF_LIMIT, -(gx * LIGHT[0] + gy * LIGHT[1]) * RELIEF_STRENGTH));
      const shade = 1 + lit;
      out[o] = lut[lutIndex] * shade;
      out[o + 1] = lut[lutIndex + 1] * shade;
      out[o + 2] = lut[lutIndex + 2] * shade;
      out[o + 3] = Math.round(alpha * 255);
    }
  }
  return out;
}
