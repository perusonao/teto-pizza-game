/**
 * #535 (Square-Pan Dough B): fixed square-dough shapes for the Preview / DEV switch (../../preview/panShapePreview.ts) and for tests.
 * Deterministic: no randomness, no clock. Production code does not import this module; only the gated Preview path and tests do.
 */
import {
  SQUARE_DOUGH_GRID,
  SQUARE_DOUGH_MAX_THICKNESS,
  isSquareCellOnPan,
  squareCellCenterPercent,
  squareCellIndex,
  type SquareDough,
} from "./squareDough";

/**
 * Lumps: a centre (percent of the box), a spread (percent) and how much thicker than the base sheet. Finger-sized (a spread of
 * 5-7% is a lump one to two fingertips wide on a phone), so a single tap can visibly flatten one, and the sheet is clearly uneven.
 */
const LUMPS: readonly { x: number; y: number; spread: number; extra: number }[] = [
  { x: 24, y: 26, spread: 6, extra: 0.5 },
  { x: 50, y: 20, spread: 5, extra: 0.45 },
  { x: 76, y: 28, spread: 6, extra: 0.5 },
  { x: 30, y: 50, spread: 5.5, extra: 0.45 },
  { x: 58, y: 48, spread: 7, extra: 0.5 },
  { x: 80, y: 56, spread: 5, extra: 0.4 },
  { x: 22, y: 76, spread: 6, extra: 0.5 },
  { x: 48, y: 78, spread: 5.5, extra: 0.45 },
  { x: 74, y: 80, spread: 6.5, extra: 0.5 },
];

/** The base sheet is this thick, lumps add `extra` on top (clamped to the maximum). */
const LUMPY_BASE_THICKNESS = 0.35;

/**
 * A full sheet over the whole pan with thick lumps in it: every on-pan cell is covered, so the outline is complete and only
 * the thickness is uneven -- what B's tap and hold level out. Valid by `isValidSquareDough`.
 */
export function createLumpySquareDough(): SquareDough {
  const thickness = new Array<number>(SQUARE_DOUGH_GRID * SQUARE_DOUGH_GRID).fill(0);
  for (let row = 0; row < SQUARE_DOUGH_GRID; row++) {
    for (let col = 0; col < SQUARE_DOUGH_GRID; col++) {
      if (!isSquareCellOnPan(row, col)) continue;
      const x = squareCellCenterPercent(col);
      const y = squareCellCenterPercent(row);
      let value = LUMPY_BASE_THICKNESS;
      for (const lump of LUMPS) {
        const d2 = (x - lump.x) ** 2 + (y - lump.y) ** 2;
        value += lump.extra * Math.exp(-d2 / (2 * lump.spread ** 2));
      }
      thickness[squareCellIndex(row, col)] = Math.min(SQUARE_DOUGH_MAX_THICKNESS, value);
    }
  }
  return { thickness };
}
