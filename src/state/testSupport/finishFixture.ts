/**
 * Cooking Steps 2.0 FINISH engine, slice D1a (Issue #294): the test-only "BBQ-chicken-shaped" late-addition recipe.
 * It uses existing ingredients only and is NEVER added to `RECIPES` -- the invariant test pins that. parsley stands in
 * for the late garnish (a finite ingredient, so the stock rules are exercised).
 */
import type { Recipe, RecipeId } from "../../data/recipes";
import { createEmptyPizza, type PizzaState, type PlacedTopping } from "../pizzaState";

export const FINISH_FIXTURE_RECIPE: Recipe = {
  id: "finish-fixture-bbq" as unknown as RecipeId,
  nameJa: "FINISH fixture (test only)",
  description: "test-only late-addition recipe; not in RECIPES",
  requiredIngredients: [
    { ingredientId: "tomato-sauce", minCount: 1 },
    { ingredientId: "mozzarella", minCount: 2 },
    { ingredientId: "chicken", minCount: 2 },
    { ingredientId: "parsley", minCount: 2, applicationPhase: "POST_BAKE" },
  ],
  bakeTarget: { start: 60, end: 80 },
  baseRewardPitz: 100,
};

let seq = 0;
export function piece(ingredientId: string, stage?: "pre" | "post"): PlacedTopping {
  seq += 1;
  return { id: `fx-${seq}`, ingredientId, x: 40 + (seq % 20), y: 40 + ((seq * 7) % 20), ...(stage ? { stage } : {}) };
}

/** The pizza at CONFIRM_BAKE: everything except the late garnish. */
export function preBakePizza(): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ["tomato-sauce"],
    toppings: [piece("mozzarella"), piece("mozzarella"), piece("chicken"), piece("chicken")],
  };
}

/** The same pizza after FINISH placed `count` parsley pieces. */
export function finishedPizza(count: number): PizzaState {
  const base = preBakePizza();
  return { ...base, toppings: [...base.toppings, ...Array.from({ length: count }, () => piece("parsley", "post"))] };
}
