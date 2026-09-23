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

/** Progression 2.0 Phase 2 design decision OD-02 (see
 *  docs/design/TETO_PROGRESSION2_PHASE2_DESIGN.md's recommended curve, reaffirmed as existing
 *  authority for Phase 3-3, Issue #198): every registered round has already cleared the
 *  Completion Gate, and `scoring.ts`'s `starsFromTotal` never returns fewer than ★1 (there is no
 *  ★0) -- so a real recipe's reward must never be allowed to round down to 0 Pitz just because
 *  quality landed in the 0-39 band. `PITZ_QUALITY_FLOOR` is that floor; `PITZ_FIRST_DISCOVERY_BONUS`
 *  is the flat bonus OD-02 also approves for a recipe's very first-ever discovery (additive, see
 *  `discoveryBonusPitz` below). Neither number is invented here -- both are copied from the
 *  already-approved Phase 2 curve, not re-tuned. */
export const PITZ_QUALITY_FLOOR = 20;
export const PITZ_FIRST_DISCOVERY_BONUS = 50;

export interface PitzRewardResult {
  /** The recipe's static `baseRewardPitz`, clamped to a safe non-negative number. */
  baseReward: number;
  /** The V1 quality multiplier this `scoreTotal` landed in. */
  multiplier: number;
  /** `Math.round(baseReward * multiplier)`, floored at `PITZ_QUALITY_FLOOR` (OD-02) whenever
   *  `baseReward` is positive -- a malformed/zero `baseRewardPitz` still earns nothing. Always a
   *  non-negative integer. */
  earnedPitz: number;
  /** OD-02's first-discovery bonus: `PITZ_FIRST_DISCOVERY_BONUS` when this round's caller says
   *  this is the recipe's first-ever discovery, otherwise 0. Additive, never folded into
   *  `earnedPitz`/`multiplier` -- mirrors Cooking Time CT2's `lastEfficiencyCredit.bonusPitz`
   *  convention (../state/gameReducer.ts), which stays a completely separate bonus. */
  discoveryBonusPitz: number;
}

/**
 * The V1 reward formula: `recipeBaseReward x qualityMultiplier = earnedPitz`, plus OD-02's ★1
 * floor and first-discovery bonus. Pure and deterministic -- same inputs in, same result out,
 * every call, no randomness or external state (mirrors `calculateMissionReward`'s own
 * determinism, see ../logic/economy.ts). `Math.round` per the project's existing rounding
 * convention (`missionScore`, `ResultPanel`'s displayed total). Malformed `baseRewardPitz`
 * (negative, NaN, non-finite, zero) clamps to 0 rather than propagating a negative/invalid
 * reward, and -- since there is then no real recipe reward to floor or bonus -- both
 * `earnedPitz` and `discoveryBonusPitz` stay 0 in that case regardless of `wasNewDiscovery`.
 */
export function calculatePitzReward(
  baseRewardPitz: number,
  scoreTotal: number,
  wasNewDiscovery = false,
): PitzRewardResult {
  const safeBaseReward =
    Number.isFinite(baseRewardPitz) && baseRewardPitz > 0 ? baseRewardPitz : 0;
  const multiplier = qualityMultiplierForScore(scoreTotal);
  const rawEarnedPitz = Math.max(0, Math.round(safeBaseReward * multiplier));
  const earnedPitz = safeBaseReward > 0 ? Math.max(PITZ_QUALITY_FLOOR, rawEarnedPitz) : 0;
  const discoveryBonusPitz = safeBaseReward > 0 && wasNewDiscovery ? PITZ_FIRST_DISCOVERY_BONUS : 0;
  return { baseReward: safeBaseReward, multiplier, earnedPitz, discoveryBonusPitz };
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
  wasNewDiscovery = false,
): PitzCredit {
  const { baseReward, multiplier, earnedPitz, discoveryBonusPitz } = calculatePitzReward(
    baseRewardPitz,
    scoreTotal,
    wasNewDiscovery,
  );
  const safeBalanceBefore =
    Number.isFinite(balanceBefore) && balanceBefore >= 0 ? balanceBefore : 0;
  return {
    baseReward,
    multiplier,
    earnedPitz,
    discoveryBonusPitz,
    balanceBefore: safeBalanceBefore,
    balanceAfter: safeBalanceBefore + earnedPitz + discoveryBonusPitz,
  };
}
