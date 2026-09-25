/**
 * Issue #215 (Completion Gate partial-quantity, Owner Decision OD-2/OD-3/OD-4b): the quantity
 * factor Q. Once the Completion Gate stopped failing an under-ideal pizza (OD-1 = G1: one piece
 * of a required ingredient is enough to complete the recipe), shortage needed a real score cost
 * -- the Pieces component alone barely moves (its placement term only averages the pieces that
 * were actually placed, and Pieces is only 16/100 split across every piece group; see the Fresh
 * Audit, docs/reports/TETO_COMPLETION-GATE_PARTIAL-QUANTITY_Fresh-Audit.md section 3.1).
 *
 * Q is a multiplier on the whole Scoring 2.0 total, driven by the single worst piece group:
 *
 *   shortageRatio = max over groups of (target - placed) / target   (placed < target)
 *   excessRatio   = max over groups of min(1, (placed - target) / target)   (placed > target)
 *   factor        = max(0, 1 - 0.5 * shortageRatio - 0.15 * excessRatio)
 *
 * `target` is the Reference Pizza's own `positions.length` for that group -- the same ideal
 * quantity the Pieces component already scores against (`PieceGroupScoreV2.targetCount`), which
 * matches every scatter ingredient's `minCount` (pinned by src/data/playerReference.test.ts).
 * Applied identically in every mode, so Lunch Rush's excess penalty (OD-4b) is this same factor;
 * Lunch Rush's shortage never reaches scoring because its Completion Gate policy ("order", OD-4
 * = LR-A) still fails a pizza below the ordered quantity.
 */
import type { PieceGroupScoreV2, QuantityComponentV2, QuantityGroupDeviation } from "./types";

/** OD-2: how much of the total a fully-missing group would cost (never reached in practice --
 *  0 pieces is a Completion Gate FAILED -- so the real range is (0, 0.5)). */
export const QUANTITY_SHORTAGE_COEFFICIENT = 0.5;
/** OD-3 / OD-4b: excess cost, capped at +100% of the target (`excessRatio` <= 1). */
export const QUANTITY_EXCESS_COEFFICIENT = 0.15;

function deviationOf(group: PieceGroupScoreV2): QuantityGroupDeviation {
  return {
    ingredientId: group.ingredientId,
    playerCount: group.playerCount,
    targetCount: group.targetCount,
  };
}

/** Pure; reads only already-validated `PieceGroupScoreV2` rows (./piecesComponent.ts has
 *  already rejected malformed Reference data before this is ever called). A group with a
 *  target of 0 has no ideal quantity to fall short of or exceed and is skipped. Ties keep the
 *  first group in Reference order, so the reported group is deterministic. */
export function scoreQuantityComponentV2(groups: readonly PieceGroupScoreV2[]): QuantityComponentV2 {
  let shortageRatio = 0;
  let excessRatio = 0;
  let shortage: QuantityGroupDeviation | null = null;
  let excess: QuantityGroupDeviation | null = null;

  for (const group of groups) {
    const target = group.targetCount;
    const placed = group.playerCount;
    if (!(target > 0)) continue;
    if (placed < target) {
      const ratio = (target - placed) / target;
      if (ratio > shortageRatio) {
        shortageRatio = ratio;
        shortage = deviationOf(group);
      }
    } else if (placed > target) {
      const ratio = Math.min(1, (placed - target) / target);
      if (ratio > excessRatio) {
        excessRatio = ratio;
        excess = deviationOf(group);
      }
    }
  }

  const factor = Math.max(
    0,
    1 - QUANTITY_SHORTAGE_COEFFICIENT * shortageRatio - QUANTITY_EXCESS_COEFFICIENT * excessRatio,
  );

  return { available: true, shortageRatio, excessRatio, shortage, excess, factor };
}
