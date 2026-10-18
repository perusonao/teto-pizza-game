/**
 * Square-Pan Dough B2 (Issue #535): what the square dough LOOKS like -- pure, no DOM, no React. Three things the Owner's iPhone Safari
 * HV (PR #546) showed were too faint to see, measured on the lumpy Preview sheet (docs/reports/TETO_SQUARE-DOUGH_B2_Visual-Feedback_Result.md):
 *
 *   - the thickness -> colour ramp. The old ramp spread the whole 0..1 thickness range over the whole colour range, but a real sheet
 *     only lives in about 0.3..0.9, so a 0.1 step was a colour difference (CIE dE) of ~5.8, barely noticeable. This ramp stretches the
 *     range that is actually used (VISUAL_THICKNESS_MIN..MAX) over cream -> dough tan -> golden brown, keeping the hue family of baked dough;
 *   - which cells a gesture really changed (`changedCells`), so the highlight marks those and no others;
 *   - the smoothness gauge's number and its change (`changePoints`), so the gauge can say "no change" instead of pretending.
 *
 * The thickness itself, the spread operator and every threshold of B1 are untouched: this only changes how the same numbers are shown.
 */
import { SQUARE_COVER_MIN_THICKNESS, SQUARE_DOUGH_GRID, type SquareDough } from "./squareDough";
import { SQUARE_PAN_HALF_SIDE } from "./panGeometry";
import { DOUGH_CENTER, type DoughPoint } from "../pizzaCoordinates";

/** Thickness at or below this reads as the palest colour. (The Preview lumpy sheet's own range is ~0.3..0.9; see the header.) */
export const VISUAL_THICKNESS_MIN = 0.3;
/** Thickness at or above this reads as the deepest colour. */
export const VISUAL_THICKNESS_MAX = 0.9;

/**
 * Which colour range a sheet is drawn with. `"lumpy"` is the Preview lumpy start (B2's Owner-approved look, unchanged). `"ball"` is the
 * production start (C, #536): a small thick ball whose dough is pulled out MASS-CONSERVINGLY, so a fully stretched sheet averages
 * ~0.16 thick (32 units of dough over ~196 cells) and every cell of it would sit at the palest end of the lumpy range. The ball range
 * stretches 0.05..0.5 over the same cream -> tan -> brown, so the thin sheet's unevenness and the thick ball both read clearly.
 */
export type SquareDoughRamp = "lumpy" | "ball";
const RAMP_DOMAIN: Record<SquareDoughRamp, readonly [number, number]> = {
  lumpy: [VISUAL_THICKNESS_MIN, VISUAL_THICKNESS_MAX],
  ball: [0.05, 0.5],
};

type Rgb = readonly [number, number, number];
/** Pale cream -> dough tan -> deep golden brown (always R > G > B: a baked-dough hue, never a grey or a rainbow). */
const RAMP: readonly [Rgb, Rgb, Rgb] = [
  [250, 238, 208],
  [226, 180, 116],
  [166, 98, 38],
];

function lerp(a: Rgb, b: Rgb, t: number): [number, number, number] {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

/** The colour of a cell of this thickness. Out-of-range (or non-finite) thickness is clamped to the ends of the ramp. */
export function thicknessRgb(thickness: number, ramp: SquareDoughRamp = "lumpy"): [number, number, number] {
  const [lo, hi] = RAMP_DOMAIN[ramp];
  const t = Number.isFinite(thickness) ? thickness : lo;
  const u = Math.min(1, Math.max(0, (t - lo) / (hi - lo)));
  return u <= 0.5 ? lerp(RAMP[0], RAMP[1], u / 0.5) : lerp(RAMP[1], RAMP[2], (u - 0.5) / 0.5);
}

export function thicknessFill(thickness: number, ramp: SquareDoughRamp = "lumpy"): string {
  const [r, g, b] = thicknessRgb(thickness, ramp);
  return `rgb(${r},${g},${b})`;
}

/**
 * A cell is "changed" when what is DRAWN for it changed: its colour (or whether it is drawn at all). Judging by a thickness epsilon
 * instead disagreed with the picture -- a thickness change of 0.001 still moves a colour channel by one step, so cells the screen
 * showed as recoloured were not marked (CI: webkit-390x844 shard 3, square-dough-visual.spec.ts:65, cell 119 235,201,149 -> 234,200,148).
 * Marking exactly the cells whose drawn colour differs makes "highlight = what changed on screen" true by construction.
 */
function drawnFill(thickness: number, ramp: SquareDoughRamp): string {
  return Number.isFinite(thickness) && thickness >= SQUARE_COVER_MIN_THICKNESS ? thicknessFill(thickness, ramp) : "";
}

/** The cell indices whose drawn colour differs between the two sheets. Empty when nothing visible changed. */
export function changedCells(before: SquareDough, after: SquareDough, ramp: SquareDoughRamp = "lumpy"): number[] {
  const out: number[] = [];
  const n = SQUARE_DOUGH_GRID * SQUARE_DOUGH_GRID;
  for (let i = 0; i < n; i++) {
    if (drawnFill(before.thickness[i], ramp) !== drawnFill(after.thickness[i], ramp)) out.push(i);
  }
  return out;
}

/** The gauge's number: a real 0..1 quantity (coverage, evenness) as a percentage with one decimal. */
export function smoothnessText(evenness: number): string {
  return `${(Math.min(1, Math.max(0, Number.isFinite(evenness) ? evenness : 0)) * 100).toFixed(1)}%`;
}

/** Shown change is rounded to one decimal of a percentage point; anything that rounds to 0.0 is "no change", never a fake tick. */
const NO_CHANGE_POINTS = 0.05;

/** After - before, in percentage points of a 0..1 quantity, or `null` when it is too small to show (the gauge then says "no change"). */
export function changePoints(before: number, after: number): number | null {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  const points = (after - before) * 100;
  return Math.abs(points) < NO_CHANGE_POINTS ? null : points;
}

/** Where the four corner marks sit (dough-percent): NW, NE, SE, SW, the same order as `squareCornerReach` / `squareDoughProgress.corners`. */
export const CORNER_MARK_INSET = 5;
export const CORNER_MARKS: readonly DoughPoint[] = (() => {
  const lo = DOUGH_CENTER - SQUARE_PAN_HALF_SIDE + CORNER_MARK_INSET;
  const hi = DOUGH_CENTER + SQUARE_PAN_HALF_SIDE - CORNER_MARK_INSET;
  return [
    { x: lo, y: lo },
    { x: hi, y: lo },
    { x: hi, y: hi },
    { x: lo, y: hi },
  ];
})();

/**
 * The drag hint for one corner: from the dough's own outermost point on the way to that corner (where a finger should start) to the
 * corner mark (where it should end). Walks the straight line from the centre of the pan to the corner and returns the last point
 * that is still on dough.
 */
export function cornerHint(dough: SquareDough, corner: number): { from: DoughPoint; to: DoughPoint } {
  const to = CORNER_MARKS[corner];
  const steps = 80;
  let from: DoughPoint = { x: DOUGH_CENTER, y: DOUGH_CENTER };
  for (let s = 0; s <= steps; s++) {
    const x = DOUGH_CENTER + ((to.x - DOUGH_CENTER) * s) / steps;
    const y = DOUGH_CENTER + ((to.y - DOUGH_CENTER) * s) / steps;
    const col = Math.min(SQUARE_DOUGH_GRID - 1, Math.max(0, Math.floor((x / 100) * SQUARE_DOUGH_GRID)));
    const row = Math.min(SQUARE_DOUGH_GRID - 1, Math.max(0, Math.floor((y / 100) * SQUARE_DOUGH_GRID)));
    const value = dough.thickness[row * SQUARE_DOUGH_GRID + col];
    if (value >= SQUARE_COVER_MIN_THICKNESS) from = { x, y };
  }
  return { from, to };
}
