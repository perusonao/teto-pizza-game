import { describe, expect, it } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { deriveResearchEntries } from "../logic/discovery/researchEntry";
import { finiteIngredientIds, onboardingRecipeId, productionCatalog, type EditorCatalog } from "./editorCatalog";
import {
  allFiniteInLadderOrder,
  buildPreset,
  buildPresetById,
  PENDING_PRESETS,
  PRESET_FINITE_STOCK,
  PRESETS,
  RESEARCH_PRESET_STEP,
} from "./presets";
import { freshEditableState, hasErrors, loadCanonical, roundTripIssues, validateEditableState, type EditableState } from "./stateModel";

const catalog = productionCatalog();
const stepTarget = catalog.ladder.steps[RESEARCH_PRESET_STEP - 1];

describe("presets are derived from the real catalog", () => {
  it("the preset list is the seven designed presets; the #402-dependent one has no builder", () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      "fresh-start",
      "margherita-discovered",
      "research-step12-ready",
      "step12-abc-undiscovered",
      "all-ingredients",
      "all-recipes",
      "everything-unlocked",
    ]);
    expect(PENDING_PRESETS.map((p) => p.id)).toEqual(["step12-b-discovered"]);
    for (const pending of PENDING_PRESETS) {
      expect(PRESETS.some((p) => (p.id as string) === pending.id)).toBe(false);
      expect(() => buildPresetById(pending.id)).toThrow(/blocked by #402/);
    }
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
  };
}

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
