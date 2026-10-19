import { describe, expect, it } from "vitest";
import {
  SAVE_STORAGE_KEY,
  createDefaultSave,
  loadSave,
  persistProgress,
  type PersistentSaveV2,
  type ProgressionSnapshot,
} from "./persistence";
import type { DexEntry } from "./dex";
import { FUTURE_V3, UNUSABLE_ROOTS, V2_TECHNIQUES_RESEARCH } from "./testSupport/saveGoldenFixtures";
import { memoryStorage } from "./testSupport/memoryStorage";

/**
 * Save Compatibility Phase A (Issue #559) -- the Fresh Audit's R1-R5, as tests.
 *
 * TWO KINDS OF TEST LIVE HERE AND THEY MUST NOT BE CONFUSED:
 *
 * 1. "CURRENT BEHAVIOUR (known risk)" -- characterization. They pin what this build does TODAY so a later change is a
 *    visible, deliberate diff. Several of them describe DATA LOSS. That is NOT the desired spec: each names the Issue
 *    that owns the fix (#560 for R1/R3, #282 for R2, #559 for R4/R5) and is expected to be INVERTED, not preserved,
 *    when that fix lands. Do not "fix" production code to keep one of them green.
 * 2. "SAFETY REQUIREMENT (not implemented)" -- `it.todo`. The requirement a fix must satisfy. Todos do not fail CI.
 *
 * Everything outside the "KNOWN RISK" blocks asserts desired behaviour that already holds.
 */

const MARGHERITA: DexEntry = { recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 };
const FUGAZZA: DexEntry = { recipeId: "fugazza", discovered: true, bestScore: 64, bestStars: 3, timesMade: 1 };

function snapshotOf(save: PersistentSaveV2, over: Partial<ProgressionSnapshot> = {}): ProgressionSnapshot {
  return { ...save, ...over };
}

function rawSave(storage: { getItem(k: string): string | null }): Record<string, unknown> {
  return JSON.parse(storage.getItem(SAVE_STORAGE_KEY) ?? "null");
}

describe("KNOWN RISK R1 (#560): an unrecognized schemaVersion is replaced by the first real write", () => {
  it("CURRENT BEHAVIOUR (known risk): the first write that changes anything overwrites a v3 save with a fresh v2 one", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
    const hydrated = loadSave(storage); // the fresh default this build falls back to
    persistProgress(snapshotOf(hydrated, { dex: [FUGAZZA] }), storage); // the player finishes a pizza

    const stored = rawSave(storage);
    expect(stored.schemaVersion).toBe(2);
    // The v3 progression and its unknown field are gone from storage, with no backup written.
    expect(stored).not.toHaveProperty("cloudProfile");
    expect(stored.pitzBalance).toBe(0);
    expect((stored.dex as DexEntry[]).map((e) => e.recipeId)).toEqual(["fugazza"]);
    expect(storage.keys()).toEqual([SAVE_STORAGE_KEY]);
  });

  it.todo("SAFETY REQUIREMENT (not implemented, #560): a write never destroys a save whose version this build cannot read (back it up or refuse)");
  it.todo("SAFETY REQUIREMENT (not implemented, #560): after such a write the original v3 text is still recoverable");
});

describe("KNOWN RISK R3 (#560): a corrupt stored root is overwritten, unrecoverably, by the first real write", () => {
  for (const { name, raw } of UNUSABLE_ROOTS) {
    it(`CURRENT BEHAVIOUR (known risk): ${name} -- replaced by a fresh save, no backup`, () => {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
      persistProgress(snapshotOf(loadSave(storage), { dex: [FUGAZZA] }), storage);

      expect(rawSave(storage).schemaVersion).toBe(2);
      expect(storage.getItem(SAVE_STORAGE_KEY)).not.toBe(raw);
      expect(storage.keys()).toEqual([SAVE_STORAGE_KEY]);
    });
  }

  it.todo("SAFETY REQUIREMENT (not implemented, #560): the unreadable original text is preserved before the first write replaces it");
});

describe("KNOWN RISK R2 (#282): a stale tab's write rolls back what another tab saved", () => {
  function twoTabs() {
    const tabA = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify({ schemaVersion: 2, dex: [MARGHERITA], pitzBalance: 100, ownedIngredientIds: [], missionBest: {}, inventory: {} }) });
    const tabB = tabA.view();
    // Both tabs hydrate from the same stored save...
    const hydratedA = loadSave(tabA);
    const hydratedB = loadSave(tabB);
    return { tabA, tabB, hydratedA, hydratedB };
  }

  it("CURRENT BEHAVIOUR (known risk): a Dex entry saved by tab B is erased by tab A's later write", () => {
    const { tabA, tabB, hydratedA, hydratedB } = twoTabs();
    persistProgress(snapshotOf(hydratedB, { dex: [...hydratedB.dex, FUGAZZA], pitzBalance: 300 }), tabB); // B discovers fugazza
    expect(loadSave(tabA).dex.map((e) => e.recipeId)).toEqual(["margherita", "fugazza"]);

    persistProgress(snapshotOf(hydratedA, { pitzBalance: 150 }), tabA); // A never saw it and saves its own Pitz

    const after = loadSave(tabA);
    expect(after.dex.map((e) => e.recipeId)).toEqual(["margherita"]); // fugazza is gone (known id: nothing keeps it)
    expect(after.pitzBalance).toBe(150); // B's 300 is overwritten (last writer wins, as #282 describes)
  });

  it("CURRENT BEHAVIOUR (known risk): stock and ownership are rolled back the same way", () => {
    const { tabA, tabB, hydratedA, hydratedB } = twoTabs();
    persistProgress(snapshotOf(hydratedB, { ownedIngredientIds: [...hydratedB.ownedIngredientIds, "onion"], inventory: { onion: 8 } }), tabB);
    expect(loadSave(tabA).inventory).toEqual({ onion: 8 });

    persistProgress(snapshotOf(hydratedA, { pitzBalance: 101 }), tabA);

    const after = loadSave(tabA);
    expect(after.inventory).toEqual({});
    expect(after.ownedIngredientIds).not.toContain("onion");
  });

  it("ledger-type fields are merged, not replaced: a stale tab cannot drop another tab's hint facts or technique", () => {
    const { tabA, tabB, hydratedA, hydratedB } = twoTabs();
    persistProgress(
      snapshotOf(hydratedB, { discoveryHintFacts: { margherita: ["ing:mozzarella"] }, discoveredTechniqueIds: ["no-sauce"], discoveryHintPurchases: { margherita: 2 } }),
      tabB,
    );

    persistProgress(snapshotOf(hydratedA, { pitzBalance: 101 }), tabA);

    const after = loadSave(tabA);
    expect(after.discoveryHintFacts).toEqual({ margherita: ["ing:mozzarella"] });
    expect(after.discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect(after.discoveryHintPurchases).toEqual({ margherita: 2 });
  });

  it("BEST never goes down inside one tab (the same-tab path is safe)", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify({ schemaVersion: 2, dex: [MARGHERITA], pitzBalance: 0, ownedIngredientIds: [], missionBest: {}, inventory: {} }) });
    const hydrated = loadSave(storage);
    persistProgress(snapshotOf(hydrated, { dex: [{ ...MARGHERITA, timesMade: 4 }] }), storage);
    expect(loadSave(storage).dex[0]).toEqual({ ...MARGHERITA, timesMade: 4 });
  });

  it.todo("SAFETY REQUIREMENT (not implemented, #282): a write from a stale tab never removes a Dex entry another tab saved");
  it.todo("SAFETY REQUIREMENT (not implemented, #282): a stale tab detects the newer save (storage event or revision) before it writes Pitz or stock");
});

describe("Dex entry boundaries (R4)", () => {
  const entry = (over: Record<string, unknown>) => ({ ...MARGHERITA, ...over });
  const stored = (dex: unknown[]) => JSON.stringify({ schemaVersion: 2, dex, pitzBalance: 0, ownedIngredientIds: [], missionBest: {}, inventory: {} });
  const loadedIds = (dex: unknown[]) => loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: stored(dex) })).dex.map((e) => e.recipeId);

  it("accepts the inclusive edges: score 0 and 100, stars 1 and 5, timesMade 0", () => {
    for (const over of [{ bestScore: 0 }, { bestScore: 100 }, { bestStars: 1 }, { bestStars: 5 }, { timesMade: 0 }]) {
      expect(loadedIds([entry(over)])).toEqual(["margherita"]);
    }
  });

  it("drops an entry just outside the ranges (the rest of the Dex is kept)", () => {
    const bad = [{ bestScore: 100.5 }, { bestScore: -0.1 }, { bestScore: Number.NaN }, { bestStars: 0 }, { bestStars: 6 }, { bestStars: 2.5 }, { timesMade: 1.5 }, { timesMade: -1 }, { discovered: "true" }, { recipeId: "" }];
    for (const over of bad) {
      expect(loadedIds([entry(over), FUGAZZA])).toEqual(["fugazza"]);
    }
  });

  it("deduplicates a recipe listed twice (first wins)", () => {
    expect(loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: stored([MARGHERITA, entry({ bestScore: 10 })]) })).dex).toEqual([MARGHERITA]);
  });

  it("CURRENT BEHAVIOUR (known risk): an out-of-range entry for a KNOWN recipe is erased from storage by the next write", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: stored([entry({ bestScore: 120 }), FUGAZZA]) });
    persistProgress(snapshotOf(loadSave(storage), { pitzBalance: 5 }), storage);
    const ids = (rawSave(storage).dex as DexEntry[]).map((e) => e.recipeId);
    expect(ids).toEqual(["fugazza"]); // margherita's record (possibly valid under a newer build's range) is gone
  });

  it.todo("SAFETY REQUIREMENT (not implemented, #559 follow-up): an entry a newer build wrote with a wider valid range is not erased by this build's write");
});

describe("Unknown fields (R5)", () => {
  it("an unknown TOP-LEVEL key survives load and every write", () => {
    const raw = JSON.stringify({ ...JSON.parse(V2_TECHNIQUES_RESEARCH), futureLedger: { a: [1, 2] } });
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
    persistProgress(snapshotOf(loadSave(storage), { pitzBalance: 999 }), storage);
    expect(rawSave(storage).futureLedger).toEqual({ a: [1, 2] });
    expect(loadSave(storage)).not.toHaveProperty("futureLedger"); // never reaches gameplay
  });

  it("an unknown ID in a known list survives a write but never reaches gameplay", () => {
    const raw = JSON.stringify({ ...JSON.parse(V2_TECHNIQUES_RESEARCH), discoveredTechniqueIds: ["no-sauce", "future-technique"], starterGrantClaimedRecipeIds: ["fugazza", "future-recipe"] });
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
    const loaded = loadSave(storage);
    expect(loaded.discoveredTechniqueIds).toEqual(["no-sauce"]);
    persistProgress(snapshotOf(loaded, { pitzBalance: 999 }), storage);
    expect(rawSave(storage).discoveredTechniqueIds).toEqual(["no-sauce", "future-technique"]);
    expect(rawSave(storage).starterGrantClaimedRecipeIds).toEqual(["fugazza", "future-recipe"]);
  });

  it("a hostile key (__proto__) is neither read nor carried through", () => {
    const raw = '{"schemaVersion":2,"dex":[],"pitzBalance":0,"ownedIngredientIds":[],"missionBest":{},"inventory":{},"__proto__":{"polluted":true}}';
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
    persistProgress(snapshotOf(loadSave(storage), { pitzBalance: 1 }), storage);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(rawSave(storage), "polluted")).toBe(false);
  });

  it("CURRENT BEHAVIOUR (known risk): an unknown field inside a KNOWN Dex entry is dropped on load and erased by the next write", () => {
    const raw = JSON.stringify({ schemaVersion: 2, dex: [{ ...MARGHERITA, bestBakeLevel: 3 }], pitzBalance: 0, ownedIngredientIds: [], missionBest: {}, inventory: {} });
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
    const loaded = loadSave(storage);
    expect(loaded.dex[0]).toEqual(MARGHERITA);
    persistProgress(snapshotOf(loaded, { pitzBalance: 1 }), storage);
    expect((rawSave(storage).dex as Record<string, unknown>[])[0]).not.toHaveProperty("bestBakeLevel");
  });

  it("CURRENT BEHAVIOUR (known risk): a non-integer Mission BEST is dropped on load (a future float score would be lost)", () => {
    const raw = JSON.stringify({ schemaVersion: 2, dex: [], pitzBalance: 0, ownedIngredientIds: [], missionBest: { "lunch-rush": 742.5, "lunch-rush-v2": 800 }, inventory: {} });
    expect(loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: raw })).missionBest).toEqual({ "lunch-rush-v2": 800 });
  });

  it.todo("SAFETY REQUIREMENT (not implemented, #559 follow-up): unknown sub-fields of a known Dex entry survive a write by an older build");
});

describe("Pitz and inventory sanitizing", () => {
  const load = (over: Record<string, unknown>) =>
    loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify({ schemaVersion: 2, dex: [], pitzBalance: 0, ownedIngredientIds: [], missionBest: {}, inventory: {}, ...over }) }));

  it("a negative, non-finite or non-numeric Pitz balance reads as 0; a valid one is kept as written", () => {
    for (const bad of [-1, "100", null, {}]) expect(load({ pitzBalance: bad }).pitzBalance).toBe(0);
    expect(load({ pitzBalance: 1234 }).pitzBalance).toBe(1234);
  });

  it("an invalid stock entry is dropped on its own; a starter id never gets finite stock", () => {
    const inv = load({ inventory: { onion: 5, mushroom: -1, basil: 3, "tomato-sauce": 9, nonsense: "x" } }).inventory;
    expect(inv.onion).toBe(5);
    expect(inv).not.toHaveProperty("mushroom");
    expect(inv).not.toHaveProperty("tomato-sauce");
    expect(inv).not.toHaveProperty("nonsense");
  });

  it("a default save is what a failed read returns, and it is a fresh object each time", () => {
    expect(createDefaultSave()).not.toBe(createDefaultSave());
  });
});
