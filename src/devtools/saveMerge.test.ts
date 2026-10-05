import { describe, expect, it } from "vitest";
import { productionCatalog } from "./editorCatalog";
import { classifyRawSave, DEFAULT_MERGE_OPTIONS, mergeEditedSave, type RawSaveClass } from "./saveMerge";
import { buildPreset } from "./presets";
import { canonicalSaveObject, freshEditableState } from "./stateModel";

const catalog = productionCatalog();

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** A stored v2 save of a newer build: unknown top-level keys, unknown ids inside every known field. */
function futureSave() {
  return {
    schemaVersion: 2,
    dex: [
      { recipeId: "margherita", discovered: true, bestScore: 50, bestStars: 2, timesMade: 1 },
      { recipeId: "future-recipe", discovered: true, bestScore: 80, bestStars: 4, timesMade: 2 },
    ],
    pitzBalance: 77,
    ownedIngredientIds: ["tomato-sauce", "future-ingredient", "mozzarella"],
    missionBest: { "lunch-rush": 612 },
    inventory: { "future-ingredient": 5 },
    starterGrantClaimedRecipeIds: ["future-recipe"],
    unlockedForShopIngredientIds: ["future-ingredient"],
    discoveryHintPurchases: { "future-recipe": 3 },
    discoveryHintFacts: { "future-recipe": ["ing:future-ingredient"] },
    discoveredTechniqueIds: ["future-technique"],
    dinnerMissionRecords: { "dinner-x": { weird: true } },
    futureTopLevel: { nested: [1, 2, 3] },
    anotherFutureKey: "kept",
  };
}

const readable = (value: Record<string, unknown>): RawSaveClass => ({ kind: "readable", value });

describe("classifyRawSave (the game's own root gate)", () => {
  it("empty, corrupt, unknown schema, readable v1 / v2", () => {
    expect(classifyRawSave(null)).toEqual({ kind: "empty" });
    expect(classifyRawSave("{not json").kind).toBe("corrupt");
    expect(classifyRawSave("").kind).toBe("corrupt");
    expect(classifyRawSave(JSON.stringify({ schemaVersion: 3, dex: [] }))).toEqual({ kind: "unknown-schema", schemaVersion: 3 });
    expect(classifyRawSave(JSON.stringify({ schemaVersion: 2 })).kind).toBe("unknown-schema");
    expect(classifyRawSave(JSON.stringify([1, 2])).kind).toBe("unknown-schema");
    expect(classifyRawSave("42").kind).toBe("unknown-schema");
    expect(classifyRawSave("null").kind).toBe("unknown-schema");
    expect(classifyRawSave(JSON.stringify({ schemaVersion: 1, dex: [] })).kind).toBe("readable");
    expect(classifyRawSave(JSON.stringify({ schemaVersion: 2, dex: [] })).kind).toBe("readable");
  });
});

describe("mergeEditedSave: unknown owned ids keep their acquisition positions (Codex P2)", () => {
  const [f0, f1, f2] = catalog.ingredients.filter((i) => i.unlockCondition !== undefined).map((i) => i.id);
  const starters = [...catalog.starterIds];
  const store = (owned: string[]): RawSaveClass => readable({ schemaVersion: 2, dex: [], ownedIngredientIds: owned });
  const edited = (owned: string[]) => canonicalSaveObject({ ...freshEditableState(), ownedIngredientIds: owned });
  const ownedOf = (value: Record<string, unknown> | null) => value!.ownedIngredientIds as string[];

  it("an edit that does not touch the order (Pitz) leaves the stored order exactly as it was, unknown ids in the middle included", () => {
    const stored = [...starters, f0, "future-a", f1, "future-b", f2];
    const canonical = canonicalSaveObject({ ...freshEditableState(), ownedIngredientIds: [...starters, f0, f1, f2], pitzBalance: 99 });
    expect(ownedOf(mergeEditedSave(canonical, store(stored), catalog).value)).toEqual(stored);
  });

  it("a reordered known sequence: each unknown id follows the stored id it came after", () => {
    const stored = [...starters, f0, "future-a", f1, f2];
    const result = ownedOf(mergeEditedSave(edited([...starters, f1, f0, f2]), store(stored), catalog).value);
    expect(result).toEqual([...starters, f1, f0, "future-a", f2]);
  });

  it("when its anchor was removed by the edit, it follows the closest earlier id that is still there; consecutive unknown ids keep their relative order", () => {
    const stored = [...starters, f0, "future-a", "future-b", f1];
    const result = ownedOf(mergeEditedSave(edited([...starters, f1]), store(stored), catalog).value);
    expect(result).toEqual([...starters, "future-a", "future-b", f1]);
  });

  it("an unknown id stored before every known id keeps the front", () => {
    const result = ownedOf(mergeEditedSave(edited([...starters, f0]), store(["future-a", ...starters, f0]), catalog).value);
    expect(result).toEqual(["future-a", ...starters, f0]);
  });

  it("a newly OWNED known id stays where the edit put it; unknown ids are never duplicated or dropped", () => {
    const stored = [...starters, "future-a", f0];
    const result = ownedOf(mergeEditedSave(edited([...starters, f0, f1]), store(stored), catalog).value);
    expect(result).toEqual([...starters, "future-a", f0, f1]);
    expect(result.filter((id) => id === "future-a")).toHaveLength(1);
  });
});

describe("mergeEditedSave: replace the known editable fields, keep everything else", () => {
  const state = buildPreset("margherita-discovered");
  const canonical = canonicalSaveObject({ ...state, pitzBalance: 300 });

  it("keeps unknown top-level keys verbatim", () => {
    const { value, preserved } = mergeEditedSave(canonical, readable(futureSave()), catalog);
    expect(value?.futureTopLevel).toEqual({ nested: [1, 2, 3] });
    expect(value?.anotherFutureKey).toBe("kept");
    expect(preserved.topLevelKeys.sort()).toEqual(["anotherFutureKey", "futureTopLevel"]);
  });

  it("keeps unknown recipe / ingredient / technique ids inside every known field, after the edited known ones", () => {
    const { value, preserved } = mergeEditedSave(canonical, readable(futureSave()), catalog);
    const dex = value?.dex as { recipeId: string }[];
    expect(dex.map((e) => e.recipeId)).toEqual(["margherita", "future-recipe"]);
    expect(value?.ownedIngredientIds).toContain("future-ingredient");
    // an unknown id keeps its STORED position (here right after the first starter), see the positions test below
    expect((value!.ownedIngredientIds as string[]).indexOf("future-ingredient")).toBe(1);
    expect(value?.inventory).toEqual({ "future-ingredient": 5 });
    expect(value?.starterGrantClaimedRecipeIds).toEqual(["future-recipe"]);
    expect(value?.unlockedForShopIngredientIds).toContain("future-ingredient");
    expect(value?.discoveryHintPurchases).toEqual({ "future-recipe": 3 });
    expect(value?.discoveryHintFacts).toEqual({ "future-recipe": ["ing:future-ingredient"] });
    expect(value?.discoveredTechniqueIds).toContain("future-technique");
    expect(preserved.unknownIds).toBeGreaterThanOrEqual(8);
  });

  it("replaces the known fields: the edit wins, a removed KNOWN id stays removed", () => {
    const { value } = mergeEditedSave(canonical, readable(futureSave()), catalog);
    expect(value?.pitzBalance).toBe(300);
    const owned = value?.ownedIngredientIds as string[];
    expect(owned).toContain("tomato-sauce");
    expect(owned).not.toContain("mozzarella-not-a-thing");
    // the stored save had `mozzarella` (a starter) and the edit has it too, once
    expect(owned.filter((id) => id === "mozzarella")).toHaveLength(1);
    const edited = buildPreset("fresh-start");
    const fresh = mergeEditedSave(canonicalSaveObject(edited), readable({ ...futureSave(), dex: [...futureSave().dex, { recipeId: "bismarck", discovered: true, bestScore: 60, bestStars: 3, timesMade: 1 }] }), catalog);
    expect((fresh.value!.dex as { recipeId: string }[]).map((e) => e.recipeId)).toEqual(["future-recipe"]);
  });

  it("missionBest and dinnerMissionRecords are carried over verbatim by default (Owner Decision OD-3)", () => {
    const { value, preserved } = mergeEditedSave(canonical, readable(futureSave()), catalog);
    expect(value?.missionBest).toEqual({ "lunch-rush": 612 });
    expect(value?.dinnerMissionRecords).toEqual({ "dinner-x": { weird: true } });
    expect(preserved).toMatchObject({ missionBest: true, dinnerRecords: true });
  });

  it("each preservation can be turned off on its own", () => {
    const off = (o: Partial<typeof DEFAULT_MERGE_OPTIONS>) => mergeEditedSave(canonical, readable(futureSave()), catalog, { ...DEFAULT_MERGE_OPTIONS, ...o }).value;
    expect(off({ preserveMissionBest: false })?.missionBest).toEqual({});
    expect(off({ preserveDinnerRecords: false })).not.toHaveProperty("dinnerMissionRecords");
    const noUnknown = off({ preserveUnknown: false });
    expect(noUnknown).not.toHaveProperty("futureTopLevel");
    expect(noUnknown?.ownedIngredientIds).not.toContain("future-ingredient");
    expect((noUnknown!.dex as { recipeId: string }[]).map((e) => e.recipeId)).toEqual(["margherita"]);
  });

  it("the canonical (authority) value wins over any stored value of a handled key", () => {
    const stored = { ...futureSave(), pitzBalance: 1, schemaVersion: 2 };
    expect(mergeEditedSave(canonical, readable(stored), catalog).value?.pitzBalance).toBe(300);
    expect(mergeEditedSave(canonical, readable(stored), catalog).value?.schemaVersion).toBe(2);
  });

  it("never mutates its inputs", () => {
    const frozenCanonical = deepFreeze(JSON.parse(JSON.stringify(canonical)) as Record<string, unknown>);
    const frozenStored = deepFreeze(futureSave());
    expect(() => mergeEditedSave(frozenCanonical, readable(frozenStored), catalog)).not.toThrow();
  });

  it("an unreadable / empty stored save preserves nothing and returns the canonical value as is", () => {
    for (const original of [{ kind: "empty" }, { kind: "corrupt" }, { kind: "unknown-schema", schemaVersion: 9 }] as RawSaveClass[]) {
      expect(mergeEditedSave(canonical, original, catalog).value).toBe(canonical);
      expect(mergeEditedSave(null, original, catalog).value).toBeNull();
    }
  });

  it("a readable save with nothing to keep stores exactly the canonical value; the default state stores nothing", () => {
    const plain = { schemaVersion: 2, dex: [], pitzBalance: 0, ownedIngredientIds: [...catalog.starterIds], missionBest: {}, inventory: {} };
    expect(mergeEditedSave(canonical, readable(plain), catalog).value).toBe(canonical);
    expect(mergeEditedSave(null, readable(plain), catalog).value).toBeNull();
  });

  it("the default state still carries what is kept: a default-based save with the preserved data", () => {
    const { value } = mergeEditedSave(null, readable(futureSave()), catalog);
    expect(value?.schemaVersion).toBe(2);
    expect(value?.futureTopLevel).toEqual({ nested: [1, 2, 3] });
    expect(value?.missionBest).toEqual({ "lunch-rush": 612 });
    expect(value?.dinnerMissionRecords).toEqual({ "dinner-x": { weird: true } });
    expect(value).not.toHaveProperty("dinnerMissionRecordsState");
  });

  it("ignores prototype-polluting and malformed ids", () => {
    const hostile = JSON.parse(
      '{"schemaVersion":2,"dex":[{"recipeId":"__proto__","discovered":true,"bestScore":1,"bestStars":1,"timesMade":0},{"recipeId":"BAD ID","discovered":true}],"__proto__":{"x":1},"ownedIngredientIds":["../etc","ok-id"],"discoveryHintFacts":{"__proto__":["a"],"Bad":["b"]}}',
    ) as Record<string, unknown>;
    const { value } = mergeEditedSave(canonical, readable(hostile), catalog);
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect((value as { x?: unknown }).x).toBeUndefined();
    expect(value?.ownedIngredientIds).toContain("ok-id");
    expect(value?.ownedIngredientIds).not.toContain("../etc");
    expect((value!.dex as { recipeId: string }[]).some((e) => e.recipeId === "__proto__" || e.recipeId === "BAD ID")).toBe(false);
    expect(value?.discoveryHintFacts).not.toHaveProperty("Bad");
  });
});
