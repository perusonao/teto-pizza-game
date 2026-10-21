import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { RECIPES } from "../../data/recipes";
import { pizzaForFinalEvaluation } from "../../state/finishEngine";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { syntheticLateRecipe } from "../catalog/testSupport/syntheticLateCatalog";
import { evaluatePizzaCompletion } from "../completionGate";
import { sanitizeToppings } from "../scoringV2/boundary";
import { classifyNearMiss } from "./nearMiss";
import { DEFAULT_IDENTITY_DIMENSIONS, signatureOfPizza, type IdentityDimensions, type RuntimeSignature } from "./signature";
import { evaluateDiscovery, matchDiscovery, type DiscoveryTarget, type RecipeDiscoveryTarget } from "./matcher";

/**
 * FIN-E2 design validation (Issue #604 / #294), TEST-ONLY. Nothing here changes `signature.ts`, the matcher, the catalog or `RECIPES`.
 * It prototypes the PROPOSED `late` observation on top of the unchanged `signatureOfPizza` (by overriding the one axis), then runs the
 * proposed rule against a SYNTHETIC catalog: correct placement, pre-bake misplacement, short placement, look-alike recipes.
 * Design: docs/design/TETO_FIN-E2_LATE-AXIS_DESIGN.md.
 */

/** PROPOSED observation: the post-stage piece ids as one `["POST_BAKE", sortedIds]` group (empty when there are none). */
function lateAxisOf(pizza: PizzaState): IdentityDimensions["late"] {
  // NOTE: `sanitizeToppings` drops `stage`, so the real implementation must read `stage` from the raw array itself.
  const raw = Array.isArray(pizza?.toppings) ? pizza.toppings : [];
  const ids = raw
    .filter((p) => p && typeof p === "object" && p.stage === "post" && typeof p.ingredientId === "string" && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => p.ingredientId);
  return ids.length === 0 ? [] : [["POST_BAKE", [...new Set(ids)].sort()]];
}

function observed(pizza: PizzaState): RuntimeSignature {
  const sig = signatureOfPizza(pizza);
  return { ...sig, dimensions: { ...sig.dimensions, late: { status: "OBSERVED", value: lateAxisOf(pizza) } } };
}

const SUPPORTED = ["DOUGH_VARIANT", "LATE_ADDITION"];

function pizzaOf(pre: readonly string[], post: readonly string[], sauces: readonly string[] = ["tomato-sauce"]): PizzaState {
  const piece = (ingredientId: string, i: number, stage?: "post") => ({ id: `${stage ?? "pre"}${i}`, ingredientId, x: 30 + i * 4, y: 50, ...(stage ? { stage } : {}) });
  return { ...createEmptyPizza(), sauceIds: [...sauces], toppings: [...pre.map((id, i) => piece(id, i)), ...post.map((id, i) => piece(id, i, "post"))], bakeResult: 70 };
}

function target(targetId: string, late: IdentityDimensions["late"], items: readonly string[], capabilities: readonly string[]): RecipeDiscoveryTarget {
  return {
    targetId,
    recipeId: targetId as RecipeDiscoveryTarget["recipeId"],
    items: [...items].sort(),
    sauceBase: ["tomato-sauce"],
    capabilities,
    identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, late },
    eligibility: { status: "ELIGIBLE" },
  };
}

const ITEMS = ["chicken", "mozzarella", "parsley", "tomato-sauce"];
const LATE_PARSLEY = target("syn:late-parsley", [["POST_BAKE", ["parsley"]]], ITEMS, ["LATE_ADDITION"]);
const LATE_CHICKEN = target("syn:late-chicken", [["POST_BAKE", ["chicken"]]], ITEMS, ["LATE_ADDITION"]); // same items, a different late ingredient
const PLAIN_TWIN = target("syn:plain-twin", [], ITEMS, []); // same items, everything before the bake
const CATALOG = [...RECIPE_DISCOVERY_CATALOG, LATE_PARSLEY, LATE_CHICKEN, PLAIN_TWIN];
const run = (pizza: PizzaState, catalog: readonly RecipeDiscoveryTarget[] = CATALOG) => evaluateDiscovery(observed(pizza), catalog, [], { supportedCapabilities: SUPPORTED });

describe("proposed late axis on a synthetic catalog", () => {
  it("correct placement: pre-bake base, parsley after the bake -> only the late recipe matches", () => {
    expect(run(pizzaOf(["mozzarella", "mozzarella", "chicken", "chicken"], ["parsley", "parsley"]))).toEqual({ kind: "NEW_DISCOVERY", recipeId: "syn:late-parsley", targetId: "syn:late-parsley" });
  });

  it("pre-bake misplacement: the same pieces all before the bake never match the late recipe (only its plain twin, if one exists)", () => {
    const pizza = pizzaOf(["mozzarella", "chicken", "parsley"], []);
    expect(run(pizza)).toEqual({ kind: "NEW_DISCOVERY", recipeId: "syn:plain-twin", targetId: "syn:plain-twin" });
    expect(run(pizza, [LATE_PARSLEY, LATE_CHICKEN])).toEqual({ kind: "ORIGINAL", blockedTargetIds: [] });
  });

  it("wrong ingredient after the bake: chicken after, parsley before -> the OTHER late recipe, not this one", () => {
    expect(run(pizzaOf(["mozzarella", "parsley"], ["chicken"]))).toEqual({ kind: "NEW_DISCOVERY", recipeId: "syn:late-chicken", targetId: "syn:late-chicken" });
    expect(run(pizzaOf(["mozzarella", "parsley"], ["chicken"]), [LATE_PARSLEY, PLAIN_TWIN])).toMatchObject({ kind: "ORIGINAL" });
  });

  it("missing late piece: nothing after the bake -> the late ingredient is absent, nothing matches", () => {
    expect(run(pizzaOf(["mozzarella", "chicken"], []), [LATE_PARSLEY, LATE_CHICKEN, PLAIN_TWIN])).toMatchObject({ kind: "ORIGINAL" });
  });

  it("everything after the bake (even the base pieces) is not the late recipe", () => {
    expect(run(pizzaOf([], ["mozzarella", "chicken", "parsley"]), [LATE_PARSLEY, LATE_CHICKEN, PLAIN_TWIN])).toMatchObject({ kind: "ORIGINAL" });
  });

  it("short placement (1 of 2 parsley) is still the late IDENTITY and still passes the Completion Gate ('recipe' policy = one piece of each; quantity is Scoring's, #215 OD-5)", () => {
    const pizza = pizzaOf(["mozzarella", "mozzarella", "chicken", "chicken"], ["parsley"]);
    expect(run(pizza)).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: "syn:late-parsley" });
    const recipe = syntheticLateRecipe();
    expect(evaluatePizzaCompletion(recipe, pizzaForFinalEvaluation(recipe, pizza)).status).toBe("PASS");
  });

  it("parsley only BEFORE the bake can neither match the late recipe nor satisfy its late requirement (no free late ingredient)", () => {
    const pizza = pizzaOf(["mozzarella", "mozzarella", "chicken", "chicken", "parsley", "parsley"], []);
    expect(run(pizza, [LATE_PARSLEY, LATE_CHICKEN])).toMatchObject({ kind: "ORIGINAL" });
    const recipe = syntheticLateRecipe();
    expect(evaluatePizzaCompletion(recipe, pizzaForFinalEvaluation(recipe, pizza)).status).toBe("FAILED");
  });

  it("parsley both before AND after the bake: identity is the late recipe, and the post piece alone satisfies the late requirement", () => {
    const pizza = pizzaOf(["mozzarella", "mozzarella", "chicken", "chicken", "parsley", "parsley"], ["parsley"]);
    expect(run(pizza)).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: "syn:late-parsley" });
    const recipe = syntheticLateRecipe();
    expect(evaluatePizzaCompletion(recipe, pizzaForFinalEvaluation(recipe, pizza)).status).toBe("PASS");
  });

  it("the match is independent of catalog order and of piece order", () => {
    const pizza = pizzaOf(["chicken", "mozzarella"], ["parsley"]);
    expect(run(pizza, [PLAIN_TWIN, LATE_CHICKEN, LATE_PARSLEY])).toEqual(run(pizza, [LATE_PARSLEY, PLAIN_TWIN, LATE_CHICKEN]));
  });

  it("a catalog without the LATE_ADDITION capability supported never matches a late target (unsupported mechanic -> no match)", () => {
    const sig = observed(pizzaOf(["mozzarella", "chicken"], ["parsley"]));
    expect(matchDiscovery(sig, [LATE_PARSLEY], { supportedCapabilities: ["DOUGH_VARIANT"] })).toMatchObject({ kind: "NO_MATCH" });
  });
});

describe("existing recipes: identification is unchanged", () => {
  it("every production target has the default late value, so a pizza with no post piece (every pizza Production can make) is identified exactly as today", () => {
    for (const t of RECIPE_DISCOVERY_CATALOG) {
      expect(t.identityDimensions.late, t.targetId).toEqual([]);
      const sauces = t.sauceBase ?? [];
      const pizza = pizzaOf(t.items.filter((i) => !sauces.includes(i)), [], sauces);
      expect(evaluateDiscovery(observed(pizza), RECIPE_DISCOVERY_CATALOG, []), t.targetId).toEqual(evaluateDiscovery(signatureOfPizza(pizza), RECIPE_DISCOVERY_CATALOG, []));
    }
  });

  it("OWNER DECISION D-1: a production pizza that carries a post piece (reachable only after E3) is ORIGINAL under the strict rule", () => {
    const margherita = RECIPES.find((r) => r.id === "margherita")!;
    const ids = margherita.requiredIngredients.map((q) => q.ingredientId);
    const pizza = pizzaOf(ids.slice(1).filter((i) => i !== "tomato-sauce"), [ids.find((i) => i !== "tomato-sauce")!]);
    expect(evaluateDiscovery(signatureOfPizza(pizza), RECIPE_DISCOVERY_CATALOG, []).kind).toBe("NEW_DISCOVERY"); // today: stage is ignored
    expect(evaluateDiscovery(observed(pizza), RECIPE_DISCOVERY_CATALOG, [], { supportedCapabilities: SUPPORTED }).kind).toBe("ORIGINAL"); // strict
  });

  it("the late value is read from the RAW toppings: sanitizeToppings drops `stage` (the trap the real implementation must avoid)", () => {
    const pizza = pizzaOf(["mozzarella"], ["parsley"]);
    expect(sanitizeToppings(pizza.toppings).some((t) => "stage" in t)).toBe(false);
    expect(lateAxisOf(pizza)).toEqual([["POST_BAKE", ["parsley"]]]);
    expect(lateAxisOf({ ...pizza, toppings: "x" } as unknown as PizzaState)).toEqual([]);
  });
});

describe("near-miss gap (why E2 must add a late distance)", () => {
  it("today classifyNearMiss compares items + sauceBase only, so a pre-bake misplacement of a late recipe has distance 0 and says NOTHING (null = 'discovery wins')", () => {
    const misplaced = observed(pizzaOf(["mozzarella", "chicken", "parsley"], []));
    expect(classifyNearMiss(misplaced, [RECIPES[0]], { catalog: [{ ...LATE_PARSLEY, recipeId: RECIPES[0].id }], recipes: RECIPES })).toBeNull();
  });
});

describe("technique detection surface (what registration would read)", () => {
  it("a target that declares a non-empty late value is the only one that requires the technique", () => {
    const requires = (t: DiscoveryTarget) => t.identityDimensions.late.length > 0;
    expect([LATE_PARSLEY, LATE_CHICKEN, PLAIN_TWIN].filter(requires).map((t) => t.targetId)).toEqual(["syn:late-parsley", "syn:late-chicken"]);
    expect(RECIPE_DISCOVERY_CATALOG.some(requires)).toBe(false);
  });
});
