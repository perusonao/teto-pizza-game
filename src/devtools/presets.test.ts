import { describe, expect, it } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { deriveResearchEntries, researchEntryLabel } from "../logic/discovery/researchEntry";
import { finiteIngredientIds, onboardingRecipeId, productionCatalog, type EditorCatalog } from "./editorCatalog";
import {
  allFiniteInLadderOrder,
  buildPreset,
  buildPresetById,
  PRESET_FINITE_STOCK,
  PRESETS,
  RESEARCH_PRESET_STEP,
} from "./presets";
import { freshEditableState, hasErrors, loadCanonical, roundTripIssues, validateEditableState, type EditableState } from "./stateModel";

const catalog = productionCatalog();
const stepTarget = catalog.ladder.steps[RESEARCH_PRESET_STEP - 1];

describe("presets are derived from the real catalog", () => {
  it("the preset list is the eight designed presets, Step 12 B discovered included (#402 merged)", () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      "fresh-start",
      "margherita-discovered",
      "research-step12-ready",
      "step12-abc-undiscovered",
      "step12-b-discovered",
      "last-step-ready",
      "all-ingredients",
      "all-recipes",
      "everything-unlocked",
    ]);
    expect(() => buildPresetById("step12-b-discovered")).not.toThrow();
    expect(() => buildPresetById("nope")).toThrow(/unknown preset/);
  });

  it("every preset validates with no error and survives the real save path unchanged", () => {
    for (const p of PRESETS) {
      const state = buildPreset(p.id);
      expect(hasErrors(validateEditableState(state, catalog)), p.id).toBe(false);
      expect(roundTripIssues(state), p.id).toEqual([]);
    }
  });

  it("Fresh Start is the authority's default save; Margherita is the onboarding recipe only", () => {
    expect(buildPreset("fresh-start")).toEqual(freshEditableState());
    expect(onboardingRecipeId(catalog)).toBe("margherita");
    expect(buildPreset("margherita-discovered").dex.map((e) => e.recipeId)).toEqual(["margherita"]);
  });

  it("the Step 12 step is the ladder's own (its materials and key recipe come from the ladder)", () => {
    expect(stepTarget.ingredientIds).toEqual(["onion"]);
    expect(stepTarget.keyRecipeId).toBe("pizza-portuguesa");
  });

  it("Step 12 Ready: the step's material is unlocked for the Shop but not owned, its key recipe is not discovered", () => {
    const state = buildPreset("research-step12-ready");
    for (const id of stepTarget.ingredientIds) {
      expect(state.ownedIngredientIds).not.toContain(id);
      expect(state.unlockedForShopIngredientIds).toContain(id);
      expect(state.inventory[id]).toBeUndefined();
    }
    expect(state.dex.map((e) => e.recipeId)).not.toContain(stepTarget.keyRecipeId);
    expect(state.dex).toHaveLength(RESEARCH_PRESET_STEP);
    expect(deriveResearchEntries({ dex: state.dex, ownedIngredientIds: state.ownedIngredientIds }).entries).toEqual([]);
  });

  it("Step 12 A/B/C undiscovered: the step's material is acquired LAST and the three Research Entries appear", () => {
    const state = buildPreset("step12-abc-undiscovered");
    expect(state.ownedIngredientIds.slice(-stepTarget.ingredientIds.length)).toEqual(stepTarget.ingredientIds);
    const projection = deriveResearchEntries({ dex: loadCanonical(state).dex, ownedIngredientIds: loadCanonical(state).ownedIngredientIds });
    // Owner OD-1: the Step 12 cohort is Aussie, Brazilian Calabresa and Pizza Portuguesa (letters are #402's).
    expect(projection.entries.map((e) => e.recipeId).sort()).toEqual(["aussie", "brazilian-calabresa", "pizza-portuguesa"]);
    for (const e of projection.entries) expect(e.unlockIngredientId).toBe(stepTarget.ingredientIds[0]);
    for (const e of projection.entries) expect(state.dex.map((d) => d.recipeId)).not.toContain(e.recipeId);
  });

  it("Step 12 B discovered (Research Stable Identity, #402): B = Brazilian Calabresa is discovered; A and C stay, with their letters", () => {
    const abc = buildPreset("step12-abc-undiscovered");
    const abcEntries = deriveResearchEntries({ dex: abc.dex, ownedIngredientIds: abc.ownedIngredientIds }).entries;
    const letterOf = (recipeId: string) => abcEntries.find((e) => e.recipeId === recipeId)?.cohortLetter;
    // Owner OD-1: A = Aussie, B = Brazilian Calabresa, C = Pizza Portuguesa -- as the AUTHORITY's letters say
    expect([letterOf("aussie"), letterOf("brazilian-calabresa"), letterOf("pizza-portuguesa")]).toEqual(["A", "B", "C"]);

    const state = buildPreset("step12-b-discovered");
    const discovered = state.dex.map((e) => e.recipeId);
    expect(discovered).toContain("brazilian-calabresa");
    expect(discovered).not.toContain("aussie");
    expect(discovered).not.toContain("pizza-portuguesa");
    const loaded = loadCanonical(state);
    const entries = deriveResearchEntries({ dex: loaded.dex, ownedIngredientIds: loaded.ownedIngredientIds }).entries;
    // the remaining entries are A and C: C does NOT move up to B
    expect(entries.map((e) => [e.cohortLetter, e.recipeId])).toEqual(expect.arrayContaining([["A", "aussie"], ["C", "pizza-portuguesa"]]));
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.cohortLetter).sort()).toEqual(["A", "C"]);
    for (const e of entries) expect(e.unlockIngredientId).toBe(stepTarget.ingredientIds[0]);
    expect(entries.some((e) => e.recipeId === "brazilian-calabresa")).toBe(false);
    // the label is the authority's: ？？？ピザ A（たまねぎ） / ？？？ピザ C（たまねぎ）
    expect(entries.map((e) => researchEntryLabel(e))).toEqual(expect.arrayContaining(["？？？ピザ A（たまねぎ）", "？？？ピザ C（たまねぎ）"]));
    expect(researchEntryLabel({ unlockIngredientId: stepTarget.ingredientIds[0], cohortLetter: "B" })).toBe("？？？ピザ B（たまねぎ）");
    // acquisition order, ownership and stock are exactly the A/B/C preset's: only the Dex differs by one recipe
    expect(state.ownedIngredientIds).toEqual(abc.ownedIngredientIds);
    expect(state.inventory).toEqual(abc.inventory);
    expect(state.dex).toHaveLength(abc.dex.length + 1);
    expect(abc.dex.map((e) => e.recipeId)).not.toContain("brazilian-calabresa");
    // the preset names no recipe: it is the entry the authority letters B (the second of the cohort)
    const b = abcEntries.find((e) => e.cohortLetter === catalog.researchLetter(1))!;
    expect(discovered).toContain(b.recipeId);
  });

  it("the B preset follows the authority, not a recipe id: a catalog whose cohort differs gets its own B", () => {
    const stubbed: EditorCatalog = {
      ...catalog,
      researchEntries: (dex, owned) => {
        const real = catalog.researchEntries(dex, owned);
        // reverse the lettering of the step cohort: the entry the real authority calls A is now B
        const swap = (l: string | null) => (l === "A" ? "B" : l === "B" ? "A" : l);
        return real.map((e) => ({ ...e, cohortLetter: swap(e.cohortLetter) }));
      },
    };
    const state = buildPreset("step12-b-discovered", stubbed);
    expect(state.dex.map((e) => e.recipeId)).toContain("aussie");
    expect(state.dex.map((e) => e.recipeId)).not.toContain("brazilian-calabresa");
  });

  it("the B preset fails loudly when the cohort has no entry with that letter", () => {
    const none: EditorCatalog = { ...catalog, researchEntries: () => [] };
    expect(() => buildPreset("step12-b-discovered", none)).toThrow(/no entry lettered B/);
  });

  it("acquisition order matters: with the step's material owned EARLIER the unlock fact is a different material", () => {
    const state = buildPreset("step12-abc-undiscovered");
    const moved = [...state.ownedIngredientIds];
    const material = stepTarget.ingredientIds[0];
    moved.splice(moved.indexOf(material), 1);
    moved.splice(catalog.starterIds.length, 0, material);
    const entries = deriveResearchEntries({ dex: state.dex, ownedIngredientIds: moved }).entries;
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.unlockIngredientId !== material)).toBe(true);
  });

  it("All Ingredients / All Recipes / Everything Unlocked are sized by the catalog, not by a literal", () => {
    const finite = finiteIngredientIds(catalog);
    expect(finite.length).toBe(INGREDIENTS.filter((i) => i.unlockCondition).length);
    const all = buildPreset("all-ingredients");
    expect(all.ownedIngredientIds).toHaveLength(STARTER_INGREDIENT_IDS.length + finite.length);
    expect(Object.keys(all.inventory).sort()).toEqual([...finite].sort());
    expect(Object.values(all.inventory).every((q) => q === PRESET_FINITE_STOCK)).toBe(true);
    expect(buildPreset("all-recipes").dex).toHaveLength(RECIPES.length);
    const everything = buildPreset("everything-unlocked");
    expect(everything.dex).toHaveLength(RECIPES.length);
    expect(everything.ownedIngredientIds).toHaveLength(STARTER_INGREDIENT_IDS.length + finite.length);
    expect([...everything.discoveredTechniqueIds].sort()).toEqual([...catalog.techniqueIds].sort());
    expect(allFiniteInLadderOrder(catalog)).toHaveLength(finite.length);
  });

  it("a discovered recipe's technique is in the ledger (the game would add it on load)", () => {
    const state = buildPreset("all-recipes");
    expect(state.discoveredTechniqueIds).toEqual(catalog.techniqueLedgerFor([], state.dex));
    expect(state.discoveredTechniqueIds.length).toBeGreaterThan(0);
  });
});

describe("validation", () => {
  it("reports unknown ids, bad stars / stock / order, and the derived technique lock", () => {
    const state = buildPreset("all-ingredients");
    const bad: EditableState = {
      ...state,
      dex: [{ recipeId: "no-such-recipe", discovered: true, bestScore: 70, bestStars: 9 as never, timesMade: 1 }],
      pitzBalance: -1,
      ownedIngredientIds: [...state.ownedIngredientIds.slice(1), "ghost"],
      inventory: { ...state.inventory, [STARTER_INGREDIENT_IDS[0]]: 3, ghost: -1 },
    };
    const codes = validateEditableState(bad, catalog).map((i) => i.code);
    for (const code of ["dex-unknown-recipe", "dex-stars", "pitz-invalid", "owned-unknown", "owned-starters-first", "inventory-starter", "inventory-unknown", "inventory-qty"]) {
      expect(codes, code).toContain(code);
    }
    const locked = { ...buildPreset("all-recipes"), discoveredTechniqueIds: [] };
    expect(validateEditableState(locked, catalog).some((i) => i.code === "technique-derived-lock" && i.severity === "warning")).toBe(true);
  });

  it("the authority round trip catches what a readable check cannot (an id the writer drops)", () => {
    const state = { ...buildPreset("fresh-start"), discoveryHintFacts: { margherita: ["NOT A FACT"] } };
    expect(roundTripIssues(state)).toContain("discoveryHintFacts");
  });
});

// ---- OD-8: a synthetic 172-recipe / 62-ingredient catalog (no literal in the builders) ----------------------

function syntheticCatalog(recipeCount: number, starterCount: number, ingredientCount: number): EditorCatalog {
  const ingredients = Array.from({ length: ingredientCount }, (_, i) => (i < starterCount ? { id: `s-${i}` } : { id: `f-${i}`, unlockCondition: { kind: "x" } }));
  const starters = ingredients.slice(0, starterCount).map((i) => i.id);
  const finite = ingredients.slice(starterCount).map((i) => i.id);
  const recipes = Array.from({ length: recipeCount }, (_, k) => {
    const needs = k === 0 ? [] : k <= finite.length ? [finite[k - 1]] : [finite[0], finite[k % finite.length]];
    return { id: `r-${k}`, requiredIngredients: [...starters.map((ingredientId) => ({ ingredientId })), ...needs.map((ingredientId) => ({ ingredientId }))] };
  });
  return {
    recipes,
    ingredients,
    starterIds: starters,
    ladder: { populationId: "synthetic", steps: finite.map((id, i) => ({ step: i + 1, kind: "MATERIAL" as const, ingredientIds: [id], keyRecipeId: `r-${i + 1}` })) },
    techniqueIds: [],
    countsTowardLadder: () => true,
    techniqueLedgerFor: () => [],
    ...syntheticResearch(recipes, ingredients),
  };
}

/**
 * A test double of the Research derivation for the synthetic catalog (the real authority reads the shipped catalog):
 * a recipe is registrable when every finite material it needs is owned; its unlock is the one acquired last; a cohort
 * shares an unlock; letters follow the sorted ids. Only the synthetic scale test uses it.
 */
function syntheticResearch(recipes: EditorCatalog["recipes"], ingredients: EditorCatalog["ingredients"]): Pick<EditorCatalog, "researchEntries" | "researchLetter"> {
  const finite = new Set(ingredients.filter((i) => i.unlockCondition !== undefined).map((i) => i.id));
  return {
    researchLetter: (i) => String.fromCharCode(65 + i),
    researchEntries: (dex, owned) => {
      const found = new Set(dex.map((e) => e.recipeId));
      const cohorts = new Map<string, string[]>();
      for (const r of recipes) {
        const needs = r.requiredIngredients.map((q) => q.ingredientId).filter((id) => finite.has(id));
        if (needs.length === 0 || needs.some((id) => !owned.includes(id))) continue;
        const unlock = needs.reduce((a, b) => (owned.indexOf(b) > owned.indexOf(a) ? b : a));
        cohorts.set(unlock, [...(cohorts.get(unlock) ?? []), r.id]);
      }
      return [...cohorts].flatMap(([unlock, ids]) =>
        [...ids].sort().map((recipeId, i) => ({ recipeId, unlockIngredientId: unlock, cohortLetter: ids.length > 1 ? String.fromCharCode(65 + i) : null })).filter((e) => !found.has(e.recipeId)),
      );
    },
  };
}

describe("last-step-ready (Expansion Slice 3 Owner HV)", () => {
  it("reaches the last ladder step with its materials unbought and only the recipes that need them undiscovered", () => {
    const last = catalog.ladder.steps[catalog.ladder.steps.length - 1];
    const state = buildPreset("last-step-ready");
    const found = new Set(state.dex.map((e) => e.recipeId));
    const undiscovered = catalog.recipes.filter((r) => !found.has(r.id)).map((r) => r.id);
    expect(undiscovered).toEqual([last.keyRecipeId]);
    for (const m of last.ingredientIds) {
      expect(state.ownedIngredientIds).not.toContain(m);
      expect(state.unlockedForShopIngredientIds).toContain(m);
    }
    expect(state.pitzBalance).toBeGreaterThanOrEqual(100);
  });
});

describe("presets scale to a synthetic 172-recipe / 62-ingredient catalog", () => {
  const big = syntheticCatalog(172, 3, 62);
  const finiteCount = finiteIngredientIds(big).length;

  it("every preset builds, validates against the catalog and is sized by it", () => {
    expect(big.recipes).toHaveLength(172);
    for (const p of PRESETS) {
      const state = buildPreset(p.id, big);
      expect(hasErrors(validateEditableState(state, big)), p.id).toBe(false);
    }
    expect(buildPreset("all-recipes", big).dex).toHaveLength(172);
    expect(buildPreset("all-ingredients", big).ownedIngredientIds).toHaveLength(big.starterIds.length + finiteCount);
    expect(buildPreset("everything-unlocked", big).unlockedForShopIngredientIds).toHaveLength(finiteCount);
  });

  it("Step 12 is derived from the synthetic ladder, with the step's material acquired last", () => {
    const ready = buildPreset("research-step12-ready", big);
    const abc = buildPreset("step12-abc-undiscovered", big);
    const material = big.ladder.steps[RESEARCH_PRESET_STEP - 1].ingredientIds[0];
    expect(ready.ownedIngredientIds).not.toContain(material);
    expect(ready.unlockedForShopIngredientIds).toContain(material);
    expect(abc.ownedIngredientIds.at(-1)).toBe(material);
    expect(abc.dex).toHaveLength(RESEARCH_PRESET_STEP);
  });

  it("builds in well under a second", () => {
    const t0 = performance.now();
    for (const p of PRESETS) buildPreset(p.id, big);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
