/**
 * B1: Scoring 2.0 Shadow Bake similarity component -- see the Fresh Audit
 * (docs/reports/TETO_SCORING2_AUTHORITY_Fresh-Audit.md section 9, "B1 -- Bake similarity
 * component for Scoring 2.0") for why this was the last missing invariant before Scoring 2.0
 * Authority could even be considered.
 *
 * Deliberately reuses, rather than invents:
 * - ../bake.ts's `classifyBake` thresholds (`Recipe.bakeTarget.start`/`.end`) as the "what
 *   counts as perfect" semantic truth.
 * - ../scoring.ts legacy `scorePizza`'s own continuous bake formula (distance from the
 *   *nearest edge* of the target zone, normalized by the zone's own center) as the "how quickly
 *   does it degrade" shape -- re-expressed as a 0-1 similarity for architectural consistency
 *   with Sauce/Pieces/Recipe (./sauceComponent.ts, ./piecesComponent.ts,
 *   ./recipeComponent.ts), not a new curve. This already is a symmetric nearest-edge
 *   distance-to-ideal model: `distanceFromNearestEdge` below is 0 inside the zone and grows
 *   identically whether the value is too low (raw) or too high (burnt), so raw and over-baked
 *   pizzas degrade the same way on their respective sides of the ideal, per the Fresh Audit's
 *   own guidance to prefer this shape over inventing a new one.
 *
 * Unlike Sauce/Pieces/Recipe, Bake needs no Reference fixture at all -- `Recipe.bakeTarget` is
 * static per-recipe data already defined for all 7 recipes (../../data/recipes.ts), unlike
 * ../../data/referencePizza.ts's Margherita-only `ReferencePizza` (P0-1/B2 scope). So this
 * component is computed the same way regardless of whether a Reference Pizza exists yet -- see
 * ./index.ts, which calls this unconditionally, ahead of (and independent from) its own
 * Reference-availability gate. This does not itself flip `ScoringV2Result.available` for the 6
 * Reference-less recipes; it only means Bake's own diagnostic numbers are real, not
 * placeholders, everywhere, ahead of B2 landing.
 */
import type { BakeTarget } from "../../data/recipes";
import { classifyBake } from "../bake";
import { isValidBakeTarget } from "./boundary";
import { safeUnit } from "./tolerance";
import type { BakeComponentV2 } from "./types";

const BAKE_TARGET_MALFORMED_REASON =
  "このレシピの焼成目標データ (bakeTarget) が不正なため、Scoring 2.0 の Bake はこの結果を採点できません（フェイルクローズ）。";

/** 0 when `value` falls inside `[start, end]`, else the distance from whichever edge is
 *  nearer -- always >= 0, and (by construction) identical in shape whether `value` undershoots
 *  or overshoots the zone. */
function distanceFromNearestEdge(value: number, start: number, end: number): number {
  if (value < start) return start - value;
  if (value > end) return value - end;
  return 0;
}

/**
 * `bakeResult` is read as `unknown`-ish here (checked with `typeof`/`Number.isFinite`, not
 * trusted from its declared `number | null` type) -- the same defensive posture every other
 * Scoring 2.0 component takes with pizza-derived data, since a malformed `PizzaState` can violate
 * its own TypeScript type at runtime (see ./boundary.ts's file header). A non-finite/absent
 * value reads as "not yet baked", the same as legacy `scorePizza`'s own `bakeResult === null`
 * branch: no credit, never a thrown error or a fabricated in-between score.
 */
export function scoreBakeComponentV2(bakeResult: number | null, bakeTarget: BakeTarget): BakeComponentV2 {
  if (!isValidBakeTarget(bakeTarget)) {
    return { available: false, reason: BAKE_TARGET_MALFORMED_REASON };
  }
  const { start, end } = bakeTarget;

  if (typeof bakeResult !== "number" || !Number.isFinite(bakeResult)) {
    return {
      available: true,
      bakeResult: null,
      bakeState: null,
      distanceFromIdeal: 0,
      similarity: 0,
      score: 0,
    };
  }

  const distance = distanceFromNearestEdge(bakeResult, start, end);
  const center = (start + end) / 2;
  // Mirrors legacy `scorePizza`'s own normalizer exactly (`distance / center`) -- `center` is
  // guaranteed > 0 by `isValidBakeTarget` (both `start`/`end` finite, `end > start`, and every
  // authored `BakeTarget` in ../../data/recipes.ts is positive) for every real recipe, but a
  // hypothetical `start <= -end` custom target is guarded rather than assumed away.
  const similarity = distance === 0 ? 1 : center > 0 ? safeUnit(1 - distance / center) : 0;

  return {
    available: true,
    bakeResult,
    bakeState: classifyBake(bakeResult, bakeTarget),
    distanceFromIdeal: distance,
    similarity,
    score: similarity * 100,
  };
}
