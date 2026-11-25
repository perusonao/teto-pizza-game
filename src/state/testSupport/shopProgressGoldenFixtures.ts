/**
 * B案 Phase 1b (Issue #901): golden saves that carry `shopProgress`, written by hand and FROZEN like
 * ./saveGoldenFixtures.ts (never regenerate one from current code). Every value is invented.
 */

/** The newest era (techniques + research) plus this build's `shopProgress` shape. */
export const V2_SHOP_PROGRESS = JSON.stringify({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 }],
  pitzBalance: 120,
  ownedIngredientIds: ["onion"],
  missionBest: {},
  inventory: { onion: 7 },
  starterGrantClaimedRecipeIds: ["fugazza"],
  unlockedForShopIngredientIds: ["onion"],
  discoveryHintPurchases: { fugazza: 2 },
  discoveryHintFacts: { fugazza: ["ing:mozzarella"] },
  discoveredTechniqueIds: ["no-sauce"],
  researchExclusions: { margherita: ["onion"] },
  shopProgress: { reputation: 250, grantedMenuRecipeIds: ["margherita"] },
});

/** A save a newer build might leave: an unknown recipe id and sub-keys this build cannot read. */
export const V2_SHOP_PROGRESS_FROM_NEWER_BUILD = JSON.stringify({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 }],
  pitzBalance: 120,
  ownedIngredientIds: ["onion"],
  missionBest: {},
  inventory: { onion: 7 },
  unlockedForShopIngredientIds: ["onion"],
  shopProgress: {
    reputation: 640,
    grantedMenuRecipeIds: ["margherita", "future-pizza"],
    futureMarker: { source: "future-source", value: 300 },
    chapterRewardsClaimed: [1, 2],
  },
});
