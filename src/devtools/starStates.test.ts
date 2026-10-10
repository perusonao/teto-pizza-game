import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER, type DiscoveryLadder } from "../data/discoveryLadder";
import { countsTowardLadder } from "../data/recipes";
import { reachedStepNumber } from "../logic/discoveryLadder";
import { onboardingRecipeId } from "./editorCatalog";
import { starsFromTotal } from "../logic/scoring";
import { totalStars } from "../logic/mastery";
import { creditedDiscoveredCount, resolveShopEntitlement } from "../state/materialEntitlement";
import { loadSave, SAVE_STORAGE_KEY } from "../state/persistence";
import { applyEditableState, inspectStoredSave } from "./apply";
import { productionCatalog, type EditorCatalog } from "./editorCatalog";
import { createMemoryStorage } from "./memoryStorage";
import { buildPreset, buildPresetById, PRESETS, STAR_PRESETS, starPresetsOf } from "./presets";
import { buildableStarTargets, buildStarState, distributeStars, planStarState, SCORE_FOR_STARS, STAR_MAX, STAR_MIN, starGatesOf, starTargetsOf, STAR_PRESET_PITZ, STAR_PRESET_STOCK } from "./starStates";
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


/** A synthetic catalog: 60 ladder steps (step i unlocks `f-(i-1)`, its key recipe is `r-i`), with the given gates ({step: threshold}). */
function ladderCatalog(gates: Record<number, number>, notCredited: readonly string[] = []): EditorCatalog {
  const finite = Array.from({ length: 60 }, (_, i) => `f-${i}`);
  const ingredients = [{ id: "s-0" }, ...finite.map((id) => ({ id, unlockCondition: { kind: "x" } }))];
  const recipes = Array.from({ length: 61 }, (_, k) => ({ id: `r-${k}`, requiredIngredients: [{ ingredientId: "s-0" }, ...(k === 0 ? [] : [{ ingredientId: finite[k - 1] }])] }));
  const steps = finite.map((id, i) => ({ step: i + 1, kind: "MATERIAL" as const, ingredientIds: [id], keyRecipeId: `r-${i + 1}`, ...(gates[i + 1] !== undefined ? { starGates: { [id]: gates[i + 1] } } : {}) }));
  return {
    recipes,
    ingredients,
    starterIds: ["s-0"],
    ladder: { populationId: "synthetic-gates", steps },
    techniqueIds: [],
    countsTowardLadder: (id) => !notCredited.includes(id),
    techniqueLedgerFor: () => [],
    researchEntries: () => [],
    researchLetter: (i) => String.fromCharCode(65 + i),
  };
}

/** What the game would derive for a built state: the step it reaches and which gated materials are unlocked. */
function derived(c: EditorCatalog, stars: number) {
  const state = buildStarState(c, stars);
  const credited = state.dex.filter((e) => c.countsTowardLadder(e.recipeId)).length;
  const step = reachedStepNumber(c.ladder, credited);
  const unlocked = new Set(state.unlockedForShopIngredientIds);
  const entitlement = resolveShopEntitlement(state.dex, state.ownedIngredientIds, state.unlockedForShopIngredientIds, c.ladder, c.countsTowardLadder);
  return { state, step, unlocked, entitlement, sum: state.dex.reduce((n, e) => n + e.bestStars, 0) };
}

describe("star targets keep EVERY gate they stand for (Codex P2, starStates.ts:63)", () => {
  it("equal thresholds at different steps: one count stands for both and reaches the higher step", () => {
    const c = ladderCatalog({ 50: 100, 55: 100 });
    const targets = starTargetsOf(c.ladder);
    expect(targets.map((t) => [t.stars, t.step, t.gates.map((g) => `${g.side}:${g.gate.ingredientId}`)])).toEqual([
      [99, 55, ["below:f-49", "below:f-54"]],
      [100, 55, ["at:f-49", "at:f-54"]],
    ]);
    const at = derived(c, 100);
    expect(at.sum).toBe(100);
    expect(at.step).toBeGreaterThanOrEqual(55);
    expect(at.unlocked.has("f-49") && at.unlocked.has("f-54")).toBe(true); // both gates' materials, not just the first
    const below = derived(c, 99);
    expect(below.step).toBeGreaterThanOrEqual(55);
    expect(below.unlocked.has("f-49") || below.unlocked.has("f-54")).toBe(false); // step reached, stars short: still locked
  });

  it("adjacent thresholds: the shared count reaches the later gate's step but never unlocks the gate it is short of", () => {
    const c = ladderCatalog({ 50: 100, 55: 101 });
    const t100 = starTargetsOf(c.ladder).find((t) => t.stars === 100)!;
    expect(t100.gates.map((g) => g.side).sort()).toEqual(["at", "below"]);
    expect(t100.step).toBe(55);
    const r = derived(c, 100);
    expect(r.step).toBeGreaterThanOrEqual(55);
    expect(r.unlocked.has("f-49")).toBe(true); // 100 >= 100
    expect(r.unlocked.has("f-54")).toBe(false); // 100 < 101: step 55 is reached, the stars are not
    const next = derived(c, 101);
    expect(next.unlocked.has("f-49") && next.unlocked.has("f-54")).toBe(true);
    expect(derived(c, 99).unlocked.has("f-49")).toBe(false);
  });

  it("non-adjacent thresholds, in either step order, give independent targets", () => {
    for (const gates of [{ 50: 100, 55: 200 }, { 50: 200, 55: 100 }]) {
      const c = ladderCatalog(gates);
      expect(starTargetsOf(c.ladder).map((t) => t.stars)).toEqual([99, 100, 199, 200]);
      expect(buildableStarTargets(c).map((t) => t.stars)).toEqual([99, 100, 199, 200]);
    }
    const c = ladderCatalog({ 50: 100, 55: 200 });
    expect(derived(c, 100).unlocked.has("f-54")).toBe(false);
    expect(derived(c, 200).unlocked.has("f-54")).toBe(true);
  });

  it("the first and the last gate of a ladder", () => {
    const c = ladderCatalog({ 3: 4, 60: 300 });
    // first gate: 3 stars needs 3 recipes at step 3 -> 3 is under the Dex's own minimum (3 rows): buildable only from 3 up
    expect(buildableStarTargets(c).map((t) => t.stars)).toEqual([3, 4, 299, 300].filter((n) => planStarState(c, n).ok));
    expect(derived(c, 4).unlocked.has("f-2")).toBe(true);
    expect(derived(c, 3).unlocked.has("f-2")).toBe(false);
    // last gate: 300 over the 60 recipes of steps 1..59 + onboarding is within 5 each
    expect(derived(c, 300).unlocked.has("f-59")).toBe(true);
    expect(derived(c, 299).unlocked.has("f-59")).toBe(false);
  });

  it("an invariant over mixed ladders: a gated material is unlocked only when its step is reached AND its threshold is met", () => {
    for (const gates of [{ 50: 100, 55: 100 }, { 50: 100, 55: 101 }, { 50: 101, 55: 100 }, { 52: 120, 53: 120, 58: 121 }] as Record<number, number>[]) {
      const c = ladderCatalog(gates);
      for (const t of buildableStarTargets(c)) {
        const r = derived(c, t.stars);
        for (const g of starGatesOf(c.ladder)) {
          const unlocked = r.unlocked.has(g.ingredientId);
          if (unlocked) expect(r.step >= g.step && t.stars >= g.gate, `${JSON.stringify(gates)} @${t.stars}: ${g.ingredientId} unlocked wrongly`).toBe(true);
          for (const tg of t.gates) {
            expect(r.step, `${JSON.stringify(gates)} @${t.stars} reaches the step of ${tg.gate.ingredientId}`).toBeGreaterThanOrEqual(tg.gate.step);
            expect(r.unlocked.has(tg.gate.ingredientId), `${JSON.stringify(gates)} @${t.stars} ${tg.side}:${tg.gate.ingredientId}`).toBe(tg.side === "at");
          }
        }
        expect(r.entitlement.newlyUnlockedMaterialIds, "the state is already what the game derives").toEqual([]);
        expect(hasErrors(validateEditableState(r.state, c))).toBe(false);
      }
    }
  });

  it("unreachable star counts are not offered, and building one fails loudly", () => {
    const tooFew = ladderCatalog({ 50: 40 }); // step 50 needs 50 rows = at least 50 stars
    expect(starTargetsOf(tooFew.ladder).map((t) => t.stars)).toEqual([39, 40]);
    expect(buildableStarTargets(tooFew)).toEqual([]);
    expect(starPresetsOf(tooFew)).toEqual([]);
    expect(planStarState(tooFew, 40)).toMatchObject({ ok: false });
    expect(() => buildStarState(tooFew, 40)).toThrow(/cannot be held/);

    const tooMany = ladderCatalog({ 50: 400 }); // 50 rows hold at most 250 stars
    expect(buildableStarTargets(tooMany)).toEqual([]);

    const unreached = ladderCatalog({ 50: 120 }, ["r-10"]); // one key recipe does not credit the ladder: 49 credited < step 50
    expect(planStarState(unreached, 120)).toMatchObject({ ok: false });
    expect(() => buildStarState(unreached, 120)).toThrow(/not reached/);
    expect(starPresetsOf(unreached)).toEqual([]);

    expect(() => buildStarState(ladderCatalog({ 50: 120 }), 121)).toThrow(/no star-gate target/);
    // every listed preset of every catalog above builds (a click never throws)
    for (const c of [tooFew, tooMany, unreached, ladderCatalog({ 50: 100, 55: 101 })]) {
      for (const p of starPresetsOf(c)) expect(() => buildPreset(p.id, c), p.id).not.toThrow();
    }
  });

  it("the description names every role of a shared count and never claims a locked material is unlocked", () => {
    const c = ladderCatalog({ 50: 100, 55: 101 });
    const byId = Object.fromEntries(starPresetsOf(c).map((p) => [p.id, p.descriptionJa]));
    expect(byId["stars-99"]).toContain("100⭐の1つ手前");
    expect(byId["stars-99"]).toContain("まだ解放されない");
    expect(byId["stars-101"]).toContain("101⭐ちょうど");
    expect(byId["stars-100"]).toContain("100⭐の⭐条件付き材料は Shop に解放される");
    expect(byId["stars-100"]).toContain("101⭐の材料はまだ解放されない");
    expect(byId["stars-100"]).toContain("ladder step 55");
    // every description keeps the fixed phrase the production-bundle gate looks for
    for (const d of Object.values(byId)) expect(d).toContain("⭐条件付き材料");
  });
});

describe("production star presets are unchanged by the multi-gate audit (stars-119 / 120 / 129 / 130)", () => {
  /** The pre-audit construction, written independently of the code under test (step of the first gate, earlier steps by position). */
  function reference(stars: number) {
    const gate = gates.find((g) => g.gate === stars || g.gate === stars + 1)!;
    const earlier = DISCOVERY_LADDER.steps.filter((s) => s.step < gate.step);
    const dexIds = [...new Set([onboardingRecipeId(catalog)!, ...earlier.map((s) => s.keyRecipeId)])];
    const gatedIds = new Set(gates.map((g) => g.ingredientId));
    const owned = [...new Set(earlier.flatMap((s) => [...s.ingredientIds]))].filter((id) => !gatedIds.has(id));
    const rows = distributeStars(dexIds.length, stars);
    return normalizeEditableState(
      {
        ...buildPreset("fresh-start"),
        dex: dexIds.map((recipeId, i) => ({ recipeId, discovered: true, bestScore: SCORE_FOR_STARS[rows[i]], bestStars: rows[i] as 1, timesMade: 1 })),
        pitzBalance: STAR_PRESET_PITZ,
        ownedIngredientIds: [...catalog.starterIds, ...owned],
        inventory: Object.fromEntries(owned.map((id) => [id, STAR_PRESET_STOCK])),
      },
      catalog,
    );
  }

  it("the four production targets keep their single gate each and their step", () => {
    const targets = starTargetsOf(DISCOVERY_LADDER);
    expect(targets.map((t) => [t.stars, t.gates.length, t.gates[0].side])).toEqual([[119, 1, "below"], [120, 1, "at"], [129, 1, "below"], [130, 1, "at"]]);
    expect(targets.map((t) => t.step)).toEqual([goat.step, goat.step, spinach.step, spinach.step]);
    expect(buildableStarTargets(catalog).map((t) => t.stars)).toEqual([119, 120, 129, 130]);
  });

  it("each preset equals the independent reference state, field for field", () => {
    for (const stars of [119, 120, 129, 130]) expect(buildPreset(`stars-${stars}`), `stars-${stars}`).toEqual(reference(stars));
  });

  it("the descriptions the editor shows are the same as before", () => {
    const byId = Object.fromEntries(STAR_PRESETS.map((p) => [p.id, p.descriptionJa]));
    expect(byId["stars-119"]).toBe(`累計⭐119（120⭐の1つ手前。ladder step ${goat.step} 到達済み、⭐条件付き材料はまだ解放されない）`);
    expect(byId["stars-120"]).toBe(`累計⭐120（120⭐ちょうど。ladder step ${goat.step} 到達済み、⭐条件付き材料が Shop に解放される・未購入）`);
    expect(byId["stars-129"]).toBe(`累計⭐129（130⭐の1つ手前。ladder step ${spinach.step} 到達済み、⭐条件付き材料はまだ解放されない）`);
    expect(byId["stars-130"]).toBe(`累計⭐130（130⭐ちょうど。ladder step ${spinach.step} 到達済み、⭐条件付き材料が Shop に解放される・未購入）`);
  });
});
