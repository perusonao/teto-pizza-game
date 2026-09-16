/**
 * Phase 4A-2: Scoring 2.0 Shadow Pieces component -- mozzarella/basil placement, reusing
 * ../referenceMatching.ts's `scorePieceGroup` (Hungarian-assignment, permutation-invariant
 * matching against the Reference's own positions) wholesale rather than re-deriving an
 * equivalent placement algorithm.
 *
 * P0-1: only ever called when a Reference Pizza exists for the recipe (../../data/
 * referencePizza.ts's `getReferencePizza`) -- see ./index.ts, which is the only caller.
 */
import type { ReferencePieceGroup } from "../../data/referencePizza";
import { scorePieceGroup } from "../referenceMatching";
import type { PlacedTopping } from "../../state/pizzaState";
import { isValidToleranceBand, safeUnit } from "./tolerance";
import type { PieceGroupScoreV2, PiecesComponentV2 } from "./types";

/** Sub-weights within one piece group's own score, sum to 100. Placement is weighted above
 *  raw count: getting *close to* three well-placed mozzarella pieces should read as a much
 *  better pizza than dropping three anywhere at all, matching the SSOT's "recreate it
 *  physically" goal over a pure ingredient-counting one (the count-only side of that is
 *  already ../scoring.ts's `matchScore`, which this Shadow component is deliberately not a
 *  duplicate of). */
const QUANTITY_WEIGHT = 30;
const PLACEMENT_WEIGHT = 70;

/**
 * Scores one topping group (e.g. every mozzarella piece) against its Reference positions.
 * P1-1: `group.matching`'s tolerance radii are static, authored config
 * (../../data/referencePizza.ts) that should always be a valid band, but this still validates
 * it before calling `scorePieceGroup` (which does not itself validate) rather than trusting a
 * future edit of that data never introduces `zeroCreditRadius <= fullCreditRadius` -- an
 * invalid band here fails closed to a 0 score for this group instead of risking a divide by
 * zero inside `scorePieceGroup`'s own distance-similarity curve.
 */
function isFinitePoint(point: { x: number; y: number }): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function scorePieceGroupV2(
  toppings: readonly PlacedTopping[],
  group: ReferencePieceGroup,
): PieceGroupScoreV2 {
  // Defense-in-depth: PLACE_TOPPING (../../state/gameReducer.ts) already rejects a non-finite
  // x/y before it ever reaches canonical state, but ./index.ts's own P1 contract ("Infinity
  // cannot escape the public scoring API") must hold even if this is ever called with data
  // that didn't come through that reducer. A NaN/Infinity coordinate reaching
  // `scorePieceGroup`'s own Hungarian assignment (../referenceMatching.ts) doesn't just
  // produce a bad number -- the algorithm's cost-matrix search can fail to terminate on a
  // non-finite cost, so an untrusted point is excluded here, before it, entirely (treated as
  // "not really placed"), rather than "sanitized" into some finite substitute value.
  const safeToppings = toppings.filter((t) => isFinitePoint(t));
  const playerCount = safeToppings.filter((t) => t.ingredientId === group.ingredientId).length;
  const targetCount = group.positions.length;

  if (!isValidToleranceBand(group.matching.fullCreditRadius, group.matching.zeroCreditRadius)) {
    return {
      ingredientId: group.ingredientId,
      targetCount,
      playerCount,
      quantitySimilarity: 0,
      placementSimilarity: null,
      score: 0,
    };
  }

  const metrics = scorePieceGroup(safeToppings, group);
  const quantitySimilarity = safeUnit(metrics.quantitySimilarity);
  const placementSimilarity =
    metrics.placementSimilarity === null ? null : safeUnit(metrics.placementSimilarity);
  const score =
    quantitySimilarity * QUANTITY_WEIGHT + (placementSimilarity ?? 0) * PLACEMENT_WEIGHT;

  return {
    ingredientId: metrics.ingredientId,
    targetCount: metrics.targetCount,
    playerCount: metrics.playerCount,
    quantitySimilarity,
    placementSimilarity,
    score: safeUnit(score / 100) * 100,
  };
}

/** Equal-weighted average across every group (currently mozzarella + basil, 50/50) -- a
 *  provisional Phase 4A-2 shadow choice, not a claim that every ingredient type should always
 *  weigh the same once this expands past Margherita's two groups. */
export function scorePiecesComponentV2(
  toppings: readonly PlacedTopping[],
  groups: readonly ReferencePieceGroup[],
): PiecesComponentV2 {
  const scoredGroups = groups.map((group) => scorePieceGroupV2(toppings, group));
  const score =
    scoredGroups.length === 0
      ? 100 // No piece groups at all for this recipe -- nothing to fall short on.
      : scoredGroups.reduce((sum, g) => sum + g.score, 0) / scoredGroups.length;
  return { available: true, groups: scoredGroups, score: safeUnit(score / 100) * 100 };
}
