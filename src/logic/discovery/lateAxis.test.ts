import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { RECIPES } from "../../data/recipes";
import { pizzaForFinalEvaluation } from "../../state/finishEngine";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { syntheticLateRecipe } from "../catalog/testSupport/syntheticLateCatalog";
import { evaluatePizzaCompletion } from "../completionGate";
import { sanitizeToppings } from "../scoringV2/boundary";
import { detectTechniquesUsed, requiredTechniquesOf } from "../techniques/detection";
import { attemptFingerprintOfSignature } from "./attemptFingerprint";
import { createTrialNotebook, lookupAttempt, notebookSize, notebookView, recordAttempt } from "./trialNotebook";
import { classifyNearMiss } from "./nearMiss";
import { nearMissLine, NEAR_MISS_FAR_GENERIC_COPY } from "../../state/resultNearMiss";
import { axisGuidanceAllowed, lateAxisAnswerCount } from "../techniques/nearMissPrivacy";
import { DEFAULT_IDENTITY_DIMENSIONS, signatureOfPizza, type IdentityDimensions } from "./signature";
import { evaluateDiscovery, matchDiscovery, type RecipeDiscoveryTarget } from "./matcher";
import { isLateRecipeId } from "../catalog/testSupport/lateIds";
import { lateCatalogEnabled } from "../../data/lateCatalog";
import { pinsaEnabled } from "../../data/pinsaGate";

/**
 * FIN-E2 (Issue #604 / #294): the `late` identity axis, run against a SYNTHETIC catalog (no recipe, ingredient or ladder is added to
 * Production): correct placement, pre-bake misplacement, short placement, look-alike recipes; legacy (stage-less) pizzas; the
 * Attempt Fingerprint / Trial Notebook never carrying the axis; the technique and near-miss surfaces; and the regression of every
 * existing recipe. Design: docs/design/TETO_FIN-E2_LATE-AXIS_DESIGN.md.
 */

const observed = signatureOfPizza;

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
  it("every ordinary production target has the default late value, so a pizza with no post piece is identified exactly as today (E5: only the late target declares one)", () => {
    for (const t of RECIPE_DISCOVERY_CATALOG.filter((x) => !isLateRecipeId(x.recipeId))) {
      expect(t.identityDimensions.late, t.targetId).toEqual([]);
      const sauces = t.sauceBase ?? [];
      const pizza = { ...pizzaOf(t.items.filter((i) => !sauces.includes(i)), [], sauces), ...(t.identityDimensions.pan === "tray" ? { pan: "tray" as const } : {}) }; // Square Dough E-2: a tray target is only itself on the tray
      const sig = signatureOfPizza(pizza);
      const asBefore = { ...sig, dimensions: { ...sig.dimensions, late: { status: "FIXED_BY_FLOW" as const, value: [] } } }; // the pre-E2 axis
      expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, []), t.targetId).toEqual(evaluateDiscovery(asBefore, RECIPE_DISCOVERY_CATALOG, []));
      expect(evaluateDiscovery(sig, RECIPE_DISCOVERY_CATALOG, []).kind, t.targetId).toBe("NEW_DISCOVERY");
    }
  });

  it("OWNER D-1 (strict): a production pizza that carries a post piece (reachable only after E3) is ORIGINAL, not its late-less recipe", () => {
    const margherita = RECIPES.find((r) => r.id === "margherita")!;
    const ids = margherita.requiredIngredients.map((q) => q.ingredientId);
    const pizza = pizzaOf(ids.slice(1).filter((i) => i !== "tomato-sauce"), [ids.find((i) => i !== "tomato-sauce")!]);
    expect(evaluateDiscovery(signatureOfPizza({ ...pizza, toppings: pizza.toppings.map(({ stage: _s, ...t }) => t) }), RECIPE_DISCOVERY_CATALOG, []).kind).toBe("NEW_DISCOVERY"); // the same pieces before the bake
    expect(evaluateDiscovery(observed(pizza), RECIPE_DISCOVERY_CATALOG, []).kind).toBe("ORIGINAL");
  });

  it("the late value is read from the RAW toppings: sanitizeToppings drops `stage` (the trap this implementation avoids)", () => {
    const pizza = pizzaOf(["mozzarella"], ["parsley"]);
    expect(sanitizeToppings(pizza.toppings).some((t) => "stage" in t)).toBe(false);
    expect(signatureOfPizza(pizza).dimensions.late).toEqual({ status: "OBSERVED", value: [["POST_BAKE", ["parsley"]]] });
  });
});

describe("near-miss: an internal late distance, no production line", () => {
  const pick = (t: RecipeDiscoveryTarget) => ({ ...t, recipeId: RECIPES[0].id });
  it("a pre-bake misplacement of a late recipe is now distance 1, LATE_ONLY (it used to be distance 0 = silence)", () => {
    const misplaced = observed(pizzaOf(["mozzarella", "chicken", "parsley"], []));
    expect(classifyNearMiss(misplaced, [RECIPES[0]], { catalog: [pick(LATE_PARSLEY)], recipes: RECIPES })).toEqual({ kind: "LATE_ONLY", distance: 1 });
  });

  it("the correct placement is an exact match (null), and a missing / wrong ingredient is still ADD_ONE / CLOSE, never LATE_ONLY", () => {
    const options = { catalog: [pick(LATE_PARSLEY)], recipes: RECIPES };
    expect(classifyNearMiss(observed(pizzaOf(["mozzarella", "chicken"], ["parsley"])), [RECIPES[0]], options)).toBeNull();
    expect(classifyNearMiss(observed(pizzaOf(["mozzarella"], ["parsley"])), [RECIPES[0]], options)?.kind).toBe("ADD_ONE");
    expect(classifyNearMiss(observed(pizzaOf(["mozzarella", "chicken"], [])), [RECIPES[0]], options)?.kind).toBe("CLOSE");
  });

  it("no pizza without a post piece changes: every ordinary production recipe's near-miss is identical with and without the late fields", () => {
    // E5: the late target is the one whose internal distance includes its late part (a design effect, never shown: see the neutral-line test below).
    for (const t of RECIPE_DISCOVERY_CATALOG.filter((x) => !isLateRecipeId(x.recipeId))) {
      const sauces = t.sauceBase ?? [];
      const sig = signatureOfPizza(pizzaOf(t.items.filter((i) => !sauces.includes(i)).slice(1), [], sauces));
      const stripped = RECIPE_DISCOVERY_CATALOG.map(({ identityDimensions: d, ...rest }) => ({ ...rest, identityDimensions: { pan: d.pan } })); // (the late fields go; the pan axis stays: it decides which targets a near-miss may point at)
      expect(classifyNearMiss(sig, RECIPES), t.targetId).toEqual(classifyNearMiss(sig, RECIPES, { catalog: stripped }));
    }
  });

  it("the RESULT stays neutral: the legacy line for LATE_ONLY is the recipe-agnostic generic line (no timing words), and resultNearMiss is untouched", () => {
    const line = nearMissLine({ kind: "LATE_ONLY", distance: 1 }, false);
    expect(line).toEqual({ kind: "FAR", textJa: NEAR_MISS_FAR_GENERIC_COPY });
    expect(line!.textJa).not.toMatch(/焼|後|のせ|乗せ|仕上げ/);
    expect(nearMissLine({ kind: "LATE_ONLY", distance: 1 }, true)).toEqual({ kind: "FAR", textJa: NEAR_MISS_FAR_GENERIC_COPY }); // no silence for a known recipe either
  });

  it("k rule: the late line needs at least two candidate ingredients", () => {
    expect(axisGuidanceAllowed(lateAxisAnswerCount({ pieceIngredientIds: ["parsley", "parsley"] }))).toBe(false);
    expect(axisGuidanceAllowed(lateAxisAnswerCount({ pieceIngredientIds: ["parsley", "chicken", "chicken"] }))).toBe(true);
  });
});

describe("legacy pizzas (no `stage`) and malformed stage values keep their identity", () => {
  const base = () => pizzaOf(["mozzarella", "chicken"], []);
  it("absent stage and stage:'pre' are the before-bake default, so a save-era / pre-FINISH pizza has the default late value", () => {
    const stages: unknown[] = [undefined, "pre", "POST", "post ", 1, null, {}, true];
    for (const stage of stages) {
      const pizza = { ...base(), toppings: base().toppings.map((t) => ({ ...t, stage })) } as unknown as PizzaState;
      expect(signatureOfPizza(pizza).dimensions.late, String(stage)).toEqual({ status: "OBSERVED", value: [] });
    }
  });

  it("malformed post elements never count: non-object, no id, non-finite coordinate; a non-array toppings reads as none", () => {
    const post = { id: "x", ingredientId: "parsley", x: 40, y: 50, stage: "post" as const };
    const pizza = { ...base(), toppings: [...base().toppings, null, "s", { ...post, ingredientId: 7 }, { ...post, x: Number.NaN }, { ...post, y: Infinity }] } as unknown as PizzaState;
    expect(signatureOfPizza(pizza).dimensions.late.value).toEqual([]);
    expect(signatureOfPizza({ ...base(), toppings: "x" } as unknown as PizzaState).dimensions.late.value).toEqual([]);
    expect(signatureOfPizza({ ...base(), toppings: [...base().toppings, post] }).dimensions.late.value).toEqual([["POST_BAKE", ["parsley"]]]);
  });
});

describe("quantity is not identity (responsibility split)", () => {
  it("1, 2 or 5 post pieces give one identity (same match, same ingredientSet); the counts live in ingredientCounts and the Completion Gate / Scoring", () => {
    const sigs = [1, 2, 5].map((n) => observed(pizzaOf(["mozzarella", "mozzarella", "chicken", "chicken"], Array(n).fill("parsley"))));
    expect(new Set(sigs.map((s) => JSON.stringify([s.ingredientSet, s.sauceBase, s.dimensions.late]))).size).toBe(1);
    expect(sigs.map((s) => s.ingredientCounts.parsley)).toEqual([1, 2, 5]);
    for (const sig of sigs) expect(evaluateDiscovery(sig, CATALOG, [], { supportedCapabilities: SUPPORTED })).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: "syn:late-parsley" });
  });
});

describe("Fingerprint / Trial Notebook: before and after the bake are one attempt and nothing about timing is stored", () => {
  const sigOf = (pre: string[], post: string[]) => observed(pizzaOf(pre, post));
  it("the same pieces placed before / after the bake share one fingerprint with no late field", () => {
    const before = attemptFingerprintOfSignature(sigOf(["mozzarella", "chicken", "parsley"], []));
    const after = attemptFingerprintOfSignature(sigOf(["mozzarella", "chicken"], ["parsley"]));
    expect(after).toBe(before);
    expect(before).not.toMatch(/late|post|POST/);
  });

  it("the Notebook records ONE entry with retryCount 1, a duplicate lookup, and its serialisation / view contain no timing", () => {
    const fpBefore = attemptFingerprintOfSignature(sigOf(["mozzarella", "chicken", "parsley"], []));
    const fpAfter = attemptFingerprintOfSignature(sigOf(["mozzarella", "chicken"], ["parsley"]));
    let nb = createTrialNotebook();
    nb = recordAttempt(nb, { fingerprint: fpBefore, feedback: null }).state;
    expect(lookupAttempt(nb, fpAfter)).toMatchObject({ kind: "TRIED", number: 1, retryCount: 0 });
    nb = recordAttempt(nb, { fingerprint: fpAfter, feedback: null }).state;
    expect(notebookSize(nb)).toEqual({ display: 1, identities: 1, nextNumber: 2 });
    const view = notebookView(nb);
    expect(view).toHaveLength(1);
    expect(view[0].retryCount).toBe(1);
    expect(JSON.stringify([nb, view])).not.toMatch(/late|post|POST/i);
  });
});

describe("technique surface (late-addition)", () => {
  it("a target that declares a non-empty late value is the only one that requires the technique", () => {
    expect([LATE_PARSLEY, LATE_CHICKEN, PLAIN_TWIN].filter((t) => requiredTechniquesOf(t).includes("late-addition")).map((t) => t.targetId)).toEqual(["syn:late-parsley", "syn:late-chicken"]);
    // E5: the one production target that requires it is the late recipe, and only while the late catalog is on.
    expect(RECIPE_DISCOVERY_CATALOG.filter((t) => requiredTechniquesOf(t).includes("late-addition")).map((t) => t.recipeId)).toEqual(lateCatalogEnabled() ? ["ikura-salmon-pizza", "yuzu-shrimp-pizza", "eggplant-dengaku-pizza", "eggplant-tahini-pizza", ...(pinsaEnabled() ? ["pinsa-romana"] : [])] : []); // Pinsa Romana (#577 P3-b): the dough recipe also records 後乗せ (its arugula)
  });

  it("a pizza uses the technique iff it has a post piece; every existing recipe's own pizza uses none", () => {
    expect(detectTechniquesUsed(observed(pizzaOf(["mozzarella"], ["parsley"])))).toContain("late-addition");
    expect(detectTechniquesUsed(observed(pizzaOf(["mozzarella", "parsley"], [])))).not.toContain("late-addition");
    expect(detectTechniquesUsed(observed(createEmptyPizza()))).toEqual([]);
    // E5: the late recipe's own pizza is the one that uses it (its post pieces); asserted in lateCatalog.ikura.test.ts.
    for (const t of RECIPE_DISCOVERY_CATALOG.filter((x) => !isLateRecipeId(x.recipeId))) {
      const sauces = t.sauceBase ?? [];
      const sig = signatureOfPizza(pizzaOf(t.items.filter((i) => !sauces.includes(i)), [], sauces));
      expect(detectTechniquesUsed(sig), t.targetId).not.toContain("late-addition");
    }
  });
});
