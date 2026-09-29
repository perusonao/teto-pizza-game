/**
 * Large Catalog UX LC-1 (pure, UNWIRED): per-chapter Dex summary on the ownership basis.
 *
 * Authority: LC-OD-8 / LC-OD-8b (Owner Decision Gate §7 / §17). The Dex's 「作れそう」 counts use
 * permanent ownership (and Shop entitlement), never inventory quantity: stock is not a parameter
 * here, so emptying a stock can never change what the summary says about undiscovered recipes (the
 * PV-1 oracle of today's per-slot tags). Production keeps `recipeDiscoveryState` until LC-5.
 *
 * - explore: undiscovered, every required ingredient is a starter or owned.
 * - shop:    undiscovered, every required ingredient is a starter, owned or Shop-entitled, and at
 *            least one is not owned yet.
 * - Nothing identifies which recipe is in which bucket: the result is counts only.
 */
export interface DexSummaryRecipe {
  discovered: boolean;
  requiredIngredientIds: readonly string[];
}

export interface EntitlementView {
  /** Permanent ownership (never quantity). */
  ownedIds: readonly string[];
  /** Unlocked for the Shop (entitled but maybe not bought). */
  shopEntitledIds: readonly string[];
  /** Onboarding starters: always usable. */
  starterIds: readonly string[];
}

export interface ChapterSummary {
  discovered: number;
  total: number;
  explore: number;
  shop: number;
}

export function summarizeChapter(recipes: readonly DexSummaryRecipe[], entitlement: EntitlementView): ChapterSummary {
  const starters = new Set(entitlement.starterIds);
  const owned = new Set(entitlement.ownedIds);
  const entitled = new Set([...entitlement.shopEntitledIds, ...entitlement.ownedIds]);
  const summary: ChapterSummary = { discovered: 0, total: recipes.length, explore: 0, shop: 0 };
  for (const recipe of recipes) {
    if (recipe.discovered) {
      summary.discovered += 1;
      continue;
    }
    let allOwned = true;
    let allEntitled = true;
    for (const id of recipe.requiredIngredientIds) {
      if (starters.has(id)) continue;
      if (!entitled.has(id)) allEntitled = false;
      if (!owned.has(id)) allOwned = false;
    }
    if (allOwned) summary.explore += 1;
    else if (allEntitled) summary.shop += 1;
  }
  return summary;
}

export function summarizeChapters<K>(
  chapters: readonly { key: K; recipes: readonly DexSummaryRecipe[] }[],
  entitlement: EntitlementView,
): { key: K; summary: ChapterSummary }[] {
  return chapters.map((chapter) => ({ key: chapter.key, summary: summarizeChapter(chapter.recipes, entitlement) }));
}
