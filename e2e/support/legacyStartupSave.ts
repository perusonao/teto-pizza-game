/** A pre-switch save carrying progress shared between both models. */
export const legacyStartupSave = {
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
  pitzBalance: 731,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "egg"],
  missionBest: {},
  inventory: { egg: 7 },
  discoveryHintPurchases: { fugazza: 2 },
  dinnerMissionRecords: {
    "dm-a": { revision: 1, clears: 2, bestClearMs: 95_000, bestTier: "SILVER", firstClearRewarded: true },
  },
};
