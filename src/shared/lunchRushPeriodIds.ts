/**
 * Firebase Ranking 1.0 Phase 1B (Issue #87), moved to `src/shared/` in Phase 2A. Timezone-fixed
 * period id derivation for `leaderboards/{periodId}/entries/{uid}` (see
 * ../../functions/src/submitLunchRushScore.ts) -- weekly/monthly/all-time, Asia/Tokyo (JST,
 * UTC+9, no DST). Pure functions only, taking an epoch-ms timestamp, so every period boundary
 * decision is fully deterministic and unit-testable without mocking the system clock.
 *
 * Originally lived at functions/src/periodIds.ts (server-only). Phase 2A's weekly leaderboard
 * *read* path (src/firebase/getWeeklyLeaderboard.ts) needs to derive the exact same "which
 * weekly period is 'this week'" answer the server already computes at submission time -- so
 * this moved here, to the one module both the Cloud Function and the browser already share for
 * Lunch Rush ranking logic (alongside ./lunchRushScoring.ts), instead of the client inventing a
 * second, potentially-drifting week-numbering implementation. `functions/src/periodIds.ts` is
 * now a thin re-export of this file, so nothing on the server side changed behaviorally.
 *
 * JST has a fixed +9:00 offset year-round (no DST), so a JST wall-clock date can be derived by
 * simply shifting the epoch timestamp by +9 hours and reading UTC date parts off the result --
 * no timezone database/Intl dependency needed, which keeps this file (bundled into both the
 * Functions deploy and the client bundle) small and dependency-free.
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface JstDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export function toJstDateParts(epochMs: number): JstDateParts {
  const shifted = new Date(epochMs + JST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * ISO-8601 week number (`YYYY-Www`, Monday-start, week 1 = the week containing the year's
 * first Thursday) for the JST calendar day `epochMs` falls on. Standard "nearest Thursday"
 * algorithm: shifting to the week's own Thursday and comparing against the first Thursday of
 * that Thursday's year is what makes the year-boundary case (a JST Monday in late
 * December/early January) resolve to the correct ISO year on its own, without any special-
 * cased boundary logic.
 */
export function isoWeekId(epochMs: number): string {
  const { year, month, day } = toJstDateParts(epochMs);
  // A UTC-midnight Date standing in for "this JST calendar day" -- only its date parts (not
  // time-of-day, already discarded) matter for the week computation below.
  const date = new Date(Date.UTC(year, month - 1, day));

  // getUTCDay(): Sunday=0..Saturday=6 -> remap to Monday=0..Sunday=6, then jump to that week's
  // Thursday (ISO 8601's own reference weekday).
  const mondayIndexedDay = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayIndexedDay + 3);

  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstThursdayMondayIndexedDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayMondayIndexedDay + 3);

  const weekNumber =
    1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));

  return `${isoYear}-W${pad2(weekNumber)}`;
}

/** `YYYY-MM` in JST. */
export function monthId(epochMs: number): string {
  const { year, month } = toJstDateParts(epochMs);
  return `${year}-${pad2(month)}`;
}

export const ALL_TIME_PERIOD_ID = "all_all";

export interface LunchRushPeriodIds {
  /** `leaderboards/{weekly}/entries/{uid}` doc path segment, e.g. `"weekly_2026-W38"`. */
  weekly: string;
  /** e.g. `"monthly_2026-09"`. */
  monthly: string;
  /** Constant -- one running leaderboard, no rollover (Phase 0 audit §6). */
  allTime: string;
}

/**
 * The three `leaderboards/*` collection ids a single accepted submission upserts into (see
 * ../../functions/src/submitLunchRushScore.ts) -- all derived from the exact same server-clock
 * `epochMs`, so a run can never be bucketed into a weekly period and a monthly period that
 * disagree about which JST day it landed on.
 */
export function computeLunchRushPeriodIds(epochMs: number): LunchRushPeriodIds {
  return {
    weekly: `weekly_${isoWeekId(epochMs)}`,
    monthly: `monthly_${monthId(epochMs)}`,
    allTime: ALL_TIME_PERIOD_ID,
  };
}

export interface JstWeekRange {
  monday: JstDateParts;
  sunday: JstDateParts;
}

/**
 * Phase 2A (Issue #87): the Monday-Sunday JST calendar-date range of the ISO week `epochMs`
 * falls in -- used only for the weekly ranking UI's "current week" label
 * (src/components/WeeklyRankingOverlay.tsx), never for period-id bucketing itself (that stays
 * `isoWeekId` above). Kept alongside `isoWeekId` since both describe the same ISO week and must
 * never disagree about which calendar days it spans.
 */
export function jstWeekRange(epochMs: number): JstWeekRange {
  const { year, month, day } = toJstDateParts(epochMs);
  const date = new Date(Date.UTC(year, month - 1, day));
  const mondayIndexedDay = (date.getUTCDay() + 6) % 7;

  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() - mondayIndexedDay);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  return {
    monday: { year: monday.getUTCFullYear(), month: monday.getUTCMonth() + 1, day: monday.getUTCDate() },
    sunday: { year: sunday.getUTCFullYear(), month: sunday.getUTCMonth() + 1, day: sunday.getUTCDate() },
  };
}
