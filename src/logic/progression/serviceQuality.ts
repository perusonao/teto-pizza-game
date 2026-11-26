/**
 * B案再構成 Phase 2a (Issue #901): the one adapter between the evaluation and the rewards. Design §3.2.5 / §6 Q9.
 *
 * The Pitz reward and the reputation read a pizza's evaluation only through `serviceQualityOf`, never `ScoreBreakdown`
 * directly. Scoring 3.0 (Issue #176, PR-F: how CUT relates to `total`) is not decided; whichever option it lands on changes
 * only this function's body:
 * - Option B (a capped CUT bonus inside `total`): `total` / `stars` already carry it, nothing else moves.
 * - Option C (CUT independent): `cutScore` is here for the reputation to read separately, if the Owner so decides.
 * Today it is the existing evaluation as it is: `total` and `stars` are `ScoreBreakdown`'s own, so every reward computed
 * through it is the same number as before (the legacy Pitz credit included).
 */
import type { CutEvaluation } from "../cut/types";
import type { QualityStars, ScoreBreakdown } from "../scoring";
import type { CompleteReputationTable } from "./reputationTable";

export interface ServiceQuality {
  /** 0-100, what the Pitz quality multiplier reads. */
  total: number;
  stars: QualityStars;
  /** The CUT step's standalone score when the round was cut, else `null`. Not read by any reward yet (Q9). */
  cutScore: number | null;
}

export function serviceQualityOf(score: ScoreBreakdown, cut: CutEvaluation | null): ServiceQuality {
  return { total: score.total, stars: score.stars, cutScore: cut ? cut.cutScore : null };
}

/** What a served order adds to the reputation: the table's gain for its stars (★1..★5). */
export function orderReputationGain(quality: ServiceQuality, table: CompleteReputationTable): number {
  const index = Math.min(table.perOrderGain.length, Math.max(1, Math.round(quality.stars))) - 1;
  return table.perOrderGain[index];
}
