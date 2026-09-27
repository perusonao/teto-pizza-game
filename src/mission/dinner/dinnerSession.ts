import type { DinnerRunState } from "./dinnerRun";

/**
 * Dinner Mission DM-2 (Issue #239): the Dinner run as the game runtime holds it
 * (`GameState.dinner`, ../../state/gameReducer.ts). Never saved -- a reload starts with no run
 * (OD-DM-7). `null` in GameState whenever no Dinner Mission is on screen.
 */
export interface DinnerSession {
  run: DinnerRunState;
  /** HOME was requested during a PLAYING run and is waiting for confirm / cancel. */
  abandonRequested: boolean;
}

export function isDinnerRunPlaying(session: DinnerSession | null): boolean {
  return session !== null && session.run.status === "PLAYING";
}
