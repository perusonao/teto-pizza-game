import { describe, expect, it } from "vitest";
import {
  SAVE_STORAGE_KEY,
  createDefaultSave,
  loadSave,
  persistDex,
  persistMissionBest,
  persistProgress,
  resetSave,
  type PersistentSaveV2,
  type StorageLike,
} from "./persistence";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { LUNCH_RUSH_MISSION_ID } from "../mission/lunchRush";
import type { DexEntry } from "./dex";

/**
 * Progression 2.0 W1 Integration I4b-2: the Shop entitlement ledger `unlockedForShopIngredientIds`
 * (REC-04; docs/reports/TETO_PROGRESS2_W1_I4B_Fresh-Audit.md §3 H/K). Persistence only: nothing in
 * the runtime reads or writes it until I4b-3.
 */

function fakeStorage(initial: Record<string, string> = {}): StorageLike & {
  raw(): Record<string, unknown> | undefined;
  writes(): number;
} {
  const store = new Map(Object.entries(initial));
  let writes = 0;
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      writes += 1;
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    raw: () => {
      const value = store.get(SAVE_STORAGE_KEY);
      return value === undefined ? undefined : JSON.parse(value);
    },
    writes: () => writes,
  };
}

const margherita: DexEntry = {
  recipeId: "margherita",
  discovered: true,
  bestScore: 80,
  bestStars: 4,
  timesMade: 2,
};

/** A save as main wrote it before I4b-2: no entitlement key, EP4-granted ingredients and stock. */
function legacyEp4Save(): Record<string, unknown> {
  const save: Record<string, unknown> = {
    ...createDefaultSave(),
    dex: [margherita, { ...margherita, recipeId: "funghi" }],
    pitzBalance: 75,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "mushroom"],
    inventory: { mushroom: 17 },
    starterGrantClaimedRecipeIds: ["funghi"],
  };
  delete save.unlockedForShopIngredientIds;
  return save;
}

function snapshotOf(save: PersistentSaveV2) {
  return {
    dex: save.dex,
    pitzBalance: save.pitzBalance,
    ownedIngredientIds: save.ownedIngredientIds,
    inventory: save.inventory,
    starterGrantClaimedRecipeIds: save.starterGrantClaimedRecipeIds,
  };
}

describe("unlockedForShopIngredientIds: schema", () => {
  it("a fresh save starts with an empty ledger and stays schemaVersion 2", () => {
    const save = createDefaultSave();
    expect(save.schemaVersion).toBe(2);
    expect(save.unlockedForShopIngredientIds).toEqual([]);
  });

  it("an old v2 save without the key reads back [] and keeps everything else unchanged", () => {
    const legacy = legacyEp4Save();
    const loaded = loadSave(fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(legacy) }));
    expect(loaded.unlockedForShopIngredientIds).toEqual([]);
    expect(loaded.ownedIngredientIds).toEqual(legacy.ownedIngredientIds);
    expect(loaded.inventory).toEqual({ mushroom: 17 });
    expect(loaded.starterGrantClaimedRecipeIds).toEqual(["funghi"]);
    expect(loaded.pitzBalance).toBe(75);
  });

  it("a v1 save migrates with an empty ledger", () => {
    const v1 = {
      schemaVersion: 1,
      dex: [margherita],
      pitzBalance: 10,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
      missionBest: {},
    };
    const loaded = loadSave(fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(v1) }));
    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.unlockedForShopIngredientIds).toEqual([]);
  });

  it("sanitizes: keeps known non-starter ids once in first-seen order; drops starters and junk", () => {
    const raw = {
      ...createDefaultSave(),
      unlockedForShopIngredientIds: [
        "bacon",
        "egg",
        "bacon",
        "mozzarella",
        "tomato-sauce",
        "",
        42,
        null,
        { id: "ham" },
        "future-ingredient",
        "NOT VALID",
        "ham",
      ],
    };
    const loaded = loadSave(fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(raw) }));
    expect(loaded.unlockedForShopIngredientIds).toEqual(["bacon", "egg", "ham"]);
  });

  it("a non-array value reads back []", () => {
    for (const bad of [null, "egg", 3, { egg: true }]) {
      const raw = { ...createDefaultSave(), unlockedForShopIngredientIds: bad };
      expect(loadSave(fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(raw) })).unlockedForShopIngredientIds).toEqual([]);
    }
  });
});

describe("unlockedForShopIngredientIds: persistProgress", () => {
  it("a snapshot without the field leaves the stored ledger untouched", () => {
    const stored = { ...createDefaultSave(), dex: [margherita], unlockedForShopIngredientIds: ["egg"] };
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(stored) });
    const save = loadSave(storage);
    persistProgress({ ...snapshotOf(save), pitzBalance: 99 }, storage);
    expect(storage.raw()?.unlockedForShopIngredientIds).toEqual(["egg"]);
    expect(storage.raw()?.pitzBalance).toBe(99);
  });

  it("writes the ledger when it is the only change, and skips the write when nothing changed", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(createDefaultSave()) });
    const save = loadSave(storage);
    persistProgress({ ...snapshotOf(save), unlockedForShopIngredientIds: ["egg"] }, storage);
    expect(storage.writes()).toBe(1);
    expect(storage.raw()?.unlockedForShopIngredientIds).toEqual(["egg"]);
    persistProgress({ ...snapshotOf(loadSave(storage)), unlockedForShopIngredientIds: ["egg"] }, storage);
    expect(storage.writes()).toBe(1);
  });

  it("never removes an id: a smaller snapshot is unioned with what is stored", () => {
    const stored = { ...createDefaultSave(), unlockedForShopIngredientIds: ["egg", "bacon"] };
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(stored) });
    persistProgress({ ...snapshotOf(loadSave(storage)), unlockedForShopIngredientIds: ["mushroom"] }, storage);
    expect(storage.raw()?.unlockedForShopIngredientIds).toEqual(["egg", "bacon", "mushroom"]);
    persistProgress({ ...snapshotOf(loadSave(storage)), unlockedForShopIngredientIds: [] }, storage);
    expect(storage.raw()?.unlockedForShopIngredientIds).toEqual(["egg", "bacon", "mushroom"]);
  });

  it("strips starters from a snapshot", () => {
    const storage = fakeStorage();
    persistProgress(
      { ...snapshotOf(createDefaultSave()), unlockedForShopIngredientIds: ["basil", "egg", "mozzarella"] },
      storage,
    );
    expect(storage.raw()?.unlockedForShopIngredientIds).toEqual(["egg"]);
  });

  it("unlocking never touches existing inventory or ownership", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(legacyEp4Save()) });
    const save = loadSave(storage);
    persistProgress({ ...snapshotOf(save), unlockedForShopIngredientIds: ["egg", "bacon", "mushroom"] }, storage);
    const raw = storage.raw() as unknown as PersistentSaveV2;
    expect(raw.inventory).toEqual({ mushroom: 17 });
    expect(raw.ownedIngredientIds).toEqual(legacyEp4Save().ownedIngredientIds);
    expect(raw.starterGrantClaimedRecipeIds).toEqual(["funghi"]);
    expect(raw.unlockedForShopIngredientIds).toEqual(["egg", "bacon", "mushroom"]);
  });
});

describe("unlockedForShopIngredientIds: I0 forward compatibility", () => {
  const withUnknown = () => ({
    ...createDefaultSave(),
    dex: [margherita],
    unlockedForShopIngredientIds: ["egg", "future-ingredient", "bacon"],
  });

  it("unknown ids survive persistProgress, persistDex and persistMissionBest", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(withUnknown()) });
    const save = loadSave(storage);
    expect(save.unlockedForShopIngredientIds).toEqual(["egg", "bacon"]);

    persistProgress({ ...snapshotOf(save), unlockedForShopIngredientIds: ["egg", "bacon", "ham"] }, storage);
    expect(storage.raw()?.unlockedForShopIngredientIds).toEqual(["egg", "bacon", "ham", "future-ingredient"]);

    persistDex([{ ...margherita, timesMade: 9 }], storage);
    persistMissionBest(LUNCH_RUSH_MISSION_ID, 400, storage);
    expect(storage.raw()?.unlockedForShopIngredientIds).toEqual(["egg", "bacon", "ham", "future-ingredient"]);
    expect(loadSave(storage).unlockedForShopIngredientIds).toEqual(["egg", "bacon", "ham"]);
  });

  it("an old build's write (no ledger field in its snapshot) keeps the whole list", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(withUnknown()) });
    persistProgress({ ...snapshotOf(loadSave(storage)), pitzBalance: 5 }, storage);
    expect(storage.raw()?.unlockedForShopIngredientIds).toEqual(["egg", "bacon", "future-ingredient"]);
  });
});

describe("Full Game Reset", () => {
  it("resetSave deletes the whole save, ledger included; the next load starts empty", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: JSON.stringify({ ...withEverything(), unlockedForShopIngredientIds: ["egg", "future-x"] }),
    });
    expect(resetSave(storage)).toBe(true);
    expect(storage.raw()).toBeUndefined();
    expect(loadSave(storage)).toEqual(createDefaultSave());
  });
});

function withEverything(): Record<string, unknown> {
  return { ...legacyEp4Save(), missionBest: { [LUNCH_RUSH_MISSION_ID]: 10 } };
}
