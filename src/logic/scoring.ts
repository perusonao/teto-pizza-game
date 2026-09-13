import type { Recipe } from "../data/recipes";
import type { PizzaState } from "../state/pizzaState";
import { classifyBake } from "./bake";

export interface ScoreBreakdown {
  matchScore: number;
  ingredientScore: number;
  bakeScore: number;
  total: number;
  stars: 1 | 2 | 3;
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

  const total = (matchScore + ingredientScore + bakeScore) / 3;
  let stars: 1 | 2 | 3 = total >= 90 ? 3 : total >= 60 ? 2 : 1;

  // A pizza that isn't baked to the perfect zone should never read as a flawless ★3 —
  // the visual (raw/burnt), Blue's comment, and the score must stay consistent.
  if (pizza.bakeResult !== null && stars === 3) {
    const bakeState = classifyBake(pizza.bakeResult, recipe.bakeTarget);
    if (bakeState !== "perfect") stars = 2;
  }

  return { matchScore, ingredientScore, bakeScore, total, stars };
}
