/**
 * Geometry of the placed parmigiano shavings (Topping Visuals 2.0 PR-1 rev. 2, Issue #824). A plain data module so the drawing component file exports only a component;
 * the SVG test pins these numbers (thin proportions, gaps, size and direction variety, bounds).
 */
export interface ParmigianoShaving {
  /** Centre in the 64x64 viewBox. */
  readonly cx: number;
  readonly cy: number;
  /** Length along the shaving's own axis, and half-thickness (the shape is `2 * half` thick at most). */
  readonly len: number;
  readonly half: number;
  /** Rotation in degrees. */
  readonly angle: number;
  /** Which of the three ivory/cream fills the top face uses. */
  readonly fill: 0 | 1 | 2;
  /** -1..1: skews the shape so no two shavings are the same silhouette. */
  readonly skew: number;
}

/** Six separate shavings of different sizes and directions; pairwise centre distance and the thin proportions are pinned by the SVG test. */
export const PARMIGIANO_SHAVINGS: readonly ParmigianoShaving[] = [
  { cx: 25, cy: 27, len: 27, half: 4.1, angle: -22, fill: 0, skew: 0.5 },
  { cx: 44, cy: 19, len: 17, half: 2.8, angle: 21, fill: 1, skew: -0.6 },
  { cx: 43, cy: 38, len: 21, half: 3.5, angle: -7, fill: 2, skew: 0.2 },
  { cx: 19, cy: 45, len: 15, half: 2.4, angle: 38, fill: 1, skew: -0.3 },
  { cx: 33, cy: 51, len: 13, half: 2.1, angle: 6, fill: 0, skew: 0.7 },
  { cx: 15, cy: 15, len: 10, half: 1.7, angle: -48, fill: 2, skew: -0.8 },
];
