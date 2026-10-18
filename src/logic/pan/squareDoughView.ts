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
import { SQUARE_DOUGH_GRID, type SquareDough } from "./squareDough";

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

/** A thickness change at or below this is not "a changed cell" (a rounding hair). Far below anything the eye could see. */
export const CHANGE_EPSILON = 0.002;

/** The cell indices whose thickness differs between the two sheets by more than `epsilon`. Empty when nothing changed. */
export function changedCells(before: SquareDough, after: SquareDough, epsilon: number = CHANGE_EPSILON): number[] {
  const out: number[] = [];
  const n = SQUARE_DOUGH_GRID * SQUARE_DOUGH_GRID;
  for (let i = 0; i < n; i++) {
    const a = before.thickness[i];
    const b = after.thickness[i];
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > epsilon) out.push(i);
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
