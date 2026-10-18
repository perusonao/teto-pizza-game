/**
 * Square-Pan Dough B2: the smoothness gauge's one source of truth, shared between SquareDoughLayer (which knows the live dough) and the
 * gauge in the dock (a different part of the screen). A tiny external store, so the gauge redraws on its own: the layer pushes the real
 * evenness of the dough it shows (the working dough while a finger is down, the committed one otherwise) and, when a gesture ends, the
 * real change. The gauge never invents a number: it only shows what was pushed.
 */
export interface SquareDoughGaugeChange {
  /** Bumped per gesture end, so the gauge can show the change for a moment and then let it go. */
  readonly seq: number;
  /** Percentage points of evenness the gesture changed, or `null` for "no change". */
  readonly points: number | null;
}

export interface SquareDoughGaugeState {
  /** Evenness (0..1) of the dough on screen, or `null` before the layer has reported one. */
  readonly evenness: number | null;
  readonly change: SquareDoughGaugeChange | null;
}

const EMPTY: SquareDoughGaugeState = { evenness: null, change: null };
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
  /** The evenness of the dough on screen right now. */
  setEvenness(evenness: number): void {
    if (state.evenness === evenness) return;
    state = { ...state, evenness };
    emit();
  },
  /** A gesture ended: `points` is its real effect on the evenness (`null` = none). */
  reportChange(points: number | null): void {
    seq += 1;
    state = { ...state, change: { seq, points } };
    emit();
  },
  /** The layer is gone: forget everything (the next round starts from what its own dough says). */
  reset(): void {
    state = EMPTY;
    emit();
  },
};
