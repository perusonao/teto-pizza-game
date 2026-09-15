/**
 * Phase 4A-1A: shadow-only similarity between the player's tomato-sauce metrics and the
 * Margherita Reference Pizza target (../data/referencePizza.ts).
 *
 * "Shadow" is load-bearing: this NEVER feeds `scorePizza`/`ScoreBreakdown`
 * (./scoring.ts), never touches Dex BEST/★, and never reaches Mission scoring
 * (./missionScoring.ts). It exists only so the Prototype Metrics panel can show "how close
 * is this to the reference" while validating the *interaction*. Authoritative Scoring 2.0
 * (folding Reference matching into the real score) is explicitly deferred to Phase 4A-1B --
 * see the Phase 4A-1A result report's Scope Guard section. Do not wire this into
 * gameReducer's CONFIRM_BAKE/scorePizza call.
 */
import type { ReferenceSauce } from "../data/referencePizza";
import type { SauceMetrics } from "./sauceField";

export interface SauceReferenceShadowScore {
  quantitySimilarity: number;
  coverageSimilarity: number;
  /** Average of the two similarities above. Shadow-only -- see file header. */
  overall: number;
}

export function scoreSauceAgainstReference(
  metrics: Pick<SauceMetrics, "quantity" | "coverage">,
  reference: ReferenceSauce,
): SauceReferenceShadowScore {
  const quantitySimilarity = 1 - Math.min(1, Math.abs(metrics.quantity - reference.quantity));
  const coverageSimilarity = 1 - Math.min(1, Math.abs(metrics.coverage - reference.coverage));
  return {
    quantitySimilarity,
    coverageSimilarity,
    overall: (quantitySimilarity + coverageSimilarity) / 2,
  };
}
