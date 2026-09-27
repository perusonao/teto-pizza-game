/**
 * Large Catalog UX LC-1 (pure, UNWIRED): the runtime ingredient data as catalog descriptors.
 *
 * Reads only `INGREDIENTS` -- never recipes (privacy boundary B-1). The family lookup is injected
 * (production will pass DH4-1's `ingredientAttributeFamily` when LC-2 wires it; DH4-1 stays unwired
 * until then). Not imported by any production file yet.
 */
import { INGREDIENTS } from "../../data/ingredients";
import type { CatalogFamilyId, CatalogIngredient } from "./catalogTypes";

export function runtimeCatalog(familyOf: (ingredientId: string) => CatalogFamilyId | null = () => null): readonly CatalogIngredient[] {
  return INGREDIENTS.map((ingredient, catalogIndex) => ({
    id: ingredient.id,
    category: ingredient.category,
    nameJa: ingredient.nameJa,
    family: familyOf(ingredient.id),
    catalogIndex,
  }));
}
