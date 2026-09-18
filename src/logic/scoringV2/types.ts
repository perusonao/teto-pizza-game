/**
 * Phase 4A-2 / A1: Scoring 2.0 public types.
 *
 * Authoritative -- `computeScoringV2`'s result (this module's `ScoringV2Result`) is converted
 * by `toLegacyScoreBreakdown` (./toLegacyScoreBreakdown.ts) into the legacy `ScoreBreakdown`
 * shape that `state.score` is built from at CONFIRM_BAKE, so it does feed `ScoreBreakdown`,
 * Dex BEST/★, Mission scoring and progression (see src/state/gameReducer.ts). It is still never
 * itself persisted (see src/state/persistence.ts, which never serializes GameState). See
 * docs/reports/TETO_PHASE-4A-2_SCORING-2_Shadow_Result.md for the original architecture this
 * implements, and docs/reports/TETO_SCORING2-A1_AUTHORITY_Result.md for the authority cutover.
 *
 * P0-1 (Reference availability): only Margherita has an authoritative Reference fixture
 * (../../data/referencePizza.ts's `getReferencePizza`). Every Reference-dependent component
 * (Sauce, Pieces) is `{ available: false, reason }` -- never a fabricated number -- for every
 * other recipe, and the whole `ScoringV2Result` follows suit (`available: false,
 * totalScore: null`). Recipe correctness *could* be computed without a Reference fixture, but
 * this phase keeps the whole result's availability gated on Reference presence for one
 * unambiguous "Reference unavailable" state (see ./index.ts's own comment) rather than a
 * partial reveal -- a later phase can split that out once there's a reason to.
 */
import type { BakeState } from "../bake";

/** A component that has nothing meaningful to report (no Reference fixture for this recipe,
 *  or -- for Bake -- no reviewed Scoring 2.0 primitive yet). Never a stand-in zero score. */
export interface ScoringV2Unavailable {
  available: false;
  reason: string;
}

export interface SauceComponentV2 {
  available: true;
  /** 0-1, tolerant continuous similarity between the player's sauce quantity and the
   *  Reference's target quantity (both normalized, see ../sauceField.ts). */
  quantitySimilarity: number;
  /** 0-1, same shape as `quantitySimilarity` but for coverage. */
  coverageSimilarity: number;
  /** 0-1, self-normalized (see ../sauceField.ts's `computeEvenness`) -- no Reference needed,
   *  gated to 0 when essentially no sauce was applied (see ./sauceComponent.ts). */
  evennessScore: number;
  /** 0-1, absolute threshold on `SauceMetrics.edgeRatio` (../sauceEvaluation.ts's
   *  EDGE_GREAT/EDGE_POOR) -- no Reference needed, same presence gate as evenness. */
  edgeScore: number;
  /** 0-100 weighted combination of the four similarities above. */
  score: number;
}

/** `scorePieceGroupV2` (../piecesComponent.ts) returns this OR `ScoringV2Unavailable` -- the
 *  strict Reference-validity gate lives on that function itself (Codex P1 Round 3), so a
 *  `PieceGroupScoreV2` is only ever produced once the group's own authoritative Reference
 *  data (`ingredientId`/`positions`/`matching`) has already passed strict validation.
 *  `PiecesComponentV2.groups` below only ever holds this branch -- if any single group comes
 *  back unavailable, the whole `PiecesComponentV2` does too (never a mix of the two). */
export interface PieceGroupScoreV2 {
  available: true;
  ingredientId: string;
  targetCount: number;
  playerCount: number;
  /** 0-1, how close the placed count is to the Reference's target count. */
  quantitySimilarity: number;
  /** 0-1 permutation-invariant placement similarity (Hungarian-matched against the
   *  Reference's own positions, ../referenceMatching.ts), or null when there is nothing to
   *  match (no pieces placed at all). */
  placementSimilarity: number | null;
  /** 0-100 weighted combination of the two similarities above. */
  score: number;
}

export interface PiecesComponentV2 {
  available: true;
  groups: readonly PieceGroupScoreV2[];
  /** 0-100, equal-weighted average across `groups`. */
  score: number;
}

export interface RecipeComponentV2 {
  available: true;
  /** How many required ingredient *types* (not counts -- see ./recipeComponent.ts) are used
   *  on the pizza at all. */
  requiredTypesPresent: number;
  requiredTypesTotal: number;
  /** Issue #32 purity: total distinct ingredient types used on the pizza at all (required or
   *  not) -- the denominator `extraTypesCount` is diluted by, mirroring ../scoring.ts's legacy
   *  `ingredientScore`'s own shape. 0 for a genuinely empty pizza. */
  usedTypesTotal: number;
  /** Issue #32 purity: how many of `usedTypesTotal` are ingredient types this recipe never
   *  required at all (an unspecified/wrong-substitution ingredient). Duplicate placements of
   *  the same extra type still count once -- quantity is never this component's concern. */
  extraTypesCount: number;
  /** Issue #32 purity: 0-1 multiplier applied to the presence score above, 1 when
   *  `extraTypesCount` is 0 (unchanged from pre-Issue-#32 behavior). */
  purityMultiplier: number;
  /** 0-100 = (requiredTypesPresent / requiredTypesTotal) * 100 * purityMultiplier. */
  score: number;
}

/**
 * B1 (Bake similarity component): closeness of the confirmed bake gauge value to the recipe's
 * own target zone (`Recipe.bakeTarget`). Unlike Sauce/Pieces/Recipe, this needs no Reference
 * fixture -- `bakeTarget` is static per-recipe data already defined for all 7 recipes -- so it
 * is computed the same way whether or not a Reference Pizza exists for this recipe. It does not
 * by itself flip `ScoringV2Result.available` (P0-1's Reference gate on Sauce/Pieces/Recipe is
 * untouched); see ./bakeComponent.ts for the formula (reuses ../bake.ts's `classifyBake`
 * thresholds and ../scoring.ts legacy `scorePizza`'s own distance-from-nearest-edge shape).
 */
export interface BakeComponentV2Available {
  available: true;
  /** The confirmed bake gauge value this was scored against, or null when the pizza has not
   *  been baked yet. */
  bakeResult: number | null;
  /** ../bake.ts's `classifyBake` categorical state for `bakeResult`, or null when not yet
   *  baked. */
  bakeState: BakeState | null;
  /** 0 when `bakeResult` falls inside the recipe's target zone, else the distance (same units
   *  as `bakeResult`/`BakeTarget`) from the nearest edge of that zone. 0 when not yet baked
   *  does not by itself mean "perfect" -- see `bakeResult`/`bakeState`. */
  distanceFromIdeal: number;
  /** 0-1 continuous similarity -- 1 inside the target zone, degrading symmetrically as
   *  `bakeResult` moves away from either edge (raw below, burnt above), 0 when not yet baked. */
  similarity: number;
  /** 0-100 = similarity * 100. */
  score: number;
}

/** Unavailable only when `Recipe.bakeTarget` itself is malformed (see
 *  ./boundary.ts's `isValidBakeTarget`) -- in real gameplay this never happens, since
 *  `bakeTarget` is static authored recipe config, but the public function stays fail-closed for
 *  the same reason every other component here is. */
export type BakeComponentV2 = BakeComponentV2Available | ScoringV2Unavailable;

export interface ScoringV2Components {
  sauce: SauceComponentV2 | ScoringV2Unavailable;
  pieces: PiecesComponentV2 | ScoringV2Unavailable;
  recipe: RecipeComponentV2 | ScoringV2Unavailable;
  bake: BakeComponentV2;
}

export interface ScoringV2Result {
  /** Bumped whenever the formula/weights below change, so a stored/logged result can never be
   *  silently misread against a different ruleset. */
  rulesetVersion: string;
  recipeId: string;
  /** False whenever this recipe has no Reference fixture (P0-1) -- `totalScore` and every
   *  Reference-dependent component are null/unavailable in that case, never fabricated. */
  available: boolean;
  unavailableReason: string | null;
  /** 0-100, or null when `available` is false. Always finite when non-null (../scoringV2's
   *  own tolerance/clamping guarantees -- see ./tolerance.ts). */
  totalScore: number | null;
  components: ScoringV2Components;
}
