/**
 * PR #206 Forward-Compatibility Deployment Readiness Fresh Audit -- fixtures only.
 *
 * "C" (future Progression 2.0) does not exist yet. It is modelled here purely as the save JSON a
 * future build would write: schemaVersion 2 (no bump), every current field, plus additive future
 * fields and ids this build does not know. Nothing here is a production field definition.
 */

export const SAVE_KEY = "teto-pizza-save-v1";

export const STARTER = ["tomato-sauce", "mozzarella", "basil"];

/** The future save C writes. Each `probe*` value is something the audit checks after a write. */
export function futureSaveC(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    dex: [
      { recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 2 },
      // unknown recipe id, well-formed entry
      { recipeId: "future-recipe-a", discovered: true, bestScore: 81, bestStars: 4, timesMade: 3 },
      // unknown recipe id, entry carrying an extra nested (future) field
      {
        recipeId: "future-recipe-b",
        discovered: true,
        bestScore: 50,
        bestStars: 2,
        timesMade: 1,
        perfectCount: 1,
      },
      // KNOWN recipe id, entry carrying an extra nested (future) field
      {
        recipeId: "marinara",
        discovered: true,
        bestScore: 66,
        bestStars: 3,
        timesMade: 4,
        perfectCount: 2,
      },
    ],
    pitzBalance: 400,
    ownedIngredientIds: [
      ...STARTER,
      "garlic",
      "future-ingredient-a",
      // malformed-by-#206-rule id (uppercase) -- a C id not matching ^[a-z0-9][a-z0-9_-]{0,63}$
      "Future_Ingredient_C",
    ],
    missionBest: {
      "lunch-rush": 500,
      "future-mission-x": 300,
      // non-integer value under a future key (e.g. a future object/float score shape)
      "future-mission-y": 12.5,
    },
    inventory: {
      garlic: 6,
      "future-ingredient-a": 6,
      // unknown id, fractional (portion-unit style) value
      "future-ingredient-b": 2.5,
      // KNOWN id, fractional (portion-unit style) value -- semantic change of an existing field
      oregano: 1.5,
    },
    starterGrantClaimedRecipeIds: ["marinara", "future-recipe-a"],
    // --- additive future top-level fields (no production field exists) ---
    unlockedForShopIngredientIds: ["future-ingredient-a", "future-ingredient-b"],
    lifetimePitzEarned: 480,
    futureMeta: { cutoverMarker: "p2-5state", grandfathered: ["garlic"] },
  };
}

/** Top-level keys that are "future" (unknown to A and B). */
export const FUTURE_TOP_LEVEL_KEYS = [
  "unlockedForShopIngredientIds",
  "lifetimePitzEarned",
  "futureMeta",
] as const;
