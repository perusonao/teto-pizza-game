/**
 * Square-Pan Dough B1 (Issue #535, Epic #532): how a finger presses the square dough flat. Pure -- no DOM, no React, no timing
 * of its own (time comes in as arguments). The gesture state machine that decides *when* each of these runs is ./pressGesture.ts;
 * the component that wires both to a real finger is B2.
 *
 * One operator, two feels (Owner decision, #535):
 *   - TAP  = a local push-in: one strong, firm-edged ("dome") relaxation over a small disc. It flattens a lump under the finger at once.
 *   - HOLD = a continuing spread: a gentle relaxation every frame over a disc that keeps growing while the finger stays down.
 *
 * The operator (`relaxAt`) moves every covered cell inside a round brush toward the brush's weighted mean thickness. It
 *   - conserves the total thickness (dough is pushed from thick spots into thin ones, never created or destroyed);
 *   - never changes which cells are covered -- B adjusts thickness only; the outline and the corners are C's (#536);
 *   - never leaves [cover threshold, MAX] and never moves a cell away from the mean, so
 *   - never lowers `squareDoughEvenness`: the mean over the pan is unchanged and the variance can only fall
 *     (change in variance = sum of (a_i^2 - 2 a_i) d_i^2 <= 0 for a_i = strength * weight_i in [0, 1], d_i = t_i - mean).
 * Every number below is an initial value: Owner on-device HV (iPhone Safari) decides the final ones (#535, decision 6).
 */
import type { DoughPoint } from "../pizzaCoordinates";
import {
  SQUARE_COVER_MIN_THICKNESS,
  SQUARE_DOUGH_GRID,
  SQUARE_DOUGH_MAX_THICKNESS,
  isSquareCellOnPan,
  squareCellCenterPercent,
  squareCellIndex,
  type SquareDough,
} from "./squareDough";

/** TAP: brush radius, in percent of the dough box (so it scales with the screen). On a 360-wide phone this is a ~50 px disc. */
export const PRESS_BRUSH_RADIUS = 11;
/** TAP: how far each covered cell moves toward the brush mean at the centre (0..1). Strong: one push-in is visible. (Not 0.85: that literal is the corner-reach threshold, and a test pins it to one place.) */
export const PRESS_STRENGTH = 0.9;

/** HOLD: the brush starts at the tap size and grows to this radius (percent of the box) ... */
export const HOLD_BRUSH_RADIUS_MAX = 22;
/** ... over this many milliseconds of holding (smooth ease-out). */
export const HOLD_GROW_MS = 700;
/** HOLD: relaxation rate per second (an exponential rate, so the result does not depend on the frame rate). */
export const HOLD_RATE_PER_S = 2.2;
/** HOLD: the longest time one step may account for. A stalled frame (or a throttled tab) cannot produce one huge step. */
export const HOLD_MAX_STEP_MS = 100;

/** A per-cell change at or below this is rounding noise, not spreading. */
const LEVEL_NOISE = 1e-12;

function isFinitePoint(p: DoughPoint): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

/**
 * How strongly the brush acts from its centre to its edge. `"cone"` falls away smoothly from the centre (a gentle, blending
 * stroke -- the HOLD); `"dome"` stays strong across most of the disc and drops only near the edge (a firm, flattening press --
 * the TAP). Both are 1 at the centre and 0 at the edge, so the conservation and never-less-even guarantees hold for either.
 */
export type BrushFalloff = "cone" | "dome";

/**
 * Relaxes the covered cells under a round brush toward the brush's weighted mean thickness, by `strength` (0..1) at the
 * centre, falling off smoothly to nothing at `radius`. Returns the input object itself when nothing would change.
 */
export function relaxAt(
  dough: SquareDough,
  center: DoughPoint,
  radius: number,
  strength: number,
  falloff: BrushFalloff = "cone",
): SquareDough {
  if (!isFinitePoint(center) || !(radius > 0) || !Number.isFinite(radius) || !(strength > 0) || !Number.isFinite(strength)) return dough;
  const s = Math.min(1, strength);

  const cells: { index: number; weight: number }[] = [];
  let weightSum = 0;
  let weightedThickness = 0;
  for (let row = 0; row < SQUARE_DOUGH_GRID; row++) {
    for (let col = 0; col < SQUARE_DOUGH_GRID; col++) {
      if (!isSquareCellOnPan(row, col)) continue;
      const index = squareCellIndex(row, col);
      const t = dough.thickness[index];
      if (!(t >= SQUARE_COVER_MIN_THICKNESS)) continue; // uncovered: left exactly as it is
      const distance = Math.hypot(squareCellCenterPercent(col) - center.x, squareCellCenterPercent(row) - center.y);
      if (distance >= radius) continue;
      const weight = falloff === "dome" ? 1 - (distance / radius) ** 2 : (1 - distance / radius) ** 2;
      cells.push({ index, weight });
      weightSum += weight;
      weightedThickness += weight * t;
    }
  }
  if (cells.length === 0 || !(weightSum > 0)) return dough;

  const mean = weightedThickness / weightSum;
  const thickness = dough.thickness.slice();
  let changed = false;
  for (const { index, weight } of cells) {
    const t = dough.thickness[index];
    const next = t + s * weight * (mean - t);
    // A covered cell stays covered (rounding must not push it under the threshold) and inside [0, MAX].
    const clamped = Math.min(SQUARE_DOUGH_MAX_THICKNESS, Math.max(SQUARE_COVER_MIN_THICKNESS, next));
    // A change that is only floating-point noise (an already level sheet) is no change: the cell keeps its exact value.
    if (Math.abs(clamped - t) <= LEVEL_NOISE) continue;
    changed = true;
    thickness[index] = clamped;
  }
  return changed ? { thickness } : dough;
}

/** The hold brush radius after `holdElapsedMs` of holding (percent of the box): tap size growing to the max, ease-out. */
export function holdBrushRadius(holdElapsedMs: number): number {
  const progress = Math.min(1, Math.max(0, Number.isFinite(holdElapsedMs) ? holdElapsedMs / HOLD_GROW_MS : 0));
  const eased = 1 - (1 - progress) ** 2;
  return PRESS_BRUSH_RADIUS + (HOLD_BRUSH_RADIUS_MAX - PRESS_BRUSH_RADIUS) * eased;
}

/** One TAP: the local push-in. */
export function pressAt(dough: SquareDough, center: DoughPoint): SquareDough {
  return relaxAt(dough, center, PRESS_BRUSH_RADIUS, PRESS_STRENGTH, "dome");
}

/** One HOLD step covering `dtMs` of a hold that has lasted `holdElapsedMs`: the continuing spread. */
export function holdStep(dough: SquareDough, center: DoughPoint, holdElapsedMs: number, dtMs: number): SquareDough {
  if (!(dtMs > 0) || !Number.isFinite(dtMs)) return dough;
  const step = Math.min(dtMs, HOLD_MAX_STEP_MS);
  const strength = 1 - Math.exp((-HOLD_RATE_PER_S * step) / 1000);
  return relaxAt(dough, center, holdBrushRadius(holdElapsedMs), strength);
}

/** What the gesture machine (./pressGesture.ts) asks to be applied. */
export type PressEffect =
  | { readonly kind: "press"; readonly center: DoughPoint }
  | { readonly kind: "hold"; readonly center: DoughPoint; readonly elapsedMs: number; readonly dtMs: number };

export function applyPressEffect(dough: SquareDough, effect: PressEffect): SquareDough {
  return effect.kind === "press" ? pressAt(dough, effect.center) : holdStep(dough, effect.center, effect.elapsedMs, effect.dtMs);
}

export function applyPressEffects(dough: SquareDough, effects: readonly PressEffect[]): SquareDough {
  return effects.reduce(applyPressEffect, dough);
}
