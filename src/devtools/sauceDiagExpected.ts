import { buildSauceDisplayPixels, SAUCE_DISPLAY_GRID } from "../logic/sauceDisplay";
import type { DoughShape } from "../logic/doughShape";
import type { SauceDeposit } from "../state/pizzaState";
import { sauceRunsOf, SAUCE_OWN_LAYERS } from "../state/sauceLayers";
import { getIngredient } from "../data/ingredients";

/**
 * Sauce diagnostic (Issue #524 Owner HV), the EXPECTED side: what each sauce canvas SHOULD hold, computed from the pizza's own deposit log in plain arrays.
 * Pure: it never creates a canvas, never calls putImageData / drawImage, and does not touch the staging surface -- i.e. nothing the canvas transfer path
 * (the suspect of the "tomato disappears under the oil" report) uses. Two independent expectations per layer:
 *
 *  1. `centroid`: the amount-weighted mean (x, y) of the layer's own deposits, in % of the dough. It uses NO renderer code at all (raw deposit coordinates only),
 *     so a canvas that holds another layer's pixels, or none, is caught even if `buildSauceDisplayPixels` were itself wrong.
 *  2. `mask` / `rgb`: the 64x64 support mask and the colour the renderer's own display function (`buildSauceDisplayPixels`) builds for the layer. This
 *     shares that pure function with the renderer (documented, not hidden), so it proves the canvas got the pixels of the right layer, not that the function is right.
 */
export interface ExpectedLayer {
  kind: string;
  /** amount-weighted mean x, y of the layer's deposits (% of the dough) */
  centroid: [number, number];
  /** 64x64 support mask (1 where alpha > 8) */
  mask: Uint8Array;
  rgb: [number, number, number];
}

const hexRgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function centroidOf(deposits: readonly { x: number; y: number; amount: number }[]): [number, number] {
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (const d of deposits) {
    const w = Number.isFinite(d.amount) && d.amount > 0 ? d.amount : 1e-6;
    sw += w;
    sx += w * d.x;
    sy += w * d.y;
  }
  return sw > 0 ? [sx / sw, sy / sw] : [50, 50];
}

/**
 * The expected OWN heat canvases of the pizza, in the DOM order the stage draws them (oldest run first). `null` when the pizza has more runs than own
 * canvases (older runs are flattened into shared groups: not covered here) or nothing was painted.
 */
export function expectedOwnLayers(facts: { sauceIds: readonly string[]; deposits: readonly SauceDeposit[]; doughShape: DoughShape }): ExpectedLayer[] | null {
  const runs = sauceRunsOf({ sauceIds: [...facts.sauceIds], sauceDeposits: [...facts.deposits] });
  if (runs.length === 0 || runs.length > SAUCE_OWN_LAYERS) return null;
  return runs.map((run) => {
    const color = getIngredient(run.ingredientId)?.color ?? "#c73b2e";
    const px = buildSauceDisplayPixels(run.deposits, facts.doughShape, color);
    const mask = new Uint8Array(SAUCE_DISPLAY_GRID * SAUCE_DISPLAY_GRID);
    for (let i = 0; i < mask.length; i += 1) mask[i] = px[i * 4 + 3] > 8 ? 1 : 0;
    return { kind: run.ingredientId, centroid: centroidOf(run.deposits), mask, rgb: hexRgb(color) };
  });
}
