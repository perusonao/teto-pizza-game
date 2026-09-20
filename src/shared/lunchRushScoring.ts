/**
 * Firebase Ranking 1.0 Phase 1B (Issue #87). The Lunch Rush Mission Score *submission*
 * authority -- deliberately separate from ../logic/missionScoring.ts (which stays exactly as
 * it was: the realtime, single-total accumulator `missionRunReducer` folds every SERVE into
 * for the live HUD/local `missionBest`). This module instead derives the same score from a
 * serve-by-serve log (`LunchRushServeRecord[]`), which is what lets the *exact same* formula
 * run twice -- once in the browser (optimistic, alongside the realtime accumulator, so a
 * submission's `score` is provably identical to what the player already saw) and once inside
 * the `submitLunchRushScore` Cloud Function (../../functions/src/*), the only place a
 * submitted score is ever actually trusted. Deliberately framework/Firebase-free (no `firebase/
 * *`, no `firebase-admin`) so both sides can import it verbatim with zero adapter code --
 * ../../functions/src bundles this exact file in, it is not reimplemented there.
 *
 * Formula matches ../logic/missionScoring.ts's `missionScore` exactly
 * (`round(servedCount * 100 + totalQualityScore)`), generalized to also *apply* the Completion
 * Gate itself (a `FAILED` entry never contributes) rather than assuming every entry already
 * passed it -- the same rule src/mission/lunchRush.ts's `missionRunReducer` SERVE case already
 * enforces client-side (Lunch Rush Completion Gate 1A), now re-derived independently so the
 * server never has to *trust* that the client only sent PASS entries.
 */

export type LunchRushServeCompletionStatus = "PASS" | "FAILED";

/** One served (or attempted) pizza this Mission run, in submission order. A FAILED entry is
 *  included deliberately (not dropped client-side) so the server can apply the Completion Gate
 *  rule itself from raw data, instead of trusting a client-side `servedCount` that already
 *  excludes FAILED pizzas. */
export interface LunchRushServeRecord {
  recipeId: string;
  /** A single pizza's ScoringV2 `score.total`, 0-100. Always 0 for a FAILED entry (a FAILED
   *  pizza is never scored at all -- see ../logic/completionGate.ts's own file header). */
  qualityTotal: number;
  completionStatus: LunchRushServeCompletionStatus;
}

export interface LunchRushMissionScoreResult {
  /** Count of PASS entries only -- a FAILED entry never increments this, matching
   *  src/mission/lunchRush.ts's `missionRunReducer` SERVE case. */
  servedCount: number;
  totalQualityScore: number;
  bestQualityScore: number;
  score: number;
}

/** Lunch Rush Ranking 1.0's ruleset identity (Phase 0 audit §12) -- bump this (to
 *  `"lunch-rush-v2"` etc.) whenever `calculateLunchRushMissionScore`'s formula, the Completion
 *  Gate's applicability to Mission, or `LUNCH_RUSH_RULESET_DURATION_SECONDS` change meaningfully
 *  enough that old and new scores are no longer comparable -- the Cloud Function only ever
 *  accepts the single currently-known value (see functions/src/submitLunchRushScore.ts). */
export const LUNCH_RUSH_RULESET_VERSION = "lunch-rush-v1";

/** Must be kept in sync with src/mission/lunchRush.ts's `DEFAULT_MISSION_DURATION_SECONDS` --
 *  duplicated here (not imported) so this module never pulls in that file's own dependency on
 *  ../data/orders, keeping the Cloud Functions bundle this module is also compiled into as small
 *  and dependency-free as possible. Both constants describe the same production Mission
 *  duration; a change to one is a ruleset bump (`LUNCH_RUSH_RULESET_VERSION` above) and must
 *  update the other in the same change. */
export const LUNCH_RUSH_RULESET_DURATION_SECONDS = 180;

/** A per-pizza quality total is always in [0, 100] (ScoringV2's own output range, see
 *  ../logic/scoringV2/index.ts) -- shared here so both the client's own defensive checks and the
 *  server's authoritative validation agree on the exact same bound. */
export const MAX_QUALITY_TOTAL = 100;
export const MIN_QUALITY_TOTAL = 0;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Total, defensive type guard -- never throws, treats anything malformed as invalid rather
 *  than crashing the caller (the Cloud Function is the one place this actually matters: a
 *  malformed payload must become a clean rejection, not an unhandled exception). */
export function isValidLunchRushServeRecord(value: unknown): value is LunchRushServeRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.recipeId !== "string" || record.recipeId.length === 0) return false;
  if (!isFiniteNumber(record.qualityTotal)) return false;
  if (record.qualityTotal < MIN_QUALITY_TOTAL || record.qualityTotal > MAX_QUALITY_TOTAL) return false;
  if (record.completionStatus !== "PASS" && record.completionStatus !== "FAILED") return false;
  return true;
}

/**
 * The Mission Score submission authority: derives `servedCount`/`totalQualityScore`/
 * `bestQualityScore`/`score` from a raw serve-by-serve log, applying the Completion Gate itself
 * (a `FAILED` entry contributes nothing) rather than trusting the caller to have already
 * filtered it. Pure, total, deterministic -- the same `serves[]` input always yields the exact
 * same result, in the browser or in Cloud Functions.
 *
 * Callers are responsible for validating each entry first (`isValidLunchRushServeRecord`) --
 * this function does not itself reject malformed entries, so the Cloud Function's own validation
 * step (functions/src/submitLunchRushScore.ts) always runs first and rejects the whole
 * submission before this is ever called on untrusted input.
 */
export function calculateLunchRushMissionScore(
  serves: readonly LunchRushServeRecord[],
): LunchRushMissionScoreResult {
  let servedCount = 0;
  let totalQualityScore = 0;
  let bestQualityScore = 0;

  for (const serve of serves) {
    if (serve.completionStatus !== "PASS") continue;
    servedCount += 1;
    totalQualityScore += serve.qualityTotal;
    bestQualityScore = Math.max(bestQualityScore, serve.qualityTotal);
  }

  return {
    servedCount,
    totalQualityScore,
    bestQualityScore,
    score: Math.round(servedCount * 100 + totalQualityScore),
  };
}

/** The maximum number of PASS-or-FAILED entries a legitimate `LUNCH_RUSH_RULESET_DURATION_SECONDS`
 *  run could ever produce, given a conservative floor on the fastest a single pizza could
 *  realistically be prepared and served. This constant is a judgment call, not a measured value
 *  (no real telemetry exists yet -- Phase 0 audit §11/§20 flags exactly this as a follow-up once
 *  real submission data exists); it is intentionally generous (fast, not "impossible") so a
 *  genuinely skilled player is never false-rejected. */
export const MIN_SECONDS_PER_SERVE = 2;

export const MAX_SERVES_PER_RUN = Math.floor(
  LUNCH_RUSH_RULESET_DURATION_SECONDS / MIN_SECONDS_PER_SERVE,
);

/** Hard payload-size guard, independent of `MAX_SERVES_PER_RUN` -- defense-in-depth against a
 *  malicious/malformed caller sending a huge array purely to burn server CPU/bandwidth, checked
 *  before any per-entry validation runs. Generous headroom above `MAX_SERVES_PER_RUN` itself
 *  (which already rejects an impossible-for-this-ruleset serve count on its own). */
export const MAX_SERVES_ARRAY_LENGTH = 200;
