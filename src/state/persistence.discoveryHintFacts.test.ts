import { describe, expect, it } from "vitest";
import {
  SAVE_STORAGE_KEY,
  createDefaultSave,
  loadSave,
  MAX_STORED_HINT_FACTS_PER_RECIPE,
  migrateV1toV2,
  persistDex,
  persistMissionBest,
  persistProgress,
  resetSave,
  type PersistentSaveV2,
  type ProgressionSnapshot,
  type StorageLike,
} from "./persistence";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import type { DexEntry } from "./dex";
import { LUNCH_RUSH_MISSION_ID } from "../mission/lunchRush";
import { selectableHintSavedState } from "../logic/discovery/hintFactMigration";
import { buildSelectableHintModel, purchaseSelectableHint, selectableHintPresentation } from "../logic/discovery/selectableHint";

/**
 * Discovery Hint 3.0 (Issue #238), H3-2: the persisted Selectable Hint fact ledger
 * `discoveryHintFacts` (`recipeId -> fact ids`), next to the legacy `discoveryHintPurchases`.
 * Every case goes through the production persistence path (`loadSave` / `persistProgress` /
 * `persistDex` / `persistMissionBest` / `resetSave`) on a storage fake.
 * Authority: docs/reports/TETO_DISCOVERY-HINT-3_H3-2_Persistence-Migration_Result.md.
 */

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  let writes = 0;
  const storage: StorageLike & { raw(): Record<string, unknown>; text(): string | undefined; writes(): number } = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      writes += 1;
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    raw: () => JSON.parse(store.get(SAVE_STORAGE_KEY) ?? "null") as Record<string, unknown>,
    text: () => store.get(SAVE_STORAGE_KEY),
    writes: () => writes,
  };
  return storage;
}

const storageWith = (save: unknown) => fakeStorage({ [SAVE_STORAGE_KEY]: typeof save === "string" ? save : JSON.stringify(save) });

function snapshotOf(save: PersistentSaveV2, extra: Partial<ProgressionSnapshot> = {}): ProgressionSnapshot {
  return {
    dex: save.dex,
    pitzBalance: save.pitzBalance,
    ownedIngredientIds: save.ownedIngredientIds,
    inventory: save.inventory,
    starterGrantClaimedRecipeIds: save.starterGrantClaimedRecipeIds,
    ...extra,
  };
}

const FUTURE_RECIPE = "brazilian-calabresa";
const MARGHERITA_DEX: DexEntry[] = [{ recipeId: "margherita", discovered: true, bestScore: 80, bestStars: 4, timesMade: 2 }];

/** A Hint Economy 1.0 era save (before H3-2): no `discoveryHintFacts` key. */
function economySave(purchases: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const { discoveryHintFacts: _omit, ...base } = createDefaultSave();
  void _omit;
  return { ...base, dex: MARGHERITA_DEX, pitzBalance: 120, discoveryHintPurchases: purchases, ...extra };
}

describe("schema decision: schemaVersion 2 is kept (additive optional field)", () => {
  it("a fresh save has an empty fact ledger and stays schemaVersion 2", () => {
    expect(createDefaultSave()).toMatchObject({ schemaVersion: 2, discoveryHintFacts: {} });
    expect(loadSave(fakeStorage()).discoveryHintFacts).toEqual({});
  });

  it("a v1 save migrates with an empty fact ledger", () => {
    const v1 = { schemaVersion: 1 as const, dex: [], pitzBalance: 5, ownedIngredientIds: [...STARTER_INGREDIENT_IDS], missionBest: {} };
    expect(migrateV1toV2(v1).discoveryHintFacts).toEqual({});
    expect(loadSave(storageWith(v1))).toMatchObject({ schemaVersion: 2, discoveryHintFacts: {} });
  });

  it("an unrecognized schemaVersion still falls back to defaults (unchanged boundary)", () => {
    expect(loadSave(storageWith({ schemaVersion: 3, dex: [], discoveryHintFacts: { bismarck: ["ing:tomato-sauce"] } }))).toEqual(createDefaultSave());
  });
});

describe("old saves load through the production path (fixtures 1-15)", () => {
  it("1. a pre-Hint-Economy v2 save (neither ledger): both read as empty, everything else unchanged", () => {
    const { discoveryHintPurchases: _a, discoveryHintFacts: _b, ...old } = { ...createDefaultSave(), dex: MARGHERITA_DEX, pitzBalance: 40 };
    void _a;
    void _b;
    const loaded = loadSave(storageWith(old));
    expect(loaded).toMatchObject({ dex: MARGHERITA_DEX, pitzBalance: 40, discoveryHintPurchases: {}, discoveryHintFacts: {} });
  });

  it("2-6. Hint Economy H0..H4 saves: the legacy level loads unchanged, the new ledger is empty, and the derived progress is right", () => {
    const expected = [
      { paidRungs: 0, granted: [] },
      { paidRungs: 1, granted: ["ing:anchovy"] },
      { paidRungs: 2, granted: ["ing:anchovy", "ing:tomato-sauce"] },
      { paidRungs: 3, granted: ["ing:anchovy", "ing:tomato-sauce"] },
      { paidRungs: 4, granted: ["ing:anchovy", "ing:tomato-sauce", "ing:mozzarella"] },
    ];
    for (let level = 0; level <= 4; level += 1) {
      const loaded = loadSave(storageWith(economySave(level === 0 ? {} : { napoletana: level })));
      expect(loaded.discoveryHintPurchases).toEqual(level === 0 ? {} : { napoletana: level });
      expect(loaded.discoveryHintFacts).toEqual({});
      expect(selectableHintSavedState("napoletana", loaded)).toEqual({
        purchasedFactIds: [],
        legacy: { paidRungs: expected[level].paidRungs, grantedFactIds: expected[level].granted },
      });
    }
  });

  it("7. several recipes at mixed levels", () => {
    const loaded = loadSave(storageWith(economySave({ bismarck: 3, napoletana: 1, capricciosa: 4, funghi: 2 })));
    expect(loaded.discoveryHintPurchases).toEqual({ bismarck: 3, napoletana: 1, capricciosa: 4, funghi: 2 });
    expect(selectableHintSavedState("capricciosa", loaded)!.legacy.paidRungs).toBe(4);
    expect(selectableHintSavedState("funghi", loaded)!.legacy.grantedFactIds).toEqual(["ing:mushroom", "ing:tomato-sauce"]);
  });

  it("8. an unknown recipe id in either ledger is hidden from gameplay but kept in storage", () => {
    const storage = storageWith(economySave({ [FUTURE_RECIPE]: 2 }, { discoveryHintFacts: { [FUTURE_RECIPE]: ["ing:calabresa", "tech:fold"] } }));
    const loaded = loadSave(storage);
    expect(loaded.discoveryHintFacts).toEqual({});
    expect(loaded.discoveryHintPurchases).toEqual({});
    persistProgress(snapshotOf(loaded, { discoveryHintFacts: { bismarck: ["ing:tomato-sauce"] } }), storage);
    expect(storage.raw().discoveryHintFacts).toEqual({ bismarck: ["ing:tomato-sauce"], [FUTURE_RECIPE]: ["ing:calabresa", "tech:fold"] });
    expect(storage.raw().discoveryHintPurchases).toEqual({ [FUTURE_RECIPE]: 2 });
  });

  it("9. malformed legacy levels and malformed fact entries are dropped per entry, never the whole save", () => {
    const loaded = loadSave(
      storageWith(
        economySave(
          { bismarck: 0, napoletana: -2, funghi: 1.5, genovese: "3", capricciosa: 2 },
          { discoveryHintFacts: { bismarck: "ing:egg", napoletana: [7, null, "ING:X", "ing:", "ing:mozzarella", "ing:mozzarella"], funghi: [], genovese: {} } },
        ),
      ),
    );
    expect(loaded.discoveryHintPurchases).toEqual({ capricciosa: 2 });
    expect(loaded.discoveryHintFacts).toEqual({ napoletana: ["ing:mozzarella"] });
    expect(loaded.dex).toEqual(MARGHERITA_DEX);
    expect(loadSave(storageWith(economySave({}, { discoveryHintFacts: "garbage" }))).discoveryHintFacts).toEqual({});
  });

  it("10. a future numeric level is kept as stored and clamped only when read as progress", () => {
    const loaded = loadSave(storageWith(economySave({ napoletana: 9, bismarck: 7 })));
    expect(loaded.discoveryHintPurchases).toEqual({ napoletana: 9, bismarck: 7 });
    expect(selectableHintSavedState("napoletana", loaded)!.legacy.paidRungs).toBe(4);
    expect(selectableHintSavedState("bismarck", loaded)!.legacy.paidRungs).toBe(3);
  });

  it("11-12. unknown top-level fields and unknown recipe / ingredient / inventory data coexist and survive a write", () => {
    const storage = storageWith(
      economySave(
        { napoletana: 2 },
        {
          dex: [...MARGHERITA_DEX, { recipeId: FUTURE_RECIPE, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
          ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "calabresa"],
          inventory: { calabresa: 10 },
          futureLedger: { anything: [1, 2] },
          discoveryHintFacts: { napoletana: ["ing:mozzarella"], [FUTURE_RECIPE]: ["ing:calabresa"] },
        },
      ),
    );
    const loaded = loadSave(storage);
    persistProgress(snapshotOf(loaded, { pitzBalance: 99 }), storage);
    const raw = storage.raw();
    expect(raw.futureLedger).toEqual({ anything: [1, 2] });
    expect(raw.inventory).toEqual({ calabresa: 10 });
    expect(raw.ownedIngredientIds).toContain("calabresa");
    expect(raw.dex).toContainEqual({ recipeId: FUTURE_RECIPE, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 });
    expect(raw.discoveryHintFacts).toEqual({ napoletana: ["ing:mozzarella"], [FUTURE_RECIPE]: ["ing:calabresa"] });
    expect(raw.discoveryHintPurchases).toEqual({ napoletana: 2 });
    expect(raw.pitzBalance).toBe(99);
  });

  it("13. a save without the new field: a write that does not touch hints adds only an empty ledger", () => {
    const storage = storageWith(economySave({ napoletana: 1 }));
    persistProgress(snapshotOf(loadSave(storage), { pitzBalance: 10 }), storage);
    expect(storage.raw().discoveryHintFacts).toEqual({});
    expect(storage.raw().discoveryHintPurchases).toEqual({ napoletana: 1 });
  });

  it("14. new facts present: they load and round-trip, including future kinds", () => {
    const facts = { napoletana: ["ing:mozzarella", "tech:fold", "finish:basil-oil:drizzle", "shape:square", "pan:cast-iron", "cook:grill", "none:cheese"] };
    const storage = storageWith(economySave({}, { discoveryHintFacts: facts }));
    expect(loadSave(storage).discoveryHintFacts).toEqual(facts);
    persistProgress(snapshotOf(loadSave(storage), { pitzBalance: 1 }), storage);
    expect(storage.raw().discoveryHintFacts).toEqual(facts);
  });

  it("15. legacy + new facts both present: both kept as they are, and the derived state uses both", () => {
    const storage = storageWith(economySave({ napoletana: 2 }, { discoveryHintFacts: { napoletana: ["ing:mozzarella"] } }));
    const loaded = loadSave(storage);
    const state = selectableHintSavedState("napoletana", loaded)!;
    expect(state).toEqual({ purchasedFactIds: ["ing:mozzarella"], legacy: { paidRungs: 2, grantedFactIds: ["ing:anchovy", "ing:tomato-sauce"] } });
    const p = selectableHintPresentation(buildSelectableHintModel("napoletana", { discoveredCount: 1 })!, state.purchasedFactIds, 0, state.legacy);
    expect(p.paidCount).toBe(3);
    expect(p.rows.flatMap((r) => r.revealed.map((c) => c.ingredientId)).sort()).toEqual(["anchovy", "mozzarella", "tomato-sauce"]);
  });
});

describe("merge semantics", () => {
  it("B/C: persistProgress merges facts per recipe as a union; a stale snapshot never drops a fact", () => {
    const storage = storageWith(economySave({ napoletana: 1 }, { discoveryHintFacts: { napoletana: ["ing:mozzarella"], bismarck: ["ing:tomato-sauce"] } }));
    const loaded = loadSave(storage);
    persistProgress(snapshotOf(loaded, { discoveryHintFacts: { napoletana: ["ing:tomato-sauce"] } }), storage);
    expect(storage.raw().discoveryHintFacts).toEqual({ napoletana: ["ing:mozzarella", "ing:tomato-sauce"], bismarck: ["ing:tomato-sauce"] });
    persistProgress(snapshotOf(loaded, { discoveryHintFacts: {} }), storage); // stale, empty
    expect(storage.raw().discoveryHintFacts).toEqual({ napoletana: ["ing:mozzarella", "ing:tomato-sauce"], bismarck: ["ing:tomato-sauce"] });
  });

  it("A: legacy progress stays max-merged and is never rewritten by a fact write", () => {
    const storage = storageWith(economySave({ napoletana: 3 }));
    const loaded = loadSave(storage);
    persistProgress(snapshotOf(loaded, { discoveryHintPurchases: { napoletana: 1 }, discoveryHintFacts: { napoletana: ["ing:mozzarella"] } }), storage);
    expect(storage.raw().discoveryHintPurchases).toEqual({ napoletana: 3 });
    expect(storage.raw().discoveryHintFacts).toEqual({ napoletana: ["ing:mozzarella"] });
  });

  it("D: two snapshots written in either order end in the same union", () => {
    const a = { napoletana: ["ing:mozzarella"], [FUTURE_RECIPE]: ["ing:calabresa"] };
    const b = { napoletana: ["ing:tomato-sauce"], capricciosa: ["ing:ham"] };
    const run = (first: typeof a | typeof b, second: typeof a | typeof b) => {
      const storage = storageWith(economySave({}));
      persistProgress(snapshotOf(loadSave(storage), { discoveryHintFacts: first }), storage);
      persistProgress(snapshotOf(loadSave(storage), { discoveryHintFacts: second }), storage);
      const raw = storage.raw().discoveryHintFacts as Record<string, string[]>;
      return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, [...v].sort()]));
    };
    // The unknown recipe arrives through a snapshot, which (like every snapshot) is sanitized to known ids.
    expect(run(a, b)).toEqual(run(b, a));
    expect(run(a, b)).toEqual({ napoletana: ["ing:mozzarella", "ing:tomato-sauce"], capricciosa: ["ing:ham"] });
  });

  it("E/F: unknown recipe ids and unknown fact kinds survive persistDex, persistProgress and persistMissionBest", () => {
    const facts = { napoletana: ["ing:mozzarella", "tech:fold"], [FUTURE_RECIPE]: ["ing:calabresa", "shape:fold"] };
    const storage = storageWith(economySave({ napoletana: 1 }, { discoveryHintFacts: facts }));
    persistDex([...MARGHERITA_DEX, { recipeId: "bismarck", discovered: true, bestScore: 60, bestStars: 3, timesMade: 1 }], storage);
    expect(storage.raw().discoveryHintFacts).toEqual(facts);
    persistMissionBest(LUNCH_RUSH_MISSION_ID, 500, storage);
    expect(storage.raw().discoveryHintFacts).toEqual(facts);
    persistProgress(snapshotOf(loadSave(storage), { pitzBalance: 3 }), storage);
    expect(storage.raw().discoveryHintFacts).toEqual(facts);
  });

  it("an unchanged ledger is a no-op write (no spurious write on mount), and loadSave never writes", () => {
    const storage = storageWith(economySave({ napoletana: 1 }, { discoveryHintFacts: { napoletana: ["ing:mozzarella"] } }));
    const loaded = loadSave(storage);
    loadSave(storage);
    expect(storage.writes()).toBe(0);
    persistProgress(snapshotOf(loaded, { discoveryHintFacts: { napoletana: ["ing:mozzarella"] }, discoveryHintPurchases: { napoletana: 1 } }), storage);
    expect(storage.writes()).toBe(0);
  });

  it("write -> read -> write is stable (byte-identical) and repeated loads are idempotent", () => {
    const storage = storageWith(economySave({ napoletana: 2 }, { discoveryHintFacts: { napoletana: ["ing:mozzarella", "tech:fold"], [FUTURE_RECIPE]: ["ing:calabresa"] }, futureLedger: 1 }));
    persistProgress(snapshotOf(loadSave(storage), { pitzBalance: 7 }), storage);
    const first = storage.text();
    persistProgress(snapshotOf(loadSave(storage), { pitzBalance: 8 }), storage);
    persistProgress(snapshotOf(loadSave(storage), { pitzBalance: 7 }), storage);
    expect(storage.text()).toBe(first);
    expect(loadSave(storage)).toEqual(loadSave(storage));
  });

  it("a recipe's ledger is capped (far above any recipe's fact count) so a corrupt save cannot grow unbounded", () => {
    const many = Array.from({ length: 200 }, (_, i) => `tech:t${i}`);
    expect(loadSave(storageWith(economySave({}, { discoveryHintFacts: { napoletana: many } }))).discoveryHintFacts.napoletana).toHaveLength(MAX_STORED_HINT_FACTS_PER_RECIPE);
  });
});

describe("hostile ids", () => {
  it("__proto__ / constructor / prototype as recipe or fact ids never pollute, and never break the save", () => {
    const text =
      '{"schemaVersion":2,"dex":[],"pitzBalance":5,"ownedIngredientIds":["tomato-sauce","mozzarella","basil"],"missionBest":{},"inventory":{},' +
      '"starterGrantClaimedRecipeIds":[],"unlockedForShopIngredientIds":[],"discoveryHintPurchases":{},' +
      '"discoveryHintFacts":{"__proto__":["ing:egg"],"constructor":["ing:x"],"prototype":["ing:y"],"napoletana":["__proto__","constructor","ing:__proto__","prototype:x","ing:mozzarella"]}}';
    const storage = storageWith(text);
    const loaded = loadSave(storage);
    expect(Object.keys(loaded.discoveryHintFacts)).toEqual(["napoletana"]);
    expect(loaded.discoveryHintFacts.napoletana).toEqual(["prototype:x", "ing:mozzarella"]);
    expect(({} as Record<string, unknown>)["ing:egg"]).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty("napoletana");
    persistProgress(snapshotOf(loaded, { pitzBalance: 6 }), storage);
    const raw = storage.raw().discoveryHintFacts as Record<string, unknown>;
    // "constructor"/"prototype" are well-formed unknown ids: kept as data (own keys), never as prototypes.
    expect(Object.keys(raw).sort()).toEqual(["constructor", "napoletana", "prototype"]);
    expect(Object.prototype.hasOwnProperty.call(raw, "__proto__")).toBe(false);
    expect(({} as Record<string, unknown>).constructor).toBe(Object);
    expect(loadSave(storage).pitzBalance).toBe(6);
  });

  it("a snapshot with hostile keys cannot pollute either", () => {
    const storage = storageWith(economySave({}));
    const hostile = JSON.parse('{"__proto__":["ing:egg"],"napoletana":["ing:mozzarella"]}') as Record<string, string[]>;
    persistProgress(snapshotOf(loadSave(storage), { discoveryHintFacts: hostile }), storage);
    expect(storage.raw().discoveryHintFacts).toEqual({ napoletana: ["ing:mozzarella"] });
    expect(({} as Record<string, unknown>)[0]).toBeUndefined();
  });
});

describe("Full Reset", () => {
  it("clears both ledgers with everything else; nothing comes back, and Dex 0 onboarding is free again", () => {
    const storage = storageWith(economySave({ napoletana: 4 }, { discoveryHintFacts: { napoletana: ["ing:mozzarella"], [FUTURE_RECIPE]: ["ing:calabresa"] } }));
    expect(resetSave(storage)).toBe(true);
    expect(storage.text()).toBeUndefined();
    const fresh = loadSave(storage);
    expect(fresh).toEqual(createDefaultSave());
    persistProgress(snapshotOf(fresh, { pitzBalance: 0 }), storage);
    expect(loadSave(storage)).toMatchObject({ discoveryHintFacts: {}, discoveryHintPurchases: {}, dex: [] });
    expect(buildSelectableHintModel("margherita", { discoveredCount: fresh.dex.length })!.onboarding).toBe(true);
  });
});

describe("no double charge across a reload", () => {
  it("a Hint 3.0 purchase persisted and reloaded is never sold again; legacy progress carries through", () => {
    const storage = storageWith(economySave({ napoletana: 1 }));
    const model = buildSelectableHintModel("napoletana", { discoveredCount: 1 })!;
    const before = selectableHintSavedState("napoletana", loadSave(storage))!;
    const p0 = selectableHintPresentation(model, before.purchasedFactIds, 100, before.legacy);
    expect(p0.nextPrice).toBe(10);
    const r = purchaseSelectableHint({ model, purchasedFactIds: before.purchasedFactIds, preferences: ["cheese"], expectedPaidCount: p0.paidCount, pitzBalance: 100, legacy: before.legacy });
    if (!r.success) throw new Error(r.reason);
    expect(r.revealed.map((f) => f.id)).toEqual(["ing:mozzarella"]);
    persistProgress(snapshotOf(loadSave(storage), { pitzBalance: r.nextPitzBalance, discoveryHintFacts: { napoletana: r.nextPurchasedFactIds } }), storage);

    const after = selectableHintSavedState("napoletana", loadSave(storage))!; // reload
    expect(after.purchasedFactIds).toEqual(["ing:mozzarella"]);
    expect(loadSave(storage).discoveryHintPurchases).toEqual({ napoletana: 1 }); // legacy untouched
    const p1 = selectableHintPresentation(model, after.purchasedFactIds, r.nextPitzBalance, after.legacy);
    expect(p1.paidCount).toBe(2);
    expect(p1.nextPrice).toBe(20);
    const again = purchaseSelectableHint({ model, purchasedFactIds: after.purchasedFactIds, preferences: ["cheese"], expectedPaidCount: 2, pitzBalance: r.nextPitzBalance, legacy: after.legacy });
    if (!again.success) throw new Error(again.reason);
    expect(again.revealed.map((f) => f.id)).toEqual(["ing:tomato-sauce"]); // falls back; mozzarella never re-sold
  });
});
