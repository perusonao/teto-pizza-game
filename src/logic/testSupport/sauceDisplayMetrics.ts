/**
 * Issue #475 Slice 1: shape metrics for a rasterized sauce alpha map, shared by the unit tests
 * (../sauceDisplay.test.ts) and the browser spec (e2e/sauce-edge-475.spec.ts, which feeds it the
 * heatmap canvas's real pixels in Chromium AND WebKit). Pure functions of an alpha array.
 *
 * "Edge roughness" and "shape distortion" are the two numbers Step 0 of Issue #475 measured on
 * screenshots: the roughness is the RMS of the boundary radius r(theta) minus its +-12 degree moving
 * average, as a percentage of the pizza width; the distortion is max r / min r (a circle is 1.0, a square
 * about 1.41). Both are only meaningful for a blob around its own centre (a hold, a spiral, a ring).
 */

/** Alpha (0-255) where the painted core begins: the display's alpha floor is 0.46, so this is "any sauce". */
export const CORE_ALPHA = 0.45 * 255;
/** Alpha (0-255) used for extent: half the floor, i.e. including the soft fringe a bilinear upscale adds. */
export const EXTENT_ALPHA = 0.23 * 255;

export interface AlphaMap {
  readonly size: number;
  readonly alpha: ArrayLike<number>;
}

/** Bilinear upscale of a `grid`x`grid` alpha array to `size`x`size` (what drawImage with smoothing does). */
export function upscaleAlpha(alpha: ArrayLike<number>, grid: number, size: number): AlphaMap {
  const out = new Float32Array(size * size);
  const at = (r: number, c: number) =>
    alpha[Math.min(grid - 1, Math.max(0, r)) * grid + Math.min(grid - 1, Math.max(0, c))];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const fx = ((x + 0.5) / size) * grid - 0.5;
      const fy = ((y + 0.5) / size) * grid - 0.5;
      const c0 = Math.floor(fx);
      const r0 = Math.floor(fy);
      const tx = fx - c0;
      const ty = fy - r0;
      out[y * size + x] =
        (1 - ty) * ((1 - tx) * at(r0, c0) + tx * at(r0, c0 + 1)) +
        ty * ((1 - tx) * at(r0 + 1, c0) + tx * at(r0 + 1, c0 + 1));
    }
  }
  return { size, alpha: out };
}

/** Pulls the alpha channel out of an RGBA buffer. */
export function alphaOfRgba(rgba: ArrayLike<number>): Float32Array {
  const out = new Float32Array(rgba.length / 4);
  for (let i = 0; i < out.length; i += 1) out[i] = rgba[i * 4 + 3];
  return out;
}

export interface ShapeStats {
  /** Pixels at or above the threshold, as a percentage of the whole map. */
  areaPct: number;
  /** Alpha-weighted centroid, in percent of the map width (50 = centre). */
  cx: number;
  cy: number;
  /** max r / min r of the boundary around the centroid (1.0 = circle). 0 when nothing is painted. */
  distortion: number;
  /** RMS of r(theta) minus its +-12 degree moving average, as a percentage of the map width. */
  roughnessPct: number;
}

export function shapeStats(map: AlphaMap, threshold: number): ShapeStats {
  const { size, alpha } = map;
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const a = alpha[y * size + x];
      if (a >= threshold) n += 1;
      sx += a * (x + 0.5);
      sy += a * (y + 0.5);
      sw += a;
    }
  }
  if (sw === 0 || n === 0) return { areaPct: 0, cx: 50, cy: 50, distortion: 0, roughnessPct: 0 };
  const cx = (sx / sw / size) * 100;
  const cy = (sy / sw / size) * 100;
  const px = (cx / 100) * size;
  const py = (cy / 100) * size;
  const r: number[] = [];
  for (let t = 0; t < 360; t += 1) {
    const angle = (t * Math.PI) / 180;
    let best = 0;
    for (let rr = 0; rr < size; rr += 0.5) {
      const x = Math.floor(px + Math.cos(angle) * rr);
      const y = Math.floor(py + Math.sin(angle) * rr);
      if (x < 0 || y < 0 || x >= size || y >= size) break;
      if (alpha[y * size + x] >= threshold) best = rr;
    }
    r.push(best);
  }
  const active = r.filter((v) => v > 0);
  const distortion = active.length === 0 ? 0 : Math.max(...active) / Math.min(...active);
  let sum2 = 0;
  for (let t = 0; t < 360; t += 1) {
    let mean = 0;
    for (let k = -12; k <= 12; k += 1) mean += r[(t + k + 360) % 360];
    mean /= 25;
    sum2 += (r[t] - mean) ** 2;
  }
  return {
    areaPct: (n / (size * size)) * 100,
    cx,
    cy,
    distortion,
    roughnessPct: (Math.sqrt(sum2 / 360) / size) * 100,
  };
}
