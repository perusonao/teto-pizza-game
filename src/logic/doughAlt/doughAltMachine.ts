/**
 * Cooking operation T9 (Issue #784), D-A': the DOUGH step's "step buttons" alternative input, as a PURE state machine (unwired, no UI, Production OFF).
 *
 * The natural gesture (drag / rim tap -> `applyStretchPoint`) is untouched and stays the primary input. This is an OPTIONAL second door for people who cannot
 * use that gesture (keyboard, switch, VoiceOver, one-handed): pick one of the 8 outline points ("direction") and press + (stretch) / - (shrink). A press is
 * EXACTLY one `applyStretchPoint` call on that direction, so the result is the same function the gesture uses (never an isotropic "perfect circle" button).
 *
 * Owner-provisional parameters (#784, 2026-11-07): STEP size 8 dough units, NO fixed press cap, and once the dough is complete every further STEP / direction
 * input is a no-op. Completion is derived (`isDoughShapeComplete`, mean radius >= 75% of DOUGH_RADIUS), never stored, so a natural gesture that shrinks the
 * dough again (SYNC) re-enables the buttons.
 *
 * Pure: no DOM, no React, no reducer, no storage, never reads the clock, never mutates its input. Committing the shape stays the existing
 * COMMIT_DOUGH_STRETCH, which this file does not know about.
 */
import {
  DOUGH_SHAPE_POINTS,
  applyStretchPoint,
  createInitialDoughShape,
  doughShapeRadiusAtAngle,
  doughSizeProgress,
  isDoughShapeComplete,
  isValidDoughShape,
  DOUGH_COMPLETION_THRESHOLD,
  type DoughShape,
} from "../doughShape";
import { DOUGH_CENTER } from "../pizzaCoordinates";

/** Owner-provisional (#784): how far one press moves the chosen outline point, in dough units. */
export const DOUGH_ALT_STEP = 8;

export type DoughAltDirection = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface DoughAltState {
  /** The outline point the buttons act on (index = angle step; 0 = east, increasing clockwise on screen). */
  readonly dir: DoughAltDirection;
  /** Always a valid shape: `applyStretchPoint`'s output, a SYNCed gesture shape, or the initial shape. */
  readonly shape: DoughShape;
  /** Presses that actually changed the shape (a press that hits a limit changes nothing and is not counted). Display / test only; never saved. */
  readonly steps: number;
  /** The round / step this state belongs to; an INVALIDATE with another revision starts over. */
  readonly revision: number;
}

export type DoughAltEvent =
  | { type: "DIR_NEXT" }
  | { type: "DIR_PREV" }
  | { type: "STEP"; delta: 1 | -1 }
  /** The natural gesture changed the real shape: adopt it (the buttons never keep a second copy that can drift). */
  | { type: "SYNC"; shape: DoughShape }
  /** A stray pointer / blur: the buttons are discrete, so there is nothing in flight to drop. Kept for contract symmetry (C5). */
  | { type: "CANCEL" }
  | { type: "INVALIDATE"; revision: number };

export function createDoughAltState(revision = 0, shape: DoughShape = createInitialDoughShape()): DoughAltState {
  return { dir: 0, shape: isValidDoughShape(shape) ? shape : createInitialDoughShape(), steps: 0, revision };
}

/** Derived, never stored. */
export function isDoughAltComplete(state: DoughAltState): boolean {
  return isDoughShapeComplete(state.shape);
}

function angleOf(dir: number): number {
  return (dir / DOUGH_SHAPE_POINTS) * Math.PI * 2;
}

function isDirection(value: unknown): value is DoughAltDirection {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < DOUGH_SHAPE_POINTS;
}

/** The shape one press would produce (pure; the same call the rim tap makes). Returns the SAME object when the press changes nothing. */
export function stepDoughShape(shape: DoughShape, dir: DoughAltDirection, delta: 1 | -1): DoughShape {
  const angle = angleOf(dir);
  const target = doughShapeRadiusAtAngle(shape, angle) + delta * DOUGH_ALT_STEP;
  return applyStretchPoint(shape, DOUGH_CENTER + Math.cos(angle) * target, DOUGH_CENTER + Math.sin(angle) * target);
}

export function doughAltReduce(state: DoughAltState, event: DoughAltEvent): DoughAltState {
  switch (event.type) {
    case "DIR_NEXT":
    case "DIR_PREV": {
      if (isDoughAltComplete(state)) return state;
      const next = (state.dir + (event.type === "DIR_NEXT" ? 1 : DOUGH_SHAPE_POINTS - 1)) % DOUGH_SHAPE_POINTS;
      return isDirection(next) ? { ...state, dir: next } : state;
    }
    case "STEP": {
      if (event.delta !== 1 && event.delta !== -1) return state;
      if (isDoughAltComplete(state)) return state;
      const shape = stepDoughShape(state.shape, state.dir, event.delta);
      if (shape === state.shape || !isValidDoughShape(shape)) return state;
      return { ...state, shape, steps: state.steps + 1 };
    }
    case "SYNC":
      return event.shape && isValidDoughShape(event.shape) && event.shape !== state.shape ? { ...state, shape: event.shape } : state;
    case "CANCEL":
      return state;
    case "INVALIDATE":
      return Number.isFinite(event.revision) && event.revision !== state.revision ? createDoughAltState(event.revision) : state;
    default:
      return state;
  }
}

/** East = 0, clockwise on screen (screen y grows downward). */
export const DOUGH_ALT_DIRECTION_LABEL_JA: readonly string[] = ["右", "右下", "下", "左下", "左", "左上", "上", "右上"];

export interface DoughAltStatus {
  readonly dirLabelJa: string;
  /** Progress toward the completion size in 25% steps (read aloud as a percentage, never the raw number): 0 / 25 / 50 / 75 / 100. 100 only when complete. */
  readonly percent: 0 | 25 | 50 | 75 | 100;
  readonly complete: boolean;
}

export function doughAltStatus(state: DoughAltState): DoughAltStatus {
  const complete = isDoughAltComplete(state);
  const ratio = Math.min(1, Math.max(0, doughSizeProgress(state.shape) / DOUGH_COMPLETION_THRESHOLD));
  const raw = Math.floor(ratio * 4) * 25;
  const percent = complete ? 100 : (Math.min(75, raw) as 0 | 25 | 50 | 75);
  return { dirLabelJa: DOUGH_ALT_DIRECTION_LABEL_JA[state.dir], percent, complete };
}

/** The one exit for drawing: which outline point to emphasise (a shape, not only a colour) and the shape itself. */
export function doughAltVisual(state: DoughAltState): { focusDir: DoughAltDirection; focusAngle: number; shape: DoughShape } {
  return { focusDir: state.dir, focusAngle: angleOf(state.dir), shape: state.shape };
}
