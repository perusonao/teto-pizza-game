/**
 * Large Catalog UX LC-1 (pure, UNWIRED): the runtime ingredient data as catalog descriptors.
 *
 * Reads only `INGREDIENTS` -- never recipes (privacy boundary B-1). The `shelf` is copied from
 * `ingredientShelf()` (the membership authority); this module classifies nothing itself. Not imported by any production file yet.
 */
import { INGREDIENTS } from "../../data/ingredients";
import { ingredientShelf } from "../../data/ingredientShelf";
import type { CatalogIngredient } from "./catalogTypes";

export function runtimeCatalog(): readonly CatalogIngredient[] {
  return INGREDIENTS.map((ingredient, catalogIndex) => ({
    id: ingredient.id,
    category: ingredient.category,
    nameJa: ingredient.nameJa,
    shelf: ingredientShelf(ingredient.id),
    catalogIndex,
  }));
}
