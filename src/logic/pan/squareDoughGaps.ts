/**
 * Square Dough UX (Issue #536, Epic #532; docs/design/TETO_SQUARE-DOUGH_UX-CLARITY_FRESH-AUDIT-DESIGN.md §5, "AB-min"): where the
 * sheet is still bare once all four corners are reached but STEP 1 is not done yet. Pure, no DOM, DERIVED from the dough and its progress:
 * nothing is stored, no threshold or judgement is read or changed (squareDoughProgress.ts decides STEP 1; this only looks at the cells).
 *
 * Why it exists: four corner pulls reach all four corners at 85 % while the coverage bar (95 %) is far off (a measured 75.5 %), the corner
 * arrows are gone by then, and nothing on the pan said where to go next. The bare cells ARE the answer, so they are tinted and the
 * largest few get one arrow each, from the dough into the gap -- a finger that follows it sweeps the gap.
 */
import { DOUGH_CENTER, type DoughPoint } from "../pizzaCoordinates";
import {
  SQUARE_COVER_MIN_THICKNESS,
  SQUARE_DOUGH_GRID,
  isSquareCellOnPan,
  squareCellCenterPercent,
  squareCellIndex,
  type SquareDough,
} from "./squareDough";
import type { SquareDoughProgress } from "./squareDoughProgress";

/** At most this many gaps get an arrow (the largest first); the tint covers every bare cell. */
export const GAP_MAX_ARROWS = 3;
/** An arrow starts on dough at least this far (dough-percent) from where it points, so it never collapses to a dot beside a one-cell gap. */
export const GAP_ARROW_MIN_LENGTH = 14;

export interface SquareGap {
  /** Cell indices of this bare region (8-connected). */
  readonly cells: readonly number[];
  /** Where the arrow points: the bare cell closest to the region's centre of mass (always inside the gap, even for a U-shaped one). */
  readonly aim: DoughPoint;
  /** Where the arrow starts: on the dough, outside the gap. */
  readonly from: DoughPoint;
}

export interface SquareGapGuide {
  /** All bare on-pan cells (the tint), whichever gap they belong to. */
  readonly bareCells: readonly number[];
  /** The largest gaps, largest first, at most GAP_MAX_ARROWS. */
  readonly gaps: readonly SquareGap[];
}

/**
 * All four corners reached while the COMMITTED step is still STEP 1: the state the gap guide is for. (`progress` is the live one, so a drag
 * that crosses the coverage bar keeps the guide until the lift commits STEP 2 -- the step is never announced early.)
 */
export function isGapGuideActive(progress: SquareDoughProgress, committedStep: 1 | 2): boolean {
  return committedStep === 1 && progress.cornersReached === progress.corners.length;
}

const NO_GAPS: SquareGapGuide = { bareCells: [], gaps: [] };

function isBare(value: number): boolean {
  return !(value >= SQUARE_COVER_MIN_THICKNESS);
}

const point = (index: number): DoughPoint => ({ x: squareCellCenterPercent(index % SQUARE_DOUGH_GRID), y: squareCellCenterPercent(Math.floor(index / SQUARE_DOUGH_GRID)) });

export function squareGapGuide(dough: SquareDough): SquareGapGuide {
  const n = SQUARE_DOUGH_GRID;
  const bare: boolean[] = new Array<boolean>(n * n).fill(false);
  const bareCells: number[] = [];
  const covered: number[] = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!isSquareCellOnPan(row, col)) continue;
      const index = squareCellIndex(row, col);
      if (isBare(dough.thickness[index])) {
        bare[index] = true;
        bareCells.push(index);
      } else covered.push(index);
    }
  }
  if (bareCells.length === 0) return NO_GAPS;

  const seen = new Set<number>();
  const regions: number[][] = [];
  for (const start of bareCells) {
    if (seen.has(start)) continue;
    const region: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const index = stack.pop() as number;
      region.push(index);
      const row = Math.floor(index / n);
      const col = index % n;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = row + dr;
          const c = col + dc;
          if ((dr === 0 && dc === 0) || r < 0 || r >= n || c < 0 || c >= n) continue;
          const next = squareCellIndex(r, c);
          if (bare[next] && !seen.has(next)) {
            seen.add(next);
            stack.push(next);
          }
        }
      }
    }
    regions.push(region);
  }
  // Largest first; equal sizes keep a stable, geometry-based order (the cell nearest the pan centre first) so the picture never flickers between renders.
  const centreDistance = (region: number[]) => Math.min(...region.map((i) => Math.hypot(point(i).x - DOUGH_CENTER, point(i).y - DOUGH_CENTER)));
  regions.sort((a, b) => b.length - a.length || centreDistance(a) - centreDistance(b) || a[0] - b[0]);

  const gaps = regions.slice(0, GAP_MAX_ARROWS).map((cells): SquareGap => {
    const cx = cells.reduce((s, i) => s + point(i).x, 0) / cells.length;
    const cy = cells.reduce((s, i) => s + point(i).y, 0) / cells.length;
    let aimIndex = cells[0];
    for (const i of cells) if (Math.hypot(point(i).x - cx, point(i).y - cy) < Math.hypot(point(aimIndex).x - cx, point(aimIndex).y - cy)) aimIndex = i;
    const aim = point(aimIndex);
    // The nearest dough that is far enough away to make a readable arrow; failing that, the farthest dough there is.
    let from: DoughPoint | null = null;
    let fromDistance = Infinity;
    let farthest: DoughPoint = aim;
    let farthestDistance = -1;
    for (const i of covered) {
      const p = point(i);
      const d = Math.hypot(p.x - aim.x, p.y - aim.y);
      if (d >= GAP_ARROW_MIN_LENGTH && d < fromDistance) {
        from = p;
        fromDistance = d;
      }
      if (d > farthestDistance) {
        farthest = p;
        farthestDistance = d;
      }
    }
    return { cells, aim, from: from ?? farthest };
  });
  return { bareCells, gaps };
}
