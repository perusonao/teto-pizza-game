import { INGREDIENTS, type Ingredient } from "../data/ingredients";
import type { PizzaState } from "../state/pizzaState";

/**
 * Issue #893: the finished-pizza button needs its own complete, semantic ingredient display.
 * The visible pizza intentionally uses several rendering primitives (emoji text, CSS cheese
 * shapes and dedicated SVGs), so scraping its descendant text is not an ingredient mapping:
 * CSS/SVG ingredients disappear while the decorative bake smoke looks like two ingredients.
 *
 * Keep this table exhaustive and keyed by the catalog id. The Japanese name is part of the
 * display identity, so ingredients which deliberately share a broad emoji (for example two
 * cheeses) still remain distinguishable and can never be coalesced by glyph text.
 */
export const PIZZA_INGREDIENT_LIST_DISPLAY = new Map(
  INGREDIENTS.map((ingredient) => [
    ingredient.id,
    { ingredient, nameJa: ingredient.nameJa },
  ] as const),
);

export interface PizzaIngredientListItem {
  ingredientId: string;
  ingredient: Ingredient;
  nameJa: string;
  count: number;
}

/** One row per ingredient id, in first-placement order; counts never merge by glyph. */
export function pizzaIngredientListItems(
  toppings: PizzaState["toppings"],
): PizzaIngredientListItem[] {
  const counts = new Map<string, number>();
  for (const topping of toppings) {
    counts.set(topping.ingredientId, (counts.get(topping.ingredientId) ?? 0) + 1);
  }
  return [...counts].flatMap(([ingredientId, count]) => {
    const display = PIZZA_INGREDIENT_LIST_DISPLAY.get(ingredientId);
    return display ? [{ ingredientId, ...display, count }] : [];
  });
}
