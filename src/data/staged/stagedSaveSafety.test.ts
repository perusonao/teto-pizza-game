import { describe, expect, it } from "vitest";
import { createDefaultSave, loadSave, SAVE_STORAGE_KEY, type StorageLike } from "../../state/persistence";
import { STAGED_INGREDIENTS } from "./testSupport/stagedIngredients";
import { STAGED_RECIPES } from "./testSupport/stagedRecipes";

/**
 * Save safety of the Staged Catalog (Issue #780 plan §7-5). Staged ids are never written by production code (isolation test),
 * so this pins what happens if one ever reaches a stored save anyway (e.g. a future DEV / Preview build that enables a train):
 * loading in the current (Production) build drops ONLY the staged ids and keeps every shipped entry, Pitz and the stored
 * text itself untouched (a read never writes). The drop is also why a Gate-OFF rollback needs #668 before any train ships.
 */
function memoryStorage(initial: Record<string, string>): StorageLike & { data: Record<string, string>; writes: number } {
  const data = { ...initial };
  const s = {
    data,
    writes: 0,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { s.writes += 1; data[k] = v; },
    removeItem: (k: string) => { s.writes += 1; delete data[k]; },
  };
  return s as never;
}

describe("Staged Catalog — save safety", () => {
  const stagedRecipe = STAGED_RECIPES[0].id;
  const stagedIng = STAGED_INGREDIENTS.find((i) => i.status === "ACTIVE")!.id;
  const base = createDefaultSave();
  const raw = {
    ...base,
    pitzBalance: 1234,
    dex: [
      { recipeId: "margherita", discovered: true, bestScore: 88, bestStars: 3, timesMade: 4 },
      { recipeId: stagedRecipe, discovered: true, bestScore: 90, bestStars: 3, timesMade: 1 },
    ],
    ownedIngredientIds: [...base.ownedIngredientIds, stagedIng],
    inventory: { ...base.inventory, [stagedIng]: 3 },
  };

  it("drops only staged ids on load and keeps shipped data", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(raw) });
    const loaded = loadSave(storage);
    expect(loaded.dex.map((d) => d.recipeId)).toEqual(["margherita"]);
    expect(loaded.dex[0]).toMatchObject({ bestScore: 88, timesMade: 4 });
    expect(loaded.pitzBalance).toBe(1234);
    expect(loaded.ownedIngredientIds).not.toContain(stagedIng);
    expect(Object.keys(loaded.inventory)).not.toContain(stagedIng);
    for (const id of base.ownedIngredientIds) expect(loaded.ownedIngredientIds).toContain(id);
  });

  it("a load never rewrites the stored text", () => {
    const text = JSON.stringify(raw);
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: text });
    loadSave(storage);
    expect(storage.writes).toBe(0);
    expect(storage.data[SAVE_STORAGE_KEY]).toBe(text);
  });

  it("the test build uses the Production save key (Preview builds use their own key)", () => {
    expect(SAVE_STORAGE_KEY).toBe("teto-pizza-save-v1");
  });
});
