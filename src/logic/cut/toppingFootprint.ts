/**
 * #479 S3: how far (dough-percent) a placed topping's drawing reaches from its centre, as a conservative circle. `placeTopping`
 * (./pieces.ts) shows a copy of the topping in every cut piece that circle touches, so a piece that the topping really crosses
 * never loses its part. Drawing only: CUT evaluation, scoring, save and economy never read it.
 *
 * Why a circle round the BOX CORNER and not the half-width: the box of an emoji / SVG glyph is a square and its drawing can reach a
 * corner; a circle of the half-width would miss it. Over-estimating is harmless (a copy in a piece the drawing does not reach is
 * clipped to that piece's outline and shows nothing); under-estimating cuts the topping flat at the cut line.
 */
import { TOPPING_REACH } from "./pieces";

/**
 * The side of the largest on-pizza box at rank scale 1, in CSS px. Measured with Chromium (Noto Color Emoji) over all 50 toppings and the
 * 10 CSS cheeses: emoji line boxes 34.9px, the widest (basil) 37.3px, SVG glyphs at most 1.15em; the CSS cheeses' largest corner
 * (mozzarella M1, 28x23 at the 1.16 bake melt scale) reaches 21px from the centre, inside this circle. 40 leaves room for a wider
 * emoji font (Apple Color Emoji).
 */
export const TOPPING_BOX_PX = 40;

/** The dough's border (CSS px, `--dough-border-width`): the percent coordinates span the padding box inside it (as `cheesePoolReachPercent`). */
export const DOUGH_BORDER_PX = 10;
/** The smallest inner dough width the radius is converted with (as `cheesePoolReachPercent`): a smaller measure only makes the radius larger. */
export const MIN_INNER_DOUGH_PX = 160;

/** The radius, in CSS px, of the circle round a topping drawn at `rankScale` (the box corner: half the diagonal). */
export function toppingFootprintRadiusPx(rankScale: number): number {
  return (TOPPING_BOX_PX * Math.SQRT2 * rankScale) / 2;
}

/**
 * The footprint radius in dough-percent, for a dough rendered `doughPx` CSS px wide. The RESULT's small dough (196px) makes the same
 * topping a larger share of it than the CUT screen's (about 330-360px), which is why a fixed percent cut toppings flat there.
 * Unmeasured (`doughPx` 0: the first frame, jsdom) there is nothing to convert with, so the legacy `TOPPING_REACH` stays.
 */
export function toppingFootprintRadiusPercent(rankScale: number, doughPx: number): number {
  if (!(doughPx > 0)) return TOPPING_REACH;
  const inner = Math.max(MIN_INNER_DOUGH_PX, doughPx - DOUGH_BORDER_PX * 2);
  return (toppingFootprintRadiusPx(rankScale) * 100) / inner;
}
