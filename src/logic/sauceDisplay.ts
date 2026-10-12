/**
 * Issue #475 Slice 1 (A1): the sauce heatmap's DISPLAY rasterizer. Render only -- it reads the same
 * deposits `computeSauceMetrics` reads and never feeds anything back: scoring still reads the 16x16
 * field (`buildSauceField` / `computeSauceMetrics`, ./sauceField.ts), unchanged.
 *
 * Why this exists (Step 0 of Issue #475): the old display path rasterized the 16x16 field (a 3x3
 * brush per deposit, then two 3x3 blur passes) and scaled it up. That field's non-zero support is a
 * union of grid-aligned squares, so a lone hold read as a square and every stroke edge as a
 * staircase -- and neither the canvas resolution, the upscale quality nor the CSS blur could change
 * that shape. This module instead splats each deposit as a radially symmetric Gaussian straight onto a
 * 64x64 display density and runs the SAME density -> alpha curve (`sauceDensityToAlpha`, floor and
 * cap included), so the paint reads as round, soft-edged dabs.
 *
 * No rim-band clamp (the old display clamped its blur beyond SAUCE_TARGET_RADIUS, Independent Review of PR #28):
 * a Gaussian splat has no blur pass to clamp, and the old display itself painted out to the crust (about r 48-50)
 * wherever a deposit's cell reached it, so "no farther than the old display" is what sauceDisplay.test.ts pins.
 * (An earlier draft kept a cell-based rim guard; it re-introduced the staircase at the crust, so it was dropped.)
 *
 * Pure and deterministic: constants, a kernel table and a per-silhouette mask cache only. No time, no
 * randomness; the same deposits + dough shape give the same bytes.
 */
import { DOUGH_CENTER } from "./pizzaCoordinates";
import { doughShapeRadiusAtAngle, type DoughShape } from "./doughShape";
import {
  insideDoughShapeFraction,
  SAUCE_FIELD_SIZE,
  SAUCE_TARGET_RADIUS,
  sauceDensityToAlpha,
  type SauceDepositLike,
} from "./sauceField";

/** Resolution of the display density (pixels per side). 64 keeps one redraw cheap (Step 0: p95 +1.1ms
 *  at 4x CPU throttle; 96 did not fit the budget). */
export const SAUCE_DISPLAY_GRID = 64;

/** Gaussian sigma, in 16x16-field cells (6.25% of the dough each). The old 3x3 brush + two blur passes
 *  have a radial profile that a Gaussian of sigma 1.29-1.36 fits (values at 0 / 1 / 2 / 2.8 / 3.6 cells), so
 *  the density falls off as before -- only round. 1.26 is that fit nudged down a little by the extent
 *  calibration below (`SAUCE_DISPLAY_VISIBLE_VALUE`). */
export const SAUCE_DISPLAY_SIGMA_CELLS = 1.26;

/** Density at which a display pixel starts to show sauce. Lower than the shared floor
 *  (`SAUCE_DISPLAY_MIN_VISIBLE_VALUE`, 0.005): the old display painted a cell at the full alpha floor and
 *  then scaled it up bilinearly, which pushed the visible edge about half a cell past the last painted
 *  cell, so a sparse dab or a thin stroke read wider than its density alone says. This keeps that extent
 *  (calibrated in sauceDisplay.test.ts against the old display, within 5%). The alpha CURVE is unchanged. */
export const SAUCE_DISPLAY_VISIBLE_VALUE = 0.00404;

/** Sub-pixel placement: a deposit is stamped with the kernel phase nearest its true position (this many
 *  phases per pixel, per axis), so paint sits where the finger was instead of snapping to a pixel (the old
 *  display snapped to 16x16 cell centres, shifting a held dab up to 3% toward the bottom-right). */
const KERNEL_PHASES = 4;

/** Crust-band reach. Beyond `SAUCE_TARGET_RADIUS` the old display only showed sauce within about one to two
 *  cells of a deposit (its raw 3x3 brush; the blur was clamped there on purpose -- Independent Review of
 *  PR #28: don't paint rim sauce the ふち metric says isn't there). A Gaussian tail alone would reach
 *  further, so in the crust band each deposit's kernel is tapered smoothly from full strength at
 *  `RIM_TAPER_START_CELLS` to zero at `RIM_TAPER_END_CELLS` from the deposit. Radially symmetric (unlike the
 *  old cell mask), so it adds no staircase. Calibrated with the extent (sauceDisplay.test.ts). */
export const SAUCE_DISPLAY_RIM_TAPER_START_CELLS = 1.2;
export const SAUCE_DISPLAY_RIM_TAPER_END_CELLS = 2.8;

/** Total mass one deposit has in the 16x16 field: the 3x3 brush falloff 1/(1+hypot(dr,dc)) summed over
 *  its nine cells (and conserved by the blur). Keeping it means the same dispense reads as the same
 *  density as before, so the same alpha curve applies unchanged. */
const BRUSH_MASS = 1 + 4 * (1 / 2) + 4 * (1 / (1 + Math.SQRT2));

/** Kernel radius in sigmas. Beyond it the Gaussian is under 2% of its peak. */
const KERNEL_SIGMAS = 2.8;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

interface Kernel {
  /** Full kernel per sub-pixel phase, and the same tapered for the crust band. */
  tables: Float32Array[];
  taperedTables: Float32Array[];
  radius: number;
  width: number;
}
const kernelCache = new Map<string, Kernel>();
function kernelFor(grid: number, sigmaCells: number, taperStart: number, taperEnd: number): Kernel {
  const key = `${grid}:${sigmaCells}:${taperStart}:${taperEnd}`;
  const hit = kernelCache.get(key);
  if (hit) return hit;
  const cell = grid / SAUCE_FIELD_SIZE;
  const sigmaPx = sigmaCells * cell;
  const radius = Math.ceil(sigmaPx * KERNEL_SIGMAS);
  const width = 2 * radius + 2; // pixel offsets -radius .. radius + 1 around the base pixel
  // Per-cell-equivalent density: a deposit of mass m contributes m * cell^2 / (2*pi*sigma^2) * exp(...)
  // at a pixel, so that summed over the pixels of one cell it matches the old per-cell value scale.
  const norm = (cell * cell) / (2 * Math.PI * sigmaPx * sigmaPx);
  const tables: Float32Array[] = [];
  const taperedTables: Float32Array[] = [];
  for (let ky = 0; ky < KERNEL_PHASES; ky += 1) {
    for (let kx = 0; kx < KERNEL_PHASES; kx += 1) {
      const fx = kx / KERNEL_PHASES;
      const fy = ky / KERNEL_PHASES;
      const table = new Float32Array(width * width);
      const tapered = new Float32Array(width * width);
      for (let j = 0; j < width; j += 1) {
        for (let i = 0; i < width; i += 1) {
          const dx = i - radius - fx;
          const dy = j - radius - fy;
          const value = norm * Math.exp(-(dx * dx + dy * dy) / (2 * sigmaPx * sigmaPx));
          const distanceCells = Math.hypot(dx, dy) / cell;
          const t = Math.min(1, Math.max(0, (distanceCells - taperStart) / (taperEnd - taperStart)));
          table[j * width + i] = value;
          tapered[j * width + i] = value * (1 - t * t * (3 - 2 * t));
        }
      }
      tables.push(table);
      taperedTables.push(tapered);
    }
  }
  const built = { tables, taperedTables, radius, width };
  kernelCache.set(key, built);
  return built;
}

interface CrustRows { lo: Int16Array; hi: Int16Array }
const crustCache = new Map<number, CrustRows>();
/** Per display row, the first and last pixel whose centre lies inside `SAUCE_TARGET_RADIUS` (the disc is
 *  contiguous in a row); everything outside that span is the crust band. `lo > hi` for rows with none. */
function crustRows(grid: number): CrustRows {
  const hit = crustCache.get(grid);
  if (hit) return hit;
  const lo = new Int16Array(grid).fill(grid);
  const hi = new Int16Array(grid).fill(-1);
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      const px = ((x + 0.5) / grid) * 100;
      const py = ((y + 0.5) / grid) * 100;
      if (Math.hypot(px - DOUGH_CENTER, py - DOUGH_CENTER) <= SAUCE_TARGET_RADIUS) {
        if (x < lo[y]) lo[y] = x;
        hi[y] = x;
      }
    }
  }
  const rows = { lo, hi };
  crustCache.set(grid, rows);
  return rows;
}

const MASK_CACHE_LIMIT = 16;
const maskCache = new Map<string, Uint8Array>();
/** How much of the display pixel lies inside the dough silhouette, 0-255 (255 = fully inside). The edge is
 *  anti-aliased over one display pixel so the crust line isn't a 64-step staircase. Cached per silhouette:
 *  the shape only changes during DOUGH, while a sauce redraw happens every tick. */
function silhouetteMask(grid: number, shape: DoughShape): Uint8Array {
  const key = `${grid}:${shape.radii.join(",")}`;
  const hit = maskCache.get(key);
  if (hit) return hit;
  const mask = new Uint8Array(grid * grid);
  const pixel = 100 / grid;
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      const px = ((x + 0.5) / grid) * 100;
      const py = ((y + 0.5) / grid) * 100;
      const angle = Math.atan2(py - DOUGH_CENTER, px - DOUGH_CENTER);
      const inside = (doughShapeRadiusAtAngle(shape, angle) - Math.hypot(px - DOUGH_CENTER, py - DOUGH_CENTER)) / pixel + 0.25;
      mask[y * grid + x] = Math.round(Math.min(1, Math.max(0, inside)) * 255);
    }
  }
  if (maskCache.size >= MASK_CACHE_LIMIT) maskCache.clear();
  maskCache.set(key, mask);
  return mask;
}

interface DensityCache {
  key: string;
  count: number;
  /** x, y, amount of every deposit, flattened. */
  values: Float64Array;
  density: Float32Array;
  any: boolean;
}
let densityCache: DensityCache | null = null;

function sameDeposits(cache: DensityCache, deposits: readonly SauceDepositLike[]): boolean {
  const v = cache.values;
  for (let i = 0; i < cache.count; i += 1) {
    const d = deposits[i];
    if (v[i * 3] !== d.x || v[i * 3 + 1] !== d.y || v[i * 3 + 2] !== d.amount) return false;
  }
  return true;
}

function snapshotDeposits(key: string, deposits: readonly SauceDepositLike[], density: Float32Array, any: boolean): DensityCache {
  const values = new Float64Array(deposits.length * 3);
  for (let i = 0; i < deposits.length; i += 1) {
    values[i * 3] = deposits[i].x;
    values[i * 3 + 1] = deposits[i].y;
    values[i * 3 + 2] = deposits[i].amount;
  }
  return { key, count: deposits.length, values, density: density.slice(), any };
}

/**
 * Deposits -> a `grid`x`grid` RGBA buffer (colour from `colorHex`, alpha from the shared curve). Each
 * deposit is weighted by `insideDoughShapeFraction` (the same inside-the-silhouette split the old
 * display used), splatted with the Gaussian kernel at its sub-pixel position, then masked to the dough
 * silhouette (anti-aliased over one pixel). Untouched pixels are fully transparent.
 */
export interface SauceDisplayOptions {
  grid?: number;
  sigmaCells?: number;
  visibleValue?: number;
  rimTaperStartCells?: number;
  rimTaperEndCells?: number;
}

export function buildSauceDisplayPixels(
  deposits: readonly SauceDepositLike[],
  shape: DoughShape,
  colorHex: string,
  options: SauceDisplayOptions = {},
): Uint8ClampedArray {
  const grid = options.grid ?? SAUCE_DISPLAY_GRID;
  const visibleValue = options.visibleValue ?? SAUCE_DISPLAY_VISIBLE_VALUE;
  const pixels = new Uint8ClampedArray(grid * grid * 4);
  const { tables, taperedTables, radius, width } = kernelFor(
    grid,
    options.sigmaCells ?? SAUCE_DISPLAY_SIGMA_CELLS,
    options.rimTaperStartCells ?? SAUCE_DISPLAY_RIM_TAPER_START_CELLS,
    options.rimTaperEndCells ?? SAUCE_DISPLAY_RIM_TAPER_END_CELLS,
  );
  const rows = crustRows(grid);
  // Redraws come one tick at a time (each adds a deposit to the same stroke), so the density of the previous
  // call is reused when this call's deposits extend it; the new deposits are then splatted in the same order a
  // full rebuild would use, so the result is bit-identical either way.
  const cacheKey = `${grid}|${options.sigmaCells ?? SAUCE_DISPLAY_SIGMA_CELLS}|${options.rimTaperStartCells ?? SAUCE_DISPLAY_RIM_TAPER_START_CELLS}|${options.rimTaperEndCells ?? SAUCE_DISPLAY_RIM_TAPER_END_CELLS}|${shape.radii.join(",")}`;
  let density: Float32Array;
  let any = false;
  let from = 0;
  const previous = densityCache;
  if (previous && previous.key === cacheKey && previous.count <= deposits.length && sameDeposits(previous, deposits)) {
    density = previous.density.slice();
    any = previous.any;
    from = previous.count;
  } else {
    density = new Float32Array(grid * grid);
  }
  for (let n = from; n < deposits.length; n += 1) {
    const deposit = deposits[n];
    const amount = deposit.amount * insideDoughShapeFraction(shape, deposit.x, deposit.y) * BRUSH_MASS;
    if (!(amount > 0)) continue;
    any = true;
    // Nearest sub-pixel phase of the deposit's true position (pixel centres sit at index + 0.5).
    let bx = Math.floor((deposit.x / 100) * grid - 0.5);
    let by = Math.floor((deposit.y / 100) * grid - 0.5);
    let kx = Math.round(((deposit.x / 100) * grid - 0.5 - bx) * KERNEL_PHASES);
    let ky = Math.round(((deposit.y / 100) * grid - 0.5 - by) * KERNEL_PHASES);
    if (kx === KERNEL_PHASES) {
      kx = 0;
      bx += 1;
    }
    if (ky === KERNEL_PHASES) {
      ky = 0;
      by += 1;
    }
    const phase = ky * KERNEL_PHASES + kx;
    const table = tables[phase];
    const tapered = taperedTables[phase];
    for (let j = -radius; j <= radius + 1; j += 1) {
      const y = by + j;
      if (y < 0 || y >= grid) continue;
      const rowBase = y * grid;
      const kernelBase = (j + radius) * width + radius - bx; // + x gives the kernel index of pixel x
      const xs = Math.max(0, bx - radius);
      const xe = Math.min(grid - 1, bx + radius + 1);
      const lo = rows.lo[y];
      const hi = rows.hi[y];
      // Pixels left of the disc span and right of it are in the crust band (tapered kernel); the span itself
      // is inside the ideal ring (plain kernel).
      for (let x = xs; x <= xe; x += 1) {
        density[rowBase + x] += amount * (x < lo || x > hi ? tapered : table)[kernelBase + x];
      }
    }
  }
  densityCache = snapshotDeposits(cacheKey, deposits, density, any);
  if (!any) return pixels;

  const mask = silhouetteMask(grid, shape);
  const color = hexToRgb(colorHex);
  for (let p = 0; p < grid * grid; p += 1) {
    const value = density[p];
    if (value <= visibleValue || mask[p] === 0) continue;
    const coverage = mask[p] / 255;
    const i = p * 4;
    pixels[i] = color.r;
    pixels[i + 1] = color.g;
    pixels[i + 2] = color.b;
    pixels[i + 3] = Math.round(sauceDensityToAlpha(value) * coverage * 255);
  }
  return pixels;
}
