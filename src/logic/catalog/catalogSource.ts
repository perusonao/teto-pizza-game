/**
 * Large Catalog UX LC-1 (pure, UNWIRED): the runtime ingredient data as catalog descriptors.
 *
 * Reads only `INGREDIENTS` -- never recipes (privacy boundary B-1). The `shelf` is copied from
 * `ingredientShelf()` (the membership authority); this module classifies nothing itself. Read by the pantry (LC-R3+).
 */
import { INGREDIENTS } from "../../data/ingredients";
import { ingredientShelf } from "../../data/ingredientShelf";
import { searchAliasesFor } from "../../data/ingredientSearchAliases";
import type { CatalogIngredient } from "./catalogTypes";

export function runtimeCatalog(): readonly CatalogIngredient[] {
  return INGREDIENTS.map((ingredient, catalogIndex) => {
    const aliases = searchAliasesFor(ingredient.id);
    return {
      id: ingredient.id,
      category: ingredient.category,
      nameJa: ingredient.nameJa,
      shelf: ingredientShelf(ingredient.id),
      // LC-R5-b: search-only aliases (Owner-approved table); absent when the ingredient has none.
      ...(aliases.length > 0 ? { searchAliasesJa: aliases } : {}),
      catalogIndex,
    };
  });
}
