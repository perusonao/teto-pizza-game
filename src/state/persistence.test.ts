import { describe, expect, it } from "vitest";
import {
  SAVE_STORAGE_KEY,
  clearSave,
  createDefaultSave,
  loadMissionBest,
  loadSave,
  persistDex,
  persistMissionBest,
  persistProgress,
  type StorageLike,
} from "./persistence";
import { EMPTY_DEX, registerScoreToDex, type DexEntry } from "./dex";
import type { ScoreBreakdown, QualityStars } from "../logic/scoring";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { LUNCH_RUSH_MISSION_ID } from "../mission/lunchRush";

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

describe("ownedIngredientIds (Phase 3C-3 Starter Set backfill)", () => {
  it("a fresh save owns all 13 starter ingredients", () => {
    const save = loadSave(fakeStorage());
    expect(save.ownedIngredientIds.sort()).toEqual([...STARTER_INGREDIENT_IDS].sort());
  });

  it("an existing save with an empty ownedIngredientIds still gets every starter ingredient", () => {
    // Simulates a pre-3C-3 save (or one that otherwise ended up with an empty list) --
    // starter ownership must never be lost just because this field was empty/absent.
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: saveWith({ ownedIngredientIds: [] }),
    });
    const save = loadSave(storage);
    expect(save.ownedIngredientIds.sort()).toEqual([...STARTER_INGREDIENT_IDS].sort());
  });

  it("backfills starter ingredients missing from an otherwise-valid partial list", () => {
    const partial = STARTER_INGREDIENT_IDS.slice(1); // missing the first starter ingredient
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: saveWith({ ownedIngredientIds: partial }),
    });
    const save = loadSave(storage);
    expect(save.ownedIngredientIds.sort()).toEqual([...STARTER_INGREDIENT_IDS].sort());
  });

  it("drops unknown ingredient ids while keeping the full starter set", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: saveWith({
        ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "not-a-real-ingredient"],
      }),
    });
    const save = loadSave(storage);
    expect(save.ownedIngredientIds).not.toContain("not-a-real-ingredient");
    expect(save.ownedIngredientIds.sort()).toEqual([...STARTER_INGREDIENT_IDS].sort());
  });

  it("roundtrips an already-valid ownedIngredientIds list unchanged", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: saveWith({ ownedIngredientIds: [...STARTER_INGREDIENT_IDS] }),
    });
    const save = loadSave(storage);
    expect(save.ownedIngredientIds.sort()).toEqual([...STARTER_INGREDIENT_IDS].sort());
  });

  it("a corrupt/unknown-schemaVersion save still falls back to full starter ownership", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: JSON.stringify({ ...createDefaultSave(), schemaVersion: 999 }),
    });
    const save = loadSave(storage);
    expect(save.ownedIngredientIds.sort()).toEqual([...STARTER_INGREDIENT_IDS].sort());
  });
});

describe("persistProgress (Phase 3C-5)", () => {
  it("roundtrips pitzBalance", () => {
    const storage = fakeStorage();
    persistProgress({ dex: EMPTY_DEX, pitzBalance: 120, ownedIngredientIds: STARTER_INGREDIENT_IDS }, storage);
    expect(loadSave(storage).pitzBalance).toBe(120);
  });

  it("roundtrips a purchased (non-starter) ownedIngredientIds entry", () => {
    const storage = fakeStorage();
    const owned = [...STARTER_INGREDIENT_IDS];
    persistProgress({ dex: EMPTY_DEX, pitzBalance: 0, ownedIngredientIds: owned }, storage);
    expect(loadSave(storage).ownedIngredientIds.sort()).toEqual([...owned].sort());
  });

  it("roundtrips a purchased salami (Phase 3C-6's first real non-Starter ingredient)", () => {
    const storage = fakeStorage();
    const owned = [...STARTER_INGREDIENT_IDS, "salami"];
    persistProgress({ dex: EMPTY_DEX, pitzBalance: 0, ownedIngredientIds: owned }, storage);
    const loaded = loadSave(storage).ownedIngredientIds;
    expect(loaded).toContain("salami");
    expect(loaded.sort()).toEqual([...owned].sort());
  });

  it("a reload after purchasing salami keeps it OWNED (does not fall back to LOCKED)", () => {
    const storage = fakeStorage();
    persistProgress(
      { dex: EMPTY_DEX, pitzBalance: 0, ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "salami"] },
      storage,
    );
    // Simulate a fresh reload: read the save back exactly like App.tsx's mount-time hydration.
    const reloaded = loadSave(storage);
    expect(reloaded.ownedIngredientIds).toContain("salami");
  });

  it("a Pitz balance update does not clobber an existing Dex", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: saveWith({ dex: [validEntry] }) });
    persistProgress(
      { dex: [validEntry], pitzBalance: 90, ownedIngredientIds: STARTER_INGREDIENT_IDS },
      storage,
    );
    const save = loadSave(storage);
    expect(save.dex).toEqual([validEntry]);
    expect(save.pitzBalance).toBe(90);
  });

  it("a Pitz balance / purchase update does not clobber missionBest", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: saveWith({ missionBest: { "lunch-rush": 742 } }) });
    persistProgress(
      { dex: EMPTY_DEX, pitzBalance: 200, ownedIngredientIds: STARTER_INGREDIENT_IDS },
      storage,
    );
    const save = loadSave(storage);
    expect(save.missionBest).toEqual({ "lunch-rush": 742 });
    expect(save.pitzBalance).toBe(200);
  });

  it("a missionBest update (persistMissionBest) does not clobber pitzBalance or ownedIngredientIds", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: saveWith({ pitzBalance: 150 }) });
    persistMissionBest("lunch-rush", 500, storage);
    const save = loadSave(storage);
    expect(save.pitzBalance).toBe(150);
    expect(save.missionBest["lunch-rush"]).toBe(500);
  });

  it("does not rewrite storage when nothing in the snapshot actually changed", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: saveWith({ pitzBalance: 60, ownedIngredientIds: [...STARTER_INGREDIENT_IDS] }),
    });
    const before = storage.getItem(SAVE_STORAGE_KEY);
    persistProgress({ dex: EMPTY_DEX, pitzBalance: 60, ownedIngredientIds: STARTER_INGREDIENT_IDS }, storage);
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(before);
  });

  it("does not throw when the storage backend throws on write", () => {
    expect(() =>
      persistProgress(
        { dex: EMPTY_DEX, pitzBalance: 10, ownedIngredientIds: STARTER_INGREDIENT_IDS },
        throwingStorage(),
      ),
    ).not.toThrow();
  });

  it("never overwrites a save with an unrecognized schemaVersion (same guard as persistDex)", () => {
    const untouchedRaw = JSON.stringify({
      schemaVersion: 999,
      dex: [validEntry],
      pitzBalance: 500,
      ownedIngredientIds: [],
      missionBest: { someFutureMission: true },
    });
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: untouchedRaw });

    const hydrated = loadSave(storage); // falls back to defaults -- schemaVersion 999 is unknown
    persistProgress(hydrated, storage);

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

describe("Mission BEST (Phase 3C-4)", () => {
  it("loadMissionBest is 0 for a fresh player (no save at all)", () => {
    expect(loadMissionBest(LUNCH_RUSH_MISSION_ID, fakeStorage())).toBe(0);
  });

  it("loadMissionBest is 0 when the save exists but has no entry for this mission id", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: saveWith({ missionBest: {} }) });
    expect(loadMissionBest(LUNCH_RUSH_MISSION_ID, storage)).toBe(0);
  });

  it("persistMissionBest writes a first score and loadMissionBest reads it back", () => {
    const storage = fakeStorage();
    persistMissionBest(LUNCH_RUSH_MISSION_ID, 742, storage);
    expect(loadMissionBest(LUNCH_RUSH_MISSION_ID, storage)).toBe(742);
  });

  it("persistMissionBest never lets BEST go down (monotonic, like Dex BEST)", () => {
    const storage = fakeStorage();
    persistMissionBest(LUNCH_RUSH_MISSION_ID, 742, storage);
    persistMissionBest(LUNCH_RUSH_MISSION_ID, 500, storage);
    expect(loadMissionBest(LUNCH_RUSH_MISSION_ID, storage)).toBe(742);
  });

  it("persistMissionBest updates BEST when the new score is strictly higher", () => {
    const storage = fakeStorage();
    persistMissionBest(LUNCH_RUSH_MISSION_ID, 500, storage);
    persistMissionBest(LUNCH_RUSH_MISSION_ID, 742, storage);
    expect(loadMissionBest(LUNCH_RUSH_MISSION_ID, storage)).toBe(742);
  });

  it("persistMissionBest keys BEST per mission id -- other missions never collide", () => {
    const storage = fakeStorage();
    persistMissionBest(LUNCH_RUSH_MISSION_ID, 300, storage);
    persistMissionBest("some-other-future-mission", 900, storage);
    expect(loadMissionBest(LUNCH_RUSH_MISSION_ID, storage)).toBe(300);
    expect(loadMissionBest("some-other-future-mission", storage)).toBe(900);
  });

  it("persistMissionBest preserves other saved fields (Dex, ownedIngredientIds)", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: saveWith({ dex: [validEntry] }) });
    persistMissionBest(LUNCH_RUSH_MISSION_ID, 400, storage);
    const save = loadSave(storage);
    expect(save.dex).toEqual([validEntry]);
    expect(save.missionBest[LUNCH_RUSH_MISSION_ID]).toBe(400);
  });

  it("persistMissionBest does not throw when the storage backend throws on write", () => {
    expect(() => persistMissionBest(LUNCH_RUSH_MISSION_ID, 100, throwingStorage())).not.toThrow();
  });

  it("sanitizes a corrupt missionBest record on load: negative/non-integer/non-numeric values are dropped", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: JSON.stringify({
        ...createDefaultSave(),
        missionBest: {
          [LUNCH_RUSH_MISSION_ID]: 742,
          negative: -5,
          fractional: 12.5,
          notANumber: "742",
          nullish: null,
        },
      }),
    });
    const save = loadSave(storage);
    expect(save.missionBest).toEqual({ [LUNCH_RUSH_MISSION_ID]: 742 });
  });

  it("a malformed (non-object) missionBest falls back to an empty record instead of throwing", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: JSON.stringify({ ...createDefaultSave(), missionBest: "not-an-object" }),
    });
    expect(loadSave(storage).missionBest).toEqual({});
  });
});
