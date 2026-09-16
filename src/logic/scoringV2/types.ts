/**
 * Phase 4A-2: Scoring 2.0 Shadow public types.
 *
 * SHADOW ONLY -- nothing in this module (or anywhere under ./logic/scoringV2/) feeds
 * ../scoring.ts's `ScoreBreakdown`, Dex BEST/★, Mission scoring, Pitz, or the persisted save
 * (see src/state/persistence.ts, which never serializes GameState). See
 * docs/reports/TETO_PHASE-4A-2_SCORING-2_Shadow_Result.md for the architecture this
 * implements and why.
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

export interface PieceGroupScoreV2 {
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
  /** 0-100. */
  score: number;
}

/** Always unavailable in this phase -- see ./index.ts's BAKE_UNAVAILABLE_REASON and the
 *  Fresh Audit's Bake scope guard (no reviewed Scoring 2.0 Bake similarity primitive exists
 *  yet; this PR does not add one). Legacy Bake scoring (../scoring.ts, ../bake.ts) is
 *  untouched. */
export type BakeComponentV2 = ScoringV2Unavailable;

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
