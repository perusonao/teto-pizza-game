/**
 * Firebase Ranking 1.0 (Issue #87). Moved to ../../src/shared/lunchRushPeriodIds.ts in Phase 2A
 * so the client's weekly leaderboard read path (src/firebase/getWeeklyLeaderboard.ts) can derive
 * the exact same JST period ids this server-side submission path already computes, instead of
 * the client inventing a second week-numbering implementation. This file is kept as a thin
 * re-export so nothing here (../../functions/src/submitLunchRushScore.ts's own `import ... from
 * "./periodIds"`, and this file's own ./periodIds.test.ts) had to change.
 */
export * from "../../src/shared/lunchRushPeriodIds";
