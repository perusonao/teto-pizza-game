import { useMemo, useSyncExternalStore } from "react";
import type { SquareDough } from "../logic/pan/squareDough";
import { squareDoughGaugeStore } from "../logic/pan/squareDoughGaugeStore";
import { squareDoughProgress, type SquareDoughProgress } from "../logic/pan/squareDoughProgress";

/**
 * `live` follows the dough on screen (the numbers move with the finger); `committed` is what the game state holds and decides the
 * STEP and the finish -- announced only once the gesture that earned them is committed, so a cancelled gesture can never take a
 * step back. (A drag that reaches the coverage bar mid-stroke shows it in the gauge at once; STEP 2 opens when the finger lifts.)
 */
export function useSquareProgress(fallbackDough: SquareDough): { live: SquareDoughProgress; committed: SquareDoughProgress } {
  const { dough, committed } = useSyncExternalStore(squareDoughGaugeStore.subscribe, squareDoughGaugeStore.get);
  const liveProgress = useMemo(() => squareDoughProgress(dough ?? fallbackDough), [dough, fallbackDough]);
  const committedProgress = useMemo(() => squareDoughProgress(committed ?? fallbackDough), [committed, fallbackDough]);
  return { live: liveProgress, committed: committedProgress };
}

