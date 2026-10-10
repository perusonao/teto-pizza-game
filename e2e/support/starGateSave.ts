import { RECIPES, countsTowardLadder } from "../../src/data/recipes";
import { materialsUpTo } from "../../src/logic/catalog/testSupport/catalogDerived";

/**
 * Batch 6 PR-3: test-only starting saves for the star-gate specs. They only write the starting `localStorage` save of the
 * e2e dev server (never Production, never a real player's save) and add no UI to the game.
 *
 * `found` credited recipes are discovered (the Ladder step reached equals `found`), `margherita` sits at 1 star (the Lunch
 * Rush serve target) and the rest is spread so the Dex BEST stars sum to exactly `totalStars` (every entry holds >= 1 star:
 * a 0-star row is not a valid save row).
 */
export const SAVE_KEY = "teto-pizza-save-v1";
export const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const CREDITED = RECIPES.filter((r) => countsTowardLadder(r.id)).map((r) => r.id as string);

/** Ledger as an older save would hold it: everything up to step 49 (the Batch 6 materials are granted by the load itself). */
export const LEDGER_TO_STEP_49 = materialsUpTo(49);

export function starGateSave(found: number, totalStars: number, ledger: readonly string[] = LEDGER_TO_STEP_49): string {
  const ids = ["margherita", ...CREDITED.filter((id) => id !== "margherita")].slice(0, found);
  let extra = totalStars - ids.length; // 1 star each, the remainder on top (up to 5 each)
  if (extra < 0) throw new Error(`totalStars ${totalStars} is below the ${ids.length} one-star rows`);
  const dex = ids.map((recipeId) => {
    if (recipeId === "margherita") return { recipeId, discovered: true, bestScore: 40, bestStars: 1, timesMade: 1 };
    const add = Math.min(4, extra);
    extra -= add;
    return { recipeId, discovered: true, bestScore: 40, bestStars: 1 + add, timesMade: 1 };
  });
  if (extra > 0) throw new Error("totalStars is too high for this many recipes");
  return JSON.stringify({
    schemaVersion: 2,
    dex,
    pitzBalance: 500,
    ownedIngredientIds: STARTERS,
    missionBest: {},
    inventory: {},
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: ledger,
  });
}
