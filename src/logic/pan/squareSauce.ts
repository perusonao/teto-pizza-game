/**
 * Square-Pan Dough D1 (Issue #537, Epic #532): the sauce boundary and metrics for the square pan.
 *
 * The round `computeSauceMetrics` (../sauceField.ts) reads a fixed circle (`DOUGH_RADIUS`, `SAUCE_TARGET_RADIUS`).
 * This module is its square counterpart: same 16x16 field, same quantity / coverage / evenness / overflow / edge
 * quantities, same continuity guarantees, but measured against `SQUARE_PAN_GEOMETRY`. The square pan's Reference
 * region is `SQUARE_PAN_GEOMETRY.targetArea` (A, #534), never the round `SAUCE_TARGET_RADIUS`.
 *
 * Inert: nothing in Production imports this yet (the reducer / PizzaStage wiring is a later D slice, after B/C land).
 * It does not touch the round functions, so the round pizza cannot change. Pure: no DOM, no timing, no randomness.
 */
import { DOUGH_CENTER } from "../pizzaCoordinates";
import {
  COVERAGE_THRESHOLD,
  DEPOSIT_FOOTPRINT_RADIUS,
  SAUCE_FIELD_SIZE,
  buildSauceField,
  computeEvenness,
  emptySauceMetrics,
  type SauceDepositLike,
  type SauceMetrics,
} from "../sauceField";
import { clampQuantity } from "../sauceQuantity";
import { SQUARE_PAN_HALF_SIDE, SQUARE_TARGET_HALF_SIDE } from "./panGeometry";
import { isSquareCellOnPan } from "./squareDough";

/** Share (0-1) of one axis of a deposit's footprint, `[v - r, v + r]`, that lies within `centre +/- halfSide`. */
function axisOverlap(v: number, halfSide: number, footprint: number): number {
  const lo = Math.max(v - footprint, DOUGH_CENTER - halfSide);
  const hi = Math.min(v + footprint, DOUGH_CENTER + halfSide);
  return Math.min(1, Math.max(0, (hi - lo) / (2 * footprint)));
}

/**
 * Fraction (0-1) of a deposit's own footprint (a square of side `2 * footprint` around it) that overlaps the square
 * `centre +/- halfSide`. 1 well inside, 0 well outside and a continuous ramp across the edge, so a deposit a hair
 * either side of the pan edge never flips 0% <-> 100% -- the same guarantee `circleOverlapFraction` gives the round
 * pizza. A square footprint against a square region makes this exactly separable (x overlap * y overlap).
 */
export function squareOverlapFraction(
  x: number,
  y: number,
  halfSide: number,
  footprint: number = DEPOSIT_FOOTPRINT_RADIUS,
): number {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  return axisOverlap(x, halfSide, footprint) * axisOverlap(y, halfSide, footprint);
}

/** Square counterpart of `insideDoughFraction`: the share of a deposit that landed on the pan. */
export function insidePanFraction(x: number, y: number): number {
  return squareOverlapFraction(x, y, SQUARE_PAN_HALF_SIDE);
}

/** Square counterpart of `insideTargetFraction`: the share that landed inside the square Reference region. */
export function insideSquareTargetFraction(x: number, y: number): number {
  return squareOverlapFraction(x, y, SQUARE_TARGET_HALF_SIDE);
}

/**
 * Whether a field cell is eligible to paint on the square pan (`isCellVisible` of `sauceFieldToRgbaPixels`).
 * The 16x16 field has 14 x 14 = 196 on-pan cells (the outer ring's centres lie outside the 44 half side), so
 * the grid reaches the corners: the corner cells (1, 1) .. (14, 14) are on the pan.
 */
export function isSquareSauceCellVisible(row: number, col: number): boolean {
  return isSquareCellOnPan(row, col);
}

let cachedOnPanCellCount: number | null = null;
function onPanCellCount(): number {
  if (cachedOnPanCellCount !== null) return cachedOnPanCellCount;
  let n = 0;
  for (let r = 0; r < SAUCE_FIELD_SIZE; r += 1) {
    for (let c = 0; c < SAUCE_FIELD_SIZE; c += 1) if (isSquareCellOnPan(r, c)) n += 1;
  }
  cachedOnPanCellCount = n;
  return n;
}

/**
 * Square counterpart of `computeSauceMetrics`. Every deposit's amount is split continuously between "on the pan" and
 * overflow (`insidePanFraction`), so `quantity + overflowAmount` conserves the dispensed total exactly; `edgeAmount`
 * is an independent read against the square Reference region (sauce beyond it -- the rim band or off the pan --
 * counts as "not staying inside the target"), as the round `edgeAmount` does.
 */
export function computeSquareSauceMetrics(deposits: readonly SauceDepositLike[]): SauceMetrics {
  if (deposits.length === 0) return emptySauceMetrics();

  const insideWeightedDeposits: SauceDepositLike[] = [];
  let quantity = 0;
  let overflowAmount = 0;
  let edgeAmount = 0;
  for (const deposit of deposits) {
    const insideAmount = deposit.amount * insidePanFraction(deposit.x, deposit.y);
    quantity += insideAmount;
    overflowAmount += deposit.amount - insideAmount;
    edgeAmount += deposit.amount * (1 - insideSquareTargetFraction(deposit.x, deposit.y));
    if (insideAmount > 0) insideWeightedDeposits.push({ x: deposit.x, y: deposit.y, amount: insideAmount });
  }
  quantity = clampQuantity(quantity);

  const field = buildSauceField(insideWeightedDeposits);
  const onPanValues: number[] = [];
  let touched = 0;
  for (let r = 0; r < SAUCE_FIELD_SIZE; r += 1) {
    for (let c = 0; c < SAUCE_FIELD_SIZE; c += 1) {
      if (!isSquareCellOnPan(r, c)) continue;
      const value = field[r * SAUCE_FIELD_SIZE + c];
      onPanValues.push(value);
      if (value > COVERAGE_THRESHOLD) touched += 1;
    }
  }

  const coverage = onPanCellCount() === 0 ? 0 : touched / onPanCellCount();
  const evenness = computeEvenness(onPanValues);
  const totalDispensedAmount = quantity + overflowAmount;
  const overflowRatio = totalDispensedAmount <= 1e-9 ? 0 : overflowAmount / totalDispensedAmount;
  const edgeRatio = totalDispensedAmount <= 1e-9 ? 0 : edgeAmount / totalDispensedAmount;

  return { quantity, coverage, evenness, overflowAmount, overflowRatio, edgeAmount, edgeRatio };
}
