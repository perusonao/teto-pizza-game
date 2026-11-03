import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES, countsTowardLadder } from "../data/recipes";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type PersistentSaveV2 } from "./persistence";
import { memoryStorage } from "./testSupport/memoryStorage";
import { resolveShopEntitlement } from "./materialEntitlement";
import type { DexEntry } from "./dex";

/**
 * Expansion Batch 16 (Issue #736, PROVISIONAL SPEC): the schema stays v2, nothing is migrated. A save from before Batch 16 loads unchanged -- in particular a Dex that already holds shirasu-pizza (whose whitebait / shiso materials the
 * new recipe shares) keeps that entry byte for byte; a save that already holds the new material / Dex entry round-trips; an id this build cannot name (what a PRE-Batch-16 build sees of the new ones) is kept on a rewrite (the #674 / unknownIdsIn mechanism).
 */
const NEW_RECIPE = "ume-shiso-pizza";
const NEW_MATERIAL = "umeboshi-paste";
const entry = (recipeId: string, extra: Partial<DexEntry> = {}): DexEntry => ({ recipeId, discovered: true, bestScore: 88, bestStars: 4, timesMade: 2, ...extra });
const stored = (dex: DexEntry[], owned: string[], ledger: string[] = owned) =>
  JSON.stringify({ schemaVersion: 2, dex, pitzBalance: 100, ownedIngredientIds: owned, unlockedForShopIngredientIds: ledger, missionBest: {}, inventory: {} });
const rawOf = (s: { getItem(k: string): string | null }) => JSON.parse(s.getItem(SAVE_STORAGE_KEY) ?? "null");
const rewrite = (s: ReturnType<typeof memoryStorage>) => {
  const loaded = loadSave(s);
  persistProgress({ ...(loaded as PersistentSaveV2), pitzBalance: loaded.pitzBalance + 1 }, s);
};

describe("Batch 16 save compatibility", () => {
  it("the new material and recipe are known to this build: they load as written and a rewrite keeps them (schema v2)", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry(NEW_RECIPE)], ["mushroom", NEW_MATERIAL]) });
    const loaded = loadSave(s);
    expect(loaded.dex.map((e) => e.recipeId)).toEqual(["margherita", NEW_RECIPE]);
    expect(loaded.ownedIngredientIds).toContain(NEW_MATERIAL);
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", NEW_RECIPE]);
    expect(raw.ownedIngredientIds).toEqual(expect.arrayContaining([NEW_MATERIAL]));
    expect(raw.schemaVersion).toBe(2);
  });

  it("a save from before Batch 16 that already discovered shirasu-pizza keeps that entry exactly, and gains neither the new recipe nor the new material by itself", () => {
    const shirasu = entry("shirasu-pizza", { bestScore: 91, bestStars: 5, timesMade: 7 });
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), shirasu], ["mushroom", "shiso", "whitebait"]) });
    const loaded = loadSave(s);
    expect(loaded.dex.find((e) => e.recipeId === "shirasu-pizza")).toEqual(shirasu);
    expect(loaded.dex.map((e) => e.recipeId)).not.toContain(NEW_RECIPE);
    expect(loaded.ownedIngredientIds).not.toContain(NEW_MATERIAL);
    rewrite(s);
    expect(rawOf(s).dex.find((e: DexEntry) => e.recipeId === "shirasu-pizza")).toEqual(shirasu);
    expect(rawOf(s).dex.map((e: DexEntry) => e.recipeId)).not.toContain(NEW_RECIPE);
    expect(rawOf(s).ownedIngredientIds).not.toContain(NEW_MATERIAL);
  });

  it("the Research label is derived, never persisted: no field of the save mentions a cohort letter or an anonymous label", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita")], ["mushroom", NEW_MATERIAL]) });
    rewrite(s);
    expect(JSON.stringify(rawOf(s))).not.toMatch(/cohort|letter|？？？/);
    expect(rawOf(s).ownedIngredientIds).not.toContain("ume-shiso-pizza");
  });

  it("what a pre-Batch-16 build cannot name (an unknown ingredient / recipe id) survives a rewrite, in order, so a rollback does not lose the data", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry("not-a-recipe-yet")], ["mushroom", "not-a-material-yet", "bacon"]) });
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.ownedIngredientIds.filter((id: string) => ["mushroom", "not-a-material-yet", "bacon"].includes(id))).toEqual(["mushroom", "not-a-material-yet", "bacon"]);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", "not-a-recipe-yet"]);
  });

  it("a save holding the Batch 14 / 15 recipes and the Batch 14 material keeps them after a Batch 16 rewrite", () => {
    const owned = ["mushroom", "cinnamon", "beef"];
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry("margherita"), entry("moussaka-style-pizza"), entry("nigerian-suya-pizza"), entry("rendang-pizza")], owned) });
    rewrite(s);
    const raw = rawOf(s);
    expect(raw.dex.map((e: DexEntry) => e.recipeId)).toEqual(["margherita", "moussaka-style-pizza", "nigerian-suya-pizza", "rendang-pizza"]);
    expect(raw.ownedIngredientIds).toEqual(expect.arrayContaining(owned));
    expect(raw.ownedIngredientIds).not.toContain(NEW_MATERIAL);
  });

  it("the Batch 16 entitlement: 66 credited discoveries do not unlock umeboshi-paste; 67 do, at the same count as the FIXED late floors of soy-sauce / wasabi; every earlier entitlement is unchanged", () => {
    const credited = RECIPES.filter((r) => countsTowardLadder(r.id as never)).map((r) => r.id as string);
    const at = (c: number) => resolveShopEntitlement(credited.slice(0, c).map((recipeId) => entry(recipeId)), [...STARTER_INGREDIENT_IDS], [], DISCOVERY_LADDER).unlockedForShopIngredientIds;
    expect(at(66)).not.toContain(NEW_MATERIAL);
    expect(at(67)).toContain(NEW_MATERIAL);
    expect(at(67).filter((id) => !at(66).includes(id)).sort()).toEqual([NEW_MATERIAL, "soy-sauce", "wasabi"].sort());
    expect(at(68).filter((id) => !at(67).includes(id)).sort()).toEqual(["cod-roe", "fresh-cream-sauce", "nori"]); // the late floor 68, not moved by the new ordinary step
    for (const c of [60, 64, 65, 66]) expect(at(c + 1).filter((id) => at(c).includes(id)), `count ${c}`).toEqual(at(c)); // nothing is ever taken back
  });

  it("the new recipe adds exactly one ladder step (67) and no other ledger change: the ladder grows by one entry keyed to it", () => {
    expect(DISCOVERY_LADDER.steps.filter((s) => s.keyRecipeId === NEW_RECIPE).map((s) => [s.step, s.ingredientIds])).toEqual([[67, [NEW_MATERIAL]]]);
  });
});
