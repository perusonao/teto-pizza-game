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
import {
  MALFORMED_REFERENCE_REASON,
  sanitizeToppings,
  validateCoordinateArrayStrict,
} from "./boundary";
import { isValidToleranceBand, safeUnit } from "./tolerance";
import type { PieceGroupScoreV2, PiecesComponentV2, ScoringV2Unavailable } from "./types";

/** Sub-weights within one piece group's own score, sum to 100. Placement is weighted above
 *  raw count: getting *close to* three well-placed mozzarella pieces should read as a much
 *  better pizza than dropping three anywhere at all, matching the SSOT's "recreate it
 *  physically" goal over a pure ingredient-counting one (the count-only side of that is
 *  already ../scoring.ts's `matchScore`, which this Shadow component is deliberately not a
 *  duplicate of). */
const QUANTITY_WEIGHT = 30;
const PLACEMENT_WEIGHT = 70;

/**
 * Placement remains fully influential at or below the authoritative target count. Above the
 * target, the existing quantity similarity also gates placement so a best-matching subset of
 * many extra pieces cannot retain disproportionate placement credit.
 */
function overQuantityPlacementGate(
  playerCount: number,
  targetCount: number,
  quantitySimilarity: number,
): number {
  return playerCount <= targetCount ? 1 : quantitySimilarity;
}

/**
 * Scores one topping group (e.g. every mozzarella piece) against its Reference positions.
 *
 * Codex P1 blocker fix, Round 3: this is now THE single enforcement point for the strict
 * "malformed authoritative Reference data must invalidate the result, never score a
 * filtered-down subset" rule. Round 2 put this check only in `scorePiecesComponentV2` below,
 * which left this function itself reachable as a direct, unguarded bypass -- Codex's narrow
 * verification reproduced it: a direct call with one malformed Reference position mixed into
 * otherwise-valid ones still filtered it out and returned a normal, even 100, score. The
 * fix: validate `group`'s own authoritative data (its `ingredientId`, its `positions` list
 * via `validateCoordinateArrayStrict` -- one malformed position anywhere invalidates the
 * *whole* list, not just that position -- and its `matching` tolerance radii) FIRST, before
 * any filtering or Hungarian matching, and return `{ available: false, reason }` instead of a
 * `PieceGroupScoreV2` the moment any of it fails. There is now exactly one place this
 * validation happens; `scorePiecesComponentV2` below no longer duplicates it -- it simply
 * calls this function per group and checks each result's own `available` field, so no caller
 * can route around the rule by calling this function directly instead of the aggregate one.
 *
 * PLAYER input (`toppings`) stays deliberately lenient, unchanged from Round 1/2: a non-array
 * `toppings`, or a malformed/null/non-finite element within it, is normalized/dropped via
 * `sanitizeToppings` (never thrown on) -- a malformed *player* piece genuinely means "the
 * player didn't place a real piece here", a different question entirely from "is the
 * Reference target itself trustworthy", which is what this function's own strict gate above
 * decides for the *other* argument.
 */
export function scorePieceGroupV2(
  toppings: readonly PlacedTopping[],
  group: ReferencePieceGroup,
): PieceGroupScoreV2 | ScoringV2Unavailable {
  if (typeof group !== "object" || group === null) {
    return { available: false, reason: MALFORMED_REFERENCE_REASON };
  }
  const record = group as unknown as Record<string, unknown>;
  if (typeof record.ingredientId !== "string") {
    return { available: false, reason: MALFORMED_REFERENCE_REASON };
  }
  const positionsValidation = validateCoordinateArrayStrict(record.positions);
  if (!positionsValidation.valid) {
    return { available: false, reason: MALFORMED_REFERENCE_REASON };
  }
  if (typeof record.matching !== "object" || record.matching === null) {
    return { available: false, reason: MALFORMED_REFERENCE_REASON };
  }
  const matchingRecord = record.matching as Record<string, unknown>;
  const { fullCreditRadius, zeroCreditRadius } = matchingRecord;
  if (
    typeof fullCreditRadius !== "number" ||
    typeof zeroCreditRadius !== "number" ||
    !isValidToleranceBand(fullCreditRadius, zeroCreditRadius)
  ) {
    return { available: false, reason: MALFORMED_REFERENCE_REASON };
  }

  // Every value used below is now known-valid by the checks above -- no further defensive
  // fallback is needed or wanted here, since reaching this point is itself the proof.
  const ingredientId = record.ingredientId;
  const positions = positionsValidation.items;

  const safeToppings = sanitizeToppings(toppings);

  // `scorePieceGroup` (../referenceMatching.ts) only ever reads `.ingredientId`/`.positions`/
  // `.matching` -- never `.interaction` -- so a group reconstructed from already-validated
  // data is safe to hand it wholesale, reusing its reviewed matching logic unchanged rather
  // than re-deriving an equivalent computation here.
  const validatedGroup: ReferencePieceGroup = {
    ...group,
    ingredientId: ingredientId as ReferencePieceGroup["ingredientId"],
    positions,
    matching: { fullCreditRadius, zeroCreditRadius },
  };
  const metrics = scorePieceGroup(safeToppings as PlacedTopping[], validatedGroup);
  const quantitySimilarity = safeUnit(metrics.quantitySimilarity);
  const placementSimilarity =
    metrics.placementSimilarity === null ? null : safeUnit(metrics.placementSimilarity);
  const placementGate = overQuantityPlacementGate(
    metrics.playerCount,
    metrics.targetCount,
    quantitySimilarity,
  );
  const score =
    quantitySimilarity * QUANTITY_WEIGHT +
    (placementSimilarity ?? 0) * PLACEMENT_WEIGHT * placementGate;

  return {
    available: true,
    ingredientId: metrics.ingredientId,
    targetCount: metrics.targetCount,
    playerCount: metrics.playerCount,
    quantitySimilarity,
    placementSimilarity,
    score: safeUnit(score / 100) * 100,
  };
}

/**
 * Equal-weighted average across every group (currently mozzarella + basil, 50/50) -- a
 * provisional Phase 4A-2 shadow choice, not a claim that every ingredient type should always
 * weigh the same once this expands past Margherita's two groups.
 *
 * Codex P1 blocker fix, Round 3: `groups` (the container) is still validated here -- a
 * non-array `groups` fails the whole component closed before anything else, since that is a
 * container-level concern `scorePieceGroupV2` (which scores one already-selected group) never
 * sees. Per-group Reference validity, though, is no longer re-checked here -- it is enforced
 * exactly once, inside `scorePieceGroupV2` above, and this function simply asks each group's
 * own result whether it succeeded (`available`). If any group comes back unavailable, the
 * whole component fails closed too, for the same reason Round 2 established: a total built
 * from a mix of trustworthy and corrupted groups is not honestly computable. A `groups` that
 * is a genuinely well-formed empty array is still valid: "this recipe requires no piece
 * groups" is a real fact a recipe can express, so `scoredGroups.length === 0` after a *valid*
 * (possibly empty) `groups` still reads as full marks, exactly as before.
 */
export function scorePiecesComponentV2(
  toppings: readonly PlacedTopping[],
  groups: readonly ReferencePieceGroup[],
): PiecesComponentV2 | ScoringV2Unavailable {
  if (!Array.isArray(groups)) {
    return { available: false, reason: MALFORMED_REFERENCE_REASON };
  }

  const scoredGroups: PieceGroupScoreV2[] = [];
  for (const group of groups) {
    const result = scorePieceGroupV2(toppings, group);
    if (!result.available) {
      return { available: false, reason: result.reason };
    }
    scoredGroups.push(result);
  }

  const score =
    scoredGroups.length === 0
      ? 100 // No piece groups at all for this recipe -- nothing to fall short on.
      : scoredGroups.reduce((sum, g) => sum + g.score, 0) / scoredGroups.length;
  return { available: true, groups: scoredGroups, score: safeUnit(score / 100) * 100 };
}
