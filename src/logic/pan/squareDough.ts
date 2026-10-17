/**
 * Square-Pan Dough A (Issue #534): the square dough MODEL -- pure functions over a coverage / thickness cell grid. It deliberately does not reuse
 * the round dough's radial 8-point model (`doughShape.ts`): eight radii cannot express a rectangle with corners.
 *
 * Each cell holds `spread` in [0, 1]: how fully the dough has been pressed out at that cell of the pan (0 = no dough has reached it yet, 1 = pressed
 * out completely). Coverage, evenness and corner reach are measured from that one grid. This slice only DEFINES the model and its measures; the
 * gestures that change it are step B (tap / long-press = `pressAt`'s caller) and step C (the corner drag and the completion predicate, which also
 * owns the final thresholds). Nothing in the game uses this module yet.
 *
 * All numbers below are INITIAL values (Owner decision D5): the final values come from Owner on-device HV, so each is a named constant in one place.
 */
import { DOUGH_CENTER } from "../pizzaCoordinates";
import { SQUARE_PAN_HALF_SIDE } from "./panGeometry";

/** Cells per side. */
export const SQUARE_DOUGH_GRID = 12;
/** A cell counts as covered once its spread reaches this. */
export const SQUARE_COVERAGE_MIN_SPREAD = 0.05;
/** A corner is "reached" when the mean spread of its corner zone is at least this (Owner D5 initial value: 85%). */
export const SQUARE_CORNER_REACH_THRESHOLD = 0.85;
/** A corner zone covers this fraction of each axis, anchored in the corner (the outer quarter). */
export const SQUARE_CORNER_ZONE_FRACTION = 0.25;
/** The zone's side in cells, derived from the fraction so a re-tuned grid keeps the same proportion; never more than half the grid (zones must not overlap). */
export const SQUARE_CORNER_ZONE_CELLS = Math.max(1, Math.min(Math.floor(SQUARE_DOUGH_GRID / 2), Math.round(SQUARE_DOUGH_GRID * SQUARE_CORNER_ZONE_FRACTION)));

export interface SquareDough {
  /** Row-major, `SQUARE_DOUGH_GRID` * `SQUARE_DOUGH_GRID` values, each in [0, 1]. */
  cells: readonly number[];
}

export type CornerId = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
export const CORNER_IDS: readonly CornerId[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"];

const CELL_COUNT = SQUARE_DOUGH_GRID * SQUARE_DOUGH_GRID;
const PAN_MIN = DOUGH_CENTER - SQUARE_PAN_HALF_SIDE;
const CELL_SIZE = (2 * SQUARE_PAN_HALF_SIDE) / SQUARE_DOUGH_GRID;

export function createSquareDough(): SquareDough {
  return { cells: new Array<number>(CELL_COUNT).fill(0) };
}

export function isValidSquareDough(dough: SquareDough | null | undefined): dough is SquareDough {
  return (
    typeof dough === "object" &&
    dough !== null &&
    Array.isArray(dough.cells) &&
    dough.cells.length === CELL_COUNT &&
    dough.cells.every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1)
  );
}

/** Centre of a cell in dough percent. */
export function squareCellCenter(col: number, row: number): { x: number; y: number } {
  return { x: PAN_MIN + (col + 0.5) * CELL_SIZE, y: PAN_MIN + (row + 0.5) * CELL_SIZE };
}

/** The cell under a dough-percent point, or null when the point is off the pan (or not finite). */
export function squareCellAt(x: number, y: number): { col: number; row: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const fx = (x - PAN_MIN) / CELL_SIZE;
  const fy = (y - PAN_MIN) / CELL_SIZE;
  if (fx < 0 || fy < 0 || fx > SQUARE_DOUGH_GRID || fy > SQUARE_DOUGH_GRID) return null;
  return { col: Math.min(SQUARE_DOUGH_GRID - 1, Math.floor(fx)), row: Math.min(SQUARE_DOUGH_GRID - 1, Math.floor(fy)) };
}

/**
 * Presses the dough out around (x, y): every cell whose centre is within `brushRadius` (dough percent) gains up to `amount` of spread, strongest at the
 * centre and fading linearly to 0 at the brush edge; a cell saturates at 1 and never goes below its current value. Returns the same object for
 * anything that cannot change the grid (a non-finite input, a non-positive amount or radius, or a malformed grid), so a bad pointer event or a bad grid can never put a NaN in the model.
 */
export function pressAt(dough: SquareDough, x: number, y: number, amount: number, brushRadius: number): SquareDough {
  if (!isValidSquareDough(dough) || ![x, y, amount, brushRadius].every(Number.isFinite) || amount <= 0 || brushRadius <= 0) return dough;
  let changed = false;
  const cells = dough.cells.slice();
  for (let row = 0; row < SQUARE_DOUGH_GRID; row += 1) {
    for (let col = 0; col < SQUARE_DOUGH_GRID; col += 1) {
      const c = squareCellCenter(col, row);
      const d = Math.hypot(c.x - x, c.y - y);
      if (d >= brushRadius) continue;
      const i = row * SQUARE_DOUGH_GRID + col;
      const next = Math.min(1, cells[i] + amount * (1 - d / brushRadius));
      if (next !== cells[i]) {
        cells[i] = next;
        changed = true;
      }
    }
  }
  return changed ? { cells } : dough;
}

/** Fraction (0-1) of the pan's cells that are covered. */
export function squareCoverage(dough: SquareDough): number {
  return dough.cells.filter((v) => v >= SQUARE_COVERAGE_MIN_SPREAD).length / CELL_COUNT;
}

/**
 * How even the spread is over the whole pan, 0-1: `1 - stdDev / mean`, clamped. A uniform grid is 1 **whatever its level** (a barely pressed pan with every
 * cell at 0.06 is perfectly even); an empty grid is 0. Bare cells count, so a pan that is only partly covered is uneven by construction. Evenness is therefore a
 * SHAPE measure only: step C's completion must combine it with corner reach (which reads the level) and, if wanted, `squareMeanSpread` -- never evenness alone.
 */
export function squareEvenness(dough: SquareDough): number {
  const mean = dough.cells.reduce((a, v) => a + v, 0) / CELL_COUNT;
  if (mean <= 0) return 0;
  const variance = dough.cells.reduce((a, v) => a + (v - mean) ** 2, 0) / CELL_COUNT;
  return Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / mean));
}

/** Mean spread over the whole pan, 0-1 (the level that `squareEvenness` deliberately ignores). */
export function squareMeanSpread(dough: SquareDough): number {
  return dough.cells.reduce((a, v) => a + v, 0) / CELL_COUNT;
}

/** The cells (col, row) of one corner zone. */
export function squareCornerZone(corner: CornerId): { col: number; row: number }[] {
  const near = Array.from({ length: SQUARE_CORNER_ZONE_CELLS }, (_, i) => i);
  const far = near.map((i) => SQUARE_DOUGH_GRID - 1 - i);
  const cols = corner === "topLeft" || corner === "bottomLeft" ? near : far;
  const rows = corner === "topLeft" || corner === "topRight" ? near : far;
  return rows.flatMap((row) => cols.map((col) => ({ col, row })));
}

/** Corner reach per corner, 0-1: the mean spread of that corner's zone. */
export function squareCornerReach(dough: SquareDough): Record<CornerId, number> {
  const reach = {} as Record<CornerId, number>;
  for (const corner of CORNER_IDS) {
    const zone = squareCornerZone(corner);
    reach[corner] = zone.reduce((a, { col, row }) => a + dough.cells[row * SQUARE_DOUGH_GRID + col], 0) / zone.length;
  }
  return reach;
}

export function isSquareCornerReached(reach: number): boolean {
  return reach >= SQUARE_CORNER_REACH_THRESHOLD;
}

/** Which corners are reached (at `SQUARE_CORNER_REACH_THRESHOLD`). */
export function squareCornersReached(dough: SquareDough): Record<CornerId, boolean> {
  const reach = squareCornerReach(dough);
  return Object.fromEntries(CORNER_IDS.map((c) => [c, isSquareCornerReached(reach[c])])) as Record<CornerId, boolean>;
}
