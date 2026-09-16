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
  sanitizeCoordinates,
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
 * Scores one topping group (e.g. every mozzarella piece) against its Reference positions.
 *
 * P1-1: `group.matching`'s tolerance radii are static, authored config
 * (../../data/referencePizza.ts) that should always be a valid band, but this still validates
 * it before calling `scorePieceGroup` (which does not itself validate) rather than trusting a
 * future edit of that data never introduces `zeroCreditRadius <= fullCreditRadius` -- an
 * invalid band here fails closed to a 0 score for this group instead of risking a divide by
 * zero inside `scorePieceGroup`'s own distance-similarity curve.
 *
 * Codex P1 blocker fix: `toppings` and `group` are declared with their real types for callers
 * (autocomplete, compile-time safety), but both are treated as `unknown` internally via
 * ./boundary.ts's sanitizers before any array operation or property read -- a non-array
 * `toppings`, a `group` that isn't an object, a malformed/null element in either, or a
 * non-finite coordinate anywhere are all normalized/dropped rather than thrown on. A NaN/
 * Infinity coordinate reaching `scorePieceGroup`'s own Hungarian assignment
 * (../referenceMatching.ts) doesn't just produce a bad number -- the algorithm's cost-matrix
 * search can fail to terminate on a non-finite cost -- so untrusted points (on *both* the
 * player and the Reference side) are excluded here, before it, entirely.
 *
 * Codex P1 blocker fix, Round 2: this function stays deliberately *lenient* -- it is the
 * crash/hang-safety layer for PLAYER input (`toppings`), never thrown on however malformed
 * `group` is either. It is NOT where authoritative Reference validity is decided: a `group`
 * with a malformed/partially-malformed position list still gets a (safe, filtered, low)
 * score here rather than an `available: false` -- callers that need the strict "a corrupted
 * Reference must invalidate the result, never score a shrunk-down subset" rule use
 * `scorePiecesComponentV2` below instead, which gates on `../boundary.ts`'s strict validators
 * *before* ever calling this function. Direct callers of this function (tests included) get
 * the lenient/defensive behavior on purpose; the strict contract lives one level up.
 */
export function scorePieceGroupV2(
  toppings: readonly PlacedTopping[],
  group: ReferencePieceGroup,
): PieceGroupScoreV2 {
  const groupRecord: Record<string, unknown> =
    typeof group === "object" && group !== null ? (group as unknown as Record<string, unknown>) : {};
  const ingredientId = typeof groupRecord.ingredientId === "string" ? groupRecord.ingredientId : "";
  const safePositions = sanitizeCoordinates(groupRecord.positions);
  const matchingRecord: Record<string, unknown> =
    typeof groupRecord.matching === "object" && groupRecord.matching !== null
      ? (groupRecord.matching as Record<string, unknown>)
      : {};
  const fullCreditRadius =
    typeof matchingRecord.fullCreditRadius === "number" ? matchingRecord.fullCreditRadius : Number.NaN;
  const zeroCreditRadius =
    typeof matchingRecord.zeroCreditRadius === "number" ? matchingRecord.zeroCreditRadius : Number.NaN;

  const safeToppings = sanitizeToppings(toppings);
  const playerCount = safeToppings.filter((t) => t.ingredientId === ingredientId).length;
  const targetCount = safePositions.length;

  if (!isValidToleranceBand(fullCreditRadius, zeroCreditRadius)) {
    return {
      ingredientId,
      targetCount,
      playerCount,
      quantitySimilarity: 0,
      placementSimilarity: null,
      score: 0,
    };
  }

  // `scorePieceGroup` (../referenceMatching.ts) only ever reads `.ingredientId`/`.positions`/
  // `.matching` -- never `.interaction` -- so a group reconstructed from already-sanitized
  // data is safe to hand it wholesale, reusing its reviewed matching logic unchanged rather
  // than re-deriving an equivalent computation here.
  const safeGroup: ReferencePieceGroup = {
    ...group,
    ingredientId: ingredientId as ReferencePieceGroup["ingredientId"],
    positions: safePositions,
    matching: { fullCreditRadius, zeroCreditRadius },
  };
  const metrics = scorePieceGroup(safeToppings as PlacedTopping[], safeGroup);
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

/**
 * Codex P1 blocker fix, Round 2: strictly validates one group's own authoritative Reference
 * data -- its `ingredientId`, its `positions` list (every element, via
 * `validateCoordinateArrayStrict`), and its `matching` tolerance radii -- before
 * `scorePiecesComponentV2` below ever calls the lenient `scorePieceGroupV2` on it. Unlike
 * that function's own internal sanitization (drop-and-continue, meant for player input), this
 * is all-or-nothing: a single malformed position, a non-array `positions`, a missing/malformed
 * `matching`, or an invalid tolerance band all fail the *entire group* closed.
 */
function isGroupReferenceDataValid(group: ReferencePieceGroup): boolean {
  if (typeof group !== "object" || group === null) return false;
  const record = group as unknown as Record<string, unknown>;
  if (typeof record.ingredientId !== "string") return false;
  if (!validateCoordinateArrayStrict(record.positions).valid) return false;
  const matching = record.matching;
  if (typeof matching !== "object" || matching === null) return false;
  const matchingRecord = matching as Record<string, unknown>;
  const { fullCreditRadius, zeroCreditRadius } = matchingRecord;
  if (typeof fullCreditRadius !== "number" || typeof zeroCreditRadius !== "number") return false;
  return isValidToleranceBand(fullCreditRadius, zeroCreditRadius);
}

/**
 * Equal-weighted average across every group (currently mozzarella + basil, 50/50) -- a
 * provisional Phase 4A-2 shadow choice, not a claim that every ingredient type should always
 * weigh the same once this expands past Margherita's two groups.
 *
 * Codex P1 blocker fix, Round 2: `groups` (and every element in it) is the authoritative
 * Reference container this component scores against, so it is validated *strictly* here --
 * a non-array `groups`, or any single group anywhere in it that fails
 * `isGroupReferenceDataValid` above (a malformed position list, missing/invalid tolerance
 * radii, ...), fails the whole component closed (`available: false`) *before* any scoring
 * happens, rather than silently scoring the player's pizza against whatever positions
 * happened to survive filtering (which could turn a genuinely wrong pizza into an
 * accidental, meaningless 100 -- see ./boundary.ts's own doc comment on why a filtered-down
 * Reference is unsafe). A `groups` that is a genuinely well-formed empty array is still
 * valid: "this recipe requires no piece groups" is a real fact a recipe can express, so
 * `scoredGroups.length === 0` after a *valid* (possibly empty) `groups` still reads as full
 * marks, exactly as before.
 */
export function scorePiecesComponentV2(
  toppings: readonly PlacedTopping[],
  groups: readonly ReferencePieceGroup[],
): PiecesComponentV2 | ScoringV2Unavailable {
  if (!Array.isArray(groups)) {
    return { available: false, reason: MALFORMED_REFERENCE_REASON };
  }
  for (const group of groups) {
    if (!isGroupReferenceDataValid(group)) {
      return { available: false, reason: MALFORMED_REFERENCE_REASON };
    }
  }

  const scoredGroups = groups.map((group) => scorePieceGroupV2(toppings, group));
  const score =
    scoredGroups.length === 0
      ? 100 // No piece groups at all for this recipe -- nothing to fall short on.
      : scoredGroups.reduce((sum, g) => sum + g.score, 0) / scoredGroups.length;
  return { available: true, groups: scoredGroups, score: safeUnit(score / 100) * 100 };
}
