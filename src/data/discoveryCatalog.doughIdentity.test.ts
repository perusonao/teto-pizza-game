import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG, discoveryIdentityOf } from "./discoveryCatalog";
import { LATE_RECIPES } from "./lateCatalog";
import { RECIPES, countsTowardLadder } from "./recipes";
import { TECHNIQUES } from "./techniques";
import { evaluateDiscovery, type DiscoveryOutcome, type RecipeDiscoveryTarget } from "../logic/discovery/matcher";
import { DEFAULT_IDENTITY_DIMENSIONS, signatureOfPizza } from "../logic/discovery/signature";
import { registerTechniqueDiscovery } from "../logic/techniques/registration";
import { techniqueAffordanceStep, isTechniqueAffordanceOpen } from "../logic/techniques/registration";
import { techniqueDexViews } from "../logic/techniques/dexView";
import { productionTechniqueContext, type TechniqueCatalogEntry, type TechniqueRuntimeContext } from "../logic/techniques/runtime";
import { ingredientUnlockStep } from "../state/materialEntitlement";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { discoveredDex } from "../state/testSupport/guidedRound";
import { isLateRecipeId, ordinaryRecipes } from "../logic/catalog/testSupport/lateIds";

/**
 * P3-a2 (#577): `discoveryIdentityOf` reads a recipe's `doughKind`, so a target can declare the `dough` axis (and DOUGH_VARIANT) the same way a late
 * requirement declares `late` (and LATE_ADDITION). Pinsa is NOT in the catalog (P3-b, HOLD): every Pinsa here is a SYNTHETIC recipe built from jamon's
 * ingredients, run through the same function the data will use. Owner decisions pinned: L1 (prosciutto before the bake, only arugula after), D2 (a
 * standard dough with arugula after the bake is ORIGINAL; an already-discovered jamon is untouched), D3 (the late-addition riddle may open at
 * step 33, and nothing else about it leaks).
 */

const PINSA = "material-multigrain-long-ferment";
const JAMON_ID = "jamon-serrano-pizza";
const JAMON = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === JAMON_ID)!;

const L1_PINSA_RECIPE = {
  doughKind: PINSA,
  requiredIngredients: [
    { ingredientId: "tomato-sauce", minCount: 1 },
    { ingredientId: "mozzarella", minCount: 2 },
    { ingredientId: "prosciutto-crudo", minCount: 3 },
    { ingredientId: "arugula", minCount: 2, applicationPhase: "POST_BAKE" as const },
  ],
};

/** A catalog target for a synthetic recipe, built exactly like `RECIPE_DISCOVERY_CATALOG` builds its own (items sorted, sauce base from the sauce category). */
function targetOf(id: string, recipe: Parameters<typeof discoveryIdentityOf>[0]): RecipeDiscoveryTarget {
  const { identityDimensions, capabilities } = discoveryIdentityOf(recipe);
  return {
    targetId: `syn:${id}`,
    recipeId: `syn:${id}` as RecipeDiscoveryTarget["recipeId"],
    items: [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))].sort(),
    sauceBase: ["tomato-sauce"],
    capabilities,
    identityDimensions,
    eligibility: { status: "ELIGIBLE" },
  };
}
const PINSA_TARGET = targetOf("pinsa-romana", L1_PINSA_RECIPE);

describe("discoveryIdentityOf", () => {
  it("every shipped recipe keeps the SAME default dimensions object and no capability (the production catalog is unchanged)", () => {
    // E5: the late recipe (ikura) is the one that declares a late value and the late-addition capability (pinned in lateCatalog.ikura.test.ts).
    // Square Dough E-2: grandma-pizza (panShape "square") is the one ordinary recipe that declares `pan: "tray"` (and nothing else); pinned in its own test below.
    for (const recipe of ordinaryRecipes(RECIPES).filter((r) => (r as { panShape?: string }).panShape !== "square")) {
      const out = discoveryIdentityOf(recipe);
      expect(out.identityDimensions).toBe(DEFAULT_IDENTITY_DIMENSIONS);
      expect(out.capabilities).toEqual([]);
    }
    for (const target of RECIPE_DISCOVERY_CATALOG.filter((t) => !isLateRecipeId(t.recipeId) && t.recipeId !== "grandma-pizza")) {
      expect(target.identityDimensions).toBe(DEFAULT_IDENTITY_DIMENSIONS);
      expect(target.capabilities).toEqual([]);
    }
  });

  it("a square-pan recipe declares exactly pan: tray on top of the defaults, and no capability (Square Dough E-2)", () => {
    const out = discoveryIdentityOf({ requiredIngredients: [{ ingredientId: "tomato-sauce", minCount: 1 }], panShape: "square" });
    expect(out.identityDimensions).toEqual({ ...DEFAULT_IDENTITY_DIMENSIONS, pan: "tray" });
    expect(out.capabilities).toEqual([]);
    expect(RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === "grandma-pizza")?.identityDimensions).toEqual({ ...DEFAULT_IDENTITY_DIMENSIONS, pan: "tray" });
    // any other panShape (round / absent / unknown) keeps the default object
    expect(discoveryIdentityOf({ requiredIngredients: [], panShape: "round" }).identityDimensions).toBe(DEFAULT_IDENTITY_DIMENSIONS);
  });

  it("an unknown or standard doughKind is the default, as is a recipe with no doughKind", () => {
    const base = { requiredIngredients: [{ ingredientId: "mozzarella", minCount: 1 }] };
    for (const doughKind of [undefined, "standard", "pinsa", 3, null, {}]) {
      const out = discoveryIdentityOf({ ...base, doughKind });
      expect(out.identityDimensions).toBe(DEFAULT_IDENTITY_DIMENSIONS);
      expect(out.capabilities).toEqual([]);
    }
  });

  it("a late-only recipe declares exactly what it did before (the late axis and LATE_ADDITION, nothing about dough)", () => {
    const ikura = LATE_RECIPES.find((r) => r.id === "ikura-salmon-pizza")!;
    expect(discoveryIdentityOf(ikura)).toEqual({
      identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, late: [["POST_BAKE", ["salmon-roe", "shiso"]]] },
      capabilities: ["LATE_ADDITION"],
    });
  });

  it("a dough-only recipe declares the dough axis and DOUGH_VARIANT, and no late value", () => {
    const out = discoveryIdentityOf({ doughKind: PINSA, requiredIngredients: [{ ingredientId: "mozzarella", minCount: 1 }] });
    expect(out).toEqual({ identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, dough: PINSA }, capabilities: ["DOUGH_VARIANT"] });
    expect(out.identityDimensions.late).toEqual([]);
  });

  it("L1: dough AND only arugula after the bake (prosciutto stays before it), both capabilities, other axes default", () => {
    const out = discoveryIdentityOf(L1_PINSA_RECIPE);
    expect(out).toEqual({
      identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, dough: PINSA, late: [["POST_BAKE", ["arugula"]]] },
      capabilities: ["DOUGH_VARIANT", "LATE_ADDITION"],
    });
  });

  it("late ids are sorted and de-duplicated", () => {
    const out = discoveryIdentityOf({
      requiredIngredients: [
        { ingredientId: "arugula", minCount: 1, applicationPhase: "POST_BAKE" },
        { ingredientId: "arugula", minCount: 1, applicationPhase: "POST_BAKE" },
        { ingredientId: "basil", minCount: 1, applicationPhase: "POST_BAKE" },
      ],
    });
    expect(out.identityDimensions.late).toEqual([["POST_BAKE", ["arugula", "basil"]]]);
  });
});

type DoughChoice = "standard" | "pinsa";
type LateChoice = "none" | "arugula-only" | "prosciutto-only" | "both";
type PanChoice = "none" | "tray";
const LATE_IDS: Record<LateChoice, readonly string[]> = { none: [], "arugula-only": ["arugula"], "prosciutto-only": ["prosciutto-crudo"], both: ["prosciutto-crudo", "arugula"] };

function pizzaOf(dough: DoughChoice, late: LateChoice, pan: PanChoice): PizzaState {
  const post = LATE_IDS[late];
  const pre = ["mozzarella", "prosciutto-crudo", "arugula"].filter((id) => !post.includes(id));
  const piece = (ingredientId: string, i: number, stage?: "post") => ({ id: `${stage ?? "pre"}${i}`, ingredientId, x: 30 + i * 6, y: 50, ...(stage ? { stage } : {}) });
  return {
    ...createEmptyPizza(),
    sauceIds: ["tomato-sauce"],
    toppings: [...pre.map((id, i) => piece(id, i)), ...post.map((id, i) => piece(id, i + 3, "post" as const))],
    bakeResult: 70,
    ...(dough === "pinsa" ? { dough: PINSA } : {}),
    ...(pan === "tray" ? { pan: "tray" as const } : {}),
  } as PizzaState;
}
// The catalog without the real Pinsa row (present only while PINSA_PRODUCTION is open; the real row is pinned in lateCatalog.pinsa.test.ts): these tables
// compare "no Pinsa" with a SYNTHETIC Pinsa built by the same function the data uses, so both runs of the suite (gate closed / open) read the same fixtures.
const PRODUCTION: readonly RecipeDiscoveryTarget[] = RECIPE_DISCOVERY_CATALOG.filter((t) => t.recipeId !== "pinsa-romana");
const WITH_PINSA: readonly RecipeDiscoveryTarget[] = [...PRODUCTION, PINSA_TARGET];
const label = (o: DiscoveryOutcome): string => (o.kind === "NEW_DISCOVERY" || o.kind === "ALREADY_DISCOVERED" ? `${o.kind}:${o.recipeId}` : o.kind);
const run = (p: PizzaState, catalog: readonly RecipeDiscoveryTarget[], discovered: readonly string[] = []): string => label(evaluateDiscovery(signatureOfPizza(p), catalog, discovered));

describe("L1 discovery table for jamon's ingredient set (the synthetic Pinsa target built by discoveryIdentityOf)", () => {
  const DOUGHS: readonly DoughChoice[] = ["standard", "pinsa"];
  const LATES: readonly LateChoice[] = ["none", "arugula-only", "prosciutto-only", "both"];
  const PANS: readonly PanChoice[] = ["none", "tray"];

  const expected = (dough: DoughChoice, late: LateChoice, pan: PanChoice): string => {
    if (pan === "tray") return "ORIGINAL";
    if (dough === "standard" && late === "none") return `NEW_DISCOVERY:${JAMON_ID}`;
    if (dough === "pinsa" && late === "arugula-only") return "NEW_DISCOVERY:syn:pinsa-romana";
    return "ORIGINAL";
  };

  for (const dough of DOUGHS) {
    for (const late of LATES) {
      for (const pan of PANS) {
        it(`${dough} dough / late ${late} / pan ${pan}`, () => {
          expect(run(pizzaOf(dough, late, pan), WITH_PINSA)).toBe(expected(dough, late, pan));
        });
      }
    }
  }

  it("D2: a standard dough with only the arugula after the bake is ORIGINAL (jamon's target is unchanged), in the production catalog too", () => {
    expect(run(pizzaOf("standard", "arugula-only", "none"), WITH_PINSA)).toBe("ORIGINAL");
    expect(run(pizzaOf("standard", "arugula-only", "none"), PRODUCTION)).toBe("ORIGINAL");
  });

  it("L1: the Pinsa dough with the prosciutto after the bake (the L2 shape) is ORIGINAL; so is the Pinsa dough with everything before the bake", () => {
    expect(run(pizzaOf("pinsa", "both", "none"), WITH_PINSA)).toBe("ORIGINAL");
    expect(run(pizzaOf("pinsa", "none", "none"), WITH_PINSA)).toBe("ORIGINAL");
  });

  it("the production catalog (no Pinsa) discovers jamon from exactly one of the 16 pizzas and nothing else", () => {
    const hits = DOUGHS.flatMap((d) => LATES.flatMap((l) => PANS.map((p) => run(pizzaOf(d, l, p), PRODUCTION)))).filter((r) => r !== "ORIGINAL");
    expect(hits).toEqual([`NEW_DISCOVERY:${JAMON_ID}`]);
  });

  it("D2: an already-discovered jamon stays ALREADY_DISCOVERED with Pinsa in the catalog, and the discovered list is not touched", () => {
    const discovered = Object.freeze([JAMON_ID]);
    expect(run(pizzaOf("standard", "none", "none"), WITH_PINSA, discovered)).toBe(`ALREADY_DISCOVERED:${JAMON_ID}`);
    expect(run(pizzaOf("standard", "none", "none"), PRODUCTION, discovered)).toBe(`ALREADY_DISCOVERED:${JAMON_ID}`);
    expect(discovered).toEqual([JAMON_ID]);
  });

  it("jamon's own target does not change when the late / dough machinery exists: default dimensions, no capability", () => {
    expect(JAMON.identityDimensions).toBe(DEFAULT_IDENTITY_DIMENSIONS);
    expect(JAMON.capabilities).toEqual([]);
    expect(PINSA_TARGET.items).toEqual(JAMON.items);
    expect(PINSA_TARGET.sauceBase).toEqual(JAMON.sauceBase);
  });
});

/** D3 fixtures: the real production targets plus a synthetic Pinsa and the real ikura recipe as a late target (its late step is "ordinary length + 1"; 56 here). */
const IKURA_TARGET = targetOf("ikura-salmon-pizza", LATE_RECIPES.find((r) => r.id === "ikura-salmon-pizza")!);
const IKURA_LATE_STEP = 56;
const materialStep = (id: string): number | null => (id === "salmon-roe" ? IKURA_LATE_STEP : ingredientUnlockStep(id));
function context(extra: readonly RecipeDiscoveryTarget[]): TechniqueRuntimeContext {
  return { ...productionTechniqueContext(), catalog: [...RECIPE_DISCOVERY_CATALOG.filter((t) => !isLateRecipeId(t.recipeId)), ...extra] as readonly TechniqueCatalogEntry[], materialStep };
}
const FORBIDDEN = /ピンサ|ロマーナ|ハモン|ルッコラ|生ハム|焼成|焼き上|pinsa|romana|arugula|prosciutto|dough-pinsa|late-addition/i;

describe("D3: the late-addition riddle may open at step 33; nothing else about it leaks", () => {
  it("INV-TQ-4 stays: without a Pinsa / late target neither technique has an affordance step", () => {
    const ctx = context([]);
    expect(techniqueAffordanceStep("dough-pinsa-romana", ctx.catalog, ctx.materialStep)).toBeNull();
    expect(techniqueAffordanceStep("late-addition", ctx.catalog, ctx.materialStep)).toBeNull();
  });

  it("with only ikura the late-addition affordance is the late step (derived, 56 here); with Pinsa it is the Pinsa step 33 (the accepted front-run)", () => {
    const ikuraOnly = context([IKURA_TARGET]);
    expect(techniqueAffordanceStep("late-addition", ikuraOnly.catalog, ikuraOnly.materialStep)).toBe(IKURA_LATE_STEP);
    const both = context([IKURA_TARGET, PINSA_TARGET]);
    expect(techniqueAffordanceStep("late-addition", both.catalog, both.materialStep)).toBe(33);
    expect(techniqueAffordanceStep("dough-pinsa-romana", both.catalog, both.materialStep)).toBe(33);
    expect(ingredientUnlockStep("arugula")).toBe(33);
    expect(isTechniqueAffordanceOpen(33, 32)).toBe(false);
    expect(isTechniqueAffordanceOpen(33, 33)).toBe(true);
  });

  it("T1: the two riddles are fixed strings that name no recipe, ingredient or moment", () => {
    const riddles = Object.fromEntries(TECHNIQUES.filter((t) => t.id === "dough-pinsa-romana" || t.id === "late-addition").map((t) => [t.id, t.riddleJa]));
    expect(riddles).toEqual({
      "dough-pinsa-romana": "同じ具材でも、生地の仕立て方で違う一枚になることがあるよ。",
      "late-addition": "同じ材料でも、ひと手間の加え方で違う一枚になることがあるよ。",
    });
    for (const riddle of Object.values(riddles)) expect(riddle).not.toMatch(FORBIDDEN);
  });

  it("T2: below step 33 the Dex shows neither riddle; from step 33 it shows exactly the two fixed riddles, with no name, description or recipe word", () => {
    const ctx = context([IKURA_TARGET, PINSA_TARGET]);
    const credited = RECIPES.filter((r) => countsTowardLadder(r.id)).map((r) => r.id);
    const at = (n: number) => techniqueDexViews([], discoveredDex(credited.slice(0, n)), ctx);
    const kinds = (n: number) => at(n).map((v) => `${v.id}:${v.state}`);
    expect(kinds(32)).not.toContain("dough-pinsa-romana:RIDDLE");
    expect(kinds(32)).not.toContain("late-addition:RIDDLE");
    const views = at(33);
    expect(views.filter((v) => v.id === "dough-pinsa-romana" || v.id === "late-addition").map((v) => v.state)).toEqual(["RIDDLE", "RIDDLE"]);
    for (const v of views.filter((x) => x.id === "dough-pinsa-romana" || x.id === "late-addition")) {
      if (v.state !== "RIDDLE") throw new Error("expected RIDDLE");
      expect(Object.keys(v).sort()).toEqual(["id", "riddleJa", "state"]);
      expect(v.riddleJa).not.toMatch(FORBIDDEN);
    }
  });

  it("T2: a Pinsa target only adds the dough technique's riddle; every other view (the late-addition one included) is the same as without it once ikura's own step is reached", () => {
    const withPinsa = context([IKURA_TARGET, PINSA_TARGET]);
    const withoutPinsa = context([IKURA_TARGET]);
    const credited = RECIPES.filter((r) => countsTowardLadder(r.id)).map((r) => r.id);
    const dex = discoveredDex(credited); // far past both affordances
    const others = (views: ReturnType<typeof techniqueDexViews>) => views.filter((v) => v.id !== "dough-pinsa-romana");
    expect(others(techniqueDexViews([], dex, withPinsa))).toEqual(others(techniqueDexViews([], dex, withoutPinsa)));
    expect(techniqueDexViews([], dex, withoutPinsa).some((v) => v.id === "dough-pinsa-romana")).toBe(false);
  });

  it("recipe path: matching the Pinsa target records BOTH techniques, in registry order, whatever the affordance", () => {
    const out = registerTechniqueDiscovery({
      ledger: [],
      signature: signatureOfPizza(pizzaOf("pinsa", "arugula-only", "none")),
      completionPassed: true,
      matchedTarget: PINSA_TARGET,
      isAffordanceOpen: () => false,
    });
    expect(out.newlyDiscovered).toEqual(["dough-pinsa-romana", "late-addition"]);
  });

  it("usage path (an original pizza): both techniques are recorded only once their own affordance is open", () => {
    const signature = signatureOfPizza(pizzaOf("pinsa", "prosciutto-only", "none"));
    const base = { ledger: [] as string[], signature, completionPassed: true, matchedTarget: null };
    expect(registerTechniqueDiscovery({ ...base, isAffordanceOpen: () => false }).newlyDiscovered).toEqual([]);
    expect(registerTechniqueDiscovery({ ...base, isAffordanceOpen: () => true }).newlyDiscovered).toEqual(["dough-pinsa-romana", "late-addition"]);
    expect(registerTechniqueDiscovery({ ...base, isAffordanceOpen: (id) => id === "late-addition" }).newlyDiscovered).toEqual(["late-addition"]);
  });
});
