/**
 * Square dough PROTOTYPE "push-stretch" (marker: square-stretch-preview-v1). Preview / DEV only, behind `?squareModel=stretch`
 * (../../preview/squareModelPreview.ts); the current model (squareDoughDrag.ts / squareDoughProgress.ts) is untouched and is what runs
 * without the flag. Design: the Fresh Audit and the redesign study after PR #581's iPhone HV (Owner direction 1-6).
 *
 * Same data as the current model -- a 16x16 `SquareDough` thickness grid -- so the save shape and the round pizza are not touched.
 *
 *   STRETCH (the drag). The dough is pulled TOWARD the finger from where it already is:
 *     - a film is laid only on cells that connect (8-neighbourhood) to dough that is at least SOLID thick, so nothing appears out of
 *       nowhere -- but a finger that grabs the EDGE of the dough (within the brush of it) drags the edge along;
 *     - the film is thinner the farther it is from the starting lump (TAPER) and a little thinner behind the finger than ahead of it (DIR);
 *     - the dough for the film is drawn from the thick cells nearby, so the total is conserved exactly like the current drag.
 *   STEP 1 (spread): all four corners are reached by the connected BODY (cells >= SOLID joined to the thickest cell) and the body covers
 *     STEP1_COVERAGE_MIN of the pan. A detached or paper-thin film counts for nothing.
 *   STEP 2 (even out): the target thickness is what the dough can actually give (total mass / on-pan cells). Every on-pan cell is
 *     thin (< THIN_RATIO x target, including bare cells), thick (> THICK_RATIO x target) or OK. Done when the OK share reaches the OK rate
 *     (75 % or 85 %, Owner undecided). THICK is pressed (tap / hold, unchanged), THIN is stretched from a thick neighbour.
 *
 * Every number is an initial value for Owner iPhone HV.
 */
import { DOUGH_CENTER, type DoughPoint } from "../pizzaCoordinates";
import { SQUARE_PAN_HALF_SIDE } from "./panGeometry";
import {
  CORNER_REACH_THRESHOLD,
  SQUARE_COVER_MIN_THICKNESS,
  SQUARE_DOUGH_GRID,
  isSquareCellOnPan,
  squareCellCenterPercent,
  squareCellIndex,
  type SquareDough,
} from "./squareDough";
import { SQUARE_STRETCH_PREVIEW_MARK, squareStretchOkRate } from "../../preview/squareModelPreview";
import type { SquareDoughProgress } from "./squareDoughProgress";

export const STRETCH_MARK = SQUARE_STRETCH_PREVIEW_MARK;
export const STRETCH_BRUSH_RADIUS = 18;
export const STRETCH_FILM_THICKNESS = 0.16;
/** A cell is dough (body, corners, coverage) from this thickness up; thinner is a film that does not count. */
export const STRETCH_SOLID_THICKNESS = 0.09;
/** The film is this much thinner (fraction) at the farthest point from the pan centre than at the centre. */
export const STRETCH_TAPER = 0.3;
/** Behind the finger the film is up to this much thinner (fraction) than ahead of it. */
export const STRETCH_DIRECTION = 0.25;
export const STRETCH_DONOR_DECAY = 20;
export const STRETCH_DONOR_POWER = 2;
export const STRETCH_SUBSTEP = 1;
export const STRETCH_STEP1_COVERAGE_MIN = 0.9;
export const STRETCH_THIN_RATIO = 0.7;
export const STRETCH_THICK_RATIO = 1.4;
const TAPER_REACH = 62;
const NOISE = 1e-12;

interface Cell {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
}

const CELLS: readonly Cell[] = (() => {
  const out: Cell[] = [];
  for (let row = 0; row < SQUARE_DOUGH_GRID; row++) {
    for (let col = 0; col < SQUARE_DOUGH_GRID; col++) {
      if (isSquareCellOnPan(row, col)) out.push({ index: squareCellIndex(row, col), row, col, x: squareCellCenterPercent(col), y: squareCellCenterPercent(row) });
    }
  }
  return out;
})();
const ON_PAN_COUNT = CELLS.length;
const BY_INDEX = new Map(CELLS.map((cell) => [cell.index, cell]));
const NEIGHBOURS = new Map<number, readonly Cell[]>(
  CELLS.map((cell) => {
    const out: Cell[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = cell.row + dr;
        const c = cell.col + dc;
        if (r < 0 || c < 0 || r >= SQUARE_DOUGH_GRID || c >= SQUARE_DOUGH_GRID) continue;
        const other = BY_INDEX.get(squareCellIndex(r, c));
        if (other) out.push(other);
      }
    }
    return [cell.index, out] as const;
  }),
);

function isFinitePoint(p: DoughPoint): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

/** One sub-step: the film at `q` while the finger moves along the unit vector `u`. Returns the input itself when nothing changes. */
export function stretchAt(dough: SquareDough, q: DoughPoint, u: DoughPoint): SquareDough {
  const t = dough.thickness;
  const goals = new Map<number, number>();
  for (const cell of CELLS) {
    const distance = Math.hypot(cell.x - q.x, cell.y - q.y);
    if (distance >= STRETCH_BRUSH_RADIUS) continue;
    const ahead = ((cell.x - q.x) * u.x + (cell.y - q.y) * u.y) / STRETCH_BRUSH_RADIUS; // -1 behind .. 1 ahead
    const direction = Math.min(1, Math.max(1 - STRETCH_DIRECTION, 1 + STRETCH_DIRECTION * ahead));
    const taper = 1 - STRETCH_TAPER * Math.min(1, Math.hypot(cell.x - DOUGH_CENTER, cell.y - DOUGH_CENTER) / TAPER_REACH);
    const goal = STRETCH_FILM_THICKNESS * taper * direction * (1 - (distance / STRETCH_BRUSH_RADIUS) ** 2);
    if (goal >= SQUARE_COVER_MIN_THICKNESS) goals.set(cell.index, goal);
  }
  if (goals.size === 0) return dough;

  // Grow the film outward from dough that is already solid: a cell is laid only next to a solid cell or a cell laid in this step.
  const laid = new Map<number, number>();
  let grew = true;
  for (let pass = 0; grew && pass < 40; pass++) {
    grew = false;
    for (const [index, goal] of goals) {
      const current = laid.get(index) ?? t[index];
      if (goal <= current + 1e-9) continue;
      let supported = false;
      for (const n of NEIGHBOURS.get(index) ?? []) {
        if (t[n.index] >= STRETCH_SOLID_THICKNESS || laid.has(n.index)) {
          supported = true;
          break;
        }
      }
      if (!supported) continue;
      laid.set(index, goal);
      grew = true;
    }
  }
  let need = 0;
  for (const [index, value] of laid) need += value - t[index];
  if (need <= NOISE) return dough;

  const donors: { index: number; room: number; weight: number }[] = [];
  let room = 0;
  for (const cell of CELLS) {
    if (laid.has(cell.index)) continue;
    const spare = t[cell.index] - STRETCH_FILM_THICKNESS;
    if (spare > NOISE) {
      donors.push({ index: cell.index, room: spare, weight: Math.exp(-Math.hypot(cell.x - q.x, cell.y - q.y) / STRETCH_DONOR_DECAY) });
      room += spare;
    }
  }
  if (room <= NOISE) return dough;
  const next = t.slice();
  let owed = Math.min(need, room);
  const owed0 = owed;
  for (let round = 0; round < 8 && owed > NOISE; round++) {
    const live = donors.filter((d) => d.room > NOISE);
    const weightSum = live.reduce((sum, d) => sum + d.room ** STRETCH_DONOR_POWER * d.weight, 0);
    if (!(weightSum > 0)) break;
    let paid = 0;
    for (const donor of live) {
      const take = Math.min(donor.room, (owed * donor.room ** STRETCH_DONOR_POWER * donor.weight) / weightSum);
      next[donor.index] -= take;
      donor.room -= take;
      paid += take;
    }
    owed -= paid;
  }
  const paidTotal = owed0 - owed;
  if (!(paidTotal > NOISE)) return dough;
  const scale = paidTotal / need;
  for (const [index, value] of laid) next[index] += (value - t[index]) * scale;
  return { thickness: next };
}

/** The film laid along the straight segment `from` -> `to`, in 1 %-of-the-box sub-steps. Returns the input itself when nothing changes. */
export function stretchAlong(dough: SquareDough, from: DoughPoint, to: DoughPoint): SquareDough {
  if (!isFinitePoint(from) || !isFinitePoint(to)) return dough;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < 1e-9) return dough;
  const u = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const steps = Math.max(1, Math.ceil(length / STRETCH_SUBSTEP));
  let current = dough;
  for (let s = 1; s <= steps; s++) current = stretchAt(current, { x: from.x + ((to.x - from.x) * s) / steps, y: from.y + ((to.y - from.y) * s) / steps }, u);
  return current;
}

/** The connected body: cells >= SOLID joined (8-neighbourhood) to the thickest cell. Empty when nothing is solid. */
export function stretchBody(dough: SquareDough): Set<number> {
  let seed = -1;
  let thickest = -1;
  for (const cell of CELLS) {
    if (dough.thickness[cell.index] > thickest) {
      thickest = dough.thickness[cell.index];
      seed = cell.index;
    }
  }
  const body = new Set<number>();
  if (thickest < STRETCH_SOLID_THICKNESS) return body;
  const stack = [seed];
  body.add(seed);
  while (stack.length > 0) {
    const index = stack.pop() as number;
    for (const n of NEIGHBOURS.get(index) ?? []) {
      if (!body.has(n.index) && dough.thickness[n.index] >= STRETCH_SOLID_THICKNESS) {
        body.add(n.index);
        stack.push(n.index);
      }
    }
  }
  return body;
}

const CELL_SIZE = 100 / SQUARE_DOUGH_GRID;
const edgeOffset = (index: number) => Math.min(SQUARE_PAN_HALF_SIDE, Math.abs(squareCellCenterPercent(index) - DOUGH_CENTER) + CELL_SIZE / 2);
const MAX_EDGE = (() => {
  let max = 0;
  for (let i = 0; i < SQUARE_DOUGH_GRID; i++) if (isSquareCellOnPan(i, i)) max = Math.max(max, edgeOffset(i));
  return max;
})();
const CORNER_SIGNS: readonly (readonly [number, number])[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

/** Corner reach of the BODY only (same measure as the current `squareCornerReach`, on connected solid cells). */
export function stretchCornerReach(dough: SquareDough, body: Set<number> = stretchBody(dough)): number[] {
  return CORNER_SIGNS.map(([sx, sy]) => {
    let best = 0;
    for (const cell of CELLS) {
      if (!body.has(cell.index)) continue;
      const dx = cell.x - DOUGH_CENTER;
      const dy = cell.y - DOUGH_CENTER;
      if (Math.sign(dx) !== sx || Math.sign(dy) !== sy) continue;
      best = Math.max(best, Math.min(edgeOffset(cell.col), edgeOffset(cell.row)) / MAX_EDGE);
    }
    return Math.min(1, best);
  });
}

export type StretchCellClass = "thin" | "ok" | "thick";

export interface StretchDetail {
  /** Which model made this detail (the prototype's marker; the production-bundle gate looks for it). */
  readonly model: string;
  /** Target thickness: total mass / on-pan cells (what the dough can actually give). */
  readonly target: number;
  /** Per cell index (on-pan cells only). */
  readonly classes: readonly (StretchCellClass | undefined)[];
  readonly thin: number;
  readonly thick: number;
  readonly ok: number;
  readonly okRate: number;
  /** STEP 2's OK-rate goal in force (0.75 / 0.85). */
  readonly okGoal: number;
}

function reached(value: number, min: number): boolean {
  return Number.isFinite(value) && Math.round(value * 1000) >= Math.round(min * 1000);
}

/** The prototype's progress, in the shape the current UI already reads (`evenness` = the OK rate, `coverage` = the body's share). */
export function stretchProgress(dough: SquareDough): SquareDoughProgress & { readonly stretch: StretchDetail } {
  const body = stretchBody(dough);
  const coverage = body.size / ON_PAN_COUNT;
  const corners = stretchCornerReach(dough, body).map((reach) => reach >= CORNER_REACH_THRESHOLD);
  const cornersReached = corners.filter(Boolean).length;
  const coverageReached = reached(coverage, STRETCH_STEP1_COVERAGE_MIN);
  const step1Done = cornersReached === corners.length && coverageReached;
  const mass = dough.thickness.reduce((sum, v) => sum + v, 0);
  const target = mass / ON_PAN_COUNT;
  const classes: (StretchCellClass | undefined)[] = [];
  let thin = 0;
  let thick = 0;
  let ok = 0;
  for (const cell of CELLS) {
    const v = dough.thickness[cell.index];
    const k: StretchCellClass = v < STRETCH_THIN_RATIO * target ? "thin" : v > STRETCH_THICK_RATIO * target ? "thick" : "ok";
    classes[cell.index] = k;
    if (k === "thin") thin++;
    else if (k === "thick") thick++;
    else ok++;
  }
  const okRate = ok / ON_PAN_COUNT;
  const okGoal = squareStretchOkRate();
  const evennessReached = reached(okRate, okGoal);
  return {
    coverage,
    evenness: okRate,
    corners,
    cornersReached,
    coverageReached,
    step1Done,
    step: step1Done ? 2 : 1,
    evennessReached,
    complete: step1Done && evennessReached,
    stretch: { model: STRETCH_MARK, target, classes, thin, thick, ok, okRate, okGoal },
  };
}

export interface StretchHint {
  /** Where a thin patch is, and the thick cell to pull it from. */
  readonly from: DoughPoint;
  readonly to: DoughPoint;
}

/** Up to `max` arrows for STEP 2: from a thick-ish cell toward the biggest thin patches (derived, never stored). */
export function stretchThinHints(dough: SquareDough, detail: StretchDetail, max = 2): StretchHint[] {
  const seen = new Set<number>();
  const patches: Cell[][] = [];
  for (const cell of CELLS) {
    if (detail.classes[cell.index] !== "thin" || seen.has(cell.index)) continue;
    const patch = [cell];
    seen.add(cell.index);
    const stack = [cell];
    while (stack.length > 0) {
      const k = stack.pop() as Cell;
      for (const n of NEIGHBOURS.get(k.index) ?? []) {
        if (!seen.has(n.index) && detail.classes[n.index] === "thin") {
          seen.add(n.index);
          patch.push(n);
          stack.push(n);
        }
      }
    }
    patches.push(patch);
  }
  patches.sort((a, b) => b.length - a.length || a[0].index - b[0].index);
  const hints: StretchHint[] = [];
  for (const patch of patches.slice(0, max)) {
    if (patch.length < 3) continue;
    const cx = patch.reduce((s, c) => s + c.x, 0) / patch.length;
    const cy = patch.reduce((s, c) => s + c.y, 0) / patch.length;
    const aim = patch.reduce((best, c) => (Math.hypot(c.x - cx, c.y - cy) < Math.hypot(best.x - cx, best.y - cy) ? c : best));
    let source: Cell | null = null;
    let sourceValue = 0;
    for (const cell of CELLS) {
      if (Math.hypot(cell.x - aim.x, cell.y - aim.y) > 34 || Math.hypot(cell.x - aim.x, cell.y - aim.y) < 10) continue;
      if (dough.thickness[cell.index] > sourceValue && dough.thickness[cell.index] > detail.target * 1.05) {
        sourceValue = dough.thickness[cell.index];
        source = cell;
      }
    }
    if (source) hints.push({ from: { x: source.x, y: source.y }, to: { x: aim.x, y: aim.y } });
  }
  return hints;
}
