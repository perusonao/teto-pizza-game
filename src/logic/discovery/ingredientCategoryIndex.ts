import { INGREDIENTS, type IngredientCategory } from "../../data/ingredients";

/**
 * Issue #446: an O(1) `getIngredient(id)?.category` for the deduction modules. The DH4 guard asks for
 * a category hundreds of millions of times in its exhaustive gate tests, and `getIngredient` is a
 * linear `INGREDIENTS.find`.
 *
 * Same answer as `getIngredient(id)?.category`: the FIRST row with that id wins (as `find` does), an
 * id that is not a catalog ingredient (or not a string) is `undefined`. The index is built from the
 * `INGREDIENTS` export (so a module mock of it is honoured) and rebuilt whenever its length changes
 * (a row pushed / spliced at run time is seen). It is a pure function of the catalog, never of a
 * caller's input, so it is not a call-to-call cache of any guard result.
 */
let index: ReadonlyMap<string, IngredientCategory> | null = null;
let indexedLength = -1;

export function ingredientCategory(id: string): IngredientCategory | undefined {
  if (index === null || indexedLength !== INGREDIENTS.length) {
    const built = new Map<string, IngredientCategory>();
    for (const ingredient of INGREDIENTS) if (!built.has(ingredient.id)) built.set(ingredient.id, ingredient.category);
    index = built;
    indexedLength = INGREDIENTS.length;
  }
  return index.get(id);
}
