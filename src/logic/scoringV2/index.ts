/**
 * Phase 4A-2: Scoring 2.0 Shadow -- the single entry point (`computeScoringV2Shadow`) every
 * caller uses. SHADOW ONLY: see ./types.ts's file header for the full non-negotiable list of
 * what this must never touch (legacy `ScoreBreakdown`, Dex BEST/★, Mission scoring, Pitz,
 * save schema).
 *
 * P0-2 (Canonical bake-time computation): the one caller of this function is
 * src/state/gameReducer.ts's CONFIRM_BAKE case, which calls it with the exact `PizzaState`
 * that was just baked (`state.pizza` plus the confirmed `bakeResult`) and `state.recipe` --
 * never App.tsx's UI-only live-preview `useMemo` (`sauceMetrics`/`sauceShadowScore`/
 * `pieceShadowMetrics`), which reads uncommitted `pendingSauceDeposits` and is gated off
 * during Mission play. This file has no opinion on *when* it's called; gameReducer.ts is what
 * makes that true for both FREE and Lunch Rush, since both dispatch the exact same
 * CONFIRM_BAKE action.
 */
import { getReferencePizza } from "../../data/referencePizza";
import type { Recipe } from "../../data/recipes";
import type { PizzaState } from "../../state/pizzaState";
import { computeSauceMetrics } from "../sauceField";
import { scoreSauceComponentV2 } from "./sauceComponent";
import { scorePiecesComponentV2 } from "./piecesComponent";
import { scoreRecipeComponentV2 } from "./recipeComponent";
import { safeUnit } from "./tolerance";
import type { ScoringV2Result } from "./types";

export const SCORING_V2_RULESET_VERSION = "phase-4a-2-shadow-1";

const REFERENCE_UNAVAILABLE_REASON =
  "この料理はまだ Reference Pizza（お手本データ）がありません。Phase 4A-2時点ではマルゲリータのみ対応しています。";

/**
 * Bake scope guard: no reviewed Scoring 2.0 Bake similarity primitive exists yet (only
 * ../bake.ts's categorical raw/perfect/burnt `classifyBake`, and ../scoring.ts's own inline
 * continuous formula, which is legacy `ScoreBreakdown` plumbing this PR does not repurpose --
 * see the Fresh Audit's explicit Bake scope guard: "do NOT broaden this PR into a large Bake
 * redesign"). Always unavailable this phase, for every recipe, Reference or not.
 */
const BAKE_UNAVAILABLE_REASON =
  "Scoring 2.0 用の Bake 類似度プリミティブは未レビューのため、このフェーズでは未提供です（暫定）。";

/** Weights across the three available components for `totalScore`, sum to 100. Mirrors the
 *  Fresh Audit's Margherita-only 65/20/15 calibration split (Sauce/Pieces/Recipe) -- per the
 *  SCORING ARCHITECTURE brief, this is explicitly *not* meant to be read as the permanent
 *  four-category (Recipe/Sauce/Pieces/Bake) global weighting once a reviewed Bake primitive
 *  exists; it is this phase's shadow-only calibration for the components that exist today. */
const SAUCE_WEIGHT = 65;
const PIECES_WEIGHT = 20;
const RECIPE_WEIGHT = 15;

export function computeScoringV2Shadow(recipe: Recipe, pizza: PizzaState): ScoringV2Result {
  const bake = { available: false as const, reason: BAKE_UNAVAILABLE_REASON };
  const reference = getReferencePizza(recipe.id);

  if (!reference) {
    return {
      rulesetVersion: SCORING_V2_RULESET_VERSION,
      recipeId: recipe.id,
      available: false,
      unavailableReason: REFERENCE_UNAVAILABLE_REASON,
      totalScore: null,
      components: {
        sauce: { available: false, reason: REFERENCE_UNAVAILABLE_REASON },
        pieces: { available: false, reason: REFERENCE_UNAVAILABLE_REASON },
        recipe: { available: false, reason: REFERENCE_UNAVAILABLE_REASON },
        bake,
      },
    };
  }

  // P0-2: `pizza.sauceDeposits` is the canonical authoritative deposit log -- populated by
  // COMMIT_SAUCE_DISPENSE for both PAINT and PAINT_TEMPORARY sauce profiles alike (see
  // ../../data/recipeSauceProfiles.ts; both interaction kinds go through the exact same
  // dispense/commit path in PizzaStage.tsx -- pinned by scoringV2.test.ts's PAINT_TEMPORARY
  // scoreable test).
  const sauceMetrics = computeSauceMetrics(pizza.sauceDeposits);
  const sauce = scoreSauceComponentV2(sauceMetrics, reference.sauce);
  const pieces = scorePiecesComponentV2(pizza.toppings, reference.pieceGroups);
  const recipeComponent = scoreRecipeComponentV2(recipe, pizza);

  const totalScore =
    safeUnit(
      (sauce.score * SAUCE_WEIGHT + pieces.score * PIECES_WEIGHT + recipeComponent.score * RECIPE_WEIGHT) /
        100 /
        100,
    ) * 100;

  return {
    rulesetVersion: SCORING_V2_RULESET_VERSION,
    recipeId: recipe.id,
    available: true,
    unavailableReason: null,
    totalScore,
    components: { sauce, pieces, recipe: recipeComponent, bake },
  };
}

export type {
  ScoringV2Result,
  ScoringV2Components,
  ScoringV2Unavailable,
  SauceComponentV2,
  PiecesComponentV2,
  PieceGroupScoreV2,
  RecipeComponentV2,
  BakeComponentV2,
} from "./types";
