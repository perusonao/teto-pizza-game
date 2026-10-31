import { describe, expect, it } from "vitest";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type PersistentSaveV2 } from "./persistence";
import { memoryStorage } from "./testSupport/memoryStorage";
import type { DexEntry } from "./dex";

/**
 * B12 (Issue #706; PROVISIONAL SPEC): the schema stays v2, nothing is migrated and no material is added. A save that already holds the new Dex entry round-trips unchanged, a save from before B12 loads unchanged,
 * and an unknown recipe id (what a PRE-B12 build sees of the new one) is kept on a rewrite (the #674 / unknownIdsIn mechanism).
 */
const NEW_RECIPE = "jamaican-jerk-chicken-pizza";
const entry = (recipeId: string): DexEntry => ({ recipeId, discovered: true, bestScore: 88, bestStars: 4, timesMade: 2 });
const stored = (dex: DexEntry[], owned: string[]) =>
  JSON.stringify({ schemaVersion: 2, dex, pitzBalance: 100, ownedIngredientIds: owned, unlockedForShopIngredientIds: owned, missionBest: {}, inventory: {} });
const rawOf = (s: { getItem(k: string): string | null }) => JSON.parse(s.getItem(SAVE_STORAGE_KEY) ?? "null");
const rewrite = (s: ReturnType<typeof memoryStorage>) => {
  const loaded = loadSave(s);
  persistProgress({ ...(loaded as PersistentSaveV2), pitzBalance: loaded.pitzBalance + 1 }, s);
};

describe("B12 save compatibility", () => {
  it("the new recipe is known to this build: it loads as written and a rewrite keeps it", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry(NEW_RECIPE)], ["green-pepper", "pineapple", "chicken"]) });
    expect(loadSave(s).dex.map((e) => e.recipeId)).toEqual(["margherita", NEW_RECIPE]);
    rewrite(s);
    expect(rawOf(s).dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", NEW_RECIPE]);
    expect(rawOf(s).schemaVersion).toBe(2);
  });

  it("a save from before B12 loads unchanged and gains neither a recipe nor a material by itself", () => {
    const owned = ["green-pepper", "chicken"];
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry("funghi")], owned) });
    expect(loadSave(s).dex.map((e) => e.recipeId)).toEqual(["margherita", "funghi"]);
    rewrite(s);
    expect(rawOf(s).dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", "funghi"]);
    expect(rawOf(s).ownedIngredientIds).toEqual(expect.arrayContaining(owned));
  });

  it("what a pre-B12 build cannot name (an unknown recipe id) survives a rewrite, in order, so a rollback does not lose the data", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry("not-a-recipe-yet")], ["green-pepper"]) });
    rewrite(s);
    expect(rawOf(s).dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", "not-a-recipe-yet"]);
  });
});
