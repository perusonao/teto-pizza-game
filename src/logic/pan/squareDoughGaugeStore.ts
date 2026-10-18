/**
 * Square-Pan Dough B2 + C: the progress gauge's one source of truth, shared between SquareDoughLayer (which knows the live dough) and
 * the guide in the dock (a different part of the screen). A tiny external store, so the guide redraws on its own: the layer pushes
 * the dough it shows (the working dough while a finger is down, the committed one otherwise) and, when a gesture ends, the real
 * change of the number the current step is about. Everything the guide shows -- the step, the corners, the coverage, the evenness --
 * is derived from that dough (./squareDoughProgress.ts); the guide never invents a number it was not given.
 */
import type { SquareDough } from "./squareDough";

/** Which number a gesture's change is about: STEP 1 is about how far the dough has spread, STEP 2 about how even it is. */
export type SquareDoughGaugeMetric = "coverage" | "evenness";

export interface SquareDoughGaugeChange {
  /** Bumped per gesture end, so the gauge can show the change for a moment and then let it go. */
  readonly seq: number;
  /** Percentage points the gesture changed the metric by, or `null` for "no change". */
  readonly points: number | null;
  readonly metric: SquareDoughGaugeMetric;
}

export interface SquareDoughGaugeState {
  /** The dough on screen (the live working dough while a finger is down), or `null` before the layer has reported one. */
  readonly dough: SquareDough | null;
  /**
   * The COMMITTED dough (what the game state holds). The step and the finish are announced from this one, never from the live
   * working dough: a gesture that is cancelled (pointercancel, lost capture, blur) throws its dough away, and a step already
   * announced from it would visibly go back. The live numbers (coverage, evenness, corners) still follow the finger.
   */
  readonly committed: SquareDough | null;
  readonly change: SquareDoughGaugeChange | null;
}

const EMPTY: SquareDoughGaugeState = { dough: null, committed: null, change: null };
let state: SquareDoughGaugeState = EMPTY;
let seq = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export const squareDoughGaugeStore = {
  get(): SquareDoughGaugeState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** The dough on screen right now. */
  setDough(dough: SquareDough): void {
    if (state.dough === dough) return;
    state = { ...state, dough };
    emit();
  },
  /** The committed dough (the layer's `dough` prop). */
  setCommitted(committed: SquareDough): void {
    if (state.committed === committed) return;
    state = { ...state, committed };
    emit();
  },
  /** A gesture ended: `points` is its real effect on `metric` (`null` = none). */
  reportChange(points: number | null, metric: SquareDoughGaugeMetric): void {
    seq += 1;
    state = { ...state, change: { seq, points, metric } };
    emit();
  },
  /** The layer is gone: forget everything (the next round starts from what its own dough says). */
  reset(): void {
    state = EMPTY;
    emit();
  },
};
