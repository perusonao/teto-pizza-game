import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { isTechniqueId, KNOWN_TECHNIQUE_IDS, TECHNIQUES } from "../../data/techniques";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { signatureOfPizza } from "../discovery/signature";
import { detectTechniquesUsed, requiredTechniquesOf } from "./detection";
import { axisGuidanceAllowed, NEAR_MISS_PRIVACY_FALLBACK_JA, sauceAxisAnswerCount } from "./nearMissPrivacy";
import {
  backfillTechniqueLedger,
  isTechniqueAffordanceOpen,
  knownTechniqueIds,
  registerTechniqueDiscovery,
  techniqueAffordanceStep,
} from "./registration";

/** Cooking Techniques 1.0 TQ-1A (Issue #262): the pure technique model. */

function pizza(sauceIds: string[], pieces: string[]): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds,
    toppings: pieces.map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 40 + i, y: 50 })),
  };
}

const AUSSIE_SHAPE = { items: ["bacon", "egg", "mozzarella", "onion"], sauceBase: [] as string[] };
const NO_SAUCE_PIZZA = signatureOfPizza(pizza([], ["bacon", "egg", "mozzarella", "onion"]));
const SAUCED_PIZZA = signatureOfPizza(pizza(["tomato-sauce"], ["mozzarella"]));
const SAUCE_IDS = INGREDIENTS.filter((i) => i.category === "sauce").map((i) => i.id);

function materialStep(id: string): number | null {
  if ((STARTER_INGREDIENT_IDS as readonly string[]).includes(id)) return 0;
  return W1_25_DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(id))?.step ?? null;
}

describe("registry", () => {
  it("TQ-1 ships exactly NO_SAUCE; ids are well-formed and unique", () => {
    expect(TECHNIQUES.map((t) => t.id)).toEqual(["no-sauce"]);
    expect(KNOWN_TECHNIQUE_IDS).toEqual(["no-sauce"]);
    for (const t of TECHNIQUES) expect(t.id).toMatch(/^[a-z0-9][a-z0-9_-]{0,63}$/);
    expect(isTechniqueId("no-sauce")).toBe(true);
    for (const bad of ["NO_SAUCE", "post-bake", "", null, 1, "__proto__"]) expect(isTechniqueId(bad)).toBe(false);
  });

  it("the riddle never names the technique or the concrete action (OD-TQ-5 / 6)", () => {
    for (const t of TECHNIQUES) {
      expect(t.riddleJa).not.toContain(t.nameJa);
      expect(t.riddleJa).not.toMatch(/ソース|なし|省/);
    }
  });
});

describe("detection", () => {
  it("NO_SAUCE is used by a pizza with pieces and no sauce, not by a sauced or an empty pizza", () => {
    expect(detectTechniquesUsed(NO_SAUCE_PIZZA)).toEqual(["no-sauce"]);
    expect(detectTechniquesUsed(SAUCED_PIZZA)).toEqual([]);
    expect(detectTechniquesUsed(signatureOfPizza(createEmptyPizza()))).toEqual([]);
    expect(detectTechniquesUsed(signatureOfPizza(pizza(["olive-oil"], []))) ).toEqual([]);
  });

  it("a target requires NO_SAUCE only when it declares an empty base", () => {
    expect(requiredTechniquesOf({ sauceBase: [] })).toEqual(["no-sauce"]);
    expect(requiredTechniquesOf({ sauceBase: ["tomato-sauce"] })).toEqual([]);
    expect(requiredTechniquesOf({})).toEqual([]);
  });

  it("exactly one production recipe requires a technique: aussie, NO_SAUCE (TQ-1D)", () => {
    for (const t of RECIPE_DISCOVERY_CATALOG) {
      expect(requiredTechniquesOf(t), t.recipeId).toEqual(t.recipeId === "aussie" ? ["no-sauce"] : []);
    }
  });
});

describe("registration (exactly once, recipe first, affordance gate for originals)", () => {
  const open = () => true;
  const closed = () => false;

  it("a recipe match records its technique even while the affordance is closed (INV-TQ-1)", () => {
    const r = registerTechniqueDiscovery({ ledger: [], signature: NO_SAUCE_PIZZA, completionPassed: true, matchedTarget: AUSSIE_SHAPE, isAffordanceOpen: closed });
    expect(r).toEqual({ ledger: ["no-sauce"], newlyDiscovered: ["no-sauce"] });
  });

  it("an original pizza records a used technique only once its affordance is open (INV-TQ-6)", () => {
    const base = { ledger: [], signature: NO_SAUCE_PIZZA, completionPassed: true, matchedTarget: null };
    expect(registerTechniqueDiscovery({ ...base, isAffordanceOpen: closed }).newlyDiscovered).toEqual([]);
    expect(registerTechniqueDiscovery({ ...base, isAffordanceOpen: open }).newlyDiscovered).toEqual(["no-sauce"]);
  });

  it("a failed pizza records nothing", () => {
    const r = registerTechniqueDiscovery({ ledger: [], signature: NO_SAUCE_PIZZA, completionPassed: false, matchedTarget: AUSSIE_SHAPE, isAffordanceOpen: open });
    expect(r).toEqual({ ledger: [], newlyDiscovered: [] });
  });

  it("a sauced pizza matching a sauce recipe records nothing", () => {
    const r = registerTechniqueDiscovery({ ledger: [], signature: SAUCED_PIZZA, completionPassed: true, matchedTarget: { sauceBase: ["tomato-sauce"] }, isAffordanceOpen: open });
    expect(r.newlyDiscovered).toEqual([]);
  });

  it("is idempotent: the second registration of the same technique reports nothing (exactly once)", () => {
    const input = { ledger: [] as string[], signature: NO_SAUCE_PIZZA, completionPassed: true, matchedTarget: AUSSIE_SHAPE, isAffordanceOpen: open };
    const first = registerTechniqueDiscovery(input);
    const second = registerTechniqueDiscovery({ ...input, ledger: first.ledger });
    expect(second).toEqual({ ledger: ["no-sauce"], newlyDiscovered: [] });
  });

  it("keeps unknown ids a newer build wrote, in place, and never mutates its input", () => {
    const ledger = ["post-bake"];
    const r = registerTechniqueDiscovery({ ledger, signature: NO_SAUCE_PIZZA, completionPassed: true, matchedTarget: AUSSIE_SHAPE, isAffordanceOpen: open });
    expect(r.ledger).toEqual(["post-bake", "no-sauce"]);
    expect(ledger).toEqual(["post-bake"]);
    expect(knownTechniqueIds(r.ledger)).toEqual(["no-sauce"]);
  });
});

describe("backfill (INV-TQ-1 at load)", () => {
  it("adds the techniques of discovered recipes, keeps unknown ids, and is idempotent", () => {
    const once = backfillTechniqueLedger(["future-x"], [AUSSIE_SHAPE, { sauceBase: ["tomato-sauce"] }]);
    expect(once).toEqual({ ledger: ["future-x", "no-sauce"], added: ["no-sauce"] });
    expect(backfillTechniqueLedger(once.ledger, [AUSSIE_SHAPE])).toEqual({ ledger: once.ledger, added: [] });
  });

  it("is a no-op for every production Dex without aussie, and adds no-sauce once aussie is discovered", () => {
    const withoutAussie = RECIPE_DISCOVERY_CATALOG.filter((t) => t.recipeId !== "aussie");
    expect(backfillTechniqueLedger([], withoutAussie)).toEqual({ ledger: [], added: [] });
    expect(backfillTechniqueLedger([], RECIPE_DISCOVERY_CATALOG)).toEqual({ ledger: ["no-sauce"], added: ["no-sauce"] });
  });
});

describe("affordance (derived from the ladder; INV-TQ-4)", () => {
  it("never opens while no target requires the technique -- the production catalog without aussie", () => {
    const step = techniqueAffordanceStep("no-sauce", RECIPE_DISCOVERY_CATALOG.filter((t) => t.recipeId !== "aussie"), materialStep);
    expect(step).toBeNull();
    for (const count of [0, 12, 25, 1000]) expect(isTechniqueAffordanceOpen(step, count)).toBe(false);
  });

  it("opens at W1 step 12 (onion) on the production catalog, because aussie requires it (TQ-1D)", () => {
    const step = techniqueAffordanceStep("no-sauce", RECIPE_DISCOVERY_CATALOG, materialStep);
    expect(step).toBe(12);
    expect(isTechniqueAffordanceOpen(step, 11)).toBe(false);
    expect(isTechniqueAffordanceOpen(step, 12)).toBe(true);
  });

  it("opens at the first step where a requiring recipe becomes makeable (the Aussie shape -> W1 step 12, onion)", () => {
    const step = techniqueAffordanceStep("no-sauce", [...RECIPE_DISCOVERY_CATALOG.filter((t) => t.recipeId !== "aussie"), AUSSIE_SHAPE], materialStep);
    expect(step).toBe(12);
    expect(isTechniqueAffordanceOpen(step, 11)).toBe(false);
    expect(isTechniqueAffordanceOpen(step, 12)).toBe(true);
    expect(isTechniqueAffordanceOpen(step, Number.NaN)).toBe(false);
  });

  it("ignores a requiring target with a material no step sells", () => {
    expect(techniqueAffordanceStep("no-sauce", [{ items: ["mozzarella", "unsold"], sauceBase: [] }], materialStep)).toBeNull();
  });
});

describe("near-miss privacy (OD-TQ-P1)", () => {
  it("Aussie at W1 step 12: only tomato owned -> 1 candidate (no sauce) -> fallback", () => {
    const owned = [...STARTER_INGREDIENT_IDS, "egg", "bacon", "onion"];
    const k = sauceAxisAnswerCount({ ownedIngredientIds: owned, usedSauceIds: ["tomato-sauce"], sauceIngredientIds: SAUCE_IDS });
    expect(k).toBe(1);
    expect(axisGuidanceAllowed(k)).toBe(false);
  });

  it("once a second sauce is owned, the sauce axis keeps >= 2 answers and may be named", () => {
    const owned = [...STARTER_INGREDIENT_IDS, "olive-oil"];
    const k = sauceAxisAnswerCount({ ownedIngredientIds: owned, usedSauceIds: ["tomato-sauce"], sauceIngredientIds: SAUCE_IDS });
    expect(k).toBe(2);
    expect(axisGuidanceAllowed(k)).toBe(true);
  });

  it("a pizza without sauce: 'no sauce' is not an alternative, only the owned sauces are", () => {
    expect(sauceAxisAnswerCount({ ownedIngredientIds: [...STARTER_INGREDIENT_IDS], usedSauceIds: [], sauceIngredientIds: SAUCE_IDS })).toBe(1);
  });

  it("ignores duplicates and non-sauce ids, and the fallback line names no axis and no technique", () => {
    expect(sauceAxisAnswerCount({ ownedIngredientIds: ["tomato-sauce", "tomato-sauce", "basil"], usedSauceIds: ["tomato-sauce", "basil"], sauceIngredientIds: SAUCE_IDS })).toBe(1);
    expect(NEAR_MISS_PRIVACY_FALLBACK_JA).toBe("おしい！あと少し、なにかが違うみたい…？");
    expect(NEAR_MISS_PRIVACY_FALLBACK_JA).not.toMatch(/ソース|焼|チーズ|のせ/);
    for (const t of TECHNIQUES) expect(NEAR_MISS_PRIVACY_FALLBACK_JA).not.toContain(t.nameJa);
    expect(axisGuidanceAllowed(Number.NaN)).toBe(false);
  });
});
