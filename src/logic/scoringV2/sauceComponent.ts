/**
 * Phase 4A-2: Scoring 2.0 Shadow Sauce component -- quantity, coverage, evenness, edge/rim
 * control, all derived from ../sauceField.ts's `SauceMetrics` (the same reviewed primitive
 * ../referenceScoring.ts's Phase 4A-1A shadow score and ../sauceEvaluation.ts's player-facing
 * 広さ/均一さ/ふち tiers already read from) -- never a second, independent read of raw
 * `sauceDeposits`.
 *
 * P0-1: only ever called when a `ReferenceSauce` exists for the recipe (../../data/
 * referencePizza.ts's `getReferencePizza`) -- see ./index.ts, which is the only caller.
 */
import type { ReferenceSauce } from "../../data/referencePizza";
import { EDGE_GREAT, EDGE_POOR } from "../sauceEvaluation";
import type { SauceMetrics } from "../sauceField";
import { clamp01 } from "../referenceMatching";
import { safeToleranceSimilarity, safeUnit } from "./tolerance";
import type { SauceComponentV2 } from "./types";

/** Sub-weights, sum to 100. Phase 4A-2 shadow calibration only -- see the Fresh Audit /
 *  Shadow Result report for the rationale and the explicit "not final" caveat (SCORING
 *  ARCHITECTURE section: "Do NOT prematurely make ... the permanent global architecture"). */
export const SAUCE_QUANTITY_WEIGHT = 30;
export const SAUCE_COVERAGE_WEIGHT = 30;
export const SAUCE_EVENNESS_WEIGHT = 20;
export const SAUCE_EDGE_WEIGHT = 20;

/**
 * Tolerance bands for quantity/coverage, in the same normalized [0, 1] units as
 * `SauceMetrics.quantity`/`.coverage`. Margherita's own Reference target sits at quantity
 * 0.92 / coverage 0.72 (../../data/referencePizza.ts) -- a `full` of 0.08 means landing within
 * roughly one dispense tick-and-a-half of the target (`SAUCE_RATE_PER_TICK` is 0.02, see
 * ../sauceQuantity.ts) still reads as a perfect match, and `zero` of 0.4 means missing the
 * target by less than half the whole normalized scale still earns *some* partial credit --
 * tolerant, not pixel-perfect, per the Fresh Audit's scoring principles.
 */
const QUANTITY_FULL_CREDIT = 0.08;
const QUANTITY_ZERO_CREDIT = 0.4;
const COVERAGE_FULL_CREDIT = 0.08;
const COVERAGE_ZERO_CREDIT = 0.4;

/**
 * Below this normalized quantity, there is essentially no sauce on the dough at all --
 * `computeSauceMetrics` (../sauceField.ts) reports an empty/near-empty gesture's evenness as
 * a neutral 1 and edgeRatio as 0 (nothing to be uneven or to have strayed off the rim), which
 * would otherwise let an empty pizza collect free evenness/edge credit it never earned. Both
 * sub-scores are scaled by how far `quantity` is into this floor (0 at truly empty, 1 once
 * past it) before being weighted below, so "no sauce" reads as close to 0 overall, not a
 * partial pass propped up by a placeholder value's vacuous truth. Chosen just above
 * `SAUCE_RATE_PER_TICK` (0.02) -- a single accidental tap should not count as "sauce
 * applied", but a couple of deliberate ticks should.
 */
const PRESENCE_QUANTITY_FLOOR = 0.05;

function presenceGate(quantity: number): number {
  return clamp01(safeUnit(quantity) / PRESENCE_QUANTITY_FLOOR);
}

export function scoreSauceComponentV2(
  metrics: Pick<SauceMetrics, "quantity" | "coverage" | "evenness" | "edgeRatio">,
  reference: ReferenceSauce,
): SauceComponentV2 {
  const quantitySimilarity = safeToleranceSimilarity(
    Math.abs(safeUnit(metrics.quantity) - safeUnit(reference.quantity)),
    QUANTITY_FULL_CREDIT,
    QUANTITY_ZERO_CREDIT,
  );
  const coverageSimilarity = safeToleranceSimilarity(
    Math.abs(safeUnit(metrics.coverage) - safeUnit(reference.coverage)),
    COVERAGE_FULL_CREDIT,
    COVERAGE_ZERO_CREDIT,
  );

  const presence = presenceGate(metrics.quantity);
  // evenness is already self-normalized 0-1, higher-is-better (../sauceField.ts's
  // computeEvenness) -- it reads directly as a similarity, no tolerance band needed.
  // edgeRatio is lower-is-better, read as a "distance" against the exact EDGE_GREAT/EDGE_POOR
  // thresholds the player-facing ふち tier already uses (../sauceEvaluation.ts), so Shadow
  // scoring can never disagree with what the player sees about what counts as a good edge.
  const evennessScore = presence * safeUnit(metrics.evenness);
  const edgeScore = presence * safeToleranceSimilarity(safeUnit(metrics.edgeRatio), EDGE_GREAT, EDGE_POOR);

  const score =
    quantitySimilarity * SAUCE_QUANTITY_WEIGHT +
    coverageSimilarity * SAUCE_COVERAGE_WEIGHT +
    evennessScore * SAUCE_EVENNESS_WEIGHT +
    edgeScore * SAUCE_EDGE_WEIGHT;

  return {
    available: true,
    quantitySimilarity,
    coverageSimilarity,
    evennessScore,
    edgeScore,
    score: safeUnit(score / 100) * 100,
  };
}
