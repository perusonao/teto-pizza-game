import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type PersistentSaveV2 } from "./persistence";
import { memoryStorage } from "./testSupport/memoryStorage";
import { resolveShopEntitlement } from "./materialEntitlement";
import type { DexEntry } from "./dex";

/**
 * Expansion Batch 10 PR-1 (docs/decisions/TETO_EXPANSION-BATCH-10_PR1_OWNER-DECISIONS.md): the schema stays v2, nothing is migrated. A save from before the batch loads unchanged, a save that
 * already holds the new materials / Dex entries round-trips unchanged, and an unknown id (what a PRE-batch build sees of the new ones) is kept on a rewrite (the #674 / unknownIdsIn mechanism).
 */
const NEW_RECIPES = ["curry-pizza-japan", "rendang-pizza", "tandoori-paneer-pizza", "currywurst", "cuban-pizza"];
const NEW_MATERIALS = ["curry-ketchup", "beef", "paneer", "paprika-powder", "wurstel", "mustard", "pickles", "swiss-cheese"];
const entry = (recipeId: string): DexEntry => ({ recipeId, discovered: true, bestScore: 88, bestStars: 4, timesMade: 2 });
const stored = (dex: DexEntry[], owned: string[], ledger: string[] = owned) =>
  JSON.stringify({ schemaVersion: 2, dex, pitzBalance: 100, ownedIngredientIds: owned, unlockedForShopIngredientIds: ledger, missionBest: {}, inventory: {} });
const rawOf = (s: { getItem(k: string): string | null }) => JSON.parse(s.getItem(SAVE_STORAGE_KEY) ?? "null");
const rewrite = (s: ReturnType<typeof memoryStorage>) => {
  const loaded = loadSave(s);
  persistProgress({ ...(loaded as PersistentSaveV2), pitzBalance: loaded.pitzBalance + 1 }, s);
};

describe("Batch 10 PR-1 save compatibility", () => {
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

  it("a save from before the batch loads unchanged and gains no new material or recipe by itself", () => {
    const owned = ["mushroom", "bacon"];
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry("funghi")], owned) });
    const loaded = loadSave(s);
    expect(loaded.dex.map((e) => e.recipeId)).toEqual(["margherita", "funghi"]);
    expect(loaded.ownedIngredientIds).toEqual(expect.arrayContaining(owned)); // (the starters are merged in on load)
    for (const id of NEW_MATERIALS) expect(loaded.ownedIngredientIds, id).not.toContain(id);
    rewrite(s);
    expect(rawOf(s).ownedIngredientIds).toEqual(expect.arrayContaining(owned));
    for (const id of NEW_MATERIALS) expect(rawOf(s).ownedIngredientIds, id).not.toContain(id);
    expect(rawOf(s).dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", "funghi"]);
  });

  it("what a pre-batch build cannot name (an unknown ingredient / recipe id) survives a rewrite, in order, so a rollback does not lose the batch's data", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry("not-a-recipe-yet")], ["mushroom", "not-a-material-yet", "bacon"]) });
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.ownedIngredientIds.filter((id: string) => ["mushroom", "not-a-material-yet", "bacon"].includes(id))).toEqual(["mushroom", "not-a-material-yet", "bacon"]);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", "not-a-recipe-yet"]);
  });

  it("an existing save keeps every entitlement it had: the ordinary steps 57-61 only add to the shop ledger", () => {
    const before = DISCOVERY_LADDER.steps.slice(0, 56).flatMap((st) => st.ingredientIds);
    const owned = [...STARTER_INGREDIENT_IDS, ...before.slice(0, 20)];
    const dex = DISCOVERY_LADDER.steps.slice(0, 55).map((st) => ({ ...entry(st.keyRecipeId) }));
    const ledger = before;
    const r = resolveShopEntitlement(dex, owned, ledger, DISCOVERY_LADDER);
    expect(r.unlockedForShopIngredientIds.slice(0, ledger.length)).toEqual(ledger);
    for (const id of NEW_MATERIALS) expect(r.unlockedForShopIngredientIds, id).not.toContain(id); // 55 discoveries have not reached step 57 yet
  });
});
