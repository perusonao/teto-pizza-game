import { describe, expect, it } from "vitest";
import { SAVE_STORAGE_KEY, createDefaultSave, loadSave, persistProgress, type ProgressionSnapshot } from "./persistence";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { FUTURE_V3, GOLDEN_ERAS, UNUSABLE_ROOTS } from "./testSupport/saveGoldenFixtures";
import { memoryStorage } from "./testSupport/memoryStorage";

/**
 * Save Compatibility Phase A (Issue #559): every era's frozen save opens in THIS build with its progression intact, and
 * loading it (or saving it unchanged) never touches the stored bytes. These assert the desired behaviour and pass today.
 */

describe("golden saves: an old save opens with its progression intact", () => {
  for (const era of GOLDEN_ERAS) {
    describe(era.name, () => {
      it("loads as a current (v2) save with the Dex, Pitz, stock and BEST it was written with", () => {
        const save = loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: era.raw }));
        expect(save.schemaVersion).toBe(2);
        expect(save.dex.map((e) => e.recipeId)).toEqual(era.expect.dexIds);
        expect(save.dex.every((e) => e.discovered)).toBe(true);
        expect(save.pitzBalance).toBe(era.expect.pitzBalance);
        expect(save.inventory).toEqual(era.expect.inventory);
        expect(save.missionBest).toEqual(era.expect.missionBest);
      });

      it("always owns the whole Starter Set, whatever the stored list held", () => {
        const save = loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: era.raw }));
        for (const id of STARTER_INGREDIENT_IDS) expect(save.ownedIngredientIds).toContain(id);
      });

      it("fields absent from the era read back as empty, never undefined", () => {
        const save = loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: era.raw }));
        expect(Array.isArray(save.starterGrantClaimedRecipeIds)).toBe(true);
        expect(Array.isArray(save.unlockedForShopIngredientIds)).toBe(true);
        expect(Array.isArray(save.discoveredTechniqueIds)).toBe(true);
        expect(save.discoveryHintPurchases).toBeTypeOf("object");
        expect(save.researchExclusions).toBeTypeOf("object");
      });

      it("loading never writes", () => {
        const storage = memoryStorage({ [SAVE_STORAGE_KEY]: era.raw });
        loadSave(storage);
        expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(era.raw);
      });

      it("saving back exactly what was loaded is a no-op (the stored bytes are not rewritten)", () => {
        const storage = memoryStorage({ [SAVE_STORAGE_KEY]: era.raw });
        persistProgress(loadSave(storage) as ProgressionSnapshot, storage);
        expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(era.raw);
      });

      it("a real change keeps every other stored field (nothing is reset by a write)", () => {
        const storage = memoryStorage({ [SAVE_STORAGE_KEY]: era.raw });
        const before = loadSave(storage);
        persistProgress({ ...before, pitzBalance: before.pitzBalance + 10 }, storage);
        const after = loadSave(storage);
        expect(after.pitzBalance).toBe(before.pitzBalance + 10);
        expect(after.dex).toEqual(before.dex);
        expect(after.inventory).toEqual(before.inventory);
        expect(after.missionBest).toEqual(before.missionBest);
        expect(after.ownedIngredientIds).toEqual(before.ownedIngredientIds);
        expect(after.discoveryHintPurchases).toEqual(before.discoveryHintPurchases);
        expect(after.discoveryHintFacts).toEqual(before.discoveryHintFacts);
        expect(after.discoveredTechniqueIds).toEqual(before.discoveredTechniqueIds);
        expect(after.researchExclusions).toEqual(before.researchExclusions);
        expect(after.starterGrantClaimedRecipeIds).toEqual(before.starterGrantClaimedRecipeIds);
        expect(after.unlockedForShopIngredientIds).toEqual(before.unlockedForShopIngredientIds);
      });
    });
  }

  it("the newest era's ledgers (hints, technique, research) survive load", () => {
    const era = GOLDEN_ERAS[GOLDEN_ERAS.length - 1];
    const save = loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: era.raw }));
    expect(save.discoveryHintPurchases).toEqual({ fugazza: 2 });
    expect(save.discoveryHintFacts).toEqual({ fugazza: ["ing:mozzarella"] });
    expect(save.discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect(save.researchExclusions).toEqual({ margherita: ["onion"] });
    expect(save.starterGrantClaimedRecipeIds).toEqual(["fugazza"]);
    expect(save.unlockedForShopIngredientIds).toEqual(["onion"]);
  });

  it("a v1 purchaser of a finite ingredient is migrated with usable stock, never 0 (no 'bought but unusable')", () => {
    const save = loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: GOLDEN_ERAS[1].raw }));
    expect(save.ownedIngredientIds).toContain("onion");
    expect(save.inventory.onion).toBeGreaterThan(0);
  });
});

describe("an unusable stored root never breaks loading", () => {
  for (const { name, raw } of UNUSABLE_ROOTS) {
    it(`${name}: loadSave returns a fresh default and does not throw`, () => {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
      expect(loadSave(storage)).toEqual(createDefaultSave());
      expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(raw);
    });
  }

  it("an unrecognized future schemaVersion loads as a fresh default and the stored bytes are untouched on load", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
    expect(loadSave(storage)).toEqual(createDefaultSave());
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(FUTURE_V3);
  });

  it("mount-time no-op: persisting the hydrated default over a future-version or corrupt save writes nothing", () => {
    for (const raw of [FUTURE_V3, ...UNUSABLE_ROOTS.map((u) => u.raw)]) {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
      persistProgress(loadSave(storage) as ProgressionSnapshot, storage);
      expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(raw);
    }
  });
});
