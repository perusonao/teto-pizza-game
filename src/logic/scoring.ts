import type { Recipe } from "../data/recipes";
import type { PizzaState } from "../state/pizzaState";
import { classifyBake, type BakeState } from "./bake";
import { scorePlacement } from "./placement";

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
  /** How thoughtfully toppings were placed, 0-100 (see logic/placement.ts). */
  placementScore: number;
  /** How close the bake landed to the recipe's target zone, 0-100. */
  bakeScore: number;
  /** Weighted total across all four metrics below, 0-100. */
  total: number;
  stars: QualityStars;
}

/**
 * Weight each 0-100 metric contributes to `total` (must sum to 100). Per
 * docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 4 / Phase 3C-1 scope:
 * Recipe correctness 35 + Purity 15 + Placement 20 + Bake 30 = 100.
 */
const WEIGHT_MATCH = 35;
const WEIGHT_INGREDIENT = 15;
const WEIGHT_PLACEMENT = 20;
const WEIGHT_BAKE = 30;

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

function usedIngredientIds(pizza: PizzaState): string[] {
  const ids = new Set<string>(pizza.sauceIds);
  for (const t of pizza.toppings) ids.add(t.ingredientId);
  return Array.from(ids);
}

export function scorePizza(recipe: Recipe, pizza: PizzaState): ScoreBreakdown {
  const required = recipe.requiredIngredients;
  const satisfiedCount = required.filter(
    (req) => countUsedIngredient(pizza, req.ingredientId) >= req.minCount,
  ).length;
  const matchScore = required.length === 0 ? 100 : (satisfiedCount / required.length) * 100;

  const used = usedIngredientIds(pizza);
  const requiredIds = new Set(required.map((r) => r.ingredientId));
  const extraCount = used.filter((id) => !requiredIds.has(id)).length;
  const ingredientScore =
    used.length === 0 ? 0 : Math.max(0, 100 - (extraCount / used.length) * 100);

  const placementScore = scorePlacement(pizza.toppings);

  let bakeScore = 0;
  if (pizza.bakeResult !== null) {
    const { start, end } = recipe.bakeTarget;
    if (pizza.bakeResult >= start && pizza.bakeResult <= end) {
      bakeScore = 100;
    } else {
      const center = (start + end) / 2;
      const halfRange = (end - start) / 2 || 1;
      const distance = Math.abs(pizza.bakeResult - center) - halfRange;
      bakeScore = Math.max(0, 100 - (distance / center) * 100);
    }
  }

  const total =
    (matchScore * WEIGHT_MATCH +
      ingredientScore * WEIGHT_INGREDIENT +
      placementScore * WEIGHT_PLACEMENT +
      bakeScore * WEIGHT_BAKE) /
    100;

  const bakeState = pizza.bakeResult !== null ? classifyBake(pizza.bakeResult, recipe.bakeTarget) : null;
  const stars = capStarsForBake(starsFromTotal(total), bakeState);

  return { matchScore, ingredientScore, placementScore, bakeScore, total, stars };
}
