import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES, countsTowardLadder } from "../data/recipes";
import { LATE_LADDER_STEPS } from "../data/lateCatalog";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type PersistentSaveV2 } from "./persistence";
import { memoryStorage } from "./testSupport/memoryStorage";
import { resolveShopEntitlement } from "./materialEntitlement";
import type { DexEntry } from "./dex";

/**
 * Expansion Batch 18 (Issue #748, PROVISIONAL SPEC): the schema stays v2, nothing is migrated. The cilantro keeps its id, so a save that already holds it (stock / ledger / owned order), a Dex that already holds bbq-chicken-pizza (the late
 * recipe that shares the cilantro) and every earlier entitlement are untouched; the two new recipes are plain new Dex ids; an id this build cannot name is kept on a rewrite.
 */
const NEW_RECIPES = ["baingan-bharta-pizza", "reina-pepiada-pizza"];
const entry = (recipeId: string, extra: Partial<DexEntry> = {}): DexEntry => ({ recipeId, discovered: true, bestScore: 88, bestStars: 4, timesMade: 2, ...extra });
const stored = (dex: DexEntry[], owned: string[], ledger: string[] = owned, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ schemaVersion: 2, dex, pitzBalance: 100, ownedIngredientIds: owned, unlockedForShopIngredientIds: ledger, missionBest: {}, inventory: {}, ...extra });
const rawOf = (s: { getItem(k: string): string | null }) => JSON.parse(s.getItem(SAVE_STORAGE_KEY) ?? "null");
const rewrite = (s: ReturnType<typeof memoryStorage>) => {
  const loaded = loadSave(s);
  persistProgress({ ...(loaded as PersistentSaveV2), pitzBalance: loaded.pitzBalance + 1 }, s);
};

describe("Batch 18 save compatibility", () => {
  it("the new recipes are known to this build: they load as written and a rewrite keeps them (schema v2)", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), ...NEW_RECIPES.map((id) => entry(id))], ["mushroom", "cilantro"]) });
    expect(loadSave(s).dex.map((e) => e.recipeId)).toEqual(["margherita", ...NEW_RECIPES]);
    rewrite(s);
    expect(rawOf(s).dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", ...NEW_RECIPES]);
    expect(rawOf(s).schemaVersion).toBe(2);
  });

  it("a pre-Batch-18 save that holds the late cilantro, its ownership ORDER (bbq-sauce before cilantro) and the discovered bbq-chicken-pizza loads and rewrites byte for byte in those fields", () => {
    const bbq = entry("bbq-chicken-pizza", { bestScore: 93, bestStars: 5, timesMade: 4 });
    const owned = ["mushroom", "bbq-sauce", "cilantro", "wasabi"];
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), bbq], owned, owned, { inventory: { cilantro: 7, "bbq-sauce": 3 } }) });
    const loaded = loadSave(s);
    expect(loaded.ownedIngredientIds.filter((id) => ["bbq-sauce", "cilantro", "wasabi"].includes(id))).toEqual(["bbq-sauce", "cilantro", "wasabi"]);
    expect(loaded.dex.find((e) => e.recipeId === "bbq-chicken-pizza")).toEqual(bbq);
    expect(loaded.dex.map((e) => e.recipeId)).not.toEqual(expect.arrayContaining(NEW_RECIPES));
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.ownedIngredientIds.filter((id: string) => ["bbq-sauce", "cilantro", "wasabi"].includes(id))).toEqual(["bbq-sauce", "cilantro", "wasabi"]);
    expect(raw.dex.find((e: DexEntry) => e.recipeId === "bbq-chicken-pizza")).toEqual(bbq);
    expect(raw.inventory.cilantro).toBe(7); // stock of the promoted material is untouched
    expect(raw.inventory["bbq-sauce"]).toBe(3);
  });

  it("the Research label is derived, never persisted: no field of the save mentions a cohort letter or an anonymous label", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita")], ["mushroom", "cilantro"]) });
    rewrite(s);
    expect(JSON.stringify(rawOf(s))).not.toMatch(/cohort|letter|？？？/);
  });

  it("what a pre-Batch-18 build cannot name (an unknown ingredient / recipe id) survives a rewrite, in order, so a rollback does not lose the data", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry("not-a-recipe-yet")], ["mushroom", "not-a-material-yet", "bacon"]) });
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.ownedIngredientIds.filter((id: string) => ["mushroom", "not-a-material-yet", "bacon"].includes(id))).toEqual(["mushroom", "not-a-material-yet", "bacon"]);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", "not-a-recipe-yet"]);
  });

  it("the entitlement: a stale save at 66 / 67 / 68 credited discoveries still receives bbq-sauce THEN cilantro (the fixed floor, unchanged order), and nothing is ever taken back", () => {
    const credited = RECIPES.filter((r) => countsTowardLadder(r.id as never)).map((r) => r.id as string);
    const lateIds = [...LATE_LADDER_STEPS.flatMap((st) => st.ingredientIds), "cilantro"];
    const ladderOwned = (c: number) => DISCOVERY_LADDER.steps.filter((st) => st.step <= c).flatMap((st) => st.ingredientIds).filter((i) => !lateIds.includes(i));
    const at = (c: number) => resolveShopEntitlement(credited.slice(0, c).map((recipeId) => entry(recipeId)), [...STARTER_INGREDIENT_IDS, ...ladderOwned(c)], [...STARTER_INGREDIENT_IDS], DISCOVERY_LADDER).unlockedForShopIngredientIds;
    for (const c of [66, 67, 68]) {
      const ids = at(c);
      expect(ids, `count ${c}`).toEqual(expect.arrayContaining(["bbq-sauce", "cilantro"]));
      expect(ids.indexOf("bbq-sauce"), `count ${c}`).toBeLessThan(ids.indexOf("cilantro"));
    }
    for (const c of [60, 65, 66, 67, 68, 69]) expect(at(c).every((id) => at(c + 1).includes(id)), `count ${c}`).toBe(true); // (set containment: the promoted cilantro moves within the ledger ARRAY at 69, which is not a re-lock)
  });

  it("the new recipes add exactly one ladder step (69, cilantro, keyed to baingan-bharta-pizza); reina-pepiada-pizza is not credited, so it adds none and the discovered count does not move for it", () => {
    expect(DISCOVERY_LADDER.steps.filter((s) => NEW_RECIPES.includes(s.keyRecipeId)).map((s) => [s.step, s.ingredientIds, s.keyRecipeId])).toEqual([[69, ["cilantro"], "baingan-bharta-pizza"]]);
    expect(countsTowardLadder("baingan-bharta-pizza" as never)).toBe(true);
    expect(countsTowardLadder("reina-pepiada-pizza" as never)).toBe(false);
  });
});
