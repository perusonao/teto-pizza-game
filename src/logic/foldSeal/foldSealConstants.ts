/**
 * FOLD+SEAL ("包む", Issue #773 T6-F1): the provisional numbers of the pure state machine.
 *
 * Every value here is an INITIAL DESIGN VALUE (docs/reports/TETO_FOLD-SEAL_Design-Acceptance_2026-11-07.md §3) to be tuned in the iPhone HV -- this file is
 * the one place. Nothing in this directory is imported by the game (unwired), saved, scored or shown; see ./index.ts.
 *
 * Coordinates are the dough box in percent (0..100), the same space as ../pizzaCoordinates.ts (centre 50, ideal radius 48). Angles are radians.
 */

/** The fold line is the horizontal diameter y = 50. The lid is the upper half (y < 50); the toppings sit on the lower half (nearer the thumb). */
export const FOLD_LINE_Y = 50;
export const FOLD_CENTER_X = 50;
/** The ideal dough radius, mirrored from ../pizzaCoordinates.ts DOUGH_RADIUS (a test pins the equality) so this module imports nothing from the game. */
export const FOLD_SEAL_DEFAULT_RADIUS = 48;

/** The lid can only be grabbed at least this far above the fold line (closer, the angle is ill-conditioned). ~45px. */
export const FOLD_D_MIN = 14;
/** The grab may start this far outside the dough silhouette (a forgiving margin). */
export const FOLD_GRAB_MARGIN = 6;
/** A release at or beyond this fold angle commits the fold (0 = open, PI = fully folded over). */
export const FOLD_THETA_COMMIT = 0.88 * Math.PI;

/** The seam (the lower half of the silhouette) is cut into this many equal angular bins (5 degrees each). */
export const SEAM_BINS = 36;
/** A finger within this radial distance of the seam seals the bins it passes (~26px: a fingertip may cover the line). */
export const SEAM_BAND = 8;
/** Two consecutive in-band samples further apart than this are a discontinuity: the bins between them are NOT filled (a stray jump seals nothing). */
export const SEAL_MAX_INTERP = Math.PI / 2;
/** The button alternative seals the seam in this many equal parts, left to right. */
export const SEAL_BUTTON_STEPS = 4;
export const SEAL_BINS_PER_STEP = SEAM_BINS / SEAL_BUTTON_STEPS;
/** Visual only: an unsealed run shorter than this many bins (15 degrees) is not drawn as a gap. */
export const OPEN_RUN_MIN_BINS = 3;

/** Presentation timing for a future UI (the logic never reads these). */
export const FOLD_SEAL_TIMING = { snapMs: 180, returnMs: 200, foldButtonMs: 400 } as const;
