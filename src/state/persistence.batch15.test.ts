import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type PersistentSaveV2 } from "./persistence";
import { memoryStorage } from "./testSupport/memoryStorage";
import { resolveShopEntitlement } from "./materialEntitlement";
import type { DexEntry } from "./dex";

/**
 * Expansion Batch 15 (Issue #728, PROVISIONAL SPEC): nigerian-suya-pizza adds a recipe id and NOTHING else (no material, no ladder step), so the schema stays v2 and nothing is migrated.
 * A save from before Batch 15 loads unchanged -- in particular a Dex that already holds rendang-pizza (whose Research LABEL changes for players who have not discovered it: a derived,
 * never-persisted display) keeps rendang-pizza's entry byte for byte; a save that already holds suya round-trips; an id this build cannot name (what a PRE-Batch-15 build sees of suya)
 * is kept on a rewrite (the #674 / unknownIdsIn mechanism).
 */
const NEW_RECIPE = "nigerian-suya-pizza";
const entry = (recipeId: string, extra: Partial<DexEntry> = {}): DexEntry => ({ recipeId, discovered: true, bestScore: 88, bestStars: 4, timesMade: 2, ...extra });
const stored = (dex: DexEntry[], owned: string[], ledger: string[] = owned) =>
  JSON.stringify({ schemaVersion: 2, dex, pitzBalance: 100, ownedIngredientIds: owned, unlockedForShopIngredientIds: ledger, missionBest: {}, inventory: {} });
const rawOf = (s: { getItem(k: string): string | null }) => JSON.parse(s.getItem(SAVE_STORAGE_KEY) ?? "null");
const rewrite = (s: ReturnType<typeof memoryStorage>) => {
  const loaded = loadSave(s);
  persistProgress({ ...(loaded as PersistentSaveV2), pitzBalance: loaded.pitzBalance + 1 }, s);
};

describe("Batch 15 save compatibility", () => {
  it("the new recipe is known to this build: it loads as written and a rewrite keeps it (schema v2)", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry(NEW_RECIPE)], ["mushroom", "beef"]) });
    expect(loadSave(s).dex.map((e) => e.recipeId)).toEqual(["margherita", NEW_RECIPE]);
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", NEW_RECIPE]);
    expect(raw.schemaVersion).toBe(2);
  });

  it("a save from before Batch 15 that already discovered rendang-pizza keeps that entry exactly, and does not gain the new recipe by itself", () => {
    const rendang = entry("rendang-pizza", { bestScore: 91, bestStars: 5, timesMade: 7 });
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), rendang], ["mushroom", "beef"]) });
    const loaded = loadSave(s);
    expect(loaded.dex.find((e) => e.recipeId === "rendang-pizza")).toEqual(rendang);
    expect(loaded.dex.map((e) => e.recipeId)).not.toContain(NEW_RECIPE);
    rewrite(s);
    expect(rawOf(s).dex.find((e: DexEntry) => e.recipeId === "rendang-pizza")).toEqual(rendang);
    expect(rawOf(s).dex.map((e: DexEntry) => e.recipeId)).not.toContain(NEW_RECIPE);
  });

  it("a save that owns beef but has NOT discovered rendang loads unchanged (the Research label is derived, never persisted: no field of the save mentions a cohort letter)", () => {
    const text = stored([entry("margherita")], ["mushroom", "beef"]);
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: text });
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.ownedIngredientIds).toEqual(expect.arrayContaining(["mushroom", "beef"])); // (starter materials are added by the loader, as before)
    expect(raw.ownedIngredientIds).not.toContain("nigerian-suya-pizza");
    expect(JSON.stringify(raw)).not.toMatch(/cohort|letter|研究|？？？/);
  });

  it("what a pre-Batch-15 build cannot name (an unknown ingredient / recipe id) survives a rewrite, in order, so a rollback does not lose the data", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry("not-a-recipe-yet")], ["mushroom", "not-a-material-yet", "bacon"]) });
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.ownedIngredientIds.filter((id: string) => ["mushroom", "not-a-material-yet", "bacon"].includes(id))).toEqual(["mushroom", "not-a-material-yet", "bacon"]);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", "not-a-recipe-yet"]);
  });

  it("a save holding the Batch 14 recipe and material keeps them after a Batch 15 rewrite", () => {
    const owned = ["mushroom", "cinnamon"];
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry("moussaka-style-pizza"), entry("rendang-pizza")], owned) });
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", "moussaka-style-pizza", "rendang-pizza"]);
    expect(raw.ownedIngredientIds).toEqual(expect.arrayContaining(owned));
  });

  it("no entitlement changes: Batch 15 adds no material, so the shop ledger of an existing save is exactly what it was", () => {
    const before = DISCOVERY_LADDER.steps.slice(0, 58).flatMap((st) => st.ingredientIds);
    const owned = [...STARTER_INGREDIENT_IDS, ...before.slice(0, 20)];
    const dex = DISCOVERY_LADDER.steps.slice(0, 57).map((st) => ({ ...entry(st.keyRecipeId) }));
    const r = resolveShopEntitlement(dex, owned, before, DISCOVERY_LADDER);
    expect(r.unlockedForShopIngredientIds.slice(0, before.length)).toEqual(before);
    expect(DISCOVERY_LADDER.steps.some((st) => st.keyRecipeId === NEW_RECIPE)).toBe(false);
  });
});
