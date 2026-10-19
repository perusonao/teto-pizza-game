/**
 * Economy / Progression Phase 1 (#561): a deterministic Pitz budget estimate for a star profile. TEST SUPPORT ONLY
 * (never imported by production code; it reads the production reward and price functions and changes none of them).
 *
 * It is an ESTIMATE, not a simulation: it prices the first pack of every material the profile reaches, an assumed
 * refill load for exploration, and the income of one discovery per reached recipe, then converts the gap into the
 * number of extra rounds a player has to replay. Assumptions are named constants so a report can quote them.
 */
import { DISCOVERY_LADDER } from "../../../data/discoveryLadder";
import { INGREDIENTS } from "../../../data/ingredients";
import { materialOffer } from "../../materialShop";
import { calculateMissionReward } from "../../economy";
import { PITZ_FIRST_DISCOVERY_BONUS, calculatePitzReward } from "../../pitzReward";
import { recordServe, EMPTY_MISSION_METRICS } from "../../missionScoring";
import { analyzeLadderReachability, type StarProfile } from "./ladderReachability";

/** A quality score that lands in each star band (STAR_THRESHOLDS 90/75/60/40/0), the middle of the band. */
export const REPRESENTATIVE_SCORE_BY_STARS = { 1: 20, 2: 50, 3: 68, 4: 82, 5: 95 } as const;

/** Research search attempts per new recipe: TETO_SCALE-AUDIT-53_Result.md §7 (tail band ≈ 14, "FULL" model). */
export const ATTEMPTS_PER_NEW_RECIPE = 14;
/** Toppings tested per attempt (K = 3, same report). */
export const TOPPINGS_PER_ATTEMPT = 3;
/** Same report: one piece per tested topping ("ONE", 7.5 Pitz) relative to the full pack unit ("FULL", 18 Pitz) at T4. */
export const ONE_PIECE_FRACTION_OF_FULL = 7.5 / 18;
/** Lunch Rush run used for the "with Rush" case: pizzas served in one 180 s run at the profile's star quality. */
export const RUSH_SERVED_PER_RUN = 3;

export interface EconomyEstimate {
  stars: 1 | 2 | 3 | 4 | 5;
  reachedRecipes: number;
  reachedMaterialSteps: number;
  /** Pitz from the first discovery of every reached recipe (reward + first-discovery bonus). */
  discoveryIncome: number;
  /** First-pack price of every material of every reached step (star-locked materials excluded). */
  firstPackCost: number;
  /** Exploration refills for the reached recipes, "FULL" and "ONE" models. */
  refillCostFull: number;
  refillCostOne: number;
  /** Pitz of one replay of margherita (starters only: no stock is consumed). */
  margheritaReplayPitz: number;
  /** Gross Pitz of one Lunch Rush run (3 pizzas at this quality); stock the run consumes is not deducted. */
  rushRunGrossPitz: number;
  /** Shortfall (0 when income covers cost) and the extra margherita replays it takes, packs only / packs + refills. */
  shortfallPacksOnly: number;
  replaysPacksOnly: number;
  replaysWithRefillFull: number;
  replaysWithRefillOne: number;
  /** The same shortfalls expressed as Lunch Rush runs instead of margherita replays (gross, optimistic). */
  rushRunsWithRefillFull: number;
  rushRunsWithRefillOne: number;
}

const ceilDiv = (a: number, b: number): number => (a <= 0 ? 0 : Math.ceil(a / b));

export function estimateEconomy(best: 1 | 2 | 3 | 4 | 5): EconomyEstimate {
  const profile: StarProfile = { kind: "uniform", best };
  const reach = analyzeLadderReachability({ profile });
  const score = REPRESENTATIVE_SCORE_BY_STARS[best];
  const reward = calculatePitzReward(100, score, false).earnedPitz;
  const perDiscovery = reward + PITZ_FIRST_DISCOVERY_BONUS;
  const reachedSteps = DISCOVERY_LADDER.steps.filter((s) => s.step <= reach.creditedReached);
  const locked = new Set(reach.starLockedMaterialIds);

  let firstPackCost = 0;
  let refillFull = 0;
  for (const step of reachedSteps) {
    for (const id of step.ingredientIds) {
      if (locked.has(id)) continue;
      const offer = materialOffer(INGREDIENTS.find((i) => i.id === id)!);
      if (!offer) continue;
      firstPackCost += offer.packPrice;
    }
    // One key recipe per step; its exploration is priced at the step's last (newest) material tier.
    const newest = materialOffer(INGREDIENTS.find((i) => i.id === step.ingredientIds[step.ingredientIds.length - 1])!);
    if (newest) refillFull += ATTEMPTS_PER_NEW_RECIPE * TOPPINGS_PER_ATTEMPT * (newest.refillPrice / 10);
  }
  const refillOne = refillFull * ONE_PIECE_FRACTION_OF_FULL;

  const discoveryIncome = reach.discoveredIds.length * perDiscovery;
  let rush = EMPTY_MISSION_METRICS;
  for (let i = 0; i < RUSH_SERVED_PER_RUN; i++) rush = recordServe(rush, score);
  const rushGross = calculateMissionReward(rush);

  const shortfallPacks = Math.max(0, firstPackCost - discoveryIncome);
  const shortfallFull = Math.max(0, firstPackCost + refillFull - discoveryIncome);
  const shortfallOne = Math.max(0, firstPackCost + refillOne - discoveryIncome);
  return {
    stars: best,
    reachedRecipes: reach.discoveredIds.length,
    reachedMaterialSteps: reachedSteps.length,
    discoveryIncome,
    firstPackCost,
    refillCostFull: Math.round(refillFull),
    refillCostOne: Math.round(refillOne),
    margheritaReplayPitz: reward,
    rushRunGrossPitz: rushGross,
    shortfallPacksOnly: shortfallPacks,
    replaysPacksOnly: ceilDiv(shortfallPacks, reward),
    replaysWithRefillFull: ceilDiv(shortfallFull, reward),
    replaysWithRefillOne: ceilDiv(shortfallOne, reward),
    rushRunsWithRefillFull: ceilDiv(shortfallFull, rushGross),
    rushRunsWithRefillOne: ceilDiv(shortfallOne, rushGross),
  };
}
