/**
 * Issue #38 E-P1/E-P2: Score-based Pitz reward core (see
 * docs/reports/TETO_ISSUE-38_PITZ-REWARD_Fresh-Audit.md sec. 2). A pure domain module, deliberately
 * independent of `scoringV2/` -- it takes an abstract 0-100 quality `total` (whatever
 * `gameReducer.ts`'s `CONFIRM_BAKE` currently treats as `state.score.total`, today
 * Scoring-2.0-derived via `toLegacyScoreBreakdown`) rather than importing Scoring 2.0 directly, so
 * a future authority change never requires touching this file. UI never computes a reward amount
 * itself -- it only ever reads the reducer-applied `GameState.lastPitzCredit` snapshot.
 */

/** V1 quality bands -- byte-for-byte the same thresholds as `scoring.ts`'s own
 *  `STAR_THRESHOLDS` (90/75/60/40/0), so the Pitz multiplier tier a player lands in always
 *  matches the star rating shown on the same RESULT screen. Do not re-tune without Human Feel
 *  evidence (Issue #38's own instruction). */
const QUALITY_MULTIPLIER_BANDS: ReadonlyArray<{ min: number; multiplier: number }> = [
  { min: 90, multiplier: 1.2 },
  { min: 75, multiplier: 1.0 },
  { min: 60, multiplier: 0.8 },
  { min: 40, multiplier: 0.5 },
  { min: 0, multiplier: 0 },
];

/** Maps an abstract 0-100 quality total to its V1 multiplier. Malformed input (NaN, +/-Infinity,
 *  negative, >100) clamps to the safe side rather than throwing or producing a negative/absurd
 *  multiplier -- an invalid `total` reads as the worst band (multiplier 0), never a fabricated
 *  bonus. */
export function qualityMultiplierForScore(total: number): number {
  const safeTotal = Number.isFinite(total) ? total : 0;
  const clamped = Math.min(100, Math.max(0, safeTotal));
  const band = QUALITY_MULTIPLIER_BANDS.find((b) => clamped >= b.min);
  return band ? band.multiplier : 0;
}

export interface PitzRewardResult {
  /** The recipe's static `baseRewardPitz`, clamped to a safe non-negative number. */
  baseReward: number;
  /** The V1 quality multiplier this `scoreTotal` landed in. */
  multiplier: number;
  /** `Math.round(baseReward * multiplier)`, floored at 0. Always a non-negative integer. */
  earnedPitz: number;
}

/**
 * The V1 reward formula: `recipeBaseReward x qualityMultiplier = earnedPitz`. Pure and
 * deterministic -- same `(baseRewardPitz, scoreTotal)` in, same result out, every call, no
 * randomness or external state (mirrors `calculateMissionReward`'s own determinism, see
 * ../logic/economy.ts). `Math.round` per the project's existing rounding convention
 * (`missionScore`, `ResultPanel`'s displayed total). Malformed `baseRewardPitz` (negative, NaN,
 * non-finite) clamps to 0 rather than propagating a negative/invalid reward.
 */
export function calculatePitzReward(baseRewardPitz: number, scoreTotal: number): PitzRewardResult {
  const safeBaseReward =
    Number.isFinite(baseRewardPitz) && baseRewardPitz > 0 ? baseRewardPitz : 0;
  const multiplier = qualityMultiplierForScore(scoreTotal);
  const earnedPitz = Math.max(0, Math.round(safeBaseReward * multiplier));
  return { baseReward: safeBaseReward, multiplier, earnedPitz };
}

/** Canonical transient RESULT/DISCOVERED display snapshot (`GameState.lastPitzCredit`, see
 *  ../state/gameReducer.ts). Set once, atomically, by the same reducer step that applies the
 *  credit -- the display layer never recomputes any of these five numbers itself. */
export interface PitzCredit extends PitzRewardResult {
  balanceBefore: number;
  balanceAfter: number;
}

/**
 * Applies one round's Pitz credit against a starting balance -- the one function
 * `REGISTER_TO_DEX` (../state/gameReducer.ts) calls to both compute and snapshot a credit in the
 * same step. `balanceBefore` is defensively clamped the same way `persistence.ts`'s
 * `sanitizePitzBalance` already treats a stored balance (a malformed/negative balance reads as 0
 * rather than propagating), even though `GameState.pitzBalance` should never actually be invalid
 * at this call site.
 */
export function applyPitzCredit(
  baseRewardPitz: number,
  scoreTotal: number,
  balanceBefore: number,
): PitzCredit {
  const { baseReward, multiplier, earnedPitz } = calculatePitzReward(baseRewardPitz, scoreTotal);
  const safeBalanceBefore =
    Number.isFinite(balanceBefore) && balanceBefore >= 0 ? balanceBefore : 0;
  return {
    baseReward,
    multiplier,
    earnedPitz,
    balanceBefore: safeBalanceBefore,
    balanceAfter: safeBalanceBefore + earnedPitz,
  };
}
