import { describe, expect, it } from "vitest";
import {
  SAVE_STORAGE_KEY,
  clearSave,
  createDefaultSave,
  loadSave,
  persistDex,
  type StorageLike,
} from "./persistence";
import { EMPTY_DEX, registerScoreToDex, type DexEntry } from "./dex";
import type { ScoreBreakdown, QualityStars } from "../logic/scoring";

function scoreOf(total: number, stars: QualityStars): ScoreBreakdown {
  return {
    matchScore: total,
    ingredientScore: total,
    placementScore: total,
    bakeScore: total,
    total,
    stars,
  };
}

/** In-memory fake of the `Storage` interface so these tests don't depend on jsdom/localStorage
 *  being present (vitest here runs in a plain "node" environment). */
function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

function throwingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error("storage unavailable");
    },
    setItem: () => {
      throw new Error("storage unavailable");
    },
    removeItem: () => {
      throw new Error("storage unavailable");
    },
  };
}

const validEntry: DexEntry = {
  recipeId: "margherita",
  discovered: true,
  bestScore: 91,
  bestStars: 5,
  timesMade: 3,
};

/** Builds a raw save payload from the default save plus overrides. `overrides` is
 *  intentionally untyped (`Record<string, unknown>`, not `Partial<PersistentSaveV1>`) since
 *  several tests below deliberately construct malformed Dex entries to exercise validation --
 *  those shapes must not type-check as real `DexEntry`/`PersistentSaveV1` values. */
function saveWith(overrides: Record<string, unknown>): string {
  return JSON.stringify({ ...createDefaultSave(), ...overrides });
}

describe("loadSave", () => {
  it("returns a fresh default save when nothing is stored", () => {
    const save = loadSave(fakeStorage());
    expect(save).toEqual(createDefaultSave());
    expect(save.dex).toEqual([]);
    expect(save.pitzBalance).toBe(0);
    expect(save.missionBest).toEqual({});
  });

  it("hydrates a valid save's Dex entries", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: saveWith({ dex: [validEntry] }),
    });
    const save = loadSave(storage);
    expect(save.dex).toEqual([validEntry]);
  });

  it("falls back to fresh on malformed JSON", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: "{bad json" });
    expect(loadSave(storage)).toEqual(createDefaultSave());
  });

  it("falls back to fresh on an unknown schemaVersion", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: JSON.stringify({ ...createDefaultSave(), schemaVersion: 999 }),
    });
    expect(loadSave(storage)).toEqual(createDefaultSave());
  });

  it("falls back to fresh when the root isn't a valid save object", () => {
    const roots = ['"just a string"', "42", "null", "[]", "{}", JSON.stringify({ dex: "nope" })];
    for (const raw of roots) {
      const storage = fakeStorage({ [SAVE_STORAGE_KEY]: raw });
      expect(loadSave(storage)).toEqual(createDefaultSave());
    }
  });

  it("skips a Dex entry with an unknown recipeId, keeping valid entries", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: saveWith({
        dex: [validEntry, { ...validEntry, recipeId: "not-a-real-recipe" }],
      }),
    });
    expect(loadSave(storage).dex).toEqual([validEntry]);
  });

  it("skips a Dex entry with bestScore outside 0-100", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: saveWith({
        dex: [
          validEntry,
          { ...validEntry, recipeId: "marinara", bestScore: 101 },
          { ...validEntry, recipeId: "funghi", bestScore: -5 },
        ],
      }),
    });
    expect(loadSave(storage).dex).toEqual([validEntry]);
  });

  it("skips a Dex entry with an invalid bestStars", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: saveWith({
        dex: [
          validEntry,
          { ...validEntry, recipeId: "marinara", bestStars: 0 },
          { ...validEntry, recipeId: "funghi", bestStars: 6 },
          { ...validEntry, recipeId: "genovese", bestStars: 2.5 },
          { ...validEntry, recipeId: "bismarck", bestStars: "5" },
        ],
      }),
    });
    expect(loadSave(storage).dex).toEqual([validEntry]);
  });

  it("skips a Dex entry with a negative or non-integer timesMade", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: saveWith({
        dex: [
          validEntry,
          { ...validEntry, recipeId: "marinara", timesMade: -1 },
          { ...validEntry, recipeId: "funghi", timesMade: 1.5 },
        ],
      }),
    });
    expect(loadSave(storage).dex).toEqual([validEntry]);
  });

  it("drops an entry that isn't an object at all, without touching the rest", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: saveWith({ dex: [validEntry, null, "garbage", 42] }),
    });
    expect(loadSave(storage).dex).toEqual([validEntry]);
  });

  it("falls back to defaults instead of crashing when storage throws", () => {
    expect(() => loadSave(throwingStorage())).not.toThrow();
    expect(loadSave(throwingStorage())).toEqual(createDefaultSave());
  });

  it("treats no storage backend (e.g. SSR/no window) as a fresh save", () => {
    expect(loadSave(null)).toEqual(createDefaultSave());
  });
});

describe("persistDex / loadSave roundtrip", () => {
  it("serializes and deserializes a Dex back to an equal value", () => {
    const storage = fakeStorage();
    const { dex } = registerScoreToDex(EMPTY_DEX, "margherita", scoreOf(91, 5));

    persistDex(dex, storage);
    expect(loadSave(storage).dex).toEqual(dex);
  });

  it("keeps Dex BEST across a simulated reload", () => {
    const storage = fakeStorage();
    let dex = EMPTY_DEX;
    dex = registerScoreToDex(dex, "margherita", scoreOf(72, 3)).dex;
    dex = registerScoreToDex(dex, "margherita", scoreOf(91, 5)).dex;
    persistDex(dex, storage);

    const reloaded = loadSave(storage).dex;
    const entry = reloaded.find((e) => e.recipeId === "margherita");
    expect(entry?.bestScore).toBe(91);
    expect(entry?.bestStars).toBe(5);
  });

  it("keeps timesMade across a simulated reload after multiple rounds", () => {
    const storage = fakeStorage();
    let dex = EMPTY_DEX;
    dex = registerScoreToDex(dex, "margherita", scoreOf(72, 3)).dex;
    persistDex(dex, storage);
    dex = registerScoreToDex(loadSave(storage).dex, "margherita", scoreOf(65, 3)).dex;
    persistDex(dex, storage);

    const entry = loadSave(storage).dex.find((e) => e.recipeId === "margherita");
    expect(entry?.timesMade).toBe(2);
  });

  it("preserves other saved fields when only the Dex is rewritten", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: saveWith({ pitzBalance: 40 }),
    });
    persistDex([validEntry], storage);
    const save = loadSave(storage);
    expect(save.pitzBalance).toBe(40);
    expect(save.dex).toEqual([validEntry]);
  });

  it("does not throw when the storage backend throws on write", () => {
    expect(() => persistDex([validEntry], throwingStorage())).not.toThrow();
  });

  it("does not rewrite storage when the given Dex already matches what's stored", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: saveWith({ dex: [validEntry] }) });
    const before = storage.getItem(SAVE_STORAGE_KEY);
    persistDex([validEntry], storage);
    // Same string instance -- setItem was never called, not just "wrote the same thing".
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(before);
  });

  it("never overwrites a save with an unrecognized schemaVersion just because hydration fell back to an empty Dex", () => {
    // Regression test (PR #16 review): App.tsx's persistence effect also fires once on
    // mount with whatever the initial hydration produced. If storage holds a save this
    // client doesn't understand (e.g. a newer schemaVersion with real progression),
    // loadSave().dex correctly falls back to [] -- but persistDex must never take that as
    // license to blindly overwrite the real, still-unrecognized save with a fresh empty one
    // before the player has done anything.
    const untouchedRaw = JSON.stringify({
      schemaVersion: 999,
      dex: [validEntry],
      pitzBalance: 500,
      ownedIngredientIds: [],
      missionBest: { someFutureMission: true },
    });
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: untouchedRaw });

    const hydratedDex = loadSave(storage).dex; // falls back to [] -- schemaVersion 999 is unknown
    expect(hydratedDex).toEqual([]);
    persistDex(hydratedDex, storage);

    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(untouchedRaw);
  });
});

describe("clearSave", () => {
  it("removes a stored save so the next load is fresh", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: saveWith({ dex: [validEntry] }) });
    clearSave(storage);
    expect(loadSave(storage)).toEqual(createDefaultSave());
  });

  it("does not throw when storage is unavailable or throws", () => {
    expect(() => clearSave(null)).not.toThrow();
    expect(() => clearSave(throwingStorage())).not.toThrow();
  });
});
