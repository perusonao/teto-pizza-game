/**
 * Square-Pan Dough A (Issue #534, Epic #532): the square-pan dough model and its pure metrics. No gestures yet
 * (B, #535: tap / long-press spread; C, #536: corner drag + completion gate), no UI, no state wiring.
 *
 * Why not the round dough's 8-point radial model (../doughShape.ts)? A radial boundary cannot express a rectangle
 * with corners, and bending it to would change the round feel. The square dough is a separate model: a
 * `SQUARE_DOUGH_GRID` x `SQUARE_DOUGH_GRID` grid over the same 0-100 dough-percent box, one thickness per cell.
 *   - thickness 0           -> no dough on that cell (not covered)
 *   - thickness >= MIN      -> covered
 *   - thickness up to MAX   -> thick (a fresh dough is a small thick ball in the middle)
 * Cells whose centre is off the pan always hold 0 (an invariant `isValidSquareDough` checks).
 *
 * Every number below is an initial value: Owner on-device HV decides the final ones (D5). In particular the
 * corner-reach threshold lives in exactly one place (`CORNER_REACH_THRESHOLD`), pinned by test.
 */
import { DOUGH_CENTER, type DoughPoint } from "../pizzaCoordinates";
import { INITIAL_DOUGH_RADIUS } from "../doughShape";
import { SQUARE_PAN_GEOMETRY, SQUARE_PAN_HALF_SIDE } from "./panGeometry";

/** Cells per side. Matches the sauce field's 16 x 16 so the two layers can share a grid later (D). Provisional. */
export const SQUARE_DOUGH_GRID = 16;

export const SQUARE_DOUGH_MAX_THICKNESS = 1;

/** Relative spread (sd / mean) below which the dough counts as perfectly even -- numerical noise only. */
const EVENNESS_NOISE_FLOOR = 1e-9;

/** A cell counts as covered from this thickness up. */
export const SQUARE_COVER_MIN_THICKNESS = 0.05;

/**
 * D5: a corner counts as reached once the dough extends at least this fraction of the way from the centre to
 * that corner **along both axes** (measured at the outer edge of the furthest covered cell in the corner's
 * quadrant, normalised so covering the outermost on-pan cell = 1). The comparison is inclusive (`>=`).
 * Deliberately generous and imprecise-friendly; the final value is decided from Owner on-device HV.
 */
export const CORNER_REACH_THRESHOLD = 0.85;

export interface SquareDough {
  /** Row-major, length `SQUARE_DOUGH_GRID ** 2`, each in `[0, SQUARE_DOUGH_MAX_THICKNESS]`. */
  readonly thickness: readonly number[];
}

/** Corner order everywhere: clockwise from the north-west, matching `SQUARE_PAN_CORNERS`. */
export const SQUARE_CORNER_COUNT = 4;

const CELL_COUNT = SQUARE_DOUGH_GRID * SQUARE_DOUGH_GRID;
const CELL_SIZE = 100 / SQUARE_DOUGH_GRID;

export function squareCellIndex(row: number, col: number): number {
  return row * SQUARE_DOUGH_GRID + col;
}

/** Cell centre along one axis, in dough-percent. */
export function squareCellCenterPercent(index: number): number {
  return (index + 0.5) * CELL_SIZE;
}

/** Whether the cell's centre lies on the pan. Only these cells can ever hold dough. */
export function isSquareCellOnPan(row: number, col: number): boolean {
  return SQUARE_PAN_GEOMETRY.contains(squareCellCenterPercent(col), squareCellCenterPercent(row));
}

const ON_PAN_CELL_COUNT = (() => {
  let count = 0;
  for (let row = 0; row < SQUARE_DOUGH_GRID; row++) {
    for (let col = 0; col < SQUARE_DOUGH_GRID; col++) if (isSquareCellOnPan(row, col)) count++;
  }
  return count;
})();

/** A fresh dough: a small thick round ball in the middle, the same size as the round dough starts at. */
export function createInitialSquareDough(): SquareDough {
  const thickness = new Array<number>(CELL_COUNT).fill(0);
  for (let row = 0; row < SQUARE_DOUGH_GRID; row++) {
    for (let col = 0; col < SQUARE_DOUGH_GRID; col++) {
      const distance = Math.hypot(squareCellCenterPercent(col) - DOUGH_CENTER, squareCellCenterPercent(row) - DOUGH_CENTER);
      if (distance <= INITIAL_DOUGH_RADIUS && isSquareCellOnPan(row, col)) thickness[squareCellIndex(row, col)] = SQUARE_DOUGH_MAX_THICKNESS;
    }
  }
  return { thickness };
}

/** The "stale / late / corrupted value" guard every committed shape payload gets (cf. `isValidDoughShape`). */
export function isValidSquareDough(dough: SquareDough): boolean {
  if (!Array.isArray(dough.thickness) || dough.thickness.length !== CELL_COUNT) return false;
  for (let row = 0; row < SQUARE_DOUGH_GRID; row++) {
    for (let col = 0; col < SQUARE_DOUGH_GRID; col++) {
      const value = dough.thickness[squareCellIndex(row, col)];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > SQUARE_DOUGH_MAX_THICKNESS) return false;
      if (value > 0 && !isSquareCellOnPan(row, col)) return false;
    }
  }
  return true;
}

function isCovered(value: number): boolean {
  return value >= SQUARE_COVER_MIN_THICKNESS;
}

/** Covered share of the on-pan cells, in [0, 1]. */
export function squareDoughCoverage(dough: SquareDough): number {
  let covered = 0;
  for (let row = 0; row < SQUARE_DOUGH_GRID; row++) {
    for (let col = 0; col < SQUARE_DOUGH_GRID; col++) {
      if (isSquareCellOnPan(row, col) && isCovered(dough.thickness[squareCellIndex(row, col)])) covered++;
    }
  }
  return covered / ON_PAN_CELL_COUNT;
}

/**
 * How even the thickness is across the whole pan, in [0, 1]: `1 - (standard deviation / mean)` over **every on-pan
 * cell, uncovered ones counting as thickness 0**, floored at 0. A uniform full sheet is 1; an empty pan is 0. Because
 * empty cells are part of the population, a mostly empty pan can never read as even -- a small ball with a few
 * isolated extensions, or a thin frame around the rim, scores ~0 -- so "all corners reached and evenness above a
 * threshold" (the completion gate, C) cannot be met by stretching out tendrils to the corners.
 */
export function squareDoughEvenness(dough: SquareDough): number {
  const values: number[] = [];
  for (let row = 0; row < SQUARE_DOUGH_GRID; row++) {
    for (let col = 0; col < SQUARE_DOUGH_GRID; col++) {
      if (!isSquareCellOnPan(row, col)) continue;
      // An uncovered cell is thickness 0 -- including a sliver below SQUARE_COVER_MIN_THICKNESS, which `isCovered`
      // (coverage, corner reach) already treats as no dough. Using its raw value would let a near-threshold film
      // over the whole pan read as an even sheet.
      const value = dough.thickness[squareCellIndex(row, col)];
      values.push(isCovered(value) ? value : 0);
    }
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean <= 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const spread = Math.sqrt(variance) / mean;
  // A uniform sheet must read exactly 1 whatever its thickness: floating-point noise in the mean is not unevenness.
  if (spread < EVENNESS_NOISE_FLOOR) return 1;
  return Math.max(0, 1 - spread);
}

/** Outer edge of a cell, as a distance from the centre along one axis, clipped to the pan. */
function outerEdgeOffset(index: number): number {
  return Math.min(SQUARE_PAN_HALF_SIDE, Math.abs(squareCellCenterPercent(index) - DOUGH_CENTER) + CELL_SIZE / 2);
}

/** The largest `outerEdgeOffset` any on-pan cell has -- covering that cell is "all the way into the corner". */
const MAX_OUTER_EDGE_OFFSET = (() => {
  let max = 0;
  for (let i = 0; i < SQUARE_DOUGH_GRID; i++) {
    if (isSquareCellOnPan(i, i)) max = Math.max(max, outerEdgeOffset(i));
  }
  return max;
})();

/** Quadrant signs of the four corners, clockwise from the north-west: [x, y] with -1 = left/top. */
const CORNER_SIGNS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/**
 * For each corner (NW, NE, SE, SW), how far the dough has been pulled into it, in [0, 1]: the best, over the
 * covered on-pan cells in that corner's quadrant, of the smaller of the two axis extents (outer cell edge,
 * clipped to the pan) divided by the outermost on-pan edge. 0 = nothing in that quadrant; 1 = the corner cell.
 * Taking the smaller axis means a dough pulled far along one side only does not count as reaching the corner.
 */
export function squareCornerReach(dough: SquareDough): readonly number[] {
  return CORNER_SIGNS.map(([sx, sy]) => {
    let best = 0;
    for (let row = 0; row < SQUARE_DOUGH_GRID; row++) {
      for (let col = 0; col < SQUARE_DOUGH_GRID; col++) {
        if (!isSquareCellOnPan(row, col) || !isCovered(dough.thickness[squareCellIndex(row, col)])) continue;
        const dx = squareCellCenterPercent(col) - DOUGH_CENTER;
        const dy = squareCellCenterPercent(row) - DOUGH_CENTER;
        if (Math.sign(dx) !== sx || Math.sign(dy) !== sy) continue;
        best = Math.max(best, Math.min(outerEdgeOffset(col), outerEdgeOffset(row)) / MAX_OUTER_EDGE_OFFSET);
      }
    }
    return Math.min(1, best);
  });
}

/** Every corner reached (inclusive threshold). */
export function areAllCornersReached(dough: SquareDough, threshold: number = CORNER_REACH_THRESHOLD): boolean {
  return squareCornerReach(dough).every((reach) => reach >= threshold);
}

/** Dough-percent position of a cell centre, for later rendering / hit-testing. */
export function squareCellCenter(row: number, col: number): DoughPoint {
  return { x: squareCellCenterPercent(col), y: squareCellCenterPercent(row) };
}
