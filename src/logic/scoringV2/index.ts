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
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { computeSauceMetrics } from "../sauceField";
import { scoreBakeComponentV2 } from "./bakeComponent";
import { sanitizeSauceDeposits } from "./boundary";
import { scoreSauceComponentV2 } from "./sauceComponent";
import { scorePiecesComponentV2 } from "./piecesComponent";
import { scoreRecipeComponentV2 } from "./recipeComponent";
import { safeUnit } from "./tolerance";
import type { ScoringV2Result } from "./types";

export const SCORING_V2_RULESET_VERSION = "phase-4a-2-shadow-3";

const REFERENCE_UNAVAILABLE_REASON =
  "この料理はまだ Reference Pizza（お手本データ）がありません。Phase 4A-2時点ではマルゲリータのみ対応しています。";

/**
 * B1 weight split (see docs/reports/TETO_SCORING2-B1_BAKE_Result.md's "Bake formula / weight
 * decision" for the full reasoning this comment summarizes): adding a real Bake weight is a
 * genuine calibration decision, so rather than inventing four fresh numbers, this keeps the
 * *existing*, already-iPhone-calibrated Sauce:Pieces:Recipe ratio (65:20:15) completely
 * unchanged and only rescales it down to make room for Bake -- 65/20/15 each multiplied by 0.8
 * gives 52/16/12 (same ratio to each other, verified: 52/16 = 65/20 = 3.25, 52/12 = 65/15 =
 * 4.333, 16/12 = 20/15 = 1.333). Bake itself takes the freed 20 points: the smaller of
 * the two anchors this task named (legacy's own Bake weight is 30/100, its single heaviest --
 * the Fresh Audit's cited historical conceptual direction is Recipe15/Sauce35/Pieces30/Bake20),
 * chosen deliberately conservative since this new formula has no iPhone Human-Feel evidence of
 * its own yet, unlike the Sauce/Pieces/Recipe ratio it's being weighed against. All four sum to
 * 100. Ruleset version bumped (-shadow-2 -> -shadow-3) so a stored/logged Shadow result can
 * never be misread against the pre-Bake formula. */
const SAUCE_WEIGHT = 52;
const PIECES_WEIGHT = 16;
const RECIPE_WEIGHT = 12;
const BAKE_WEIGHT = 20;

export function computeScoringV2Shadow(recipe: Recipe, pizza: PizzaState): ScoringV2Result {
  // Codex P1 blocker fix: `pizza` itself (not just its fields) is a public-API argument that
  // can violate its own TypeScript type at runtime -- a `null`/`undefined`/non-object value
  // here would throw on the very first `pizza.sauceDeposits` read below. Falls back to a
  // genuinely empty pizza rather than special-casing "no pizza" as its own result shape, so
  // every downstream component still sees one consistent, always-valid `PizzaState`.
  const safePizza: PizzaState = typeof pizza === "object" && pizza !== null ? pizza : createEmptyPizza();
  // B1: computed unconditionally, ahead of the Reference-availability gate below -- Bake needs
  // no Reference fixture (see ./bakeComponent.ts's file header), so it is real for all 7
  // recipes from this PR onward, even though `reference`-gated Sauce/Pieces/Recipe (and
  // therefore the whole result's `available`/`totalScore`) still are not, pending B2.
  const bake = scoreBakeComponentV2(safePizza.bakeResult, recipe.bakeTarget);
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
  //
  // Codex P1 blocker fix: sanitized via ./boundary.ts's `sanitizeSauceDeposits` before ever
  // reaching `computeSauceMetrics` (../sauceField.ts, legacy Phase 4A-1A code this PR does not
  // modify) -- that primitive assumes a well-formed array and does not itself validate, so a
  // malformed `sauceDeposits` (non-array, or containing null/malformed/non-finite elements)
  // is normalized to a clean subset here, at the Scoring 2.0 boundary, instead.
  const safeSauceDeposits = sanitizeSauceDeposits(safePizza.sauceDeposits);
  const sauceMetrics = computeSauceMetrics(safeSauceDeposits);
  const sauce = scoreSauceComponentV2(sauceMetrics, reference.sauce);
  const pieces = scorePiecesComponentV2(safePizza.toppings, reference.pieceGroups);
  const recipeComponent = scoreRecipeComponentV2(recipe, safePizza);

  // Codex P1 blocker fix, Round 2: `pieces`/`recipeComponent` can now themselves be
  // `{ available: false }` -- ./piecesComponent.ts's and ./recipeComponent.ts's own strict
  // validation of their authoritative Reference/requirement data rejected it outright, rather
  // than scoring against a filtered-down subset. A `totalScore` partially built from an
  // unavailable component would be exactly the "normal-looking score built on corrupted
  // Reference data" the blocker exists to prevent, so the whole result fails closed here too
  // -- same shape as the P0-1 "no Reference fixture at all" branch above, just triggered by
  // "a Reference fixture exists, but its own data failed strict validation" instead.
  if (!pieces.available) {
    return {
      rulesetVersion: SCORING_V2_RULESET_VERSION,
      recipeId: recipe.id,
      available: false,
      unavailableReason: pieces.reason,
      totalScore: null,
      components: { sauce, pieces, recipe: recipeComponent, bake },
    };
  }
  if (!recipeComponent.available) {
    return {
      rulesetVersion: SCORING_V2_RULESET_VERSION,
      recipeId: recipe.id,
      available: false,
      unavailableReason: recipeComponent.reason,
      totalScore: null,
      components: { sauce, pieces, recipe: recipeComponent, bake },
    };
  }
  // B1: `bake` can only be unavailable here if `recipe.bakeTarget` itself is malformed (see
  // ./bakeComponent.ts) -- never happens for real authored recipes, but the same fail-closed
  // discipline as the two branches above applies: a `totalScore` cannot be built from a
  // malformed weighted input.
  if (!bake.available) {
    return {
      rulesetVersion: SCORING_V2_RULESET_VERSION,
      recipeId: recipe.id,
      available: false,
      unavailableReason: bake.reason,
      totalScore: null,
      components: { sauce, pieces, recipe: recipeComponent, bake },
    };
  }

  const totalScore =
    safeUnit(
      (sauce.score * SAUCE_WEIGHT +
        pieces.score * PIECES_WEIGHT +
        recipeComponent.score * RECIPE_WEIGHT +
        bake.score * BAKE_WEIGHT) /
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
  BakeComponentV2Available,
} from "./types";
