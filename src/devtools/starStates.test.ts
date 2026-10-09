import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER, type DiscoveryLadder } from "../data/discoveryLadder";
import { countsTowardLadder } from "../data/recipes";
import { reachedStepNumber } from "../logic/discoveryLadder";
import { starsFromTotal } from "../logic/scoring";
import { totalStars } from "../logic/mastery";
import { creditedDiscoveredCount, resolveShopEntitlement } from "../state/materialEntitlement";
import { loadSave, SAVE_STORAGE_KEY } from "../state/persistence";
import { applyEditableState, inspectStoredSave } from "./apply";
import { productionCatalog, type EditorCatalog } from "./editorCatalog";
import { createMemoryStorage } from "./memoryStorage";
import { buildPreset, buildPresetById, PRESETS, STAR_PRESETS, starPresetsOf } from "./presets";
import { distributeStars, SCORE_FOR_STARS, STAR_MAX, STAR_MIN, starGatesOf, starTargetsOf, buildStarState } from "./starStates";
import { canonicalSaveObject, editableFromSave, hasErrors, normalizeEditableState, roundTripIssues, validateEditableState } from "./stateModel";

const catalog = productionCatalog();
const gates = starGatesOf(DISCOVERY_LADDER);
const [goat, spinach] = gates;

/** What the GAME reads back from a preset: the canonical save, written, then loaded by the real loader. */
function loaded(id: string) {
  const state = buildPresetById(id);
  const storage = createMemoryStorage();
  const result = applyEditableState(state, storage);
  expect(result.ok, `${id} applies`).toBe(true);
  const save = loadSave(storage);
  const entitlement = resolveShopEntitlement(save.dex, save.ownedIngredientIds, save.unlockedForShopIngredientIds);
  return { state, storage, save, entitlement, stars: totalStars(save.dex), count: creditedDiscoveredCount(save.dex), step: reachedStepNumber(DISCOVERY_LADDER, creditedDiscoveredCount(save.dex)) };
}

describe("distributeStars", () => {
  it("sums to the target, stays in 1..5, and is deterministic", () => {
    for (const [count, target] of [[1, 3], [50, 119], [50, 250], [51, 51], [51, 130], [7, 20]] as const) {
      const a = distributeStars(count, target);
      expect(a).toHaveLength(count);
      expect(a.reduce((x, y) => x + y, 0)).toBe(target);
      expect(a.every((s) => s >= STAR_MIN && s <= STAR_MAX)).toBe(true);
      expect(distributeStars(count, target)).toEqual(a);
    }
  });

  it("is even: values differ by at most 1, the first recipes carry the remainder", () => {
    expect(distributeStars(5, 12)).toEqual([3, 3, 2, 2, 2]);
    const a = distributeStars(50, 119);
    expect(Math.max(...a) - Math.min(...a)).toBeLessThanOrEqual(1);
    expect(a.slice(0, 19).every((s) => s === 3)).toBe(true);
  });

  it("throws out of range", () => {
    expect(() => distributeStars(5, 4)).toThrow(/cannot be spread/);
    expect(() => distributeStars(5, 26)).toThrow(/cannot be spread/);
    expect(() => distributeStars(5, 7.5)).toThrow();
    expect(() => distributeStars(-1, 0)).toThrow();
  });
});

describe("the star thresholds come from the starGates authority", () => {
  it("the production ladder's gates give the targets 119 / 120 / 129 / 130", () => {
    expect(gates.map((g) => g.gate)).toEqual(Object.values(DISCOVERY_LADDER.steps.flatMap((s) => Object.values(s.starGates ?? {}))).sort((a, b) => a - b));
    expect(starTargetsOf(DISCOVERY_LADDER).map((t) => t.stars)).toEqual(gates.flatMap((g) => [g.gate - 1, g.gate]));
    expect(STAR_PRESETS.map((p) => p.id)).toEqual(starTargetsOf(DISCOVERY_LADDER).map((t) => `stars-${t.stars}`));
    expect(STAR_PRESETS.map((p) => p.id)).toEqual(["stars-119", "stars-120", "stars-129", "stars-130"]);
  });

  it("the star presets are not part of the fixed PRESETS list, and ids never collide", () => {
    const ids = [...PRESETS, ...STAR_PRESETS].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("an unknown or off-gate target is refused", () => {
    expect(() => buildPresetById("stars-121")).toThrow(/unknown preset/);
    expect(() => buildPresetById("stars-")).toThrow(/unknown preset/);
    expect(() => buildPreset("stars-121")).toThrow(/no star-gate target/);
  });

  it("SCORE_FOR_STARS agrees with the real scoring bands", () => {
    for (let stars = STAR_MIN; stars <= STAR_MAX; stars++) expect(starsFromTotal(SCORE_FOR_STARS[stars])).toBe(stars);
  });
});

describe("star presets as the GAME reads them (real loader, step reach, Shop entitlement)", () => {
  const cases = [
    { id: "stars-119", stars: 119, gate: goat, locked: [goat.ingredientId, spinach.ingredientId] },
    { id: "stars-120", stars: 120, gate: goat, locked: [spinach.ingredientId], unlocked: [goat.ingredientId] },
    { id: "stars-129", stars: 129, gate: spinach, locked: [spinach.ingredientId], unlocked: [goat.ingredientId] },
    { id: "stars-130", stars: 130, gate: spinach, locked: [], unlocked: [goat.ingredientId, spinach.ingredientId] },
  ];

  for (const c of cases) {
    it(`${c.id}: ${c.stars} stars, the gated step reached, the gated materials ${c.unlocked ? "unlocked" : "locked"} as the authority says`, () => {
      const r = loaded(c.id);
      expect(r.stars).toBe(c.stars);
      expect(r.step).toBeGreaterThanOrEqual(c.gate.step); // the step of the gate nearest at / above is reached
      expect(r.count).toBeGreaterThanOrEqual(c.gate.step);
      const unlocked = new Set(r.entitlement.unlockedForShopIngredientIds);
      for (const id of c.locked) expect(unlocked.has(id), `${id} locked`).toBe(false);
      for (const id of c.unlocked ?? []) expect(unlocked.has(id), `${id} unlocked`).toBe(true);
      // the loader derives nothing new: the saved ledger already is the entitlement (no silent rewrite on load)
      expect(r.entitlement.newlyUnlockedMaterialIds).toEqual([]);
      // unlocked, never bought: the Shop shows them as NEW
      for (const id of c.unlocked ?? []) {
        expect(r.save.ownedIngredientIds).not.toContain(id);
        expect(r.save.inventory[id] ?? 0).toBe(0);
      }
    });
  }

  it("the gate side depends on stars alone: 119 vs 120 share one Dex, only the star sum differs", () => {
    const below = buildPreset("stars-119");
    const at = buildPreset("stars-120");
    expect(at.dex.map((e) => e.recipeId)).toEqual(below.dex.map((e) => e.recipeId));
    expect(at.ownedIngredientIds).toEqual(below.ownedIngredientIds);
    expect(creditedDiscoveredCount(at.dex)).toBe(creditedDiscoveredCount(below.dex));
  });

  it("every star preset validates, survives the real save path unchanged, and is a valid Dex (1..5 stars, score agrees)", () => {
    for (const p of STAR_PRESETS) {
      const state = buildPreset(p.id);
      expect(hasErrors(validateEditableState(state, catalog)), p.id).toBe(false);
      expect(roundTripIssues(state), p.id).toEqual([]);
      for (const e of state.dex) expect(starsFromTotal(e.bestScore), `${p.id} ${e.recipeId}`).toBe(e.bestStars);
      expect(creditedDiscoveredCount(state.dex)).toBe(state.dex.filter((e) => countsTowardLadder(e.recipeId)).length);
    }
  });

  it("the canonical save the E2E shares is the very save the editor applies", () => {
    for (const p of STAR_PRESETS) {
      const state = buildPreset(p.id);
      const storage = createMemoryStorage();
      expect(applyEditableState(state, storage).ok).toBe(true);
      const stored = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as Record<string, unknown>;
      expect(stored).toMatchObject(canonicalSaveObject(state)!);
    }
  });
});

describe("the unlock ledger never shrinks (existing spec, unchanged)", () => {
  it("a save holding the 130 ledger keeps it when its Dex is at 119 stars", () => {
    const high = loaded("stars-130").state;
    const low = buildPreset("stars-119");
    const kept = normalizeEditableState({ ...low, unlockedForShopIngredientIds: high.unlockedForShopIngredientIds }, catalog);
    for (const id of high.unlockedForShopIngredientIds) expect(kept.unlockedForShopIngredientIds).toContain(id);
    const storage = createMemoryStorage();
    expect(applyEditableState(kept, storage).ok).toBe(true);
    const save = loadSave(storage);
    const entitlement = resolveShopEntitlement(save.dex, save.ownedIngredientIds, save.unlockedForShopIngredientIds);
    expect(totalStars(save.dex)).toBe(119);
    expect(entitlement.unlockedForShopIngredientIds).toEqual(expect.arrayContaining([goat.ingredientId, spinach.ingredientId]));
  });

  it("editing a preset draft down in stars keeps the entitlement of the stored save (the editor derives, never shrinks)", () => {
    const storage = createMemoryStorage();
    expect(applyEditableState(buildPreset("stars-130"), storage).ok).toBe(true);
    const inspected = inspectStoredSave(storage);
    expect(inspected.kind).toBe("readable");
    if (inspected.kind !== "readable") return;
    const lowered = { ...inspected.state, dex: inspected.state.dex.map((e) => ({ ...e, bestStars: 1 as const, bestScore: SCORE_FOR_STARS[1] })) };
    const kept = normalizeEditableState(lowered, catalog);
    expect(totalStars(kept.dex)).toBeLessThan(120);
    expect(kept.unlockedForShopIngredientIds).toEqual(expect.arrayContaining([goat.ingredientId, spinach.ingredientId]));
    expect(editableFromSave(loadSave(createMemoryStorage())).dex).toEqual([]); // a fresh store is untouched by all this
  });
});

describe("star presets scale: a synthetic catalog with its own gates", () => {
  function gated(): EditorCatalog {
    const finite = Array.from({ length: 60 }, (_, i) => `f-${i}`);
    const ingredients = [{ id: "s-0" }, ...finite.map((id) => ({ id, unlockCondition: { kind: "x" } }))];
    const recipes = Array.from({ length: 61 }, (_, k) => ({ id: `r-${k}`, requiredIngredients: [{ ingredientId: "s-0" }, ...(k === 0 ? [] : [{ ingredientId: finite[k - 1] }])] }));
    const steps = finite.map((id, i) => ({
      step: i + 1,
      kind: "MATERIAL" as const,
      ingredientIds: [id],
      keyRecipeId: `r-${i + 1}`,
      ...(i === 39 ? { starGates: { [id]: 150 } } : i === 49 ? { starGates: { [id]: 60 } } : {}),
    }));
    const ladder: DiscoveryLadder = { populationId: "synthetic-gated", steps };
    return {
      recipes,
      ingredients,
      starterIds: ["s-0"],
      ladder,
      techniqueIds: [],
      countsTowardLadder: () => true,
      techniqueLedgerFor: () => [],
      researchEntries: () => [],
      researchLetter: (i) => String.fromCharCode(65 + i),
    };
  }

  it("targets follow the catalog's gates (sorted by threshold), no literal", () => {
    const c = gated();
    expect(starTargetsOf(c.ladder).map((t) => t.stars)).toEqual([59, 60, 149, 150]);
    expect(starPresetsOf(c).map((p) => p.id)).toEqual(["stars-59", "stars-60", "stars-149", "stars-150"]);
  });

  it("a state is built at the gated step with the gated material unlocked exactly at the gate", () => {
    const c = gated();
    for (const target of [59, 60, 149, 150]) {
      const state = buildStarState(c, target);
      expect(hasErrors(validateEditableState(state, c)), String(target)).toBe(false);
      expect(state.dex.reduce((n, e) => n + e.bestStars, 0)).toBe(target);
    }
    expect(buildStarState(c, 60).unlockedForShopIngredientIds).toContain("f-49");
    expect(buildStarState(c, 59).unlockedForShopIngredientIds).not.toContain("f-49");
    expect(buildStarState(c, 150).unlockedForShopIngredientIds).toContain("f-39");
    expect(buildStarState(c, 149).unlockedForShopIngredientIds).not.toContain("f-39");
  });

  it("buildPresetById resolves a star preset against the SUPPLIED catalog (stars-60 exists only here)", () => {
    const c = gated();
    const state = buildPresetById("stars-60", c);
    expect(state.dex.reduce((n, e) => n + e.bestStars, 0)).toBe(60);
    expect(state.unlockedForShopIngredientIds).toContain("f-49");
    expect(buildPresetById("stars-59", c).unlockedForShopIngredientIds).not.toContain("f-49");
  });

  it("the same catalog rejects the production-only star ids, and production still rejects the synthetic ones", () => {
    const c = gated();
    for (const id of ["stars-119", "stars-120", "stars-129", "stars-130"]) expect(() => buildPresetById(id, c), id).toThrow(/unknown preset/);
    expect(() => buildPresetById("stars-60")).toThrow(/unknown preset/);
    expect(buildPresetById("stars-120").dex.reduce((n, e) => n + e.bestStars, 0)).toBe(120); // production unchanged
  });

  it("a catalog without gates has no star presets, and building one fails loudly", () => {
    const c = { ...gated(), ladder: { populationId: "none", steps: gated().ladder.steps.map(({ starGates: _g, ...s }) => s) } };
    expect(starPresetsOf(c)).toEqual([]);
    expect(() => buildStarState(c, 120)).toThrow(/no star-gate target/);
  });
});
