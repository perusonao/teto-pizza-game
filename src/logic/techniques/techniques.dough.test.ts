import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { isTechniqueId, KNOWN_TECHNIQUE_IDS, TECHNIQUES } from "../../data/techniques";
import type { DexEntry, DexState } from "../../state/dex";
import { ingredientUnlockStep } from "../../state/materialEntitlement";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import type { RecipeDiscoveryTarget } from "../discovery/matcher";
import { DEFAULT_IDENTITY_DIMENSIONS, signatureOfPizza } from "../discovery/signature";
import { RECIPES } from "../../data/recipes";
import { detectTechniquesUsed, requiredTechniquesOf } from "./detection";
import { techniqueDexViews } from "./dexView";
import { backfillTechniqueLedger, techniqueAffordanceStep } from "./registration";
import { productionTechniqueContext, resolveRoundTechniques, type TechniqueRuntimeContext } from "./runtime";
import { DOUGH_PINSA_ROMANA_RECIPE_IDS } from "../testSupport/techniqueAllowlists";

/**
 * Dough Kind P1 (#577): the technique `dough-pinsa-romana`. Synthetic fixtures only -- no production recipe requires it,
 * so it never opens in production (INV-TQ-4).
 */
const ID = "dough-pinsa-romana";
const PINSA = "material-multigrain-long-ferment";
const DOUGH = TECHNIQUES.find((t) => t.id === ID)!;
const ITEMS = ["arugula", "mozzarella", "prosciutto-crudo", "tomato-sauce"];

const SYN_PINSA: RecipeDiscoveryTarget = {
  targetId: "syn:pinsa",
  recipeId: "syn-pinsa" as RecipeDiscoveryTarget["recipeId"],
  items: ITEMS,
  sauceBase: ["tomato-sauce"],
  capabilities: ["DOUGH_VARIANT"],
  identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, dough: PINSA },
  eligibility: { status: "ELIGIBLE" },
};
const CONTEXT: TechniqueRuntimeContext = { ...productionTechniqueContext(), catalog: [...RECIPE_DISCOVERY_CATALOG, SYN_PINSA] };
const dexOf = (ids: readonly string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));

function pizzaOf(dough?: PizzaState["dough"], pan?: PizzaState["pan"]): PizzaState {
  return {
    ...createEmptyPizza(),
    ...(dough === undefined ? {} : { dough }),
    ...(pan === undefined ? {} : { pan }),
    sauceIds: ["tomato-sauce"],
    toppings: ["mozzarella", "prosciutto-crudo", "arugula"].map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 8, y: 50 })),
    bakeResult: 70,
  };
}
/** A Dex holding `n` credited recipes (the affordance reads only the credited count). */
const CREDITED = RECIPES.filter((r) => !("ladderCredit" in r)).map((r) => r.id as string);
const credited = (n: number): DexState => dexOf(CREDITED.slice(0, n));
const affordance = () => techniqueAffordanceStep(ID, CONTEXT.catalog, CONTEXT.materialStep)!;
function round(pizza: PizzaState, over: Partial<Parameters<typeof resolveRoundTechniques>[0]> = {}) {
  const dex = credited(affordance());
  return resolveRoundTechniques({
    eligibility: "FREE_COOK",
    ledger: [],
    signature: signatureOfPizza(pizza),
    completionPassed: true,
    dexBefore: dex,
    dexAfter: dex,
    context: CONTEXT,
    ...over,
  });
}

describe("dough-pinsa-romana registry (Owner-approved copy, PK-20 / PK-22)", () => {
  it("is registered after no-sauce and tray (late-addition, FIN-E2, follows it), with the approved id, name, riddle and description", () => {
    expect(TECHNIQUES.map((t) => t.id)).toEqual(["no-sauce", "tray", ID, "late-addition"]);
    expect(KNOWN_TECHNIQUE_IDS).toContain(ID);
    expect(isTechniqueId(ID)).toBe(true);
    expect(DOUGH.nameJa).toBe("ピンサ生地");
    expect(DOUGH.riddleJa).toBe("同じ具材でも、生地の仕立て方で違う一枚になることがあるよ。");
    expect(DOUGH.descriptionJa).toBe("空気を含んだ軽い食感が特徴の生地");
  });

  it("the id follows the technique / save id grammar (lowercase kebab)", () => {
    expect(ID).toMatch(/^[a-z0-9][a-z0-9_-]{0,63}$/);
  });

  it("the riddle and description name no recipe, ingredient or count, and the riddle avoids the existing banned words", () => {
    for (const text of [DOUGH.riddleJa, DOUGH.descriptionJa!]) {
      expect(text).not.toMatch(/ピンサ|ロマーナ|ハモン|生ハム|ルッコラ|トマト|モッツァレラ|\d|[０-９]/);
    }
    expect(DOUGH.riddleJa).not.toContain(DOUGH.nameJa);
    expect(DOUGH.riddleJa).not.toMatch(/ソース|なし|省/);
  });
});

describe("dough-pinsa-romana detection", () => {
  it("only an explicit Pinsa dough counts as using it; standard / absent do not", () => {
    expect(detectTechniquesUsed(signatureOfPizza(pizzaOf(PINSA)))).toEqual([ID]);
    for (const d of [undefined, "standard" as const]) expect(detectTechniquesUsed(signatureOfPizza(pizzaOf(d)))).toEqual([]);
  });

  it("the pan is independent: Pinsa + tray uses both, tray alone does not use the dough technique", () => {
    expect(detectTechniquesUsed(signatureOfPizza(pizzaOf(PINSA, "tray")))).toEqual(["tray", ID]);
    expect(detectTechniquesUsed(signatureOfPizza(pizzaOf(undefined, "tray")))).toEqual(["tray"]);
  });

  it("a signature without dimensions, and an empty pizza, never use it", () => {
    const { ingredientSet, sauceBase } = signatureOfPizza(pizzaOf(PINSA));
    expect(detectTechniquesUsed({ ingredientSet, sauceBase })).toEqual([]);
    expect(detectTechniquesUsed(signatureOfPizza({ ...createEmptyPizza(), dough: PINSA }))).toEqual([]);
  });

  it("a target requires it only when its identity declares the Pinsa dough", () => {
    expect(requiredTechniquesOf({ sauceBase: ["tomato-sauce"], identityDimensions: { dough: PINSA } })).toEqual([ID]);
    for (const dough of ["standard", "x"]) expect(requiredTechniquesOf({ sauceBase: ["tomato-sauce"], identityDimensions: { dough } })).toEqual([]);
    expect(requiredTechniquesOf({ sauceBase: [], identityDimensions: { pan: "tray", dough: PINSA } })).toEqual(["no-sauce", "tray", ID]);
  });
});

describe("dough-pinsa-romana affordance and discovery", () => {
  it("no production target requires it, so it never opens in production (INV-TQ-4) and the Dex shows nothing of it", () => {
    const { catalog, materialStep } = productionTechniqueContext();
    expect(catalog.filter((t) => requiredTechniquesOf(t).includes(ID)).map((t) => t.recipeId)).toEqual(DOUGH_PINSA_ROMANA_RECIPE_IDS);
    if (DOUGH_PINSA_ROMANA_RECIPE_IDS.length === 0) {
      expect(techniqueAffordanceStep(ID, catalog, materialStep)).toBeNull();
      expect(techniqueDexViews([], credited(CREDITED.length)).filter((v) => v.id === ID)).toEqual([]);
      expect(round(pizzaOf(PINSA), { context: productionTechniqueContext() }).newlyDiscovered).toEqual([]);
    } else {
      // gate open (the shipped state): the only requiring target is pinsa-romana, the step is DERIVED from its materials (arugula's), and the Dex shows a riddle only
      expect(techniqueAffordanceStep(ID, catalog, materialStep)).toBe(Math.max(0, ...ITEMS.map((id) => ingredientUnlockStep(id) ?? Infinity)));
      const views = techniqueDexViews([], credited(CREDITED.length)).filter((v) => v.id === ID);
      expect(views.map((v) => v.state)).toEqual(["RIDDLE"]);
    }
  });

  it("with a Pinsa recipe the step is the max unlock step of its materials (derived, not authored)", () => {
    expect(affordance()).toBe(Math.max(0, ...ITEMS.map((id) => ingredientUnlockStep(id) ?? Infinity)));
  });

  it("discovers by use at the affordance step, in Free Cooking only, once", () => {
    expect(round(pizzaOf(PINSA)).newlyDiscovered).toEqual([ID]);
    const early = credited(Math.max(0, affordance() - 1));
    expect(round(pizzaOf(PINSA), { dexBefore: early, dexAfter: early }).newlyDiscovered).toEqual([]);
    expect(round(pizzaOf()).newlyDiscovered).toEqual([]);
    expect(round(pizzaOf(PINSA), { completionPassed: false }).newlyDiscovered).toEqual([]);
    expect(round(pizzaOf(PINSA), { eligibility: "FREE_GUIDED" }).newlyDiscovered).toEqual([]);
    expect(round(pizzaOf(PINSA), { eligibility: "NONE" }).newlyDiscovered).toEqual([]);
    expect(round(pizzaOf(PINSA), { ledger: [ID] }).newlyDiscovered).toEqual([]);
  });

  it("a discovered Pinsa recipe records the technique (INV-TQ-1)", () => {
    expect(backfillTechniqueLedger([], [SYN_PINSA]).ledger).toEqual([ID]);
  });

  it("Dex: nothing before the affordance, then 「？？？」 + riddle, then name + description (R1 / R2: no recipe correspondence)", () => {
    const only = (views: ReturnType<typeof techniqueDexViews>) => views.filter((v) => v.id === ID);
    const step = affordance();
    if (step > 0) expect(only(techniqueDexViews([], credited(step - 1), CONTEXT))).toEqual([]);
    expect(only(techniqueDexViews([], credited(step), CONTEXT))).toEqual([{ id: ID, state: "RIDDLE", riddleJa: DOUGH.riddleJa }]);
    const found = only(techniqueDexViews([ID], [], CONTEXT));
    expect(found).toEqual([{ id: ID, state: "DISCOVERED", nameJa: "ピンサ生地", descriptionJa: DOUGH.descriptionJa }]);
    // the view's `id` is a React key only (R6: never rendered); everything it displays names no recipe
    const { nameJa, descriptionJa } = found[0] as { nameJa: string; descriptionJa: string };
    expect(`${nameJa}${descriptionJa}`).not.toMatch(/ロマーナ|romana|ハモン|ルッコラ/);
    expect(JSON.stringify(only(techniqueDexViews([], credited(step), CONTEXT)))).not.toContain("ピンサ");
  });
});

describe("Anti-Oracle: the dough copy lives only in the technique registry (named allowlist, PK-22)", () => {
  const sources = import.meta.glob<string>(["/src/**/*.ts", "/src/**/*.tsx", "!/src/**/*.test.ts", "!/src/**/*.test.tsx"], {
    query: "?raw",
    import: "default",
    eager: true,
  });

  it("only data/techniques.ts carries the name, riddle or description as a string", () => {
    const quotedName = new RegExp(`["'\`]${DOUGH.nameJa}["'\`]`);
    const holders = Object.entries(sources)
      .filter(([, text]) => text.includes(DOUGH.riddleJa) || text.includes(DOUGH.descriptionJa!) || quotedName.test(text))
      .map(([path]) => path);
    expect(holders).toEqual(["/src/data/techniques.ts"]);
  });

  it("the raw technique id is used only by the registry, the detection pairing and nothing that renders (R6)", () => {
    const holders = Object.entries(sources)
      .filter(([, text]) => text.includes(ID))
      .map(([path]) => path)
      .sort();
    expect(holders).toEqual(["/src/data/techniques.ts", "/src/logic/techniques/detection.ts"]);
  });
});
