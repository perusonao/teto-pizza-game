/**
 * The identity a recipe / discovery target is judged by, as a string key (Pinsa Romana, #577 P3-b). "Same ingredient set and counts" is no longer the
 * whole identity: a recipe can also fix its dough kind and name ingredients that are placed after the bake (`discoveryIdentityOf`), so two recipes may share
 * every ingredient and still be different pizzas (jamon-serrano-pizza vs pinsa-romana). The uniqueness canaries use these keys, which is the matcher's real
 * notion of identity -- not a weaker one. TEST SUPPORT ONLY.
 */
import { resolveDoughKind } from "../../dough/doughKind";

interface RecipeLike {
  readonly requiredIngredients: readonly { readonly ingredientId: string; readonly minCount: number; readonly applicationPhase?: string }[];
  readonly doughKind?: unknown;
  readonly panShape?: unknown;
}

/** Ingredient ids + counts, plus the dough kind, the post-bake ingredient ids and the pan the recipe fixes. */
export function recipeIdentityKey(recipe: RecipeLike): string {
  const counts = recipe.requiredIngredients.map((q) => [q.ingredientId, q.minCount] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
  const late = [...new Set(recipe.requiredIngredients.filter((q) => q.applicationPhase === "POST_BAKE").map((q) => q.ingredientId))].sort();
  return JSON.stringify([counts, resolveDoughKind(recipe), late, recipe.panShape === "square" ? "tray" : "none"]);
}

/** A discovery target's items and sauce base plus every declared identity dimension. */
export function targetIdentityKey(t: { readonly items: readonly string[]; readonly sauceBase?: readonly string[]; readonly identityDimensions: unknown }): string {
  return JSON.stringify([[...t.items].sort(), [...(t.sauceBase ?? [])].sort(), t.identityDimensions]);
}
