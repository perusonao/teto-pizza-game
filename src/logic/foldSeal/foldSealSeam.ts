import { FOLD_CENTER_X, FOLD_LINE_Y, OPEN_RUN_MIN_BINS, SEAM_BAND, SEAM_BINS } from "./foldSealConstants";
import { isFinitePoint, type FoldSealGeometry } from "./foldSealGeometry";

/**
 * The seam (pure): after the fold, the open edge lies on the lower half of the silhouette. It is cut into SEAM_BINS equal angular bins, numbered LEFT to
 * RIGHT (bin 0 at the west end, bin SEAM_BINS-1 at the east end). `seamAngle` (phi) = PI - atan2(dy, dx): 0 at the west end, PI at the east end.
 */
export type SeamBins = ReadonlyArray<0 | 1>;

export function emptyBins(): SeamBins {
  return Array.from({ length: SEAM_BINS }, () => 0 as const);
}

/** phi in [0, PI] for a point on or below the fold line; null above it or for non-finite input (the seam only exists on the lower half). */
export function seamAngleOf(x: number, y: number): number | null {
  if (!isFinitePoint(x, y)) return null;
  const dy = y - FOLD_LINE_Y;
  if (dy < 0) return null;
  const phi = Math.PI - Math.atan2(dy, x - FOLD_CENTER_X);
  return Math.min(Math.PI, Math.max(0, phi));
}

export function seamBinIndex(phi: number): number {
  const i = Math.floor((phi / Math.PI) * SEAM_BINS);
  return Math.min(SEAM_BINS - 1, Math.max(0, i));
}

/** The seam angle of (x, y) when it is within SEAM_BAND of the silhouette's lower edge, else null. */
export function seamAngleInBand(g: FoldSealGeometry, x: number, y: number): number | null {
  const phi = seamAngleOf(x, y);
  if (phi === null) return null;
  const dist = Math.hypot(x - FOLD_CENTER_X, y - FOLD_LINE_Y);
  const edge = g.radiusAt(Math.PI - phi);
  return Math.abs(dist - edge) <= SEAM_BAND ? phi : null;
}

/** A copy with bins `from..to` (inclusive, clamped, either order) set. Returns the same array when nothing changes. */
export function fillBins(bins: SeamBins, from: number, to: number): SeamBins {
  const lo = Math.max(0, Math.min(from, to));
  const hi = Math.min(SEAM_BINS - 1, Math.max(from, to));
  let next: Array<0 | 1> | null = null;
  for (let i = lo; i <= hi; i += 1) {
    if (bins[i] === 0) {
      next ??= bins.slice();
      next[i] = 1;
    }
  }
  return next ?? bins;
}

export function countSealed(bins: SeamBins): number {
  let n = 0;
  for (const b of bins) n += b;
  return n;
}

/** Sealed fraction 0..1. */
export function coverageOf(bins: SeamBins): number {
  return countSealed(bins) / SEAM_BINS;
}

export interface BinRun {
  /** First bin of the run (inclusive). */
  from: number;
  /** Last bin of the run (inclusive). */
  to: number;
}

/** Every maximal run of unsealed bins at least `minBins` long (default 1 = all runs), left to right. */
export function unsealedRuns(bins: SeamBins, minBins = 1): BinRun[] {
  const runs: BinRun[] = [];
  let start = -1;
  for (let i = 0; i <= bins.length; i += 1) {
    const open = i < bins.length && bins[i] === 0;
    if (open && start < 0) start = i;
    if (!open && start >= 0) {
      if (i - start >= minBins) runs.push({ from: start, to: i - 1 });
      start = -1;
    }
  }
  return runs;
}

/** The runs the visuals draw as gaps. */
export function visibleGapRuns(bins: SeamBins): BinRun[] {
  return unsealedRuns(bins, OPEN_RUN_MIN_BINS);
}
