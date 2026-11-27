/**
 * B案 Phase 3c (Issue #901): golden saves that carry research points under `shopProgress`, written by hand and FROZEN like
 * ./saveGoldenFixtures.ts (never regenerate one from current code). Every value is invented.
 */

/** This build's shape: research points next to the Phase 3b ledgers. */
export const V2_SHOP_RESEARCH_POINTS = JSON.stringify({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 }],
  pitzBalance: 120,
  ownedIngredientIds: ["onion"],
  missionBest: {},
  inventory: { onion: 7 },
  unlockedForShopIngredientIds: ["onion"],
  shopProgress: { reputation: 45, grantedMenuRecipeIds: ["margherita"], researchPointsEarned: 23 },
});

/** A newer build's save: a research point value plus sub-keys this build cannot read (e.g. a spent total). */
export const V2_SHOP_RESEARCH_POINTS_FROM_NEWER_BUILD = JSON.stringify({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 }],
  pitzBalance: 120,
  ownedIngredientIds: ["onion"],
  missionBest: {},
  inventory: { onion: 7 },
  unlockedForShopIngredientIds: ["onion"],
  shopProgress: { reputation: 45, grantedMenuRecipeIds: ["margherita"], researchPointsEarned: 40, researchPointsSpent: 12 },
});
