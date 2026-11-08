import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { countsTowardLadder } from "../data/recipes";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type PersistentSaveV2 } from "./persistence";
import { memoryStorage } from "./testSupport/memoryStorage";
import type { DexEntry } from "./dex";

/**
 * Expansion Batch 19 (Issue #774, PROVISIONAL SPEC; AC-10): the schema stays v2, nothing is migrated. `burrata` and the two recipes are plain new ids; a pre-Batch-19 save (no burrata, no new Dex entry) loads and rewrites unchanged in the fields it had; the new ids load and rewrite as written;
 * an id this build cannot name is kept on a rewrite (rollback safe); the Research label is derived, never persisted.
 */
const NEW_RECIPES = ["pesto-burrata-pizza", "pizza-alla-crudaiola"];
const entry = (recipeId: string, extra: Partial<DexEntry> = {}): DexEntry => ({ recipeId, discovered: true, bestScore: 88, bestStars: 4, timesMade: 2, ...extra });
const stored = (dex: DexEntry[], owned: string[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ schemaVersion: 2, dex, pitzBalance: 100, ownedIngredientIds: owned, unlockedForShopIngredientIds: owned, missionBest: {}, inventory: {}, ...extra });
const rawOf = (s: { getItem(k: string): string | null }) => JSON.parse(s.getItem(SAVE_STORAGE_KEY) ?? "null");
const rewrite = (s: ReturnType<typeof memoryStorage>) => {
  const loaded = loadSave(s);
  persistProgress({ ...(loaded as PersistentSaveV2), pitzBalance: loaded.pitzBalance + 1 }, s);
};

describe("Batch 19 save compatibility", () => {
  it("the new recipes and burrata are known to this build: they load as written and a rewrite keeps them (schema v2)", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), ...NEW_RECIPES.map((id) => entry(id))], ["mushroom", "burrata"], { inventory: { burrata: 9 } }) });
    expect(loadSave(s).dex.map((e) => e.recipeId)).toEqual(["margherita", ...NEW_RECIPES]);
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", ...NEW_RECIPES]);
    expect(raw.ownedIngredientIds).toContain("burrata");
    expect(raw.inventory.burrata).toBe(9);
    expect(raw.schemaVersion).toBe(2);
  });

  it("a pre-Batch-19 save (cilantro owned, no burrata, a discovered baingan) loads and rewrites with its ownership ORDER and Dex entry byte for byte in those fields", () => {
    const baingan = entry("baingan-bharta-pizza", { bestScore: 93, bestStars: 5, timesMade: 4 });
    const owned = ["mushroom", "cilantro", "bacon"];
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), baingan], owned, { inventory: { cilantro: 7 } }) });
    const loaded = loadSave(s);
    expect(loaded.ownedIngredientIds.filter((id) => owned.includes(id))).toEqual(owned);
    expect(loaded.dex.map((e) => e.recipeId)).not.toEqual(expect.arrayContaining(NEW_RECIPES));
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.ownedIngredientIds.filter((id: string) => owned.includes(id))).toEqual(owned);
    expect(raw.dex.find((e: DexEntry) => e.recipeId === "baingan-bharta-pizza")).toEqual(baingan);
    expect(raw.inventory.cilantro).toBe(7);
  });

  it("the Research label is derived, never persisted: no field of the save mentions a cohort letter or an anonymous label", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita")], ["mushroom", "burrata"]) });
    rewrite(s);
    expect(JSON.stringify(rawOf(s))).not.toMatch(/cohort|letter|？？？/);
  });

  it("what a pre-Batch-19 build cannot name (an unknown ingredient / recipe id) survives a rewrite, in order, so a rollback does not lose the data", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry("not-a-recipe-yet")], ["mushroom", "not-a-material-yet", "bacon"]) });
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.ownedIngredientIds.filter((id: string) => ["mushroom", "not-a-material-yet", "bacon"].includes(id))).toEqual(["mushroom", "not-a-material-yet", "bacon"]);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", "not-a-recipe-yet"]);
  });

  it("the new recipes add exactly one ladder step (70, burrata, keyed to pesto-burrata-pizza); pizza-alla-crudaiola is not credited, so it adds none", () => {
    expect(DISCOVERY_LADDER.steps.filter((s) => NEW_RECIPES.includes(s.keyRecipeId)).map((s) => [s.step, s.ingredientIds, s.keyRecipeId])).toEqual([[70, ["burrata"], "pesto-burrata-pizza"]]);
    expect(countsTowardLadder("pesto-burrata-pizza" as never)).toBe(true);
    expect(countsTowardLadder("pizza-alla-crudaiola" as never)).toBe(false);
  });
});
