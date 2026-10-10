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
import { buildPreset, buildPresetById, PRESETS, STAR_PRESETS, starPresetsOf, starTargetDescription } from "./presets";
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
    expect(byId["stars-99"]).toContain("100⭐条件の⭐条件付き材料はまだ解放されない");
    expect(byId["stars-101"]).toContain("101⭐ちょうど");
    expect(byId["stars-100"]).toContain("100⭐条件の⭐条件付き材料は Shop に解放される");
    expect(byId["stars-100"]).toContain("101⭐条件の材料はまだ解放されない");
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

  it("the descriptions name the threshold of the gate they speak about (state unchanged; wording scoped so another threshold's unlocked material is not called locked)", () => {
    const byId = Object.fromEntries(STAR_PRESETS.map((p) => [p.id, p.descriptionJa]));
    expect(byId["stars-119"]).toBe(`累計⭐119（120⭐の1つ手前。ladder step ${goat.step} 到達済み、120⭐条件の⭐条件付き材料はまだ解放されない）`);
    expect(byId["stars-120"]).toBe(`累計⭐120（120⭐ちょうど。ladder step ${goat.step} 到達済み、120⭐条件の⭐条件付き材料が Shop に解放される・未購入）`);
    expect(byId["stars-129"]).toBe(`累計⭐129（130⭐の1つ手前。ladder step ${spinach.step} 到達済み、130⭐条件の⭐条件付き材料はまだ解放されない）`);
    expect(byId["stars-130"]).toBe(`累計⭐130（130⭐ちょうど。ladder step ${spinach.step} 到達済み、130⭐条件の⭐条件付き材料が Shop に解放される・未購入）`);
  });
});

describe("a gate that cannot be reached does not hide the reachable ones it shares a count with (Codex P2, starStates.ts:82)", () => {
  it("30 stars at step 20 AND step 50: the step-20 boundary presets stay, the step-50 gate is not unlocked", () => {
    const c = ladderCatalog({ 20: 30, 50: 30 }); // step 50 needs a 50-row Dex = at least 50 stars: 29 / 30 cannot reach it
    expect(starTargetsOf(c.ladder).map((t) => [t.stars, t.gates.length, t.step])).toEqual([[29, 2, 50], [30, 2, 50]]); // candidates keep both
    expect(buildableStarTargets(c).map((t) => [t.stars, t.gates.map((g) => g.gate.ingredientId), t.step])).toEqual([
      [29, ["f-19"], 20],
      [30, ["f-19"], 20],
    ]);
    expect(starPresetsOf(c).map((p) => p.id)).toEqual(["stars-29", "stars-30"]);
    const at = derived(c, 30);
    expect(at.sum).toBe(30);
    expect(at.step).toBeGreaterThanOrEqual(20);
    expect(at.unlocked.has("f-19")).toBe(true); // the step-20 gate's material
    expect(at.unlocked.has("f-49")).toBe(false); // the step-50 gate is unreachable at 30 stars: never unlocked
    const below = derived(c, 29);
    expect(below.unlocked.has("f-19")).toBe(false);
    expect(below.unlocked.has("f-49")).toBe(false);
  });

  it("the description names only the gates that were kept", () => {
    const c = ladderCatalog({ 20: 30, 50: 31 }); // 30 = "at" step 20 and "below" step 50 (unreachable at 30)
    const byId = Object.fromEntries(starPresetsOf(c).map((p) => [p.id, p.descriptionJa]));
    expect(byId["stars-30"]).toBe("累計⭐30（30⭐ちょうど。ladder step 20 到達済み、30⭐条件の⭐条件付き材料が Shop に解放される・未購入）");
    expect(byId["stars-30"]).not.toContain("31⭐");
  });

  it("a count whose every gate is unreachable is not listed at all", () => {
    const c = ladderCatalog({ 50: 30, 55: 30 });
    expect(starTargetsOf(c.ladder).map((t) => t.stars)).toEqual([29, 30]);
    expect(buildableStarTargets(c)).toEqual([]);
    expect(starPresetsOf(c)).toEqual([]);
    expect(() => buildStarState(c, 30)).toThrow(/cannot be held/);
  });

  it("adjacent, non-adjacent, equal and step-swapped ladders keep what is reachable", () => {
    // adjacent: 100 stars is the "at" of step 50 and the "below" of step 55: both stay
    expect(buildableStarTargets(ladderCatalog({ 50: 100, 55: 101 })).map((t) => [t.stars, t.gates.length, t.step])).toEqual([[99, 1, 50], [100, 2, 55], [101, 1, 55]]);
    // step-swapped (the lower threshold sits at the higher step)
    expect(buildableStarTargets(ladderCatalog({ 50: 101, 55: 100 })).map((t) => [t.stars, t.gates.length, t.step])).toEqual([[99, 1, 55], [100, 2, 55], [101, 1, 50]]);
    // non-adjacent, one gate unreachable (step 55 with 20 stars): only the other pair stays
    expect(buildableStarTargets(ladderCatalog({ 50: 100, 55: 20 })).map((t) => t.stars)).toEqual([99, 100]);
  });
});


describe("the FINAL state is the standard: gates the final step reaches are kept and described by what the game says (Codex P2, starStates.ts:141)", () => {
  const unlockedBy = (c: EditorCatalog, stars: number) => derived(c, stars).unlocked;

  it("gate 100 at step 10 + gate 101 at step 20, target 100: built at step 20, the step-10 gate is kept as 'at' and is unlocked", () => {
    const c = ladderCatalog({ 10: 100, 20: 101 });
    const plan = planStarState(c, 100);
    expect(plan.ok && plan.target.step).toBe(20); // step 10 cannot hold 100 stars by itself (10 rows, at most 50), step 20 can
    expect(plan.ok && plan.target.gates.map((g) => `${g.side}:${g.gate.ingredientId}`)).toEqual(["at:f-9", "below:f-19"]);
    const r = derived(c, 100);
    expect(r.step).toBe(20);
    expect(r.unlocked.has("f-9")).toBe(true); // the game unlocks it: step reached, 100 >= 100
    expect(r.unlocked.has("f-19")).toBe(false); // 100 < 101
    const d = starPresetsOf(c).find((p) => p.id === "stars-100")!.descriptionJa;
    expect(d).toBe("累計⭐100（100⭐条件の⭐条件付き材料は Shop に解放される・未購入、101⭐条件の材料はまだ解放されない。ladder step 20 到達済み）");
  });

  it("gate 78 at step 5 + gate 78 at step 37, target 77: built at step 37, both gates are kept as 'below' and both stay locked", () => {
    const c = ladderCatalog({ 5: 78, 37: 78 });
    const below = planStarState(c, 77);
    expect(below.ok && below.target.step).toBe(37);
    expect(below.ok && below.target.gates.map((g) => `${g.side}:${g.gate.ingredientId}`)).toEqual(["below:f-4", "below:f-36"]);
    const b = derived(c, 77);
    expect(b.step).toBe(37);
    expect(b.unlocked.has("f-4") || b.unlocked.has("f-36")).toBe(false);
    const at = derived(c, 78);
    expect(at.unlocked.has("f-4") && at.unlocked.has("f-36")).toBe(true); // step 5's gate is unlocked as well at the higher step
  });

  it("three equal gates at different steps: the final step is the highest one that can hold the stars, the gates above it are not kept", () => {
    // 120 stars: step 8 (max 40) cannot, step 30 (30..150) can, step 50 (50..250) can
    expect(buildableStarTargets(ladderCatalog({ 8: 120, 30: 120, 50: 120 })).map((t) => [t.stars, t.gates.length, t.step])).toEqual([[119, 3, 50], [120, 3, 50]]);
    // step 55 cannot hold 20 stars at all, so its gate (a different count) is not offered; the equal pair stays at step 30
    expect(buildableStarTargets(ladderCatalog({ 8: 120, 30: 120, 55: 20 })).map((t) => [t.stars, t.gates.length, t.step])).toEqual([[119, 2, 30], [120, 2, 30]]);
    // the gate ABOVE the final step is not reached in the final state: it is neither kept nor unlocked
    const c4 = ladderCatalog({ 20: 30, 50: 30 }); // 50 rows need >= 50 stars: step 50 cannot hold 30
    expect(buildableStarTargets(c4).map((t) => [t.step, t.gates.length])).toEqual([[20, 1], [20, 1]]);
    expect(derived(c4, 30).unlocked.has("f-49")).toBe(false);
  });

  it("an extra gate that the final step unlocks (another threshold) is unlocked by the game, and no description calls it locked", () => {
    const c = ladderCatalog({ 5: 50, 20: 100 }); // target 99/100 stand for the step-20 gate; the step-5 gate (50) is unlocked too
    for (const stars of [99, 100]) {
      const r = derived(c, stars);
      expect(r.unlocked.has("f-4"), `${stars}: the step-5 / 50-star material`).toBe(true);
    }
    const byId = Object.fromEntries(starPresetsOf(c).map((p) => [p.id, p.descriptionJa]));
    expect(byId["stars-99"]).toBe("累計⭐99（100⭐の1つ手前。ladder step 20 到達済み、100⭐条件の⭐条件付き材料はまだ解放されない）"); // scoped to the 100-star gate: true
    expect(unlockedBy(c, 99).has("f-19")).toBe(false);
    expect(unlockedBy(c, 100).has("f-19")).toBe(true);
  });

  it("the description speaks only about the gates it kept, and says nothing the final state contradicts", () => {
    for (const gates of [{ 10: 100, 20: 101 }, { 5: 78, 37: 78 }, { 20: 30, 50: 30 }, { 50: 100, 55: 101 }] as Record<number, number>[]) {
      const c = ladderCatalog(gates);
      for (const t of buildableStarTargets(c)) {
        const d = starTargetDescription(t);
        const r = derived(c, t.stars);
        const hasAt = t.gates.some((g) => g.side === "at");
        const below = t.gates.find((g) => g.side === "below");
        expect(d.includes("解放される"), `${JSON.stringify(gates)} @${t.stars}: says unlocked`).toBe(hasAt);
        expect(d.includes("解放されない"), `${JSON.stringify(gates)} @${t.stars}: says locked`).toBe(below !== undefined);
        for (const g of t.gates) expect(r.unlocked.has(g.gate.ingredientId), `${JSON.stringify(gates)} @${t.stars}: ${g.side} ${g.gate.ingredientId}`).toBe(g.side === "at");
        expect(d).toContain(`ladder step ${r.step} 到達済み`);
      }
    }
  });
});

describe("star targets: property test over generated ladders (fixed seed, independent oracle)", () => {
  const SEED = 441;
  const CASES = 120;
  /** mulberry32: a small deterministic PRNG, so a failing case is reproduced by its seed alone. */
  function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** A generated ladder: up to 5 gates on distinct steps (thresholds drawn feasible, arbitrary, or equal / adjacent to an earlier one), and up to 2 key recipes that do not credit the ladder. */
  function generate(seed: number) {
    const next = rng(seed);
    const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
    const gates: Record<number, number> = {};
    const thresholds: number[] = [];
    for (let k = int(0, 5); k > 0; k--) {
      const step = int(1, 60);
      if (gates[step] !== undefined) continue;
      const roll = next();
      const gate =
        thresholds.length > 0 && roll < 0.35 ? thresholds[int(0, thresholds.length - 1)] + int(-1, 1) // equal / adjacent to an earlier threshold
        : roll < 0.7 ? int(step, step * 5) // inside the window step `step` can hold
        : int(1, 320); // anywhere: often unreachable
      if (gate < 1) continue;
      gates[step] = gate;
      thresholds.push(gate);
    }
    const notCredited = Array.from({ length: int(0, 2) }, () => `r-${int(1, 59)}`);
    return { gates, notCredited };
  }

  /**
   * The oracle works on STATES, not on the implementation's gate selection: it enumerates every (step S, stars T) the
   * ladder's own Dex could stand for (the Dex of step S is the S rows r-0..r-(S-1); it is valid when S of them credit
   * the ladder and T fits 1..5 per row), then replays the GAME's rule on each valid state.
   */
  function validStates(notCredited: readonly string[]) {
    const valid = new Set<string>();
    for (let step = 1; step <= 60; step++) {
      const rows = Array.from({ length: step }, (_, i) => `r-${i}`);
      const credited = rows.filter((id) => !notCredited.includes(id)).length;
      if (credited < step) continue;
      for (let stars = STAR_MIN * step; stars <= STAR_MAX * step; stars++) valid.add(`${step}:${stars}`);
    }
    return valid;
  }

  it(`${CASES} generated ladders: every listed target is a valid final state whose unlocks and description the game confirms`, () => {
    let listed = 0;
    let dropped = 0;
    let keptAboveOwnStep = 0;
    for (let i = 0; i < CASES; i++) {
      const caseSeed = SEED + i;
      const { gates: gateMap, notCredited } = generate(caseSeed);
      const header = `seed=${caseSeed} (SEED ${SEED} + case ${i}) ladder gates={step:threshold}=${JSON.stringify(gateMap)} notCredited=${JSON.stringify(notCredited)}`;
      const c = ladderCatalog(gateMap, notCredited);
      const gateList = Object.entries(gateMap).map(([step, thr]) => ({ step: Number(step), thr, id: `f-${Number(step) - 1}` }));
      const valid = validStates(notCredited);

      // 1. Which star counts are offered, and at which step: from the enumerated valid states.
      const expected = new Map<number, number>(); // stars -> final step
      for (let stars = STAR_MIN; stars <= 330; stars++) {
        const represented = gateList.filter((g) => g.thr === stars || g.thr === stars + 1);
        const seedSteps = represented.filter((g) => valid.has(`${g.step}:${stars}`)).map((g) => g.step);
        if (seedSteps.length > 0) expected.set(stars, Math.max(...seedSteps));
      }
      const targets = buildableStarTargets(c);
      expect(targets.map((t) => t.stars), `${header}: the offered star counts`).toEqual([...expected.keys()]);
      expect(starPresetsOf(c).map((p) => p.id), `${header}: the presets`).toEqual(targets.map((t) => `stars-${t.stars}`));
      listed += targets.length;
      dropped += starTargetsOf(c.ladder).length - targets.length;

      for (const t of targets) {
        const ctx = `${header} | target=${t.stars} chosenStep=${t.step} expectedStep=${expected.get(t.stars)}`;
        let r: ReturnType<typeof derived>;
        try {
          r = derived(c, t.stars);
        } catch (error) {
          throw new Error(`${ctx}: build failed: ${(error as Error).message}`);
        }
        // 2. The state is one of the enumerated valid ones, at the expected step, with the exact stars.
        expect(t.step, `${ctx}: final step`).toBe(expected.get(t.stars));
        expect(valid.has(`${r.state.dex.length}:${r.sum}`), `${ctx}: built Dex (${r.state.dex.length} rows, ${r.sum} stars) is a valid state`).toBe(true);
        expect(r.sum, `${ctx}: Dex stars`).toBe(t.stars);
        expect(r.state.dex.length, `${ctx}: Dex rows = final step`).toBe(t.step);
        expect(r.step, `${ctx}: step the game reaches`).toBe(t.step);
        expect(hasErrors(validateEditableState(r.state, c)), `${ctx}: validates`).toBe(false);

        // 3. The game's own entitlement, from an EMPTY ledger, equals the rule "step reached AND threshold met".
        const fromGame = new Set(resolveShopEntitlement(r.state.dex, r.state.ownedIngredientIds, [], c.ladder, c.countsTowardLadder).unlockedForShopIngredientIds);
        const byRule = new Set(
          c.ladder.steps.filter((s) => s.step <= t.step).flatMap((s) => s.ingredientIds.filter(() => gateMap[s.step] === undefined || t.stars >= gateMap[s.step])),
        );
        expect([...fromGame].sort(), `${ctx}: unlocked set (game) vs rule`).toEqual([...byRule].sort());
        expect([...r.unlocked].sort(), `${ctx}: the state's own ledger is the game's`).toEqual([...fromGame].sort());

        // 4. The kept gates: exactly the represented gates the final step reaches; each is unlocked iff `at`.
        const representedReached = gateList.filter((g) => (g.thr === t.stars || g.thr === t.stars + 1) && g.step <= t.step).map((g) => g.id).sort();
        expect(t.gates.map((g) => g.gate.ingredientId).sort(), `${ctx}: kept gates`).toEqual(representedReached);
        for (const g of t.gates) {
          expect(fromGame.has(g.gate.ingredientId), `${ctx}: ${g.side} ${g.gate.ingredientId} (step ${g.gate.step}, threshold ${g.gate.gate}) unlocked by the game`).toBe(g.side === "at");
          if (!valid.has(`${g.gate.step}:${t.stars}`)) keptAboveOwnStep++;
        }

        // 5. The description says only what the final state confirms.
        const d = starPresetsOf(c).find((p) => p.id === `stars-${t.stars}`)!.descriptionJa;
        const hasAt = t.gates.some((g) => g.side === "at");
        const below = t.gates.find((g) => g.side === "below");
        expect(d.includes("解放される"), `${ctx}: description claims an unlock ("${d}")`).toBe(hasAt);
        expect(d.includes("解放されない"), `${ctx}: description claims a lock ("${d}")`).toBe(below !== undefined);
        if (hasAt) expect(d, `${ctx}: at-threshold named`).toContain(`${t.stars}⭐条件の`);
        if (below) expect(d, `${ctx}: below-threshold named`).toContain(`${below.gate.gate}⭐条件`);
        expect(d, `${ctx}: step named`).toContain(`ladder step ${t.step} 到達済み`);
      }
    }
    // the generator really exercises the cases (otherwise the test would pass for the wrong reason)
    expect(listed).toBeGreaterThan(100);
    expect(dropped).toBeGreaterThan(20);
    expect(keptAboveOwnStep).toBeGreaterThan(0); // a gate kept only because the final step reaches it
  });
});
