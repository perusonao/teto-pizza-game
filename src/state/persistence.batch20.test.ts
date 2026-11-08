import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { countsTowardLadder } from "../data/recipes";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type PersistentSaveV2 } from "./persistence";
import { memoryStorage } from "./testSupport/memoryStorage";
import type { DexEntry } from "./dex";

/**
 * Expansion Batch 20-A (Issue #790, PROVISIONAL SPEC): the schema stays v2, nothing is migrated. `honey`, `walnut` and `pesto-noci-pizza` are plain new ids; a pre-Batch-20-A save (no honey / walnut, no new Dex entry) loads and rewrites unchanged in the fields it had;
 * the new ids load and rewrite as written; an id this build cannot name is kept on a rewrite (rollback safe); the Research label is derived, never persisted.
 */
const NEW_RECIPE = "pesto-noci-pizza";
const entry = (recipeId: string, extra: Partial<DexEntry> = {}): DexEntry => ({ recipeId, discovered: true, bestScore: 88, bestStars: 4, timesMade: 2, ...extra });
const stored = (dex: DexEntry[], owned: string[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ schemaVersion: 2, dex, pitzBalance: 100, ownedIngredientIds: owned, unlockedForShopIngredientIds: owned, missionBest: {}, inventory: {}, ...extra });
const rawOf = (s: { getItem(k: string): string | null }) => JSON.parse(s.getItem(SAVE_STORAGE_KEY) ?? "null");
const rewrite = (s: ReturnType<typeof memoryStorage>) => {
  const loaded = loadSave(s);
  persistProgress({ ...(loaded as PersistentSaveV2), pitzBalance: loaded.pitzBalance + 1 }, s);
};

describe("Batch 20-A save compatibility", () => {
  it("the new recipe, honey and walnut are known to this build: they load as written and a rewrite keeps them (schema v2)", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry(NEW_RECIPE)], ["mushroom", "honey", "walnut"], { inventory: { honey: 4, walnut: 9 } }) });
    expect(loadSave(s).dex.map((e) => e.recipeId)).toEqual(["margherita", NEW_RECIPE]);
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", NEW_RECIPE]);
    expect(raw.ownedIngredientIds).toEqual(expect.arrayContaining(["honey", "walnut"]));
    expect(raw.inventory.honey).toBe(4);
    expect(raw.inventory.walnut).toBe(9);
    expect(raw.schemaVersion).toBe(2);
  });

  it("a pre-Batch-20-A save (burrata owned, no honey / walnut, a discovered pesto-burrata-pizza) loads and rewrites with its ownership ORDER and Dex entry byte for byte in those fields", () => {
    const burrata = entry("pesto-burrata-pizza", { bestScore: 91, bestStars: 5, timesMade: 3 });
    const owned = ["mushroom", "burrata", "bacon"];
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), burrata], owned, { inventory: { burrata: 7 } }) });
    const loaded = loadSave(s);
    expect(loaded.ownedIngredientIds.filter((id) => owned.includes(id))).toEqual(owned);
    expect(loaded.dex.map((e) => e.recipeId)).not.toContain(NEW_RECIPE);
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.ownedIngredientIds.filter((id: string) => owned.includes(id))).toEqual(owned);
    expect(raw.dex.find((e: DexEntry) => e.recipeId === "pesto-burrata-pizza")).toEqual(burrata);
    expect(raw.inventory.burrata).toBe(7);
    expect(raw.ownedIngredientIds).not.toEqual(expect.arrayContaining(["honey", "walnut"]));
  });

  it("the Research label is derived, never persisted: no field of the save mentions a cohort letter or an anonymous label", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita")], ["mushroom", "walnut"]) });
    rewrite(s);
    expect(JSON.stringify(rawOf(s))).not.toMatch(/cohort|letter|？？？/);
  });

  it("what a pre-Batch-20-A build cannot name (an unknown ingredient / recipe id) survives a rewrite, in order, so a rollback does not lose the data", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry("not-a-recipe-yet")], ["mushroom", "not-a-material-yet", "bacon"]) });
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.ownedIngredientIds.filter((id: string) => ["mushroom", "not-a-material-yet", "bacon"].includes(id))).toEqual(["mushroom", "not-a-material-yet", "bacon"]);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", "not-a-recipe-yet"]);
  });

  it("the new recipe adds exactly one ladder step (71, honey + walnut, keyed to pesto-noci-pizza) and is credited", () => {
    expect(DISCOVERY_LADDER.steps.filter((s) => s.keyRecipeId === NEW_RECIPE).map((s) => [s.step, s.ingredientIds, s.keyRecipeId])).toEqual([[71, ["honey", "walnut"], NEW_RECIPE]]);
    expect(countsTowardLadder(NEW_RECIPE as never)).toBe(true);
  });
});
