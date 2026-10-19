/**
 * Square-Pan Dough C (Issue #536, Epic #532): the drag that pulls the dough out toward the corners -- pure, no DOM, no clock.
 *
 * The model is MASS-CONSERVING (Owner decision on the Q2 simulation): a fingertip at a point lays a thin film of dough under
 * its brush wherever the sheet is empty or thinner, and every bit of dough that film uses is taken from the thick covered
 * cells nearby. Nothing is created and nothing is lost -- the sum of all thicknesses before and after a drag is the same (to
 * floating-point noise) -- so a stretched dough is a thinner dough, never more of it. A donor never goes below the film
 * thickness (so no covered cell is ever uncovered and coverage / corner reach only ever grow), and if the nearby dough cannot
 * pay for a full film the film is laid thinner instead of dough appearing from nowhere.
 *
 * Moving the finger is laid down in 1 %-of-the-box sub-steps along the segment, so the result does not depend on how often the
 * browser reports the pointer. All three constants are initial values for Owner on-device HV (Owner-approved for C).
 */
import type { DoughPoint } from "../pizzaCoordinates";
import {
  SQUARE_COVER_MIN_THICKNESS,
  SQUARE_DOUGH_GRID,
  isSquareCellOnPan,
  squareCellCenterPercent,
  squareCellIndex,
  type SquareDough,
} from "./squareDough";
import { applyPressEffect, type PressEffect } from "./squareDoughSpread";

/** Radius (dough-percent of the box) of the film the fingertip lays. */
export const DRAG_BRUSH_RADIUS = 16;
/** Thickness of the film at the centre of the brush (it falls off to nothing at the edge). */
export const DRAG_FILM_THICKNESS = 0.16;
/** How fast the dough that pays for the film is drawn from farther away: the donor weight decays as exp(-distance / this). */
export const DRAG_DONOR_DECAY = 20;
/** The donor weight also grows with the spare thickness to this power (2 = the thickest cells give disproportionately more), so the thick remnant of the ball is drained first. */
export const DRAG_DONOR_POWER = 2;
/** Sub-step length (dough-percent) a drag segment is cut into. */
export const DRAG_SUBSTEP = 1;

const MASS_NOISE = 1e-12;

interface CellRef {
  index: number;
  x: number;
  y: number;
}

const ON_PAN_CELLS: readonly CellRef[] = (() => {
  const out: CellRef[] = [];
  for (let row = 0; row < SQUARE_DOUGH_GRID; row++) {
    for (let col = 0; col < SQUARE_DOUGH_GRID; col++) {
      if (isSquareCellOnPan(row, col)) out.push({ index: squareCellIndex(row, col), x: squareCellCenterPercent(col), y: squareCellCenterPercent(row) });
    }
  }
  return out;
})();

function isFinitePoint(p: DoughPoint): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

/** One film laid at `point`. Returns the input object itself when nothing changes. */
export function dragFillAt(dough: SquareDough, point: DoughPoint): SquareDough {
  if (!isFinitePoint(point)) return dough;
  const t = dough.thickness.slice();
  const wanted: { index: number; add: number }[] = [];
  const wantedSet = new Set<number>();
  let need = 0;
  for (const cell of ON_PAN_CELLS) {
    const distance = Math.hypot(cell.x - point.x, cell.y - point.y);
    if (distance >= DRAG_BRUSH_RADIUS) continue;
    const goal = DRAG_FILM_THICKNESS * (1 - (distance / DRAG_BRUSH_RADIUS) ** 2);
    if (goal < SQUARE_COVER_MIN_THICKNESS) continue; // a film thinner than "covered" would be dough that cannot be seen
    const add = goal - t[cell.index];
    if (add > MASS_NOISE) {
      wanted.push({ index: cell.index, add });
      wantedSet.add(cell.index);
      need += add;
    }
  }
  if (need <= 0) return dough;

  const donors: { index: number; room: number; weight: number }[] = [];
  let room = 0;
  for (const cell of ON_PAN_CELLS) {
    if (wantedSet.has(cell.index)) continue;
    const spare = t[cell.index] - DRAG_FILM_THICKNESS;
    if (spare > MASS_NOISE) {
      donors.push({ index: cell.index, room: spare, weight: Math.exp(-Math.hypot(cell.x - point.x, cell.y - point.y) / DRAG_DONOR_DECAY) });
      room += spare;
    }
  }
  if (room <= MASS_NOISE) return dough;

  // The film is laid only as thick as the dough around can pay for.
  let owed = Math.min(need, room);
  const paid0 = owed;
  for (let round = 0; round < 8 && owed > MASS_NOISE; round++) {
    const live = donors.filter((d) => d.room > MASS_NOISE);
    const weightSum = live.reduce((sum, d) => sum + d.room ** DRAG_DONOR_POWER * d.weight, 0);
    if (!(weightSum > 0)) break;
    let paid = 0;
    for (const donor of live) {
      const take = Math.min(donor.room, (owed * donor.room ** DRAG_DONOR_POWER * donor.weight) / weightSum);
      t[donor.index] -= take;
      donor.room -= take;
      paid += take;
    }
    owed -= paid;
  }
  const paidTotal = paid0 - owed;
  if (!(paidTotal > MASS_NOISE)) return dough;
  const scale = paidTotal / need;
  for (const w of wanted) t[w.index] += w.add * scale;
  return { thickness: t };
}

/** The film laid along the straight segment from `from` to `to`. Returns the input itself when nothing changes. */
export function dragAlong(dough: SquareDough, from: DoughPoint, to: DoughPoint): SquareDough {
  if (!isFinitePoint(from) || !isFinitePoint(to)) return dough;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(length / DRAG_SUBSTEP));
  let current = dough;
  for (let s = 1; s <= steps; s++) {
    current = dragFillAt(current, { x: from.x + ((to.x - from.x) * s) / steps, y: from.y + ((to.y - from.y) * s) / steps });
  }
  return current;
}

/** What one step of a gesture asks of the working dough, in order. */
export type GestureEffect =
  | PressEffect
  /** The finger turned out to be dragging: throw away what the speculative tap applied at pointer-down. */
  | { readonly kind: "revert" }
  | { readonly kind: "drag"; readonly from: DoughPoint; readonly to: DoughPoint };

/** Applies effects to the working dough; `start` is the committed dough the gesture began from (what "revert" returns to). */
export function applyGestureEffects(dough: SquareDough, start: SquareDough, effects: readonly GestureEffect[]): SquareDough {
  let current = dough;
  for (const effect of effects) {
    if (effect.kind === "revert") current = start;
    else if (effect.kind === "drag") current = dragAlong(current, effect.from, effect.to);
    else current = applyPressEffect(current, effect);
  }
  return current;
}
