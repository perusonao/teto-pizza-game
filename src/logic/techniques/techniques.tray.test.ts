import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { isTechniqueId, KNOWN_TECHNIQUE_IDS, TECHNIQUES } from "../../data/techniques";
import type { DexEntry, DexState } from "../../state/dex";
import { ingredientUnlockStep } from "../../state/materialEntitlement";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import type { RecipeDiscoveryTarget } from "../discovery/matcher";
import { DEFAULT_IDENTITY_DIMENSIONS, signatureOfPizza } from "../discovery/signature";
import { W1_ORDER } from "../testSupport/branchingFixture";
import { detectTechniquesUsed, requiredTechniquesOf } from "./detection";
import { techniqueDexViews } from "./dexView";
import { backfillTechniqueLedger, isTechniqueAffordanceOpen, techniqueAffordanceStep } from "./registration";
import { initialTechniqueLedger, productionTechniqueContext, resolveRoundTechniques, type TechniqueRuntimeContext } from "./runtime";

/**
 * Square Dough F2 (Issue #538): the TRAY technique (天板焼き). Synthetic fixtures only -- no production recipe requires
 * the tray yet (Square Dough E, #521), so the technique can never open in production (INV-TQ-4).
 */

const TRAY = TECHNIQUES.find((t) => t.id === "tray")!;
const ITEMS = ["garlic", "mozzarella", "olive-oil", "tomato-sauce"];

/** A synthetic tray recipe with the provisional Grandma materials (NOT a production recipe). */
const SYN_TRAY: RecipeDiscoveryTarget = {
  targetId: "syn:tray-pizza",
  recipeId: "syn-tray" as RecipeDiscoveryTarget["recipeId"],
  items: ITEMS,
  sauceBase: ["olive-oil", "tomato-sauce"],
  capabilities: [],
  identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, pan: "tray" },
  eligibility: { status: "ELIGIBLE" },
};
const TRAY_CONTEXT: TechniqueRuntimeContext = { ...productionTechniqueContext(), catalog: [...RECIPE_DISCOVERY_CATALOG, SYN_TRAY] };

const dexOf = (ids: readonly string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));

function pizzaOf(pan?: PizzaState["pan"]): PizzaState {
  return {
    ...createEmptyPizza(),
    ...(pan === undefined ? {} : { pan }),
    sauceIds: ["tomato-sauce", "olive-oil"],
    toppings: ["mozzarella", "garlic"].map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 8, y: 50 })),
    bakeResult: 70,
  };
}

function round(pizza: PizzaState, over: Partial<Parameters<typeof resolveRoundTechniques>[0]> = {}) {
  return resolveRoundTechniques({
    eligibility: "FREE_COOK",
    ledger: [],
    signature: signatureOfPizza(pizza),
    completionPassed: true,
    dexBefore: dexOf(W1_ORDER.slice(0, 14)),
    dexAfter: dexOf(W1_ORDER.slice(0, 14)),
    context: TRAY_CONTEXT,
    ...over,
  });
}

describe("TRAY registry (Owner-approved copy)", () => {
  it("registers 'tray' after 'no-sauce', with the approved name, riddle and description", () => {
    expect(TECHNIQUES.map((t) => t.id)).toEqual(["no-sauce", "tray", "dough-pinsa-romana", "late-addition"]); // + Dough Kind P1 (#577), + late-addition (FIN-E2, #604)
    expect(TRAY.nameJa).toBe("天板焼き");
    expect(TRAY.riddleJa).toBe("丸くなくても、ピザは焼ける。四つの角まで生地を広げてみよう。");
    expect(TRAY.descriptionJa).toBe("四角い天板に生地を広げて焼く調理法。指で押し広げ、四隅まで伸ばして形を整えよう。");
    expect(KNOWN_TECHNIQUE_IDS).toEqual(["no-sauce", "tray", "dough-pinsa-romana", "late-addition"]);
    expect(isTechniqueId("tray")).toBe(true);
  });

  it("the riddle and description name no recipe, ingredient, count or target (a general description, same for every player)", () => {
    for (const text of [TRAY.riddleJa, TRAY.descriptionJa!]) {
      expect(text).not.toMatch(/グランマ|grandma|にんにく|オリーブ|トマト|モッツァレラ|\d|[０-９]/);
    }
  });
});

describe("TRAY detection", () => {
  it("only an explicit pan 'tray' counts as using the tray", () => {
    expect(detectTechniquesUsed(signatureOfPizza(pizzaOf("tray")))).toEqual(["tray"]);
    for (const pan of [undefined, null]) expect(detectTechniquesUsed(signatureOfPizza(pizzaOf(pan)))).toEqual([]);
  });

  it("a square dough model alone (e.g. the Preview query) is never a tray cook", () => {
    const squareOnly = { ...pizzaOf(), squareDough: {} } as unknown as PizzaState;
    expect(detectTechniquesUsed(signatureOfPizza(squareOnly))).toEqual([]);
  });

  it("a signature without dimensions never uses the tray; an empty pizza is not a tray cook", () => {
    const { ingredientSet, sauceBase } = signatureOfPizza(pizzaOf("tray"));
    expect(detectTechniquesUsed({ ingredientSet, sauceBase })).toEqual([]);
    expect(detectTechniquesUsed(signatureOfPizza({ ...createEmptyPizza(), pan: "tray" }))).toEqual([]);
  });

  it("a target requires the tray only when its identity declares pan 'tray' (not deep-pan / shallow-pan / null)", () => {
    const withPan = (pan: string | null) => ({ sauceBase: ["tomato-sauce"], identityDimensions: { pan } });
    expect(requiredTechniquesOf(withPan("tray"))).toEqual(["tray"]);
    for (const pan of [null, "deep-pan", "shallow-pan"]) expect(requiredTechniquesOf(withPan(pan))).toEqual([]);
    expect(requiredTechniquesOf({ sauceBase: [] })).toEqual(["no-sauce"]);
    expect(requiredTechniquesOf({ sauceBase: [], identityDimensions: { pan: "tray" } })).toEqual(["no-sauce", "tray"]);
  });
});

describe("TRAY affordance (derived from the ladder, never authored)", () => {
  it("in production exactly one target requires the tray -- grandma-pizza (Square Dough E-2) -- so the affordance is derived from ITS materials (INV-TQ-4)", () => {
    const { catalog, materialStep } = productionTechniqueContext();
    expect(catalog.filter((t) => requiredTechniquesOf(t).includes("tray")).map((t) => t.recipeId)).toEqual(["grandma-pizza"]);
    expect(techniqueAffordanceStep("tray", catalog, materialStep)).not.toBeNull();
  });

  it("a catalog without a tray target never opens the tray (INV-TQ-4)", () => {
    const { catalog, materialStep } = productionTechniqueContext();
    const noTray = catalog.filter((t) => !requiredTechniquesOf(t).includes("tray"));
    expect(techniqueAffordanceStep("tray", noTray, materialStep)).toBeNull();
    expect(techniqueDexViews([], dexOf(W1_ORDER), { catalog: noTray, materialStep }).filter((v) => v.id === "tray")).toEqual([]);
  });

  it("with a tray recipe, the step is the max unlock step of its materials, re-derived from the current ladder", () => {
    const derived = Math.max(0, ...ITEMS.map((id) => ingredientUnlockStep(id) ?? Infinity));
    expect(techniqueAffordanceStep("tray", TRAY_CONTEXT.catalog, TRAY_CONTEXT.materialStep)).toBe(derived);
    // The current ladder gives olive-oil 13 and garlic 14 (tomato-sauce / mozzarella are starters): 14.
    expect(derived).toBe(14);
    expect(isTechniqueAffordanceOpen(derived, 13)).toBe(false);
    expect(isTechniqueAffordanceOpen(derived, 14)).toBe(true);
  });
});

describe("TRAY discovery: an unlocked, formal pan 'tray' cook completed in Free Cooking", () => {
  it("discovers the tray at the affordance step, without any recipe being discovered", () => {
    const result = round(pizzaOf("tray"));
    expect(result.newlyDiscovered).toEqual(["tray"]);
    expect(result.ledger).toEqual(["tray"]);
  });

  it("does not discover before the affordance is open (13 credited)", () => {
    const result = round(pizzaOf("tray"), { dexBefore: dexOf(W1_ORDER.slice(0, 13)), dexAfter: dexOf(W1_ORDER.slice(0, 13)) });
    expect(result.newlyDiscovered).toEqual([]);
  });

  it("does not discover from an ordinary (round) cook of the same ingredients, a failed cook, a guided round or a mission round", () => {
    expect(round(pizzaOf()).newlyDiscovered).toEqual([]);
    expect(round(pizzaOf("tray"), { completionPassed: false }).newlyDiscovered).toEqual([]);
    expect(round(pizzaOf("tray"), { eligibility: "FREE_GUIDED" }).newlyDiscovered).toEqual([]);
    expect(round(pizzaOf("tray"), { eligibility: "NONE" }).newlyDiscovered).toEqual([]);
  });

  it("does not discover when no catalog target requires the tray (the affordance never opens)", () => {
    const production = productionTechniqueContext();
    expect(round(pizzaOf("tray"), { context: { ...production, catalog: production.catalog.filter((t) => t.recipeId !== "grandma-pizza") } }).newlyDiscovered).toEqual([]);
  });

  it("is recorded once: a ledger that already holds the tray reports nothing", () => {
    expect(round(pizzaOf("tray"), { ledger: ["tray"] }).newlyDiscovered).toEqual([]);
  });

  it("keeps NO_SAUCE and unknown ids in place and in registry order", () => {
    const result = round(pizzaOf("tray"), { ledger: ["no-sauce"] });
    expect(result.ledger).toEqual(["no-sauce", "tray"]);
    expect(result.newlyDiscovered).toEqual(["tray"]);
  });

  it("a discovered tray recipe still records the tray (INV-TQ-1), but never needs it to be discovered (INV-TQ-NB)", () => {
    expect(backfillTechniqueLedger([], [SYN_TRAY]).ledger).toEqual(["tray"]);
    expect(initialTechniqueLedger([], dexOf(["syn-tray"]), TRAY_CONTEXT)).toEqual(["tray"]);
    expect(initialTechniqueLedger(["no-sauce"], dexOf(W1_ORDER.slice(0, 3)), TRAY_CONTEXT)).toEqual(["no-sauce"]);
  });
});

describe("TRAY in the Dex 調理法 section", () => {
  it("shows nothing before the affordance, then 「？？？」 + the fixed riddle, then the name + description", () => {
    const tray = (views: ReturnType<typeof techniqueDexViews>) => views.filter((v) => v.id === "tray");
    expect(tray(techniqueDexViews([], dexOf(W1_ORDER.slice(0, 13)), TRAY_CONTEXT))).toEqual([]);
    expect(tray(techniqueDexViews([], dexOf(W1_ORDER.slice(0, 14)), TRAY_CONTEXT))).toEqual([{ id: "tray", state: "RIDDLE", riddleJa: TRAY.riddleJa }]);
    expect(tray(techniqueDexViews(["tray"], [], TRAY_CONTEXT))).toEqual([
      { id: "tray", state: "DISCOVERED", nameJa: "天板焼き", descriptionJa: TRAY.descriptionJa },
    ]);
  });

  it("the undiscovered view never carries the name or the description", () => {
    const serialized = JSON.stringify(techniqueDexViews([], dexOf(W1_ORDER.slice(0, 14)), TRAY_CONTEXT));
    expect(serialized).not.toContain("天板焼き");
    expect(serialized).not.toContain(TRAY.descriptionJa!);
  });

  it("NO_SAUCE's discovered view is unchanged (no description key)", () => {
    expect(techniqueDexViews(["no-sauce"], [])).toEqual([{ id: "no-sauce", state: "DISCOVERED", nameJa: "ソースなし" }]);
    expect(Object.keys(techniqueDexViews(["no-sauce"], [])[0])).not.toContain("descriptionJa");
  });
});

describe("Anti-Oracle: the tray copy lives only in the technique registry (named allowlist)", () => {
  // OD-TQ-5/6 exception (Owner, 2026-10-18): limited to the Dex's general technique description. The copy is defined in one
  // file; every other source (Research, Hint 5.0, RESULT near-miss, recipes) must not repeat it or the technique name.
  const TRAY_COPY_ALLOWLIST = ["/src/data/techniques.ts"];
  const sources = import.meta.glob<string>(["/src/**/*.ts", "/src/**/*.tsx", "!/src/**/*.test.ts", "!/src/**/*.test.tsx"], {
    query: "?raw",
    import: "default",
    eager: true,
  });

  it("only the allowlisted file carries the tray name, riddle or description", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(200);
    // the copy as a player-facing string: the full sentences, and the name as a quoted literal (comments may mention it)
    const quotedName = new RegExp(`["'\`]${TRAY.nameJa}["'\`]`);
    const holders = Object.entries(sources)
      .filter(([, text]) => text.includes(TRAY.riddleJa) || text.includes(TRAY.descriptionJa!) || quotedName.test(text))
      .map(([path]) => path)
      .sort();
    expect(holders).toEqual(TRAY_COPY_ALLOWLIST);
  });
});
