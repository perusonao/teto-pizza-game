/**
 * Weekly Ranking achievedAt display (Lunch Rush Result & Ranking Phase 4). Input is the exact
 * normalized boundary type `../firebase/getWeeklyLeaderboard.ts` already produces -- epoch ms,
 * or `null` for a just-written entry whose `serverTimestamp()` sentinel hasn't resolved yet, or
 * (defensively) `undefined`/malformed for a legacy/未知 shape. Firestore `Timestamp` ->
 * millis conversion already happened at that read boundary (`toAchievedAtMillis`); this module
 * never touches `firebase/firestore` and never sees a raw `Timestamp`.
 *
 * Timezone decision (task step 8): always **Asia/Tokyo**, regardless of the viewer's own browser
 * timezone. This ranking's own weekly period boundaries are already explicit JST
 * (`./lunchRushPeriodIds.ts`'s `isoWeekId`/`jstWeekRange`) -- displaying `achievedAt` in a
 * different, viewer-local zone would let a timestamp read as falling outside the very week
 * header it's listed under. A fixed zone also keeps this formatter (and its tests) fully
 * deterministic regardless of CI/host timezone, with nothing to stub.
 */

/** Compact `M/D HH:mm` format (e.g. "9/22 08:41") -- month/day unpadded, hour/minute
 *  zero-padded, matching the existing `WeeklyRankingOverlay`'s own week-range label convention
 *  (`formatWeekRangeLabel`'s "9/14〜9/20") of not padding month/day. No year: the ranking is
 *  weekly, so every entry necessarily falls within a single already-displayed week. */
export const ACHIEVED_AT_FALLBACK = "-";

const formatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatAchievedAt(achievedAtMs: number | null | undefined): string {
  if (typeof achievedAtMs !== "number" || !Number.isFinite(achievedAtMs)) {
    return ACHIEVED_AT_FALLBACK;
  }
  const date = new Date(achievedAtMs);
  if (Number.isNaN(date.getTime())) return ACHIEVED_AT_FALLBACK;

  const parts = formatter.formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  const month = part("month");
  const day = part("day");
  const hour = part("hour");
  const minute = part("minute");
  if (!month || !day || !hour || !minute) return ACHIEVED_AT_FALLBACK;

  return `${month}/${day} ${hour}:${minute}`;
}
