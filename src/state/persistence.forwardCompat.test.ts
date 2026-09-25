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
import { registerScoreToDex, type DexEntry } from "./dex";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { LUNCH_RUSH_MISSION_ID } from "../mission/lunchRush";
import { applyStarterGrants } from "./starterStock";
import { createInitialGameState } from "./gameReducer";
import type { ScoreBreakdown } from "../logic/scoring";

/**
 * Progression 2.0 Phase 3-4B: save forward-compatibility. A save written by a newer build can
 * carry recipe/ingredient ids this build doesn't know yet (Progression 2.0 content tranches).
 * `loadSave` keeps hiding them from gameplay exactly as before; every *write* must now carry them
 * through instead of erasing them, while corrupt data is still dropped.
 */

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { raw(): unknown } {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    raw: () => {
      const value = store.get(SAVE_STORAGE_KEY);
      return value === undefined ? undefined : JSON.parse(value);
    },
  };
}

const FUTURE_RECIPE = "brazilian-calabresa";
const FUTURE_INGREDIENT = "calabresa";
const PURCHASABLE = INGREDIENTS.find((i) => !STARTER_INGREDIENT_IDS.includes(i.id))!.id;

const knownEntry: DexEntry = {
  recipeId: "margherita",
  discovered: true,
  bestScore: 91,
  bestStars: 5,
  timesMade: 3,
};
const futureEntry: DexEntry = {
  recipeId: FUTURE_RECIPE,
  discovered: true,
  bestScore: 77,
  bestStars: 4,
  timesMade: 2,
};

function score(total: number, stars: 1 | 2 | 3 | 4 | 5): ScoreBreakdown {
  return {
    matchScore: total,
    ingredientScore: total,
    placementScore: total,
    bakeScore: total,
    total,
    stars,
  };
}

/** A save as a newer (Progression 2.0) build would write it. */
function futureSave(): Record<string, unknown> {
  return {
    ...createDefaultSave(),
    dex: [knownEntry, futureEntry],
    pitzBalance: 120,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS, PURCHASABLE, FUTURE_INGREDIENT],
    missionBest: { [LUNCH_RUSH_MISSION_ID]: 500, "dinner-rush": 300 },
    inventory: { [PURCHASABLE]: 6, [FUTURE_INGREDIENT]: 10 },
    starterGrantClaimedRecipeIds: ["margherita", FUTURE_RECIPE],
    futureLedger: { purchased: [FUTURE_INGREDIENT] },
  };
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

/** Plays one round in the "old" build: load, register a known-recipe score, persist. */
function playOneRound(storage: StorageLike): void {
  const save = loadSave(storage);
  const { dex } = registerScoreToDex(save.dex, "marinara", score(60, 3));
  persistProgress({ ...snapshotOf(save), dex, pitzBalance: save.pitzBalance + 5 }, storage);
}

function expectFutureDataPreserved(raw: Record<string, unknown>): void {
  expect(raw.dex).toContainEqual(futureEntry);
  expect(raw.ownedIngredientIds).toContain(FUTURE_INGREDIENT);
  expect(raw.inventory).toMatchObject({ [FUTURE_INGREDIENT]: 10 });
  expect(raw.starterGrantClaimedRecipeIds).toContain(FUTURE_RECIPE);
  expect(raw.missionBest).toMatchObject({ "dinner-rush": 300 });
  expect(raw.futureLedger).toEqual({ purchased: [FUTURE_INGREDIENT] });
}

describe("save forward-compat (Phase 3-4B)", () => {
  it("fixture ids really are unknown to this build", () => {
    expect(RECIPES.some((r) => (r.id as string) === FUTURE_RECIPE)).toBe(false);
    expect(INGREDIENTS.some((i) => (i.id as string) === FUTURE_INGREDIENT)).toBe(false);
  });

  it("current save -> load -> save keeps every existing field", () => {
    const current = {
      ...createDefaultSave(),
      dex: [knownEntry],
      pitzBalance: 40,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, PURCHASABLE],
      missionBest: { [LUNCH_RUSH_MISSION_ID]: 250 },
      inventory: { [PURCHASABLE]: 3 },
      starterGrantClaimedRecipeIds: ["margherita"],
    };
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(current) });
    playOneRound(storage);
    const raw = storage.raw() as PersistentSaveV2;
    expect(raw.dex[0]).toEqual(knownEntry);
    expect(raw.dex.map((e) => e.recipeId)).toEqual(["margherita", "marinara"]);
    expect(raw.pitzBalance).toBe(45);
    expect(raw.ownedIngredientIds).toEqual(current.ownedIngredientIds);
    expect(raw.missionBest).toEqual(current.missionBest);
    expect(raw.inventory).toEqual(current.inventory);
    expect(raw.starterGrantClaimedRecipeIds).toEqual(current.starterGrantClaimedRecipeIds);
    expect(Object.keys(raw).sort()).toEqual(Object.keys(current).sort());
  });

  it("loadSave still hides unknown ids from gameplay (runtime view unchanged)", () => {
    const save = loadSave(fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(futureSave()) }));
    expect(save.dex).toEqual([knownEntry]);
    expect(save.ownedIngredientIds).not.toContain(FUTURE_INGREDIENT);
    expect(save.ownedIngredientIds).toContain(PURCHASABLE);
    expect(save.inventory).toEqual({ [PURCHASABLE]: 6 });
    expect(save.starterGrantClaimedRecipeIds).toEqual(["margherita"]);
    expect(save).not.toHaveProperty("futureLedger");
  });

  it("runtime hydration is identical with or without future data in the save", () => {
    const hydrate = (raw: Record<string, unknown>) => {
      const save = loadSave(fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(raw) }));
      const grant = applyStarterGrants(
        save.dex,
        save.ownedIngredientIds,
        save.inventory,
        save.starterGrantClaimedRecipeIds,
      );
      return createInitialGameState(
        save.dex,
        grant.ownedIngredientIds,
        save.pitzBalance,
        grant.inventory,
        grant.claimedRecipeIds,
      );
    };
    const withFuture = futureSave();
    const withoutFuture = {
      ...createDefaultSave(),
      dex: [knownEntry],
      pitzBalance: 120,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, PURCHASABLE],
      missionBest: { [LUNCH_RUSH_MISSION_ID]: 500 },
      inventory: { [PURCHASABLE]: 6 },
      starterGrantClaimedRecipeIds: ["margherita"],
    };
    const a = hydrate(withFuture);
    const b = hydrate(withoutFuture);
    expect(a.dex).toEqual(b.dex);
    expect(a.ownedIngredientIds).toEqual(b.ownedIngredientIds);
    expect(a.inventory).toEqual(b.inventory);
    expect(a.pitzBalance).toBe(b.pitzBalance);
    expect(a.starterGrantClaimedRecipeIds).toEqual(b.starterGrantClaimedRecipeIds);
  });

  it("persistProgress keeps unknown recipe/Dex, ingredient, inventory, ledger and top-level data", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(futureSave()) });
    playOneRound(storage);
    const raw = storage.raw() as Record<string, unknown>;
    expectFutureDataPreserved(raw);
    // Known data still reflects this build's write.
    expect(raw.pitzBalance).toBe(125);
    expect((raw.dex as DexEntry[]).map((e) => e.recipeId)).toEqual([
      "margherita",
      "marinara",
      FUTURE_RECIPE,
    ]);
    expect(raw.inventory).toMatchObject({ [PURCHASABLE]: 6 });
  });

  it("persistDex and persistMissionBest also keep future data", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(futureSave()) });
    const { dex } = registerScoreToDex(loadSave(storage).dex, "marinara", score(60, 3));
    persistDex(dex, storage);
    expectFutureDataPreserved(storage.raw() as Record<string, unknown>);

    persistMissionBest(LUNCH_RUSH_MISSION_ID, 900, storage);
    const raw = storage.raw() as Record<string, unknown>;
    expectFutureDataPreserved(raw);
    expect(raw.missionBest).toEqual({ [LUNCH_RUSH_MISSION_ID]: 900, "dinner-rush": 300 });
  });

  it("downgrade -> save -> reload -> save again: future data survives repeated round-trips", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(futureSave()) });
    playOneRound(storage);
    playOneRound(storage);
    const raw = storage.raw() as Record<string, unknown>;
    expectFutureDataPreserved(raw);
    // No duplicates accumulate across writes.
    const dexIds = (raw.dex as DexEntry[]).map((e) => e.recipeId);
    expect(new Set(dexIds).size).toBe(dexIds.length);
    const owned = raw.ownedIngredientIds as string[];
    expect(new Set(owned).size).toBe(owned.length);
    const claimed = raw.starterGrantClaimedRecipeIds as string[];
    expect(new Set(claimed).size).toBe(claimed.length);
    // An "upgraded" reader (here: the raw JSON) still sees the future entry unchanged.
    expect((raw.dex as DexEntry[]).find((e) => e.recipeId === FUTURE_RECIPE)).toEqual(futureEntry);
  });

  it("a no-op mount write still never touches storage", () => {
    const original = JSON.stringify(futureSave());
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: original });
    persistProgress(snapshotOf(loadSave(storage)), storage);
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(original);
  });

  it("drops malformed unknown data: bad ids, negative/NaN/fractional stock, invalid Dex shapes", () => {
    const corrupt = {
      ...createDefaultSave(),
      dex: [
        knownEntry,
        { ...futureEntry, recipeId: "bad-stars", bestStars: 9 },
        { ...futureEntry, recipeId: "bad-score", bestScore: -1 },
        { ...futureEntry, recipeId: "bad-times", timesMade: 1.5 },
        { ...futureEntry, recipeId: "bad-discovered", discovered: "yes" },
        { ...futureEntry, recipeId: "Not Valid Id" },
        { ...futureEntry, recipeId: "" },
        { ...futureEntry, recipeId: 42 },
        "not-an-object",
        null,
        futureEntry,
        { ...futureEntry, bestScore: 10 }, // duplicate future id: first one wins
      ],
      ownedIngredientIds: [
        ...STARTER_INGREDIENT_IDS,
        FUTURE_INGREDIENT,
        FUTURE_INGREDIENT,
        "",
        "UPPER",
        "has space",
        "x".repeat(65),
        7,
        null,
      ],
      inventory: {
        [FUTURE_INGREDIENT]: 10,
        "neg-item": -1,
        "frac-item": 1.5,
        "str-item": "3",
        "Bad Key": 2,
        [STARTER_INGREDIENT_IDS[0]]: 5,
      },
      starterGrantClaimedRecipeIds: [FUTURE_RECIPE, "Bad Id", 3, null],
    };
    // A raw `__proto__` key (JSON.parse makes it an own property) must never be carried through.
    const corruptJson = JSON.stringify(corrupt).replace(/^\{/, '{"__proto__":{"polluted":true},');
    // NaN is not representable in JSON; exercise it through the raw string directly.
    const json = corruptJson.replace('"neg-item":-1', '"neg-item":-1,"nan-item":NaN');
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: json });
    // NaN makes the JSON unparseable -> whole save falls back to default (pre-existing behavior).
    expect(loadSave(storage)).toEqual(createDefaultSave());

    const storage2 = fakeStorage({ [SAVE_STORAGE_KEY]: corruptJson });
    playOneRound(storage2);
    const raw = storage2.raw() as Record<string, unknown>;
    expect((raw.dex as DexEntry[]).map((e) => e.recipeId)).toEqual([
      "margherita",
      "marinara",
      FUTURE_RECIPE,
    ]);
    expect((raw.dex as DexEntry[])[2]).toEqual(futureEntry);
    expect(raw.ownedIngredientIds).toEqual([...STARTER_INGREDIENT_IDS, FUTURE_INGREDIENT]);
    expect(raw.inventory).toEqual({ [FUTURE_INGREDIENT]: 10 });
    expect(raw.starterGrantClaimedRecipeIds).toEqual([FUTURE_RECIPE]);
    expect(Object.prototype.hasOwnProperty.call(raw, "__proto__")).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("drops invalid-shape fields entirely without crashing (non-array / non-object)", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: JSON.stringify({
        ...createDefaultSave(),
        dex: [knownEntry],
        ownedIngredientIds: "calabresa",
        inventory: [FUTURE_INGREDIENT],
        starterGrantClaimedRecipeIds: { [FUTURE_RECIPE]: true },
      }),
    });
    playOneRound(storage);
    const raw = storage.raw() as PersistentSaveV2;
    expect(raw.ownedIngredientIds).toEqual([...STARTER_INGREDIENT_IDS]);
    expect(raw.inventory).toEqual({});
    expect(raw.starterGrantClaimedRecipeIds).toEqual([]);
  });

  it("v1 migration keeps known data and carries unknown ids through the first v2 write", () => {
    const v1 = {
      schemaVersion: 1,
      dex: [knownEntry, futureEntry],
      pitzBalance: 30,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, PURCHASABLE, FUTURE_INGREDIENT],
      missionBest: { [LUNCH_RUSH_MISSION_ID]: 200 },
      futureTopLevel: 1,
    };
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(v1) });
    const migrated = loadSave(storage);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.dex).toEqual([knownEntry]);
    expect(migrated.pitzBalance).toBe(30);
    expect(migrated.ownedIngredientIds).toContain(PURCHASABLE);
    expect(migrated.inventory).toHaveProperty(PURCHASABLE);
    expect(migrated.inventory).not.toHaveProperty(FUTURE_INGREDIENT);

    playOneRound(storage);
    const raw = storage.raw() as Record<string, unknown>;
    expect(raw.schemaVersion).toBe(2);
    expect(raw.dex).toContainEqual(knownEntry);
    expect(raw.dex).toContainEqual(futureEntry);
    expect(raw.ownedIngredientIds).toContain(PURCHASABLE);
    expect(raw.ownedIngredientIds).toContain(FUTURE_INGREDIENT);
    expect(raw.futureTopLevel).toBe(1);
  });

  it("an unrecognized schemaVersion still falls back to defaults (unchanged policy)", () => {
    const storage = fakeStorage({
      [SAVE_STORAGE_KEY]: JSON.stringify({ ...futureSave(), schemaVersion: 3 }),
    });
    expect(loadSave(storage)).toEqual(createDefaultSave());
  });

  it("reset / new game starts from a clean default, with no future data resurrected", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(futureSave()) });
    expect(resetSave(storage)).toBe(true);
    expect(loadSave(storage)).toEqual(createDefaultSave());
    playOneRound(storage);
    const raw = storage.raw() as Record<string, unknown>;
    expect(raw.dex).not.toContainEqual(futureEntry);
    expect(raw.ownedIngredientIds).toEqual([...STARTER_INGREDIENT_IDS]);
    expect(raw.inventory).toEqual({});
    expect(raw).not.toHaveProperty("futureLedger");
  });

  it("a brand-new player's first write is exactly the default shape (no extras)", () => {
    const storage = fakeStorage();
    playOneRound(storage);
    const raw = storage.raw() as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual(Object.keys(createDefaultSave()).sort());
  });
});

/**
 * B-2 (PR #206 Final Preflight): PR #217 names `unlockedForShopIngredientIds` as the permanent
 * shop-unlock entitlement set a Progression 2.0 build adds at top level (schemaVersion 2, no bump).
 * This build doesn't know the key, so it must never read it and never erase it: every write path
 * carries it through verbatim, and a downgrade -> write -> reload round-trip gives it back intact.
 */
describe("save forward-compat: future entitlement field `unlockedForShopIngredientIds` (B-2)", () => {
  const ENTITLEMENT_KEY = "unlockedForShopIngredientIds";
  // A known purchasable id plus unknown well-formed ids: the set is kept as a whole, order included.
  const ENTITLEMENT = [PURCHASABLE, "future-ingredient-a", "future-ingredient-b"];

  function entitlementSave(): Record<string, unknown> {
    return { ...futureSave(), [ENTITLEMENT_KEY]: [...ENTITLEMENT] };
  }

  function expectEntitlementKept(storage: ReturnType<typeof fakeStorage>): void {
    const raw = storage.raw() as Record<string, unknown>;
    expect(raw.schemaVersion).toBe(2);
    expect(raw[ENTITLEMENT_KEY]).toEqual(ENTITLEMENT);
  }

  it("this build does not know the key (it stays a forward-compat field)", () => {
    expect(Object.keys(createDefaultSave())).not.toContain(ENTITLEMENT_KEY);
    const save = loadSave(fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(entitlementSave()) }));
    expect(save).not.toHaveProperty(ENTITLEMENT_KEY);
  });

  it("persistDex keeps it", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(entitlementSave()) });
    const { dex } = registerScoreToDex(loadSave(storage).dex, "marinara", score(60, 3));
    persistDex(dex, storage);
    expectEntitlementKept(storage);
  });

  it("persistProgress keeps it", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(entitlementSave()) });
    playOneRound(storage);
    expectEntitlementKept(storage);
  });

  it("persistMissionBest keeps it", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(entitlementSave()) });
    persistMissionBest(LUNCH_RUSH_MISSION_ID, 900, storage);
    expectEntitlementKept(storage);
    expect((storage.raw() as PersistentSaveV2).missionBest[LUNCH_RUSH_MISSION_ID]).toBe(900);
  });

  it("downgrade -> mount grant -> play -> mission -> reload -> write again keeps it verbatim", () => {
    const storage = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(entitlementSave()) });

    // Mount: the same loadSave -> applyStarterGrants -> persistProgress sequence App.tsx runs.
    const onMount = loadSave(storage);
    const grant = applyStarterGrants(
      onMount.dex,
      onMount.ownedIngredientIds,
      onMount.inventory,
      onMount.starterGrantClaimedRecipeIds,
    );
    persistProgress(
      {
        dex: onMount.dex,
        pitzBalance: onMount.pitzBalance,
        ownedIngredientIds: grant.ownedIngredientIds,
        inventory: grant.inventory,
        starterGrantClaimedRecipeIds: grant.claimedRecipeIds,
      },
      storage,
    );
    // The fixture's 5-star margherita unlocks new recipes, so this mount really writes (EP4).
    expect(grant.claimedRecipeIds.length).toBeGreaterThan(
      onMount.starterGrantClaimedRecipeIds.length,
    );
    expect((storage.raw() as PersistentSaveV2).starterGrantClaimedRecipeIds).toEqual([
      ...grant.claimedRecipeIds,
      FUTURE_RECIPE,
    ]);
    expectEntitlementKept(storage);

    const { dex } = registerScoreToDex(loadSave(storage).dex, "marinara", score(60, 3));
    persistDex(dex, storage);
    playOneRound(storage);
    persistMissionBest(LUNCH_RUSH_MISSION_ID, 900, storage);
    expectEntitlementKept(storage);

    // Reload: gameplay still never sees the key, and the next write still keeps it.
    expect(loadSave(storage)).not.toHaveProperty(ENTITLEMENT_KEY);
    playOneRound(storage);
    expectEntitlementKept(storage);
  });
});
