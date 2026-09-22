import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  type Firestore,
} from "firebase/firestore";
import { getFirebaseApp } from "./client";
import { getCurrentAuthUser } from "./auth";
import { isoWeekId, jstWeekRange, type JstWeekRange } from "../shared/lunchRushPeriodIds";
import { FALLBACK_DISPLAY_NAME } from "../shared/displayNameValidation";

/**
 * Firebase Ranking 1.0 Phase 2A (Issue #87). The client's one read path for the weekly
 * leaderboard -- `leaderboards/{periodId}/entries`, `periodId = "weekly_" + isoWeekId(now)`
 * (../shared/lunchRushPeriodIds.ts, the exact same JST week-numbering the server already uses
 * to bucket a Phase 1B submission -- see functions/src/submitLunchRushScore.ts). Deliberately
 * the only file in `src/` that imports `firebase/firestore` (Phase 1B's own security posture,
 * carried forward: no write path exists anywhere in this module, and none should ever be added
 * here -- `runs` and `leaderboards` entries stay writable only by the Cloud Function's Admin
 * SDK path, see firestore.rules).
 *
 * Read shape, in order:
 *   1. top 10 entries for the current week, `orderBy("score", "desc"), orderBy("achievedAt",
 *      "asc"), limit(10)` -- the same `score DESC, achievedAt ASC` tie-break the server's own
 *      upsert-if-higher semantics were designed around (docs/design/
 *      TETO_FIREBASE-RANKING_SETUP.md section 14).
 *   2. only if the signed-in uuid's own entry is *not* already in that top 10: one single-doc
 *      read of `leaderboards/{periodId}/entries/{uid}` plus one `count()` aggregation query
 *      (`where("score", ">", ownScore)`) to derive an approximate rank -- see
 *      `WeeklyLeaderboardCurrentUserRank`'s own doc comment for why this is an approximation,
 *      not an exact tie-broken rank.
 *
 * Every failure mode (Firebase unconfigured, no signed-in user, network/permission error)
 * resolves to a typed result instead of throwing, mirroring ./submitLunchRushScore.ts's own
 * "never fail the caller" contract -- a ranking-read failure must never be treated as a Lunch
 * Rush gameplay failure (this task's own requirement).
 */

const TOP_ENTRY_LIMIT = 10;

export interface WeeklyLeaderboardEntry {
  rank: number;
  score: number;
  /** Epoch ms, or `null` in the vanishingly rare case a just-written entry's
   *  `serverTimestamp()` sentinel hasn't resolved to a real Timestamp yet when read back. */
  achievedAt: number | null;
  isCurrentUser: boolean;
  /** Player Profile 1.0 Phase 1B (Issue #129). Always a renderable string -- never missing or
   *  empty: an entry written before this phase shipped, or with no `displayName` field for any
   *  other reason, is resolved to `FALLBACK_DISPLAY_NAME` right here, so no caller needs its own
   *  fallback logic (mirrors this module's own "never fail the caller" contract, just applied to
   *  a single field instead of the whole result). */
  displayName: string;
}

/**
 * The signed-in player's own weekly rank, only ever populated when their entry is *not* already
 * one of the `top` entries above. `rank` is derived from a single `count()` aggregation query
 * counting entries with a strictly higher `score` -- cheap (Firestore aggregation reads are
 * billed per up-to-1000 matched index entries, not per document), but this intentionally does
 * *not* replicate the `achievedAt ASC` tie-break for entries sharing the exact same `score`: an
 * exact score tie outside the top 10 would show as the same rank for both players. Given how
 * granular Lunch Rush scores are (servedCount*100 + totalQualityScore), an outside-top-10 exact
 * tie is expected to be rare; a fully tie-broken rank would need a second, more complex query
 * (Phase 0 audit §7's own suggestion) -- deferred to Phase 2B if this approximation ever proves
 * player-visible.
 */
export interface WeeklyLeaderboardCurrentUserRank {
  rank: number;
  score: number;
  /** Same resolution as WeeklyLeaderboardEntry.displayName -- see that field's own comment. */
  displayName: string;
  /** Lunch Rush Phase 4 (Ranking achievedAt display): same field, same `toAchievedAtMillis`
   *  resolution as `WeeklyLeaderboardEntry.achievedAt` above -- already stored on this document
   *  (`ownSnapshot`), just not previously read into this result shape. No new Firestore field. */
  achievedAt: number | null;
}

export type GetWeeklyLeaderboardResult =
  | { status: "unavailable" }
  | { status: "error"; message: string }
  | {
      status: "success";
      periodId: string;
      weekRange: JstWeekRange;
      /** Up to `TOP_ENTRY_LIMIT` entries, rank-ordered. Empty when nobody has submitted a score
       *  yet this week. */
      top: WeeklyLeaderboardEntry[];
      /** Set only when the signed-in player has an entry this week AND it isn't already one of
       *  `top`'s entries. `null` otherwise (no auth user, no entry yet this week, or already
       *  shown in `top`). */
      currentUserOutsideTop: WeeklyLeaderboardCurrentUserRank | null;
    };

let cachedFirestore: Firestore | null | undefined;

function getFirebaseFirestore(): Firestore | null {
  if (cachedFirestore !== undefined) return cachedFirestore;
  const app = getFirebaseApp();
  cachedFirestore = app ? getFirestore(app) : null;
  return cachedFirestore;
}

function toAchievedAtMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

/** Player Profile 1.0 Phase 1B (Issue #129). An entry's `displayName` field was already
 *  validated once, at submission time (functions/src/submitLunchRushScore.ts's own
 *  `resolveDisplayNameSnapshot`) -- this is only a type/presence guard for a legacy entry
 *  written before this phase shipped (no field at all) or any other unexpected shape, not a
 *  second content-validation pass. */
function resolveEntryDisplayName(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value : FALLBACK_DISPLAY_NAME;
}

/**
 * Reads the current week's Lunch Rush leaderboard. `now` is overridable only for tests --
 * production callers always use the default (`Date.now()`), matching every other Phase 1B/2A
 * "the server/client's own clock, never a hidden dependency" convention.
 */
export async function getWeeklyLeaderboard(now: number = Date.now()): Promise<GetWeeklyLeaderboardResult> {
  const db = getFirebaseFirestore();
  if (!db) return { status: "unavailable" };

  const periodId = `weekly_${isoWeekId(now)}`;
  const weekRange = jstWeekRange(now);
  const uid = getCurrentAuthUser()?.uid ?? null;

  try {
    const entriesRef = collection(db, "leaderboards", periodId, "entries");
    const topSnapshot = await getDocs(
      query(entriesRef, orderBy("score", "desc"), orderBy("achievedAt", "asc"), limit(TOP_ENTRY_LIMIT)),
    );

    const top: WeeklyLeaderboardEntry[] = topSnapshot.docs.map((entrySnapshot, index) => ({
      rank: index + 1,
      score: entrySnapshot.data().score as number,
      achievedAt: toAchievedAtMillis(entrySnapshot.data().achievedAt),
      isCurrentUser: uid !== null && entrySnapshot.id === uid,
      displayName: resolveEntryDisplayName(entrySnapshot.data().displayName),
    }));

    let currentUserOutsideTop: WeeklyLeaderboardCurrentUserRank | null = null;
    if (uid !== null && !top.some((entry) => entry.isCurrentUser)) {
      const ownSnapshot = await getDoc(doc(entriesRef, uid));
      if (ownSnapshot.exists()) {
        const ownScore = ownSnapshot.data().score as number;
        const higherCount = await getCountFromServer(query(entriesRef, where("score", ">", ownScore)));
        currentUserOutsideTop = {
          rank: higherCount.data().count + 1,
          score: ownScore,
          displayName: resolveEntryDisplayName(ownSnapshot.data().displayName),
          achievedAt: toAchievedAtMillis(ownSnapshot.data().achievedAt),
        };
      }
    }

    return { status: "success", periodId, weekRange, top, currentUserOutsideTop };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

/** Test-only: clears the cached Firestore instance, mirroring ./submitLunchRushScore.ts's own
 *  `__resetSubmitLunchRushScoreForTests`. */
export function __resetGetWeeklyLeaderboardForTests(): void {
  cachedFirestore = undefined;
}
