import { describe, expect, it } from "vitest";
import {
  SAVE_STORAGE_KEY,
  createDefaultSave,
  loadSave,
  migrateV1toV2,
  persistDex,
  persistMissionBest,
  persistProgress,
  resetSave,
  type PersistentSaveV2,
  type ProgressionSnapshot,
  type StorageLike,
} from "./persistence";
import { registerScoreToDex } from "./dex";
import { createInitialGameState, gameReducer } from "./gameReducer";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { LUNCH_RUSH_MISSION_ID } from "../mission/lunchRush";
import { purchasedHintLevel } from "../logic/discovery/hintPurchase";
import type { ScoreBreakdown } from "../logic/scoring";

/**
 * Discovery Hint Economy 1.0 (Issue #232), HE-1: the persisted hint purchase ledger
 * `discoveryHintPurchases` (`recipeId -> highest purchased hint level`). Same no-bump, ledger and
 * forward-compat rules as `unlockedForShopIngredientIds` (Fresh Audit §10).
 */

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { raw(): Record<string, unknown> } {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    raw: () => JSON.parse(store.get(SAVE_STORAGE_KEY) ?? "null") as Record<string, unknown>,
  };
}

function storageWith(save: Record<string, unknown>) {
  return fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(save) });
}

function snapshotOf(save: PersistentSaveV2): ProgressionSnapshot {
  return {
    dex: save.dex,
    pitzBalance: save.pitzBalance,
    ownedIngredientIds: save.ownedIngredientIds,
    inventory: save.inventory,
    starterGrantClaimedRecipeIds: save.starterGrantClaimedRecipeIds,
    unlockedForShopIngredientIds: save.unlockedForShopIngredientIds,
    discoveryHintPurchases: save.discoveryHintPurchases,
  };
}

function score(total: number, stars: 1 | 2 | 3 | 4 | 5): ScoreBreakdown {
  return { matchScore: total, ingredientScore: total, placementScore: total, bakeScore: total, total, stars };
}

const FUTURE_RECIPE = "brazilian-calabresa";

describe("HE-1: discoveryHintPurchases in save v2", () => {
  it("a fresh save starts with an empty ledger and stays schemaVersion 2", () => {
    const save = createDefaultSave();
    expect(save.discoveryHintPurchases).toEqual({});
    expect(save.schemaVersion).toBe(2);
    expect(loadSave(fakeStorage()).discoveryHintPurchases).toEqual({});
  });

  it("an old v2 save without the field reads as an empty ledger, everything else unchanged", () => {
    const { discoveryHintPurchases: _omit, ...old } = {
      ...createDefaultSave(),
      pitzBalance: 75,
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 80, bestStars: 4, timesMade: 2 }],
    };
    void _omit;
    const loaded = loadSave(storageWith(old));
    expect(loaded.discoveryHintPurchases).toEqual({});
    expect(loaded.pitzBalance).toBe(75);
    expect(loaded.dex).toHaveLength(1);
  });

  it("a v1 save migrates to an empty ledger", () => {
    const v1 = { schemaVersion: 1 as const, dex: [], pitzBalance: 10, ownedIngredientIds: [...STARTER_INGREDIENT_IDS], missionBest: {} };
    expect(migrateV1toV2(v1).discoveryHintPurchases).toEqual({});
    expect(loadSave(storageWith(v1)).discoveryHintPurchases).toEqual({});
  });

  it("a current save round-trips its ledger", () => {
    const save = { ...createDefaultSave(), discoveryHintPurchases: { bismarck: 1, capricciosa: 4 } };
    expect(loadSave(storageWith(save))).toEqual(save);
  });

  it("drops malformed values per entry, never the whole save", () => {
    for (const bad of [null, 3, "x", [1, 2]]) {
      expect(loadSave(storageWith({ ...createDefaultSave(), discoveryHintPurchases: bad })).discoveryHintPurchases).toEqual({});
    }
    const loaded = loadSave(
      storageWith({
        ...createDefaultSave(),
        pitzBalance: 30,
        discoveryHintPurchases: { bismarck: 2, funghi: 0, marinara: -1, genovese: 1.5, pepperoni: "3", salsiccia: null, capricciosa: 3 },
      }),
    );
    expect(loaded.discoveryHintPurchases).toEqual({ bismarck: 2, capricciosa: 3 });
    expect(loaded.pitzBalance).toBe(30);
  });

  it("keeps a future level as stored; gameplay clamps it to the recipe's max when reading", () => {
    const loaded = loadSave(storageWith({ ...createDefaultSave(), discoveryHintPurchases: { bismarck: 6 } }));
    expect(loaded.discoveryHintPurchases).toEqual({ bismarck: 6 });
    expect(purchasedHintLevel(loaded.discoveryHintPurchases, "bismarck", 4)).toBe(4);
    expect(purchasedHintLevel(loaded.discoveryHintPurchases, "bismarck", 3)).toBe(3);
    expect(purchasedHintLevel(loaded.discoveryHintPurchases, "funghi", 4)).toBe(0);
  });

  it("an unknown well-formed recipe id is hidden from gameplay but kept in storage by every write path", () => {
    expect(RECIPES.some((r) => (r.id as string) === FUTURE_RECIPE)).toBe(false);
    const storage = storageWith({
      ...createDefaultSave(),
      discoveryHintPurchases: { bismarck: 2, [FUTURE_RECIPE]: 3, "Not An Id!": 2, "future-bad-level": 0 },
    });
    const loaded = loadSave(storage);
    expect(loaded.discoveryHintPurchases).toEqual({ bismarck: 2 });

    // persistProgress
    persistProgress({ ...snapshotOf(loaded), pitzBalance: loaded.pitzBalance + 5 }, storage);
    expect(storage.raw().discoveryHintPurchases).toEqual({ [FUTURE_RECIPE]: 3, bismarck: 2 });
    // persistDex
    const { dex } = registerScoreToDex(loadSave(storage).dex, "margherita", score(80, 4));
    persistDex(dex, storage);
    expect(storage.raw().discoveryHintPurchases).toEqual({ [FUTURE_RECIPE]: 3, bismarck: 2 });
    // persistMissionBest
    persistMissionBest(LUNCH_RUSH_MISSION_ID, 400, storage);
    expect(storage.raw().discoveryHintPurchases).toEqual({ [FUTURE_RECIPE]: 3, bismarck: 2 });
    expect(storage.raw().schemaVersion).toBe(2);
  });

  it("persistProgress writes a new purchase and merges per id with max (a stale snapshot never lowers or drops one)", () => {
    const storage = storageWith({ ...createDefaultSave(), pitzBalance: 100 });
    const save = loadSave(storage);
    persistProgress({ ...snapshotOf(save), pitzBalance: 95, discoveryHintPurchases: { bismarck: 1 } }, storage);
    expect(loadSave(storage).discoveryHintPurchases).toEqual({ bismarck: 1 });
    expect(loadSave(storage).pitzBalance).toBe(95);

    persistProgress({ ...snapshotOf(save), pitzBalance: 85, discoveryHintPurchases: { bismarck: 2, funghi: 1 } }, storage);
    // A stale snapshot (older, lower levels / missing ids) cannot undo them.
    persistProgress({ ...snapshotOf(save), pitzBalance: 85, discoveryHintPurchases: { bismarck: 1 } }, storage);
    persistProgress({ ...snapshotOf(save), pitzBalance: 85, discoveryHintPurchases: {} }, storage);
    expect(loadSave(storage).discoveryHintPurchases).toEqual({ bismarck: 2, funghi: 1 });
  });

  it("a snapshot without the field leaves the stored ledger as it is", () => {
    const storage = storageWith({ ...createDefaultSave(), discoveryHintPurchases: { bismarck: 3 } });
    const { discoveryHintPurchases: _omit, ...snapshot } = snapshotOf(loadSave(storage));
    void _omit;
    persistProgress({ ...snapshot, pitzBalance: 50 }, storage);
    expect(loadSave(storage).discoveryHintPurchases).toEqual({ bismarck: 3 });
    expect(loadSave(storage).pitzBalance).toBe(50);
  });

  it("an unchanged ledger is a no-op write (no spurious write on mount)", () => {
    const initial = JSON.stringify({ ...createDefaultSave(), discoveryHintPurchases: { bismarck: 3 } });
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: initial });
    let writes = 0;
    const counting: StorageLike = { ...storage, setItem: (k, v) => ((writes += 1), storage.setItem(k, v)) };
    persistProgress(snapshotOf(loadSave(storage)), counting);
    expect(writes).toBe(0);
  });

  it("a purchase record stays after its recipe is discovered", () => {
    const storage = storageWith({ ...createDefaultSave(), discoveryHintPurchases: { margherita: 2 } });
    const save = loadSave(storage);
    const { dex } = registerScoreToDex(save.dex, "margherita", score(80, 4));
    persistProgress({ ...snapshotOf(save), dex }, storage);
    expect(loadSave(storage).discoveryHintPurchases).toEqual({ margherita: 2 });
  });

  it("Full Game Reset clears the ledger together with Pitz and the Dex", () => {
    const storage = storageWith({ ...createDefaultSave(), pitzBalance: 300, discoveryHintPurchases: { bismarck: 4, [FUTURE_RECIPE]: 2 } });
    expect(resetSave(storage)).toBe(true);
    const save = loadSave(storage);
    expect(save.discoveryHintPurchases).toEqual({});
    expect(save.pitzBalance).toBe(0);
  });

  it("GameState hydrates the ledger and carries it unchanged through fresh rounds", () => {
    const state = createInitialGameState(undefined, undefined, 0, undefined, [], [], { bismarck: 2 });
    expect(state.discoveryHintPurchases).toEqual({ bismarck: 2 });
    expect(createInitialGameState().discoveryHintPurchases).toEqual({});
    let s = state;
    for (const action of [
      { type: "START_FREE_COOK" },
      { type: "RETRY_SAME_RECIPE" },
      { type: "PLAY_AGAIN" },
      { type: "SELECT_RECIPE", recipeId: "margherita" },
      { type: "MISSION_RESET_ORDER" },
    ] as const) {
      s = gameReducer(s, action);
      expect(s.discoveryHintPurchases, action.type).toBe(state.discoveryHintPurchases);
    }
  });
});
