/**
 * Square-Pan Dough D2-b2 (Issue #537, Epic #532): the square dough as it LOOKS on its tray -- pure, no DOM, render only.
 *
 * `rasterizeSquareDough` (squareDoughRaster.ts) draws the dough alone, on transparency. On the flat grey of the pan an uncovered patch then
 * reads as a bite taken out of the dough (the "grey gouges" the Owner saw at STEP 1, #537 comment of 2026-10-19), and the edge of the sheet has no
 * thickness. This composes one opaque picture of the pan's floor with the dough on it:
 *   - the floor is a little lighter at the top left (the light) and darker at the bottom right, with the pan's wall darkening its edge, so an empty
 *     patch reads as the tray's floor;
 *   - the dough casts a soft shadow onto the floor (down and to the right, away from the light), so the sheet sits ON the tray;
 *   - the dough's own edge has a side: a bright lip where it faces the light and a darker one where it turns away.
 *
 * Nothing is decided here. The thickness, the coverage mask and the dough's own pixels are `squareDoughRaster.ts`'s, unchanged; the picture only adds
 * colour around and at the edge of them. Scoring, completion, the save and CUT never see it.
 */
import { RASTER_SIZE, coverageMask, rasterizeSquareDough, thicknessSurface } from "./squareDoughRaster";
import type { SquareDough } from "./squareDough";
import { thicknessRgb, type SquareDoughRamp } from "./squareDoughView";

/** The floor of the pan: light at the top left, dark at the bottom right (the pan's own grey, as `.square-dough-layer__pan` draws it). */
export const PAN_FLOOR_LIGHT: readonly [number, number, number] = [138, 143, 150];
export const PAN_FLOOR_DARK: readonly [number, number, number] = [96, 100, 107];
/** The pan's wall darkens the floor within this many pixels of the rim, by up to WALL_DARKEN. */
export const WALL_PX = 6;
export const WALL_DARKEN = 0.22;
/** The dough's shadow on the floor: offset (pixels, down and right), blur radius (pixels) and the most it darkens the floor. */
export const SHADOW_DX = 2.5;
export const SHADOW_DY = 3.5;
export const SHADOW_BLUR = 3;
export const SHADOW_STRENGTH = 0.62;
/**
 * The outline of the sheet is the 16 x 16 grid's, so it is a row of round bumps with a notch between every two. Closing the notches (blur radius
 * CLOSE_BLUR pixels, a threshold at 0.5) only ever ADDS pixels to a notch, never takes one from the dough: every pixel the dough already covers
 * stays as it is, and the picture fills at most about CLOSE_BLUR pixels into a concave corner (a quarter of a cell).
 */
export const CLOSE_BLUR = 2;
/** The dough's edge: brighter by up to EDGE_LIT where it faces the light, darker by EDGE_DARK where it faces away (fraction of the colour). */
export const EDGE_LIT = 0.07;
export const EDGE_DARK = 0.2;
/** The light's direction (up and to the left), the same as the relief's. */
const LIGHT: readonly [number, number] = (() => {
  const x = -0.62;
  const y = -0.78;
  const n = Math.hypot(x, y);
  return [x / n, y / n];
})();

function smoothstep(lo: number, hi: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

/** One box-blur pass of radius `r` over a size x size field, edges clamped (separable: rows, then columns). */
function boxBlur(field: Float32Array, size: number, r: number): Float32Array {
  if (r <= 0) return field;
  const width = 2 * r + 1;
  const tmp = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += field[y * size + Math.min(size - 1, Math.max(0, x + k))];
      tmp[y * size + x] = sum / width;
    }
  }
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += tmp[Math.min(size - 1, Math.max(0, y + k)) * size + x];
      out[y * size + x] = sum / width;
    }
  }
  return out;
}

/** Bilinear sample of a size x size field at a fractional pixel position, edges clamped. */
function sample(field: Float32Array, size: number, x: number, y: number): number {
  const fx = Math.min(size - 1, Math.max(0, x));
  const fy = Math.min(size - 1, Math.max(0, y));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const top = field[y0 * size + x0] * (1 - tx) + field[y0 * size + x1] * tx;
  const bottom = field[y1 * size + x0] * (1 - tx) + field[y1 * size + x1] * tx;
  return top * (1 - ty) + bottom * ty;
}

/** The pan's floor colour at a pixel (no dough): the light gradient, darkened toward the wall. */
export function panFloorRgb(x: number, y: number, size: number = RASTER_SIZE): [number, number, number] {
  const t = (x + y) / (2 * (size - 1));
  const wall = Math.min(x, y, size - 1 - x, size - 1 - y);
  const shade = 1 - WALL_DARKEN * (1 - smoothstep(0, WALL_PX, wall));
  return [
    (PAN_FLOOR_LIGHT[0] + (PAN_FLOOR_DARK[0] - PAN_FLOOR_LIGHT[0]) * t) * shade,
    (PAN_FLOOR_LIGHT[1] + (PAN_FLOOR_DARK[1] - PAN_FLOOR_LIGHT[1]) * t) * shade,
    (PAN_FLOOR_LIGHT[2] + (PAN_FLOOR_DARK[2] - PAN_FLOOR_LIGHT[2]) * t) * shade,
  ];
}

/**
 * The pan with the dough on it as OPAQUE RGBA pixels, row-major, `size` x `size`. Same footprint and thickness colours as
 * `rasterizeSquareDough`; the floor, the cast shadow and the dough's edge are added around and at its rim.
 */
export function rasterizeSquareDoughSheet(dough: SquareDough, ramp: SquareDoughRamp = "ball", size: number = RASTER_SIZE): Uint8ClampedArray<ArrayBuffer> {
  const sheet = rasterizeSquareDough(dough, ramp, size);
  const mask = coverageMask(dough, size);
  const closed = boxBlur(mask, size, CLOSE_BLUR);
  const surface = thicknessSurface(dough, size);
  const shadowField = boxBlur(boxBlur(mask, size, SHADOW_BLUR), size, SHADOW_BLUR);
  const at = (x: number, y: number) => mask[Math.min(size - 1, Math.max(0, y)) * size + Math.min(size - 1, Math.max(0, x))];
  const out: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      const [fr, fg, fb] = panFloorRgb(x, y, size);
      // the floor, darkened where the dough's shadow falls on it
      const shadow = 1 - SHADOW_STRENGTH * sample(shadowField, size, x - SHADOW_DX, y - SHADOW_DY);
      let r = fr * shadow;
      let g = fg * shadow;
      let b = fb * shadow;
      let alpha = sheet[o + 3] / 255;
      let dr = sheet[o];
      let dg = sheet[o + 1];
      let db = sheet[o + 2];
      const fill = smoothstep(0.45, 0.55, closed[y * size + x]);
      if (fill > alpha) {
        // a notch of the outline, closed: the pixel takes the colour of the thickness there (never thinner than the palest film)
        [dr, dg, db] = thicknessRgb(Math.max(surface[y * size + x], 0.06), ramp);
        alpha = fill;
      }
      if (alpha > 0) {
        // the dough's edge has a side: where the coverage mask changes, a lip lit from the top left and dark on the far side
        const gx = (at(x + 1, y) - at(x - 1, y)) / 2;
        const gy = (at(x, y + 1) - at(x, y - 1)) / 2;
        const magnitude = Math.hypot(gx, gy);
        const edge = smoothstep(0.03, 0.12, magnitude);
        const facing = magnitude > 0 ? -(gx * LIGHT[0] + gy * LIGHT[1]) / magnitude : 0; // +1: the edge faces the light, -1: away from it
        const side = 1 + edge * (facing > 0 ? EDGE_LIT * facing : EDGE_DARK * facing);
        r = dr * side * alpha + r * (1 - alpha);
        g = dg * side * alpha + g * (1 - alpha);
        b = db * side * alpha + b * (1 - alpha);
      }
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
  }
  return out;
}
