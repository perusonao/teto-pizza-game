/**
 * Phase 4A-1A: the Sauce Field -- a 16x16 normalized-quantity density grid over the
 * dough's own 0-100% coordinate box (../logic/pizzaCoordinates.ts), used only to derive
 * Prototype Metrics (quantity/coverage/evenness/overflow) for the Margherita Reference
 * prototype. It is never persisted and never feeds authoritative scoring (../logic/scoring.ts) --
 * see ./referenceScoring.ts's file header for that boundary.
 *
 * Deliberately keeps quantity and coverage as two different numbers computed two different
 * ways (sum of deposited amount vs. fraction of cells touched): a large deposit concentrated
 * on one point must read as high quantity / low coverage / low evenness, and a small amount
 * spread thin must read as low quantity / high coverage, or this whole prototype can't tell
 * "dumped a puddle" apart from "painted it on".
 */
import { distanceFromCenter, isInsideDough } from "./pizzaCoordinates";
import { clampQuantity } from "./sauceQuantity";

export interface SauceDepositLike {
  x: number;
  y: number;
  amount: number;
}

/** Grid resolution. 16x16 is the Prototype's base case (SSOT for this phase); kept as a
 *  named constant (not a magic 16) so a later phase can retune it with a recorded reason
 *  instead of a silent edit. */
export const SAUCE_FIELD_SIZE = 16;

/** A density cell counts as "touched" (contributes to coverage) once it holds more than
 *  this much normalized quantity -- filters out the near-zero falloff tail of a brush
 *  that only grazed a neighboring cell, which would otherwise inflate coverage. */
const COVERAGE_THRESHOLD = 0.02;

/** How many grid cells out from a deposit's own cell the brush falloff reaches. A deposit
 *  lighting up only its exact cell would make "spread while moving" indistinguishable from
 *  "many separate dots"; a small radius reads as one continuous stroke instead. */
const BRUSH_RADIUS_CELLS = 1;

function cellCenterPercent(index: number): number {
  return ((index + 0.5) / SAUCE_FIELD_SIZE) * 100;
}

/** Whether the given grid cell's center falls inside the dough circle -- the denominator
 *  for coverage, and the population evenness is measured over, is *this* set of cells, not
 *  the full 16x16 square (the square's corners are outside the round dough). */
export function isCellInsideDough(row: number, col: number): boolean {
  return distanceFromCenter(cellCenterPercent(col), cellCenterPercent(row)) <= 48;
}

let cachedInDoughCellCount: number | null = null;
function inDoughCellCount(): number {
  if (cachedInDoughCellCount !== null) return cachedInDoughCellCount;
  let n = 0;
  for (let r = 0; r < SAUCE_FIELD_SIZE; r += 1) {
    for (let c = 0; c < SAUCE_FIELD_SIZE; c += 1) {
      if (isCellInsideDough(r, c)) n += 1;
    }
  }
  cachedInDoughCellCount = n;
  return n;
}

/**
 * Rasterizes deposits (already filtered to inside-dough ones by the caller -- see
 * `computeSauceMetrics` below) into a 16x16 density grid, each deposit spreading a small
 * falloff into its neighboring cells. Exported mainly so the Visual Feedback layer
 * (PizzaStage's sauce heatmap canvas) can reuse the exact same field the metrics are
 * computed from, instead of drawing something that only looks similar.
 */
export function buildSauceField(deposits: readonly SauceDepositLike[]): Float64Array {
  const field = new Float64Array(SAUCE_FIELD_SIZE * SAUCE_FIELD_SIZE);
  for (const deposit of deposits) {
    const col = Math.floor((deposit.x / 100) * SAUCE_FIELD_SIZE);
    const row = Math.floor((deposit.y / 100) * SAUCE_FIELD_SIZE);
    for (let dr = -BRUSH_RADIUS_CELLS; dr <= BRUSH_RADIUS_CELLS; dr += 1) {
      for (let dc = -BRUSH_RADIUS_CELLS; dc <= BRUSH_RADIUS_CELLS; dc += 1) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= SAUCE_FIELD_SIZE || c < 0 || c >= SAUCE_FIELD_SIZE) continue;
        const falloff = 1 / (1 + Math.hypot(dr, dc));
        field[r * SAUCE_FIELD_SIZE + c] += deposit.amount * falloff;
      }
    }
  }
  return field;
}

/**
 * 0 (all quantity concentrated in a single cell) to 1 (as uniform as this total quantity
 * can possibly be spread across `values`). Comparing against the *worst case for this same
 * total* -- rather than a fixed scale -- is what keeps evenness meaningful independent of
 * how much sauce is on the pizza at all: a tiny dab spread over two cells and a full
 * dispenser spread over two hundred cells can both score close to 1 if each is about as
 * even as that amount of sauce could be.
 */
function computeEvenness(values: readonly number[]): number {
  const n = values.length;
  if (n === 0) return 1;
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum <= 1e-9) return 1; // nothing deposited yet -- neutral, not "bad".

  const mean = sum / n;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  // Worst case for this exact total: every bit of it in one cell, the rest at 0.
  const worstVariance = ((sum - mean) ** 2 + (n - 1) * mean ** 2) / n;
  const worstStddev = Math.sqrt(worstVariance);
  if (worstStddev <= 1e-9) return 1;

  return Math.min(1, Math.max(0, 1 - stddev / worstStddev));
}

export interface SauceMetrics {
  /** Normalized total quantity landed *inside* the dough, 0-1 (see ./sauceQuantity.ts). */
  quantity: number;
  /** Fraction of in-dough grid cells touched by any sauce, 0-1. */
  coverage: number;
  /** How uniformly the in-dough quantity is spread across the dough's cells, 0-1. */
  evenness: number;
  /** Normalized quantity deposited outside the dough circle. */
  overflowAmount: number;
  /** overflowAmount / (quantity + overflowAmount), 0 when nothing has been deposited. */
  overflowRatio: number;
}

export function emptySauceMetrics(): SauceMetrics {
  return { quantity: 0, coverage: 0, evenness: 1, overflowAmount: 0, overflowRatio: 0 };
}

/**
 * The single entry point Prototype Metrics (and the shadow reference score) read from.
 * Splits deposits into inside-dough vs. overflow *first* -- quantity/coverage/evenness are
 * derived only from the inside-dough field, overflow is tracked purely as amount/ratio, so
 * "sauce that missed the pizza" can never quietly inflate quantity or coverage.
 */
export function computeSauceMetrics(deposits: readonly SauceDepositLike[]): SauceMetrics {
  if (deposits.length === 0) return emptySauceMetrics();

  const insideDeposits: SauceDepositLike[] = [];
  let overflowAmount = 0;
  for (const deposit of deposits) {
    if (isInsideDough(deposit.x, deposit.y)) {
      insideDeposits.push(deposit);
    } else {
      overflowAmount += deposit.amount;
    }
  }

  const field = buildSauceField(insideDeposits);
  const inDoughValues: number[] = [];
  let touched = 0;
  for (let r = 0; r < SAUCE_FIELD_SIZE; r += 1) {
    for (let c = 0; c < SAUCE_FIELD_SIZE; c += 1) {
      if (!isCellInsideDough(r, c)) continue;
      const value = field[r * SAUCE_FIELD_SIZE + c];
      inDoughValues.push(value);
      if (value > COVERAGE_THRESHOLD) touched += 1;
    }
  }

  const quantity = clampQuantity(insideDeposits.reduce((sum, d) => sum + d.amount, 0));
  const coverage = inDoughCellCount() === 0 ? 0 : touched / inDoughCellCount();
  const evenness = computeEvenness(inDoughValues);
  const totalDispensed = quantity + overflowAmount;
  const overflowRatio = totalDispensed <= 1e-9 ? 0 : overflowAmount / totalDispensed;

  return { quantity, coverage, evenness, overflowAmount, overflowRatio };
}

/** Sum of every deposit's amount regardless of inside/outside dough -- the running total
 *  sauceDispenseController.ts clamps future ticks against (see SAUCE_MAX_QUANTITY). */
export function totalDispensed(deposits: readonly SauceDepositLike[]): number {
  return deposits.reduce((sum, d) => sum + d.amount, 0);
}
