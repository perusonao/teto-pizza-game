import { describe, expect, it } from "vitest";
import { RECIPES } from "../data/recipes";
import { INGREDIENTS } from "../data/ingredients";
import { createDefaultSave, loadSave, persistDex, persistMissionBest, persistProgress, resetSave, SAVE_STORAGE_KEY, type StorageLike } from "./persistence";
import {
  addResearchExclusions,
  MAX_RESEARCH_EXCLUSION_RECIPES,
  MAX_RESEARCH_EXCLUSIONS_PER_RECIPE,
  sanitizeResearchExclusions,
  unionResearchExclusions,
} from "./researchExclusions";
import { MAX_STORED_HINT_FACTS_PER_RECIPE } from "./persistence";
import { createInitialGameState } from "./gameReducer";

/**
 * Research 2.0 Phase 2 (OD-R1-2, INV-B9): the persisted negative ledger `researchExclusions` -- a top-level key of save
 * v2 (no schema bump, no migration): bare ingredient ids, a per-recipe set union, never written when empty, and every
 * unknown recipe / ingredient id and unknown top-level key kept across writes.
 */
function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(initial));
  return { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) };
}
const stored = (s: StorageLike) => JSON.parse(s.getItem(SAVE_STORAGE_KEY) ?? "null") as Record<string, unknown>;
const progress = (extra: Record<string, unknown> = {}) => {
  const d = createDefaultSave();
  return { dex: d.dex, pitzBalance: d.pitzBalance, ownedIngredientIds: d.ownedIngredientIds, inventory: d.inventory, starterGrantClaimedRecipeIds: d.starterGrantClaimedRecipeIds, ...extra };
};
const KNOWN = RECIPES[0].id;
const KNOWN2 = RECIPES[1].id;
const base = (extra: Record<string, unknown>) => ({ schemaVersion: 2, dex: [], ...extra });

describe("researchExclusions: storage contract", () => {
  it("schemaVersion stays 2 and the default save has an empty in-memory ledger", () => {
    expect(createDefaultSave().schemaVersion).toBe(2);
    expect(createDefaultSave().researchExclusions).toEqual({});
  });

  it("an empty ledger never writes the key (default write, snapshot with {} , dex write)", () => {
    const s = fakeStorage();
    persistProgress(progress({ pitzBalance: 5, researchExclusions: {} }), s);
    expect(stored(s)).not.toHaveProperty("researchExclusions");
    persistDex([{ recipeId: KNOWN, discovered: true, bestScore: 1, bestStars: 1, timesMade: 1 }], s);
    persistMissionBest("lunch-rush", 5, s);
    expect(stored(s)).not.toHaveProperty("researchExclusions");
    expect(stored(s).schemaVersion).toBe(2);
  });

  it("a v2 save without the key loads as an empty ledger and is not rewritten (no migration)", () => {
    const raw = JSON.stringify(base({ pitzBalance: 3 }));
    const s = fakeStorage({ [SAVE_STORAGE_KEY]: raw });
    expect(loadSave(s).researchExclusions).toEqual({});
    persistProgress(progress({ pitzBalance: 3 }), s);
    expect(s.getItem(SAVE_STORAGE_KEY)).toBe(raw);
  });

  it("stores bare ingredient ids and merges per recipe as a set union (never lowered)", () => {
    const s = fakeStorage();
    persistProgress(progress({ researchExclusions: { [KNOWN]: ["egg", "bacon"] } }), s);
    expect(stored(s).researchExclusions).toEqual({ [KNOWN]: ["egg", "bacon"] });
    persistProgress(progress({ researchExclusions: { [KNOWN]: ["bacon", "onion"], [KNOWN2]: ["egg"] } }), s);
    expect(stored(s).researchExclusions).toEqual({ [KNOWN]: ["egg", "bacon", "onion"], [KNOWN2]: ["egg"] });
    // a stale (smaller) snapshot never lowers it, and an absent snapshot field leaves it alone
    persistProgress(progress({ researchExclusions: { [KNOWN]: ["egg"] } }), s);
    persistProgress(progress({ pitzBalance: 9 }), s);
    expect(loadSave(s).researchExclusions).toEqual({ [KNOWN]: ["egg", "bacon", "onion"], [KNOWN2]: ["egg"] });
    expect(JSON.stringify(stored(s).researchExclusions)).not.toContain("ing:");
  });

  it("is never a Hint fact: discoveryHintFacts is unchanged by an exclusion write (INV-B9)", () => {
    const s = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ discoveryHintFacts: { [KNOWN]: ["ing:egg"] } })) });
    const before = stored(s).discoveryHintFacts;
    persistProgress(progress({ researchExclusions: { [KNOWN]: ["bacon"] } }), s);
    expect(stored(s).discoveryHintFacts).toEqual(before);
    expect(loadSave(s).discoveryHintFacts).toEqual({ [KNOWN]: ["ing:egg"] });
  });

  it("the difference of one exclusion write is the ledger key only", () => {
    const s = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ pitzBalance: 3, futureKey: 1 })) });
    persistProgress(progress({ pitzBalance: 4 }), s); // first write normalizes the older save's defaults
    const before = stored(s);
    persistProgress(progress({ pitzBalance: 4, researchExclusions: { [KNOWN]: ["bacon"] } }), s);
    const after = stored(s);
    const changed = Object.keys({ ...before, ...after }).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    expect(changed).toEqual(["researchExclusions"]);
  });

  it("Full Game Reset removes it with the whole save", () => {
    const s = fakeStorage();
    persistProgress(progress({ researchExclusions: { [KNOWN]: ["bacon"] } }), s);
    expect(resetSave(s)).toBe(true);
    expect(loadSave(s).researchExclusions).toEqual({});
  });
});

describe("researchExclusions: unknown IDs and keys are kept", () => {
  const FUTURE = {
    [KNOWN]: ["egg", "future-ingredient"],
    "future-recipe": ["egg", "future-ingredient"],
    "another-future-recipe": ["future-ingredient"],
  };

  it("loadSave shows gameplay known recipe ids only (unknown ingredient ids of a known recipe survive)", () => {
    const s = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ researchExclusions: FUTURE })) });
    expect(loadSave(s).researchExclusions).toEqual({ [KNOWN]: ["egg", "future-ingredient"] });
  });

  it("a write keeps unknown recipe ids, unknown ingredient ids and unknown top-level keys, and unions the new ones", () => {
    const s = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ researchExclusions: FUTURE, futureTopLevel: { a: [1] }, otherKey: "x" })) });
    persistProgress(progress({ researchExclusions: { [KNOWN]: ["bacon"] } }), s);
    const out = stored(s);
    expect(out.researchExclusions).toEqual({
      [KNOWN]: ["egg", "future-ingredient", "bacon"],
      "future-recipe": ["egg", "future-ingredient"],
      "another-future-recipe": ["future-ingredient"],
    });
    expect(out.futureTopLevel).toEqual({ a: [1] });
    expect(out.otherKey).toBe("x");
    expect(out.schemaVersion).toBe(2);
  });

  it("an unrelated write (Pitz, Dex, mission best) never loses the stored unknown ledger", () => {
    const s = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ researchExclusions: { "future-recipe": ["future-ingredient"] } })) });
    persistProgress(progress({ pitzBalance: 11 }), s);
    persistMissionBest("lunch-rush", 77, s);
    expect(stored(s).researchExclusions).toEqual({ "future-recipe": ["future-ingredient"] });
  });

  it("an unknown-only ledger survives an empty known ledger (the key is written from the stored part)", () => {
    const s = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ researchExclusions: { "future-recipe": ["x-1"] } })) });
    persistProgress(progress({ researchExclusions: {} }), s);
    expect(stored(s).researchExclusions).toEqual({ "future-recipe": ["x-1"] });
  });

  it("a shape this build cannot read is put back verbatim while it has no ledger of its own", () => {
    const s = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ researchExclusions: [["future", "shape"]] })) });
    expect(loadSave(s).researchExclusions).toEqual({});
    persistProgress(progress({ pitzBalance: 2 }), s);
    expect(stored(s).researchExclusions).toEqual([["future", "shape"]]);
  });

  it("hostile / malformed values are dropped, never thrown (proto key, non-array, bad ids, numbers)", () => {
    const raw = `{"schemaVersion":2,"dex":[],"researchExclusions":{"__proto__":["egg"],"${KNOWN}":["Bad Id","egg",7,null,"egg",""],"${KNOWN2}":"egg","UPPER":["egg"]}}`;
    const s = fakeStorage({ [SAVE_STORAGE_KEY]: raw });
    const loaded = loadSave(s).researchExclusions;
    expect(loaded).toEqual({ [KNOWN]: ["egg"] });
    expect(({} as Record<string, unknown>).egg).toBeUndefined();
    persistProgress(progress({ pitzBalance: 1 }), s);
    expect(Object.keys(stored(s).researchExclusions as object)).toEqual([KNOWN]);
  });

  it("an unreadable root (newer schemaVersion) is not written over by the ledger path", () => {
    const raw = JSON.stringify({ schemaVersion: 3, dex: [], researchExclusions: { [KNOWN]: ["egg"] } });
    const s = fakeStorage({ [SAVE_STORAGE_KEY]: raw });
    expect(loadSave(s).researchExclusions).toEqual({});
  });
});

describe("researchExclusions: the dedicated cap (172-recipe population)", () => {
  const ids = Array.from({ length: 300 }, (_, i) => `ing-${i}`);

  it("is its own constant, large enough for the whole 172-recipe catalog (168 ingredients) and not the Hint fact cap", () => {
    expect(MAX_RESEARCH_EXCLUSIONS_PER_RECIPE).not.toBe(MAX_STORED_HINT_FACTS_PER_RECIPE);
    expect(MAX_RESEARCH_EXCLUSIONS_PER_RECIPE).toBeGreaterThan(MAX_STORED_HINT_FACTS_PER_RECIPE);
    expect(MAX_RESEARCH_EXCLUSIONS_PER_RECIPE).toBeGreaterThanOrEqual(168);
    expect(MAX_RESEARCH_EXCLUSIONS_PER_RECIPE).toBeGreaterThan(INGREDIENTS.length);
    expect(MAX_RESEARCH_EXCLUSION_RECIPES).toBeGreaterThanOrEqual(172);
  });

  it("168 exclusions on one recipe are all kept through a save (no 64 truncation)", () => {
    const s = fakeStorage();
    const all = ids.slice(0, 168);
    persistProgress(progress({ researchExclusions: { [KNOWN]: all } }), s);
    expect((stored(s).researchExclusions as Record<string, string[]>)[KNOWN]).toHaveLength(168);
    expect(loadSave(s).researchExclusions[KNOWN]).toEqual(all);
  });

  it("a per-recipe list beyond the cap is clamped (first-seen order), on load and on write", () => {
    const s = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ researchExclusions: { [KNOWN]: ids } })) });
    expect(loadSave(s).researchExclusions[KNOWN]).toEqual(ids.slice(0, MAX_RESEARCH_EXCLUSIONS_PER_RECIPE));
    persistProgress(progress({ pitzBalance: 4, researchExclusions: { [KNOWN]: ids } }), s);
    expect((stored(s).researchExclusions as Record<string, string[]>)[KNOWN]).toHaveLength(MAX_RESEARCH_EXCLUSIONS_PER_RECIPE);
  });

  it("the recipe count is clamped too, for an unknown-recipe flood in storage", () => {
    const flood: Record<string, string[]> = {};
    for (let i = 0; i < MAX_RESEARCH_EXCLUSION_RECIPES + 40; i += 1) flood[`future-${i}`] = ["x-1"];
    const s = fakeStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ researchExclusions: flood })) });
    persistProgress(progress({ researchExclusions: { [KNOWN]: ["egg"] } }), s);
    expect(Object.keys(stored(s).researchExclusions as object).length).toBeLessThanOrEqual(MAX_RESEARCH_EXCLUSION_RECIPES);
    expect((stored(s).researchExclusions as Record<string, string[]>)[KNOWN]).toEqual(["egg"]);
  });

  it("a 172-recipe-sized ledger (172 recipes x 168 ids) stays a bounded save", () => {
    const big: Record<string, string[]> = {};
    for (let r = 0; r < 172; r += 1) big[`recipe-${r}`] = ids.slice(0, 168);
    const merged = unionResearchExclusions(big);
    expect(Object.keys(merged)).toHaveLength(172);
    expect(JSON.stringify(merged).length).toBeLessThan(1_000_000);
  });
});

describe("researchExclusions: pure helpers", () => {
  it("addResearchExclusions returns the same reference when nothing is new and never mutates", () => {
    const ledger = Object.freeze({ a: Object.freeze(["x"]) });
    expect(addResearchExclusions(ledger, "a", ["x"])).toBe(ledger);
    expect(addResearchExclusions(ledger, "a", [])).toBe(ledger);
    const next = addResearchExclusions(ledger, "b", ["y"]);
    expect(next).toEqual({ a: ["x"], b: ["y"] });
    expect(ledger).toEqual({ a: ["x"] });
  });
  it("sanitize drops empty and rejects arrays / non-objects", () => {
    expect(sanitizeResearchExclusions([["a"]], () => true)).toEqual({});
    expect(sanitizeResearchExclusions({ a: [] }, () => true)).toEqual({});
    expect(sanitizeResearchExclusions("x", () => true)).toEqual({});
  });
  it("createInitialGameState defaults to an empty ledger and takes the loaded one", () => {
    expect(createInitialGameState().researchExclusions).toEqual({});
    const g = createInitialGameState(undefined, undefined, 0, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { [KNOWN]: ["egg"] });
    expect(g.researchExclusions).toEqual({ [KNOWN]: ["egg"] });
  });
});
