/**
 * Square-Pan Dough D2-a2 (Issue #537, Epic #532): the one place the sauce canvases ask "which surface is this sauce on?".
 *
 * The round pizza's canvases (SauceHeatmapCanvas, SauceMergedCanvas, OverflowMarkerCanvas) mask by the player's own dough silhouette
 * (`buildSauceDisplayPixels`, `insideDoughShapeFraction`). A square pan swaps ONLY that mask for the pan's (D1-a: `buildSquareSauceDisplayPixels`,
 * `insidePanFraction`); the layering, overlap dimming, olive-oil look, canvas budget and failure nets stay the one shared code. For `"round"` (the
 * default, every shipped pizza) these two functions call the existing round functions with the same arguments, so nothing a round pizza draws moves.
 */
import type { DoughShape } from "../doughShape";
import { buildSauceDisplayPixels } from "../sauceDisplay";
import { insideDoughShapeFraction, type SauceDepositLike } from "../sauceField";
import type { PanShape } from "./panShape";
import { buildSquareSauceDisplayPixels } from "./squareSauceDisplay";
import { insidePanFraction } from "./squareSauce";

/** The display raster (SAUCE_DISPLAY_GRID square, RGBA) of `deposits` on this pan. `doughShape` is read by the round pan only. */
export function buildPanSauceDisplayPixels(
  pan: PanShape,
  deposits: readonly SauceDepositLike[],
  doughShape: DoughShape,
  colorHex: string,
): Uint8ClampedArray {
  return pan === "square" ? buildSquareSauceDisplayPixels(deposits, colorHex) : buildSauceDisplayPixels(deposits, doughShape, colorHex);
}

/** The share (0-1) of a deposit's footprint that lies on this pan; 1 - it is what the overflow markers show. */
export function insidePanSauceFraction(pan: PanShape, doughShape: DoughShape, x: number, y: number): number {
  return pan === "square" ? insidePanFraction(x, y) : insideDoughShapeFraction(doughShape, x, y);
}
