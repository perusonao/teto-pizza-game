/**
 * Human Feel Fix 2 (Sauce Painting Visual/Scoring Discoverability): turns `SauceMetrics`
 * (./sauceField.ts) into what the player actually sees -- three ◎/○/× tiers (広さ/均一さ/ふち)
 * and one short live message while painting. Shadow-only, same as everything else in
 * ./referenceScoring.ts and ./sauceField.ts: never feeds `scorePizza`/Dex BEST/★/Mission/
 * Pitz/Shop/progression, and this file does not change any of those either.
 *
 * `SAUCE_TARGET_RADIUS` (./sauceField.ts) is the one geometry constant both the Target Area
 * Guide (PizzaStage.tsx, ReferencePreview.tsx) and `edgeAmount`/`edgeRatio` below are derived
 * from -- see that constant's own doc comment. This file only turns the *numbers* that
 * boundary already produces into tiers/a message; it introduces no boundary of its own.
 */
import type { ReferenceSauce } from "../data/referencePizza";
import type { SauceMetrics } from "./sauceField";

export type SauceTier = "great" | "good" | "poor";

export const SAUCE_TIER_SYMBOL: Record<SauceTier, string> = {
  great: "◎", // ◎
  good: "○", // ○
  poor: "×", // ×
};

export interface SaucePlayerEvaluation {
  /** 広さ -- how much of the reference's own coverage this run has matched. */
  coverageTier: SauceTier;
  /** 均一さ -- how uniformly the sauce is spread (self-normalized, no reference needed). */
  evennessTier: SauceTier;
  /** ふち -- how much sauce stayed off the rim band / off the dough entirely. */
  edgeTier: SauceTier;
}

/** coverage/reference.coverage >= this -> great; >= COVERAGE_POOR_RATIO -> good; else poor.
 *  Reference-relative (not absolute) because a smaller/larger reference target should still
 *  read as "close to it" on its own terms. Exported so ./scoringV2's continuous Sauce
 *  component can share these exact thresholds instead of re-tuning its own. */
export const COVERAGE_GREAT_RATIO = 0.85;
export const COVERAGE_POOR_RATIO = 0.55;

/** evenness is already self-normalized 0-1 (see sauceField.ts's computeEvenness) -- these are
 *  absolute thresholds, not reference-relative. */
export const EVENNESS_GREAT = 0.9;
export const EVENNESS_POOR = 0.85;

/** edgeRatio: lower is better (less sauce beyond SAUCE_TARGET_RADIUS). */
export const EDGE_GREAT = 0.03;
export const EDGE_POOR = 0.12;

function tierFor(value: number, greatAt: number, poorBelow: number): SauceTier {
  if (value >= greatAt) return "great";
  if (value >= poorBelow) return "good";
  return "poor";
}

function coverageRatio(metrics: Pick<SauceMetrics, "coverage">, reference: ReferenceSauce): number {
  if (reference.coverage <= 0) return metrics.coverage > 0 ? 1 : 0;
  return metrics.coverage / reference.coverage;
}

export function evaluateSauceForPlayer(
  metrics: SauceMetrics,
  reference: ReferenceSauce,
): SaucePlayerEvaluation {
  return {
    coverageTier: tierFor(coverageRatio(metrics, reference), COVERAGE_GREAT_RATIO, COVERAGE_POOR_RATIO),
    evennessTier: tierFor(metrics.evenness, EVENNESS_GREAT, EVENNESS_POOR),
    // Lower edgeRatio is better, so the great/poor comparison direction flips relative to
    // tierFor's "higher is better" shape: feed it (1 - edgeRatio) against the complementary
    // thresholds instead of writing a second, inverted copy of the same three-way branch.
    edgeTier: tierFor(1 - metrics.edgeRatio, 1 - EDGE_GREAT, 1 - EDGE_POOR),
  };
}

export const SAUCE_LIVE_MESSAGE = {
  spreadMore: "もう少し広げよう",
  smoothThickArea: "厚いところを広げよう",
  keepRimClear: "耳は残そう",
  good: "いい感じ！",
} as const;

/**
 * One short message, never more than one at a time (the brief is explicit: no stacked
 * warnings). Priority order -- edge, then coverage, then evenness -- is deliberate, not
 * incidental: painting into the rim band is the one mistake this checks *first*, regardless
 * of how coverage/evenness otherwise look, because "耳は残そう" is a hard rule (the reference
 * fixture never touches it, see sauceField.ts's SAUCE_TARGET_RADIUS comment) rather than a
 * matter of degree the way coverage/evenness are. See sauceEvaluation.test.ts's Human Feel
 * Gate scenarios (A-D) for the concrete cases this ordering exists to get right -- notably
 * scenario C (painted to the rim, but coverage also reads low): edge still wins.
 */
export function deriveSauceLiveMessage(metrics: SauceMetrics, reference: ReferenceSauce): string {
  if (metrics.edgeRatio > EDGE_POOR) return SAUCE_LIVE_MESSAGE.keepRimClear;
  if (coverageRatio(metrics, reference) < COVERAGE_POOR_RATIO) return SAUCE_LIVE_MESSAGE.spreadMore;
  if (metrics.evenness < EVENNESS_POOR) return SAUCE_LIVE_MESSAGE.smoothThickArea;
  return SAUCE_LIVE_MESSAGE.good;
}
