import type { PizzaState } from "../state/pizzaState";
import type { BakeState } from "./bake";

export type QualityStars = 1 | 2 | 3 | 4 | 5;

const MAX_STARS = 5;

/** Shared ★☆ rendering for any Quality stars value -- used by both the Dex overlay and Pizza
 *  Select (Issue #39) so the two screens can never render stars differently. */
export function starLabel(stars: QualityStars): string {
  return "★".repeat(stars) + "☆".repeat(MAX_STARS - stars);
}

export interface ScoreBreakdown {
  /** Required-ingredient correctness, 0-100 ("Recipe correctness" in the SSOT). */
  matchScore: number;
  /** Penalizes ingredients on the pizza that the recipe didn't ask for, 0-100 ("Purity"). */
  ingredientScore: number;
  /** How thoughtfully toppings were placed, 0-100. */
  placementScore: number;
  /** How close the bake landed to the recipe's target zone, 0-100. */
  bakeScore: number;
  /** Weighted total across all four metrics below, 0-100. */
  total: number;
  stars: QualityStars;
}

/** total (0-100) -> Quality stars, before the perfect-bake cap below is applied. */
const STAR_THRESHOLDS: ReadonlyArray<{ min: number; stars: QualityStars }> = [
  { min: 90, stars: 5 },
  { min: 75, stars: 4 },
  { min: 60, stars: 3 },
  { min: 40, stars: 2 },
  { min: 0, stars: 1 },
];

export function starsFromTotal(total: number): QualityStars {
  const match = STAR_THRESHOLDS.find((t) => total >= t.min);
  return match ? match.stars : 1;
}

/**
 * A pizza that isn't baked to the perfect zone should never read as a flawless ★5 — the
 * visual (raw/burnt), Blue's comment, and the score must stay consistent. This is the single
 * place that rule lives; callers (RESULT UI, Dex, etc.) never need to re-apply it.
 */
export function capStarsForBake(stars: QualityStars, bakeState: BakeState | null): QualityStars {
  if (stars === 5 && bakeState !== null && bakeState !== "perfect") return 4;
  return stars;
}

export function countUsedIngredient(pizza: PizzaState, ingredientId: string): number {
  if (pizza.sauceIds.includes(ingredientId)) return 1;
  return pizza.toppings.filter((t) => t.ingredientId === ingredientId).length;
}

