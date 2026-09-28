import { describe, expect, it } from "vitest";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import {
  createDefaultSave,
  loadSave,
  MAX_TECHNIQUE_LEDGER_SIZE,
  persistProgress,
  resetSave,
  SAVE_STORAGE_KEY,
  type StorageLike,
} from "./persistence";

/**
 * Cooking Techniques 1.0 TQ-1A (Issue #262): the `discoveredTechniqueIds` ledger in save v2.
 * No schema bump; nothing in gameplay writes it yet (TQ-1C).
 */

function memoryStorage(save?: Record<string, unknown>): StorageLike & { raw(): Record<string, unknown> } {
  const data = new Map<string, string>();
  if (save) data.set(SAVE_STORAGE_KEY, JSON.stringify(save));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    raw: () => JSON.parse(data.get(SAVE_STORAGE_KEY) ?? "null") as Record<string, unknown>,
  };
}

function v2(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 2,
    dex: [],
    pitzBalance: 0,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
    missionBest: {},
    inventory: {},
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: [],
    ...extra,
  };
}

const snapshotOf = (storage: StorageLike, discoveredTechniqueIds?: readonly string[], pitzBalance?: number) => {
  const save = loadSave(storage);
  return { ...save, pitzBalance: pitzBalance ?? save.pitzBalance, discoveredTechniqueIds };
};

describe("discoveredTechniqueIds: load", () => {
  it("a fresh save and every older save read back as [] (no schema bump)", () => {
    expect(createDefaultSave().discoveredTechniqueIds).toEqual([]);
    expect(createDefaultSave().schemaVersion).toBe(2);
    expect(loadSave(memoryStorage(v2())).discoveredTechniqueIds).toEqual([]);
    const v1 = { schemaVersion: 1, dex: [], pitzBalance: 0, ownedIngredientIds: [], missionBest: {} };
    expect(loadSave(memoryStorage(v1)).discoveredTechniqueIds).toEqual([]);
  });

  it("repairs a corrupted value field by field; the rest of the save survives", () => {
    for (const bad of [42, "no-sauce", { 0: "no-sauce" }, null, true]) {
      const loaded = loadSave(memoryStorage(v2({ discoveredTechniqueIds: bad, pitzBalance: 30 })));
      expect(loaded.discoveredTechniqueIds).toEqual([]);
      expect(loaded.pitzBalance).toBe(30);
    }
    const mixed = ["no-sauce", "no-sauce", 7, null, "__proto__", "NO-SAUCE", "", " no-sauce", {}];
    expect(loadSave(memoryStorage(v2({ discoveredTechniqueIds: mixed }))).discoveredTechniqueIds).toEqual(["no-sauce"]);
  });

  it("gameplay never sees an id this build does not know", () => {
    expect(loadSave(memoryStorage(v2({ discoveredTechniqueIds: ["post-bake", "no-sauce"] }))).discoveredTechniqueIds).toEqual(["no-sauce"]);
  });
});

describe("discoveredTechniqueIds: write", () => {
  it("absent in the snapshot leaves the stored ledger as it is", () => {
    const storage = memoryStorage(v2({ discoveredTechniqueIds: ["no-sauce"] }));
    persistProgress(snapshotOf(storage, undefined, 10), storage);
    expect(storage.raw().discoveredTechniqueIds).toEqual(["no-sauce"]);
  });

  it("is a union: a stale or empty snapshot never removes a technique", () => {
    const storage = memoryStorage(v2());
    persistProgress(snapshotOf(storage, ["no-sauce"]), storage);
    expect(storage.raw().discoveredTechniqueIds).toEqual(["no-sauce"]);
    persistProgress(snapshotOf(storage, [], 20), storage);
    expect(storage.raw().discoveredTechniqueIds).toEqual(["no-sauce"]);
    persistProgress(snapshotOf(storage, ["no-sauce", "no-sauce"], 30), storage);
    expect(storage.raw().discoveredTechniqueIds).toEqual(["no-sauce"]);
  });

  it("a newly discovered technique alone is enough to trigger a write", () => {
    const storage = memoryStorage(v2());
    persistProgress(snapshotOf(storage, ["no-sauce"]), storage);
    expect(loadSave(storage).discoveredTechniqueIds).toEqual(["no-sauce"]);
  });

  it("preserves a well-formed unknown id a newer build wrote, and drops a malformed one", () => {
    const storage = memoryStorage(v2({ discoveredTechniqueIds: ["post-bake", "Post Bake", "__proto__", "x".repeat(100)] }));
    persistProgress(snapshotOf(storage, ["no-sauce"], 5), storage);
    expect(storage.raw().discoveredTechniqueIds).toEqual(["no-sauce", "post-bake"]);
    expect(loadSave(storage).discoveredTechniqueIds).toEqual(["no-sauce"]);
  });

  it("caps the stored ledger (known + unknown) at MAX_TECHNIQUE_LEDGER_SIZE", () => {
    const many = Array.from({ length: 200 }, (_, i) => `future-${i}`);
    const storage = memoryStorage(v2({ discoveredTechniqueIds: many }));
    persistProgress(snapshotOf(storage, ["no-sauce"], 5), storage);
    const stored = storage.raw().discoveredTechniqueIds as string[];
    expect(stored).toHaveLength(MAX_TECHNIQUE_LEDGER_SIZE);
    expect(stored[0]).toBe("no-sauce");
  });

  it("a future top-level field survives this build's write (the mechanism that keeps this ledger alive in older builds)", () => {
    const storage = memoryStorage(v2({ futureTechniqueModes: { "no-sauce": 1 } }));
    persistProgress(snapshotOf(storage, ["no-sauce"], 5), storage);
    expect(storage.raw().futureTechniqueModes).toEqual({ "no-sauce": 1 });
  });
});

describe("discoveredTechniqueIds: Full Reset", () => {
  it("resetSave clears the ledger together with the rest of the save", () => {
    const storage = memoryStorage(v2({ discoveredTechniqueIds: ["no-sauce", "post-bake"] }));
    expect(resetSave(storage)).toBe(true);
    expect(loadSave(storage).discoveredTechniqueIds).toEqual([]);
    persistProgress(snapshotOf(storage, undefined, 1), storage);
    expect(storage.raw().discoveredTechniqueIds).toEqual([]);
  });
});
