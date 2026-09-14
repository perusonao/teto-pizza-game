/**
 * Mission scoring (Phase 3C-4, see docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 11 and
 * docs/reports/PIZZA_GAME_Phase3C-4_Lunch-Rush_Result.md). Pure functions only -- no React, no
 * timers, no reducer wiring -- so the Mission Score formula and metric accumulation can be
 * unit tested independently of how/when they're called.
 *
 * Deliberately distinct from pizza Quality scoring (../logic/scoring.ts, ScoreBreakdown): a
 * Mission Score is a session-level tally across every pizza served in one Mission run, while
 * ScoreBreakdown.total/.stars is a single pizza's own 0-100 quality. Never conflate the two.
 */

export interface MissionMetrics {
  /** How many pizzas have been served (registered + handed off) this Mission run. */
  servedCount: number;
  /** Sum of every served pizza's ScoreBreakdown.total (each 0-100). */
  totalQualityScore: number;
  /** Highest single-pizza ScoreBreakdown.total served this run, 0 if none served yet. */
  bestQualityScore: number;
}

export const EMPTY_MISSION_METRICS: MissionMetrics = {
  servedCount: 0,
  totalQualityScore: 0,
  bestQualityScore: 0,
};

/** Records one served pizza's quality total into the running metrics. `qualityTotal` is a
 *  single pizza's `ScoreBreakdown.total` (0-100) -- callers never need to pass anything else. */
export function recordServe(metrics: MissionMetrics, qualityTotal: number): MissionMetrics {
  return {
    servedCount: metrics.servedCount + 1,
    totalQualityScore: metrics.totalQualityScore + qualityTotal,
    bestQualityScore: Math.max(metrics.bestQualityScore, qualityTotal),
  };
}

/** Derived, not stored: average quality across every pizza served this run. 0 when nothing
 *  has been served yet (avoids a 0/0 -> NaN leaking into the Mission Result UI). */
export function averageQualityScore(metrics: MissionMetrics): number {
  return metrics.servedCount === 0 ? 0 : metrics.totalQualityScore / metrics.servedCount;
}

/**
 * Mission Score formula (SSOT section 10 / Phase 3C-4 scope):
 *
 *   missionScore = servedCount * 100 + totalQualityScore
 *
 * Rounded once, here, so every caller (Mission Result UI, persisted Mission BEST) agrees on
 * the same integer without re-rounding independently.
 */
export function missionScore(metrics: MissionMetrics): number {
  return Math.round(metrics.servedCount * 100 + metrics.totalQualityScore);
}

/** BEST is monotonic (never decreases) -- the same rule Dex BEST already follows
 *  (src/state/dex.ts). Centralized here so persistence and any future UI compare Mission
 *  BEST the same way. */
export function isNewMissionBest(candidateScore: number, currentBest: number): boolean {
  return candidateScore > currentBest;
}
