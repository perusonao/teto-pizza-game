import { describe, expect, it } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { purchaseFirstPack } from "../logic/materialShop";
import { ownedAcquisitionOrder } from "../logic/discovery/deductionGuard";
import { createDefaultSave, loadSave, migrateV1toV2, persistProgress, SAVE_STORAGE_KEY, type StorageLike } from "./persistence";
import { applyStarterGrants } from "./starterStock";
import { createInitialGameState, gameReducer } from "./gameReducer";
import { EMPTY_DEX, registerScoreToDex } from "./dex";

/**
 * Discovery Hint 4.0 DH4-2B Pre-Implementation Gate, Owner Decision T1a: the APPEND-ORDER INVARIANT
 * of `ownedIngredientIds` (docs/reports/TETO_DISCOVERY-HINT-4_DH4-2B_Pre-Implementation-Gate.md §11).
 *
 *   `ownedIngredientIds` = the starter ingredients (owned together from the start), then every later
 *   acquisition in the order it happened. Every writer appends; load, migration, normalization and
 *   the forward-compatible merge never sort, and never move a known id earlier.
 *
 * The Deduction Hint guard rebuilds "what was owned when the target became makeable" from this
 * order, so a regression here is a privacy regression, not a cosmetic one.
 */

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { json(): Record<string, unknown> } {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    json: () => JSON.parse(store.get(SAVE_STORAGE_KEY) ?? "{}") as Record<string, unknown>,
  };
}

// A non-catalog, non-alphabetical acquisition order (catalog order would be olive-oil, pesto, ...).
const ACQUIRED = [...STARTER_INGREDIENT_IDS, "pineapple", "egg", "parmigiano", "olive-oil", "bacon"];
const saveWith = (owned: readonly unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ ...createDefaultSave(), ownedIngredientIds: owned, ...extra });

function progress(owned: readonly string[]) {
  const d = createDefaultSave();
  return {
    dex: d.dex,
    pitzBalance: 10,
    ownedIngredientIds: owned,
    inventory: Object.fromEntries(owned.filter((id) => !STARTER_INGREDIENT_IDS.includes(id)).map((id) => [id, 5])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: owned,
    discoveryHintPurchases: {},
    discoveryHintFacts: {},
  };
}

describe("ownedIngredientIds append-order invariant (T1a)", () => {
  it("save / load round trip keeps the acquisition order exactly (never sorted)", () => {
    const storage = memoryStorage();
    persistProgress(progress(ACQUIRED), storage);
    expect(storage.json().ownedIngredientIds).toEqual(ACQUIRED);
    expect(loadSave(storage).ownedIngredientIds).toEqual(ACQUIRED);
    // A second round trip is stable.
    persistProgress(progress(loadSave(storage).ownedIngredientIds), storage);
    expect(loadSave(storage).ownedIngredientIds).toEqual(ACQUIRED);
    expect(ownedAcquisitionOrder(loadSave(storage).ownedIngredientIds)).toEqual(ACQUIRED);
  });

  it("unknown / future ids keep their acquisition position through a write by a build that does not know them", () => {
    const raw = [...STARTER_INGREDIENT_IDS, "pineapple", "future-truffle", "egg", "future-honey", "parmigiano"];
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(raw) });
    const loaded = loadSave(storage).ownedIngredientIds;
    expect(loaded).toEqual([...STARTER_INGREDIENT_IDS, "pineapple", "egg", "parmigiano"]);
    // This build buys bacon: the write keeps every stored id where it was and appends bacon.
    persistProgress(progress([...loaded, "bacon"]), storage);
    expect(storage.json().ownedIngredientIds).toEqual([...raw, "bacon"]);
    // A second write (nothing new) keeps it exactly.
    persistProgress(progress(loadSave(storage).ownedIngredientIds), storage);
    expect(storage.json().ownedIngredientIds).toEqual([...raw, "bacon"]);
    expect(loadSave(storage).ownedIngredientIds).toEqual([...STARTER_INGREDIENT_IDS, "pineapple", "egg", "parmigiano", "bacon"]);
  });

  it("rollback scenario (independent review of #267): an id the older build does not know never moves behind a later purchase", () => {
    // A newer build bought future-key, then parmigiano. An older build (future-key unknown to it)
    // loads that save and buys bacon. future-key must stay before parmigiano and bacon, otherwise a
    // target keyed on future-key would count them as owned when it became makeable (a late decoy).
    const raw = [...STARTER_INGREDIENT_IDS, "egg", "future-key", "parmigiano"];
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(raw) });
    persistProgress(progress([...loadSave(storage).ownedIngredientIds, "bacon"]), storage);
    const stored = storage.json().ownedIngredientIds as string[];
    expect(stored).toEqual([...raw, "bacon"]);
    expect(stored.indexOf("future-key")).toBeLessThan(stored.indexOf("parmigiano"));
  });

  it("normalization never sorts: junk is dropped, a duplicate keeps its first acquisition, starters lead", () => {
    const raw = ["pineapple", ...STARTER_INGREDIENT_IDS, "egg", "pineapple", 7, null, "__proto__", "parmigiano"];
    const loaded = loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(raw) })).ownedIngredientIds;
    // Starters are owned from the start, so they lead; the known purchases keep their order.
    expect(loaded).toEqual([...STARTER_INGREDIENT_IDS, "pineapple", "egg", "parmigiano"]);
    expect(ownedAcquisitionOrder(loaded)).toEqual(loaded);
  });

  it("the v1 -> v2 migration keeps the order", () => {
    const v1 = { schemaVersion: 1 as const, dex: [], pitzBalance: 3, ownedIngredientIds: ACQUIRED, missionBest: {} };
    expect(migrateV1toV2(v1).ownedIngredientIds).toEqual(ACQUIRED);
    const loaded = loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(v1) })).ownedIngredientIds;
    expect(loaded).toEqual(ACQUIRED);
  });

  it("every writer appends: the first-pack purchase (and through the reducer), and the starter grant", () => {
    const pack = purchaseFirstPack({
      ingredient: INGREDIENTS.find((i) => i.id === "anchovy")!,
      ownedIngredientIds: ACQUIRED,
      unlockedForShopIngredientIds: [...ACQUIRED, "anchovy"],
      inventory: {},
      pitzBalance: 9999,
    });
    expect(pack.success && pack.nextOwnedIngredientIds).toEqual([...ACQUIRED, "anchovy"]);

    const state = createInitialGameState(EMPTY_DEX, ACQUIRED, 9999, {}, [], [...ACQUIRED, "anchovy"], {}, {});
    expect(gameReducer(state, { type: "PURCHASE_INGREDIENT", ingredientId: "anchovy" }).ownedIngredientIds).toEqual([...ACQUIRED, "anchovy"]);

    let dex = EMPTY_DEX;
    for (const r of RECIPES) dex = registerScoreToDex(dex, r.id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
    const granted = applyStarterGrants(dex, ACQUIRED, {}, []).ownedIngredientIds;
    expect(granted.slice(0, ACQUIRED.length)).toEqual(ACQUIRED);
  });

  it("ownedAcquisitionOrder fails closed on an order it cannot trust (never guesses)", () => {
    expect(ownedAcquisitionOrder(ACQUIRED)).toEqual(ACQUIRED);
    expect(ownedAcquisitionOrder("egg")).toBeNull();
    expect(ownedAcquisitionOrder([...ACQUIRED, "egg"])).toBeNull(); // duplicate
    expect(ownedAcquisitionOrder([...ACQUIRED, "future-truffle"])).toBeNull(); // non-catalog
    expect(ownedAcquisitionOrder([...ACQUIRED, 3])).toBeNull(); // non-string
    expect(ownedAcquisitionOrder(["egg", ...STARTER_INGREDIENT_IDS])).toBeNull(); // a starter after a purchase
  });
});
