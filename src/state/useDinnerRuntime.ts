import { useCallback, useEffect, type Dispatch } from "react";
import { isDinnerRunPlaying } from "../mission/dinner/dinnerSession";
import type { GameAction, GameState } from "./gameReducer";

/**
 * Dinner Mission DM-2 (Issue #239): the App-side runtime of a Dinner run -- the wall-clock TICK,
 * starting a run, and leaving one through HOME. Everything that decides anything lives in the
 * reducer (`GameState.dinner`, ./gameReducer.ts); this hook only feeds it the clock and the
 * player's HOME confirmation. Separate from Lunch Rush's own timer (App.tsx) -- the two never
 * share state.
 *
 * DM-2 has no Dinner UI: nothing on screen calls `startDinner` yet (DM-3 wires the entry).
 */
export const DINNER_TICK_MS = 250;

export const DINNER_ABANDON_CONFIRM_MESSAGE =
  "ディナーミッションを中断しますか？\n中断すると失敗になり、報酬はもらえません。使った材料は戻りません。";

export interface DinnerRuntime {
  /** A Dinner session exists (running or finished, not yet exited). */
  active: boolean;
  playing: boolean;
  /** Dispatches DINNER_START. `durationMs` is the caller's until DM-5 tunes the time limits. */
  startDinner: (missionId: string, durationMs?: number) => void;
  /**
   * HOME / navigation away. With no session: `true` (nothing to do). With a PLAYING run: asks
   * `confirm`; cancelled -> the run continues and this returns `false`; confirmed -> the run is
   * ABANDONED (no reward) and exited. A finished run is simply exited. `true` = go HOME.
   */
  leaveDinner: (confirm: (message: string) => boolean) => boolean;
}

export function useDinnerRuntime(
  state: Pick<GameState, "dinner">,
  dispatch: Dispatch<GameAction>,
  now: () => number = Date.now,
): DinnerRuntime {
  const session = state.dinner;
  const playing = isDinnerRunPlaying(session);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => dispatch({ type: "DINNER_TICK", now: now() }), DINNER_TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, dispatch, now]);

  const startDinner = useCallback(
    (missionId: string, durationMs?: number) => dispatch({ type: "DINNER_START", missionId, now: now(), durationMs }),
    [dispatch, now],
  );

  const leaveDinner = useCallback(
    (confirm: (message: string) => boolean) => {
      if (session === null) return true;
      if (session.run.status === "PLAYING") {
        dispatch({ type: "DINNER_REQUEST_ABANDON" });
        if (!confirm(DINNER_ABANDON_CONFIRM_MESSAGE)) {
          dispatch({ type: "DINNER_CANCEL_ABANDON" });
          return false;
        }
        dispatch({ type: "DINNER_CONFIRM_ABANDON", now: now() });
      }
      dispatch({ type: "DINNER_EXIT" });
      return true;
    },
    [session, dispatch, now],
  );

  return { active: session !== null, playing, startDinner, leaveDinner };
}
