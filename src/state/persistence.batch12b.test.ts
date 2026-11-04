import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type PersistentSaveV2 } from "./persistence";
import { memoryStorage } from "./testSupport/memoryStorage";
import { resolveShopEntitlement } from "./materialEntitlement";
import type { DexEntry } from "./dex";

/**
 * Expansion Batch 12 (Issue #707, PROVISIONAL SPEC): the schema stays v2, nothing is migrated. A save from before Batch 12 loads unchanged, a save that already holds the new materials / Dex entries round-trips unchanged, and an unknown id
 * (what a PRE-Batch-12 build sees of the new ones) is kept on a rewrite (the #674 / unknownIdsIn mechanism).
 */
const NEW_RECIPES = ["supreme-pizza", "pizza-alla-norma"];
const NEW_MATERIALS = ["ricotta-salata"];
const entry = (recipeId: string): DexEntry => ({ recipeId, discovered: true, bestScore: 88, bestStars: 4, timesMade: 2 });
const stored = (dex: DexEntry[], owned: string[], ledger: string[] = owned) =>
  JSON.stringify({ schemaVersion: 2, dex, pitzBalance: 100, ownedIngredientIds: owned, unlockedForShopIngredientIds: ledger, missionBest: {}, inventory: {} });
const rawOf = (s: { getItem(k: string): string | null }) => JSON.parse(s.getItem(SAVE_STORAGE_KEY) ?? "null");
const rewrite = (s: ReturnType<typeof memoryStorage>) => {
  const loaded = loadSave(s);
  persistProgress({ ...(loaded as PersistentSaveV2), pitzBalance: loaded.pitzBalance + 1 }, s);
};

describe("Batch 12 save compatibility", () => {
  it("the new materials and recipes are known to this build: they load as written and a rewrite keeps them", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), ...NEW_RECIPES.map(entry)], ["mushroom", ...NEW_MATERIALS]) });
    const loaded = loadSave(s);
    expect(loaded.dex.map((e) => e.recipeId)).toEqual(["margherita", ...NEW_RECIPES]);
    for (const id of NEW_MATERIALS) expect(loaded.ownedIngredientIds).toContain(id);
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", ...NEW_RECIPES]);
    expect(raw.ownedIngredientIds).toEqual(expect.arrayContaining(NEW_MATERIALS));
    expect(raw.schemaVersion).toBe(2);
  });

  it("a save from before Batch 12 loads unchanged and gains no new material or recipe by itself", () => {
    const owned = ["mushroom", "bacon"];
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry("funghi")], owned) });
    const loaded = loadSave(s);
    expect(loaded.dex.map((e) => e.recipeId)).toEqual(["margherita", "funghi"]);
    for (const id of NEW_MATERIALS) expect(loaded.ownedIngredientIds, id).not.toContain(id);
    rewrite(s);
    for (const id of NEW_MATERIALS) expect(rawOf(s).ownedIngredientIds, id).not.toContain(id);
    expect(rawOf(s).dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", "funghi"]);
  });

  it("what a pre-Batch-12 build cannot name (an unknown ingredient / recipe id) survives a rewrite, in order, so a rollback does not lose the data", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry("not-a-recipe-yet")], ["mushroom", "not-a-material-yet", "bacon"]) });
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.ownedIngredientIds.filter((id: string) => ["mushroom", "not-a-material-yet", "bacon"].includes(id))).toEqual(["mushroom", "not-a-material-yet", "bacon"]);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", "not-a-recipe-yet"]);
  });

  it("an existing save keeps every entitlement it had: the ordinary step 64 only adds to the shop ledger, and 55 discoveries have not reached it", () => {
    const before = DISCOVERY_LADDER.steps.slice(0, 56).flatMap((st) => st.ingredientIds);
    const owned = [...STARTER_INGREDIENT_IDS, ...before.slice(0, 20)];
    const dex = DISCOVERY_LADDER.steps.slice(0, 55).map((st) => ({ ...entry(st.keyRecipeId) }));
    const r = resolveShopEntitlement(dex, owned, before, DISCOVERY_LADDER);
    expect(r.unlockedForShopIngredientIds.slice(0, before.length)).toEqual(before);
    for (const id of NEW_MATERIALS) expect(r.unlockedForShopIngredientIds, id).not.toContain(id);
  });
});
