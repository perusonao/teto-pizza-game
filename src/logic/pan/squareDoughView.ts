/**
 * Square-Pan Dough B2 (Issue #535): what the square dough LOOKS like -- pure, no DOM, no React. Three things the Owner's iPhone Safari
 * HV (PR #546) showed were too faint to see, measured on the lumpy Preview sheet (docs/reports/TETO_SQUARE-DOUGH_B2_Visual-Feedback_Result.md):
 *
 *   - the thickness -> colour ramp. The old ramp spread the whole 0..1 thickness range over the whole colour range, but a real sheet
 *     only lives in about 0.3..0.9, so a 0.1 step was a colour difference (CIE dE) of ~5.8, barely noticeable. This ramp stretches the
 *     range that is actually used (VISUAL_THICKNESS_MIN..MAX) over cream -> dough tan -> golden brown, keeping the hue family of baked dough;
 *   - which cells a gesture really changed (`changedCells`), so the highlight marks those and no others;
 *   - the smoothness gauge's number and its change (`evennessChangePoints`), so the gauge can say "no change" instead of pretending.
 *
 * The thickness itself, the spread operator and every threshold of B1 are untouched: this only changes how the same numbers are shown.
 */
import { SQUARE_COVER_MIN_THICKNESS, SQUARE_DOUGH_GRID, type SquareDough } from "./squareDough";

/** Thickness at or below this reads as the palest colour. (The sheet's own range is ~0.3..0.9; see the header.) */
export const VISUAL_THICKNESS_MIN = 0.3;
/** Thickness at or above this reads as the deepest colour. */
export const VISUAL_THICKNESS_MAX = 0.9;

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
export function thicknessRgb(thickness: number): [number, number, number] {
  const t = Number.isFinite(thickness) ? thickness : VISUAL_THICKNESS_MIN;
  const u = Math.min(1, Math.max(0, (t - VISUAL_THICKNESS_MIN) / (VISUAL_THICKNESS_MAX - VISUAL_THICKNESS_MIN)));
  return u <= 0.5 ? lerp(RAMP[0], RAMP[1], u / 0.5) : lerp(RAMP[1], RAMP[2], (u - 0.5) / 0.5);
}

export function thicknessFill(thickness: number): string {
  const [r, g, b] = thicknessRgb(thickness);
  return `rgb(${r},${g},${b})`;
}

/**
 * A cell is "changed" when what is DRAWN for it changed: its colour (or whether it is drawn at all). Judging by a thickness epsilon
 * instead disagreed with the picture -- a thickness change of 0.001 still moves a colour channel by one step, so cells the screen
 * showed as recoloured were not marked (CI: webkit-390x844 shard 3, square-dough-visual.spec.ts:65, cell 119 235,201,149 -> 234,200,148).
 * Marking exactly the cells whose drawn colour differs makes "highlight = what changed on screen" true by construction.
 */
function drawnFill(thickness: number): string {
  return Number.isFinite(thickness) && thickness >= SQUARE_COVER_MIN_THICKNESS ? thicknessFill(thickness) : "";
}

/** The cell indices whose drawn colour differs between the two sheets. Empty when nothing visible changed. */
export function changedCells(before: SquareDough, after: SquareDough): number[] {
  const out: number[] = [];
  const n = SQUARE_DOUGH_GRID * SQUARE_DOUGH_GRID;
  for (let i = 0; i < n; i++) {
    if (drawnFill(before.thickness[i]) !== drawnFill(after.thickness[i])) out.push(i);
  }
  return out;
}

/** The gauge's number: the dough's real evenness (0..1) as a percentage with one decimal. */
export function smoothnessText(evenness: number): string {
  return `${(Math.min(1, Math.max(0, Number.isFinite(evenness) ? evenness : 0)) * 100).toFixed(1)}%`;
}

/** Shown change is rounded to one decimal of a percentage point; anything that rounds to 0.0 is "no change", never a fake tick. */
const NO_CHANGE_POINTS = 0.05;

/** After - before, in percentage points of evenness, or `null` when it is too small to show (the gauge then says "no change"). */
export function evennessChangePoints(before: number, after: number): number | null {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  const points = (after - before) * 100;
  return Math.abs(points) < NO_CHANGE_POINTS ? null : points;
}
