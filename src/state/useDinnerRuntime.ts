import { useCallback, useEffect, useState, type Dispatch } from "react";
import { isDinnerRunPlaying } from "../mission/dinner/dinnerSession";
import type { GameAction, GameState } from "./gameReducer";

/**
 * Dinner Mission DM-2/DM-3 (Issues #239, #242): the App-side runtime of a Dinner run -- the
 * wall-clock TICK and the display clock, starting a run, and leaving one through HOME. Everything
 * that decides anything lives in the reducer (`GameState.dinner`, ./gameReducer.ts); this hook
 * only feeds it the clock and the player's choices. Separate from Lunch Rush's own timer
 * (App.tsx) -- the two never share state.
 *
 * DM-3: HOME no longer uses `window.confirm`. `requestLeave` raises the reducer's
 * `abandonRequested`, which the in-app dialog renders; `confirmLeave` / `cancelLeave` answer it.
 */
export const DINNER_TICK_MS = 250;

export interface DinnerRuntime {
  /** A Dinner session exists (running or finished, not yet exited). */
  active: boolean;
  playing: boolean;
  /** Display clock: refreshed every tick while PLAYING, the same `Date.now()` the TICK uses. */
  now: number;
  startDinner: (missionId: string, durationMs: number) => void;
  /** HOME / navigation away. `true` = nothing to confirm (no session, or a finished one, which
   *  is exited here) -- go HOME now. `false` = a PLAYING run now waits for the dialog. */
  requestLeave: () => boolean;
  /** Dialog "続ける": the run carries on. */
  cancelLeave: () => void;
  /** Dialog "やめる": the run is ABANDONED (no reward) and exited. */
  confirmLeave: () => void;
  /** Leaves a finished run (CLEAR / FAILED screen). */
  exitFinished: () => void;
}

export function useDinnerRuntime(
  state: Pick<GameState, "dinner">,
  dispatch: Dispatch<GameAction>,
  clock: () => number = Date.now,
): DinnerRuntime {
  const session = state.dinner;
  const playing = isDinnerRunPlaying(session);
  const [now, setNow] = useState(() => clock());

  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const t = clock();
      setNow(t);
      dispatch({ type: "DINNER_TICK", now: t });
    };
    tick();
    const id = window.setInterval(tick, DINNER_TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, dispatch, clock]);

  const startDinner = useCallback(
    (missionId: string, durationMs: number) => {
      const t = clock();
      setNow(t);
      dispatch({ type: "DINNER_START", missionId, now: t, durationMs });
    },
    [dispatch, clock],
  );

  const requestLeave = useCallback(() => {
    if (session === null) return true;
    if (session.run.status === "PLAYING") {
      dispatch({ type: "DINNER_REQUEST_ABANDON" });
      return false;
    }
    dispatch({ type: "DINNER_EXIT" });
    return true;
  }, [session, dispatch]);

  const cancelLeave = useCallback(() => dispatch({ type: "DINNER_CANCEL_ABANDON" }), [dispatch]);

  const confirmLeave = useCallback(() => {
    dispatch({ type: "DINNER_CONFIRM_ABANDON", now: clock() });
    dispatch({ type: "DINNER_EXIT" });
  }, [dispatch, clock]);

  const exitFinished = useCallback(() => dispatch({ type: "DINNER_EXIT" }), [dispatch]);

  return { active: session !== null, playing, now, startDinner, requestLeave, cancelLeave, confirmLeave, exitFinished };
}
