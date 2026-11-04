/**
 * Square-Pan Dough E-1 (Issue #521, Epic #532): the square pan's Reference and the one place that picks the sauce metrics by pan.
 *
 * D4 keeps every formula and weight unchanged; what is new is an INPUT. A pizza cooked on the square pan is measured by
 * `computeSquareSauceMetrics` (./squareSauce.ts) and compared to a Reference derived from the SAME ideal-fixture recipe as the
 * round one (concentric passes, rim left bare, one dispense tick per point -- ../../data/referencePizza.ts), only laid on
 * the square target region. Round (`"round"`, absent) is returned untouched, so every shipped pizza scores byte-identically.
 *
 * Pure: no DOM, no timing, no randomness. The player-facing slot guide (`getSquareReferenceSlots`) is, like the round one,
 * a generated placement hint -- never a scoring coordinate.
 */
import type { ReferenceSauce } from "../../data/referencePizza";
import { DOUGH_CENTER } from "../pizzaCoordinates";
import { computeSauceMetrics, SAUCE_TARGET_RADIUS, type SauceDepositLike, type SauceMetrics } from "../sauceField";
import { SAUCE_RATE_PER_TICK } from "../sauceQuantity";
import { SQUARE_TARGET_HALF_SIDE } from "./panGeometry";
import type { PanShape } from "./panShape";
import { computeSquareSauceMetrics } from "./squareSauce";

/** The round fixture's rings (../../data/referencePizza.ts `FIXTURE_RINGS`), as `[radius, points]`. Kept equal by test. */
const IDEAL_RINGS: ReadonlyArray<readonly [number, number]> = [
  [6, 4],
  [16, 9],
  [26, 14],
  [36, 19],
];

/** Points `count` spaced evenly by arc length along the perimeter of the square of half side `half`, starting at its top-left corner. */
function squarePerimeter(half: number, count: number): { x: number; y: number }[] {
  const side = 2 * half;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = (i / count) * 4 * side;
    const edge = Math.floor(d / side);
    const t = d - edge * side;
    const x = edge === 0 ? -half + t : edge === 1 ? half : edge === 2 ? half - t : -half;
    const y = edge === 0 ? -half : edge === 1 ? -half + t : edge === 2 ? half : half - t;
    points.push({ x: DOUGH_CENTER + x, y: DOUGH_CENTER + y });
  }
  return points;
}

/**
 * The literally-paintable "painted well" deposits on the square pan: the round fixture's ring radii scaled by the same ratio
 * the square target region has to the round one (`SQUARE_TARGET_HALF_SIDE / SAUCE_TARGET_RADIUS`), each ring a square
 * perimeter with the same point count and the same per-point amount. The rim stays bare.
 */
export function buildIdealSquareSauceFixture(): SauceDepositLike[] {
  const scale = SQUARE_TARGET_HALF_SIDE / SAUCE_TARGET_RADIUS;
  return IDEAL_RINGS.flatMap(([radius, count]) =>
    squarePerimeter(radius * scale, count).map((p) => ({ x: p.x, y: p.y, amount: SAUCE_RATE_PER_TICK })),
  );
}

/** Metrics of the ideal square fixture -- the square Reference target is this, rounded to 2 decimals like the round one. */
export const IDEAL_SQUARE_SAUCE_METRICS: SauceMetrics = computeSquareSauceMetrics(buildIdealSquareSauceFixture());

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The sauce target for a pizza on `pan`: the round `reference` as given, or the same sauce with the square ideal's numbers. */
export function sauceTargetForPan<T extends { readonly quantity: number; readonly coverage: number }>(pan: PanShape, reference: T): T {
  if (pan !== "square") return reference;
  return { ...reference, quantity: round2(IDEAL_SQUARE_SAUCE_METRICS.quantity), coverage: round2(IDEAL_SQUARE_SAUCE_METRICS.coverage) };
}

/** `ReferenceSauce` flavour of `sauceTargetForPan`, for callers that hold the full object. */
export function referenceSauceForPan(pan: PanShape, reference: ReferenceSauce): ReferenceSauce {
  return sauceTargetForPan(pan, reference);
}

/** The sauce metrics of `deposits` measured against the pan they lie on. Round: exactly `computeSauceMetrics`. */
export function sauceMetricsForPan(pan: PanShape, deposits: readonly SauceDepositLike[]): SauceMetrics {
  return pan === "square" ? computeSquareSauceMetrics(deposits) : computeSauceMetrics(deposits);
}

/** Outermost slot offset (dough-percent) of the square guide: 80% of the square target half side, so every slot clears the rim. */
const SQUARE_SLOT_REACH = SQUARE_TARGET_HALF_SIDE * 0.8;

/**
 * `count` distinct slots (dough-percent) on a near-square grid inside the square target region, row-major from the top-left.
 * The square counterpart of `getReferenceSlots`: deterministic, never two pieces on one slot, 1 piece at the centre.
 */
export function getSquareReferenceSlots(count: number): { x: number; y: number }[] {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n === 0) return [];
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const at = (i: number, total: number) => (total === 1 ? DOUGH_CENTER : DOUGH_CENTER - SQUARE_SLOT_REACH + (i * 2 * SQUARE_SLOT_REACH) / (total - 1));
  return Array.from({ length: n }, (_, k) => ({ x: at(k % cols, cols), y: at(Math.floor(k / cols), rows) }));
}
