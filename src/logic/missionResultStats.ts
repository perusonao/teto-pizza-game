/**
 * Lunch Rush Phase 4 (Result Summary & Ranking achievedAt). Display-only derivation from the
 * exact serve-by-serve log Firebase Ranking 1.0 Phase 1B already maintains
 * (`src/mission/lunchRush.ts`'s `MissionState.serves`, `../shared/lunchRushScoring.ts`'s
 * `LunchRushServeRecord`) -- no new state, no Firebase schema change. Deliberately separate from
 * `../shared/lunchRushScoring.ts` (the Mission Score *submission* authority, also bundled into
 * Cloud Functions): this module exists purely to feed Mission Result UI and has no reason to be
 * part of that server-trusted bundle.
 *
 * PASS/FAILED interpretation lives here once, so MissionResultOverlay never re-implements its
 * own filtering of `serves[]`.
 */
import type { LunchRushServeRecord } from "../shared/lunchRushScoring";

export interface MissionResultStats {
  /** Every serve outcome this run produced, PASS or FAILED alike -- `serves.length`. */
  attempts: number;
  /** PASS outcomes only. */
  successes: number;
  /** FAILED outcomes only -- always `attempts - successes` given the two-value
   *  `LunchRushServeCompletionStatus` union. */
  failures: number;
  /** `round(successes / attempts * 100)`, `0` when `attempts` is `0` (never `NaN`). */
  successRatePercent: number;
}

export function deriveMissionResultStats(
  serves: readonly LunchRushServeRecord[],
): MissionResultStats {
  const attempts = serves.length;
  let successes = 0;
  for (const serve of serves) {
    if (serve.completionStatus === "PASS") successes += 1;
  }
  const failures = attempts - successes;
  const successRatePercent = attempts > 0 ? Math.round((successes / attempts) * 100) : 0;
  return { attempts, successes, failures, successRatePercent };
}
