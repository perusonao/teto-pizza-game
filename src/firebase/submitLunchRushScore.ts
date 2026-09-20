import { getFunctions, httpsCallable, type Functions } from "firebase/functions";
import { getFirebaseApp } from "./client";
import { ensureAnonymousUser } from "./auth";
import { LUNCH_RUSH_MISSION_ID } from "../mission/lunchRush";
import { LUNCH_RUSH_RULESET_VERSION, type LunchRushServeRecord } from "../shared/lunchRushScoring";

/**
 * Firebase Ranking 1.0 Phase 1B (Issue #87). The client's one call site for the trusted score
 * submission path (Issue #87's "safe posting route"):
 *
 *   Lunch Rush RESULT -> ensureAnonymousUser() -> Callable Cloud Function
 *   (submitLunchRushScore, functions/src/) -> server-side validation/recompute ->
 *   Firestore Admin write
 *
 * This module never writes to Firestore itself -- there is no `firebase/firestore` import
 * anywhere in `src/` (Phase 1A's own security posture, docs/design/
 * TETO_FIREBASE-RANKING_SETUP.md section 3, carried forward unchanged). It only invokes the
 * Callable Function and reports what happened; App.tsx's caller (the Mission RESULT effect)
 * never awaits or branches on the result for gameplay purposes -- a failed/unavailable
 * submission must never fail Lunch Rush's own RESULT screen (this task's own requirement).
 */

export interface SubmitLunchRushScoreInput {
  /** Advisory only -- never the ranking authority (server timestamps own that, see
   *  functions/src/submitLunchRushScore.ts). Roughly `clock.endsAt - clock.startedAt` for a
   *  Mission run that ran its full fixed duration. */
  clientDurationMs: number;
  /** The exact serve-by-serve log this run produced (src/mission/lunchRush.ts's
   *  `MissionState.serves`) -- the server recomputes `score`/`servedCount`/
   *  `totalQualityScore`/`bestQualityScore` from this itself
   *  (../shared/lunchRushScoring.ts's `calculateLunchRushMissionScore`); nothing else in this
   *  payload is ever treated as authoritative. */
  serves: readonly LunchRushServeRecord[];
}

export interface SubmitLunchRushScoreAccepted {
  status: "submitted";
  score: number;
  servedCount: number;
  totalQualityScore: number;
  bestQualityScore: number;
  isNewWeeklyBest: boolean;
  isNewMonthlyBest: boolean;
  isNewAllTimeBest: boolean;
}

export type SubmitLunchRushScoreResult =
  | SubmitLunchRushScoreAccepted
  /** Firebase is unconfigured, the Function call is unavailable, or no auth user could be
   *  established -- expected, common (every build without Manual Setup done, see the setup
   *  doc), and never surfaced to the player as an error. */
  | { status: "unavailable" }
  /** The Function itself rejected the submission (validation failure) or the call otherwise
   *  failed (network, etc.) -- `message` is for logging/debugging only, never shown to the
   *  player (this task's own "submission failure never fails RESULT" requirement). */
  | { status: "failed"; message: string };

interface SubmitLunchRushScoreRequest {
  rulesetVersion: typeof LUNCH_RUSH_RULESET_VERSION;
  missionId: typeof LUNCH_RUSH_MISSION_ID;
  clientDurationMs: number;
  serves: readonly LunchRushServeRecord[];
}

interface SubmitLunchRushScoreResponse {
  score: number;
  servedCount: number;
  totalQualityScore: number;
  bestQualityScore: number;
  isNewWeeklyBest: boolean;
  isNewMonthlyBest: boolean;
  isNewAllTimeBest: boolean;
}

let cachedFunctions: Functions | null | undefined;

// Must match the deployed callable Function's own region (functions/src/index.ts's
// `onCall({ region: ... })`) -- Firestore is pinned to asia-northeast1 (Tokyo, Manual Setup),
// so the Function is deployed there too, and the client has to target that same region
// explicitly since the Functions SDK otherwise defaults to us-central1.
const FUNCTIONS_REGION = "asia-northeast1";

function getFirebaseFunctions(): Functions | null {
  if (cachedFunctions !== undefined) return cachedFunctions;
  const app = getFirebaseApp();
  cachedFunctions = app ? getFunctions(app, FUNCTIONS_REGION) : null;
  return cachedFunctions;
}

/**
 * Submits one Lunch Rush run's score via the trusted Callable Function. Never throws -- every
 * failure mode (unconfigured Firebase, no auth, network error, server-side rejection) resolves
 * to a typed result instead of rejecting, so a caller that doesn't even `await` this (the
 * common case -- see App.tsx) can never produce an unhandled promise rejection.
 */
export async function submitLunchRushScore(
  input: SubmitLunchRushScoreInput,
): Promise<SubmitLunchRushScoreResult> {
  const functions = getFirebaseFunctions();
  if (!functions) return { status: "unavailable" };

  try {
    const user = await ensureAnonymousUser();
    if (!user) return { status: "unavailable" };

    const callable = httpsCallable<SubmitLunchRushScoreRequest, SubmitLunchRushScoreResponse>(
      functions,
      "submitLunchRushScore",
    );
    const request: SubmitLunchRushScoreRequest = {
      rulesetVersion: LUNCH_RUSH_RULESET_VERSION,
      missionId: LUNCH_RUSH_MISSION_ID,
      clientDurationMs: input.clientDurationMs,
      serves: input.serves,
    };
    const response = await callable(request);
    return { status: "submitted", ...response.data };
  } catch (error) {
    return { status: "failed", message: error instanceof Error ? error.message : String(error) };
  }
}

/** Test-only: clears the cached Functions instance, mirroring ./client.ts's/./auth.ts's own
 *  `__reset*ForTests` helpers. */
export function __resetSubmitLunchRushScoreForTests(): void {
  cachedFunctions = undefined;
}
