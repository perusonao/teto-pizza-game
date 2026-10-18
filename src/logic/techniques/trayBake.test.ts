import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { RECIPES } from "../../data/recipes";
import { TECHNIQUES, TRAY_BAKE_DESCRIPTION_JA, TRAY_BAKE_RIDDLE_JA } from "../../data/techniques";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { discoveredDex } from "../../state/testSupport/guidedRound";
import { evaluateDiscovery, type RecipeDiscoveryTarget } from "../discovery/matcher";
import { DEFAULT_IDENTITY_DIMENSIONS, signatureOfPizza } from "../discovery/signature";
import { W1_ORDER } from "../testSupport/branchingFixture";
import { detectTechniquesUsed, requiredTechniquesOf } from "./detection";
import { techniqueDexViews } from "./dexView";
import { isTechniqueAffordanceOpen, registerTechniqueDiscovery, techniqueAffordanceStep } from "./registration";
import { initialTechniqueLedger, productionTechniqueContext, resolveRoundTechniques, type TechniqueRuntimeContext } from "./runtime";
import { PAN_REQUIRING_RECIPE_IDS } from "./testSupport/technique.allowlists";

/**
 * Square Dough F2 (Issue #538): the `tray-bake` (天板焼き) Technique. Synthetic fixtures only -- no production
 * recipe sets `identityDimensions.pan` until E (#521), so every production behaviour must stay inert.
 */

const ITEMS = ["garlic", "mozzarella", "olive-oil", "tomato-sauce"];
const SAUCES = ["olive-oil", "tomato-sauce"];

function pizzaOf(pan: PizzaState["pan"], pieces = ["mozzarella", "garlic"], sauceIds = SAUCES): PizzaState {
  return {
    ...createEmptyPizza(),
    ...(pan === undefined ? {} : { pan }),
    sauceIds,
    toppings: pieces.map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 8, y: 50 })),
  };
}

function trayTarget(): RecipeDiscoveryTarget {
  return {
    targetId: "syn:tray",
    recipeId: "syn-tray" as RecipeDiscoveryTarget["recipeId"],
    items: ITEMS,
    sauceBase: SAUCES,
    capabilities: [],
    identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, pan: "tray" },
    eligibility: { status: "ELIGIBLE" },
  };
}

const CATALOG = [...RECIPE_DISCOVERY_CATALOG, trayTarget()];
const synContext = (materialStep: (id: string) => number | null): TechniqueRuntimeContext => ({
  catalog: [{ recipeId: "syn-tray", items: ITEMS, sauceBase: SAUCES, identityDimensions: trayTarget().identityDimensions }],
  materialStep,
  countsTowardLadder: () => true,
});

describe("registry copy (Owner O-6, exception limited to a general description)", () => {
  it("tray-bake is registered with the Owner copy as fixed constants", () => {
    const t = TECHNIQUES.find((x) => x.id === "tray-bake")!;
    expect(t.nameJa).toBe("天板焼き");
    expect(t.riddleJa).toBe("丸くなくても、ピザは焼ける。四つの角まで生地を広げてみよう。");
    expect(t.descriptionJa).toBe("四角い天板に生地を広げて焼く調理法。指で押し広げ、四隅まで伸ばして形を整えよう。");
    expect(t.riddleJa).toBe(TRAY_BAKE_RIDDLE_JA);
    expect(t.descriptionJa).toBe(TRAY_BAKE_DESCRIPTION_JA);
    expect(t.riddleJa).not.toContain(t.nameJa);
  });

  it("the exempt strings name no recipe, ingredient or count (nothing derives from a recipe)", () => {
    const names = [...RECIPES.map((r) => r.nameJa), "グランマ", "にんにく", "オリーブ", "トマト"];
    for (const text of [TRAY_BAKE_RIDDLE_JA, TRAY_BAKE_DESCRIPTION_JA]) {
      for (const n of names) expect(text.includes(n), n).toBe(false);
      expect(text).not.toMatch(/\d|あと少し/);
    }
  });
});

describe("detection reads the pan axis only", () => {
  it("used: the OBSERVED pan axis is 'tray' with a piece on the pizza", () => {
    expect(detectTechniquesUsed(signatureOfPizza(pizzaOf("tray")))).toEqual(["tray-bake"]);
    expect(detectTechniquesUsed(signatureOfPizza(pizzaOf(undefined)))).toEqual([]);
    expect(detectTechniquesUsed(signatureOfPizza(pizzaOf(null)))).toEqual([]);
    expect(detectTechniquesUsed(signatureOfPizza({ ...pizzaOf("tray"), toppings: [], sauceIds: [] }))).toEqual([]);
  });

  it("a tray pizza without sauce uses both techniques, in registry order", () => {
    expect(detectTechniquesUsed(signatureOfPizza(pizzaOf("tray", ["mozzarella"], [])))).toEqual(["no-sauce", "tray-bake"]);
  });

  it("required: only a target declaring pan 'tray'; production catalog requires none", () => {
    expect(requiredTechniquesOf(trayTarget())).toEqual(["tray-bake"]);
    expect(requiredTechniquesOf({ sauceBase: SAUCES })).toEqual([]);
    expect(requiredTechniquesOf({ sauceBase: SAUCES, identityDimensions: DEFAULT_IDENTITY_DIMENSIONS })).toEqual([]);
    const ids = RECIPE_DISCOVERY_CATALOG.filter((t) => requiredTechniquesOf(t).includes("tray-bake")).map((t) => t.recipeId);
    expect(ids.sort()).toEqual([...PAN_REQUIRING_RECIPE_IDS].sort());
  });

  it("the shape axis stays UNAVAILABLE (O-3)", () => {
    expect(signatureOfPizza(pizzaOf("tray")).dimensions.shape.status).toBe("UNAVAILABLE");
  });
});

describe("identity (O-2): the pan decides, the matcher is unchanged", () => {
  it("round + the pan recipe's ingredients is ORIGINAL; tray + the same ingredients is a NEW_DISCOVERY", () => {
    expect(evaluateDiscovery(signatureOfPizza(pizzaOf(undefined)), CATALOG, []).kind).toBe("ORIGINAL");
    expect(evaluateDiscovery(signatureOfPizza(pizzaOf("tray")), CATALOG, [])).toEqual({ kind: "NEW_DISCOVERY", recipeId: "syn-tray", targetId: "syn:tray" });
  });

  it("another recipe's ingredients cooked on the tray are ORIGINAL (the accepted O-2 consequence)", () => {
    for (const r of RECIPES.slice(0, 12)) {
      const target = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === r.id)!;
      const sauces = target.sauceBase ?? [];
      const pieces = target.items.filter((i) => !sauces.includes(i));
      const round = evaluateDiscovery(signatureOfPizza(pizzaOf(undefined, pieces, [...sauces])), CATALOG, []);
      const tray = evaluateDiscovery(signatureOfPizza(pizzaOf("tray", pieces, [...sauces])), CATALOG, []);
      expect(round.kind, r.id).not.toBe("ORIGINAL");
      expect(tray.kind, r.id).toBe("ORIGINAL");
    }
  });
});

describe("affordance is derived, never hard-coded (U1)", () => {
  const step = (table: Record<string, number>) => (id: string) => table[id] ?? 0;

  it("opens at the max material step of the requiring recipe, and moves when materialStep moves", () => {
    const a = techniqueAffordanceStep("tray-bake", synContext(step({ "olive-oil": 13, garlic: 14 })).catalog, step({ "olive-oil": 13, garlic: 14 }));
    const b = techniqueAffordanceStep("tray-bake", synContext(step({ "olive-oil": 13, garlic: 20 })).catalog, step({ "olive-oil": 13, garlic: 20 }));
    expect(a).toBe(14);
    expect(b).toBe(20);
    expect(isTechniqueAffordanceOpen(a, 13)).toBe(false);
    expect(isTechniqueAffordanceOpen(a, 14)).toBe(true);
  });

  it("is inert in production: no requiring recipe -> never opens at any count (INV-TQ-4)", () => {
    const { catalog, materialStep } = productionTechniqueContext();
    const stepValue = techniqueAffordanceStep("tray-bake", catalog, materialStep);
    expect(stepValue !== null).toBe(PAN_REQUIRING_RECIPE_IDS.length > 0);
    if (PAN_REQUIRING_RECIPE_IDS.length === 0) for (const n of [0, 14, 60, 1000]) expect(isTechniqueAffordanceOpen(stepValue, n)).toBe(false);
  });

  it("ladderCredit:false recipes are not counted toward opening it (OD-TQ1D-2)", () => {
    const ctx = synContext(step({ garlic: 1 }));
    const dex = discoveredDex(W1_ORDER.slice(0, 1));
    const opens = (counts: (id: string) => boolean) => techniqueDexViews([], dex, { ...ctx, countsTowardLadder: counts }).length;
    expect(opens(() => true)).toBe(1);
    expect(opens(() => false)).toBe(0);
  });
});

describe("registration paths", () => {
  const sig = signatureOfPizza(pizzaOf("tray"));
  it("an original tray pizza records tray-bake only once the affordance is open (INV-TQ-6)", () => {
    const base = { ledger: [] as string[], signature: sig, completionPassed: true, matchedTarget: null };
    expect(registerTechniqueDiscovery({ ...base, isAffordanceOpen: () => false }).newlyDiscovered).toEqual([]);
    expect(registerTechniqueDiscovery({ ...base, isAffordanceOpen: (id) => id === "tray-bake" }).newlyDiscovered).toEqual(["tray-bake"]);
  });

  it("a recipe match on the tray records it even before the affordance (INV-TQ-1), once", () => {
    const first = registerTechniqueDiscovery({ ledger: [], signature: sig, completionPassed: true, matchedTarget: trayTarget(), isAffordanceOpen: () => false });
    expect(first.newlyDiscovered).toEqual(["tray-bake"]);
    const again = registerTechniqueDiscovery({ ledger: first.ledger, signature: sig, completionPassed: true, matchedTarget: trayTarget(), isAffordanceOpen: () => true });
    expect(again.newlyDiscovered).toEqual([]);
  });

  it("the round runtime discovers it from a finished tray pizza in Free Cooking when open, and not in Lunch Rush / Dinner", () => {
    const ctx = synContext(() => 0);
    const dex = discoveredDex(W1_ORDER.slice(0, 3));
    const run = (eligibility: "FREE_COOK" | "NONE") =>
      resolveRoundTechniques({ eligibility, ledger: [], signature: sig, completionPassed: true, dexBefore: dex, dexAfter: dex, context: ctx }).newlyDiscovered;
    expect(run("FREE_COOK")).toEqual(["tray-bake"]);
    expect(run("NONE")).toEqual([]);
  });

  it("a recipe in the Dex backfills the ledger at load (INV-TQ-1) via the declared pan", () => {
    const ctx = synContext(() => 0);
    expect(initialTechniqueLedger([], discoveredDex(["syn-tray"]), ctx)).toEqual(["tray-bake"]);
  });
});

describe("Dex 調理法 (O-6): riddle only after the affordance, name+description only after discovery", () => {
  const ctx = synContext((id) => ({ "olive-oil": 13, garlic: 14 })[id] ?? 0);
  it("closed -> nothing; open -> riddle without the name; discovered -> name + description", () => {
    const rows = (ledger: string[], n: number) => techniqueDexViews(ledger, discoveredDex(W1_ORDER.slice(0, n)), ctx).filter((v) => v.id === "tray-bake");
    expect(rows([], 13)).toEqual([]);
    expect(rows([], 14)).toEqual([{ id: "tray-bake", state: "RIDDLE", riddleJa: TRAY_BAKE_RIDDLE_JA }]);
    expect(JSON.stringify(rows([], 14))).not.toContain("天板焼き");
    expect(rows(["tray-bake"], 14)).toEqual([{ id: "tray-bake", state: "DISCOVERED", nameJa: "天板焼き", descriptionJa: TRAY_BAKE_DESCRIPTION_JA }]);
  });
});

describe("Anti-Oracle: nothing reaches the player while no recipe requires the pan", () => {
  it("production Dex views never carry tray-bake at any discovered count (inert while the allowlist is empty)", () => {
    if (PAN_REQUIRING_RECIPE_IDS.length > 0) return;
    for (let n = 0; n <= W1_ORDER.length; n++) {
      const dex = discoveredDex(W1_ORDER.slice(0, n));
      for (const ledger of [[], ["no-sauce"]]) {
        const text = JSON.stringify(techniqueDexViews(ledger, dex));
        expect(text, `n=${n}`).not.toMatch(/tray|天板|四つの角/);
      }
    }
  });

  const uiSources = import.meta.glob<string>(
    ["../../components/**/*.tsx", "../../screens/**/*.tsx", "../../*.css", "../../**/*.css", "../../data/changelog.ts", "!../../**/*.test.tsx", "!../../**/*.test.ts"],
    { query: "?raw", import: "default", eager: true },
  );
  it("no player-facing source (components, screens, CSS, Changelog) mentions the tray, its name or a pan class", () => {
    expect(Object.keys(uiSources).length).toBeGreaterThan(20);
    for (const [path, text] of Object.entries(uiSources)) expect(text, path).not.toMatch(/天板|tray-bake|四つの角|--tray|\.pan-|pan--|square-pan/i);
  });

  it("the hint / deduction / Research-row modules never read the pan axis (Hint 5.0 and DH4 stay pan-blind)", () => {
    const hint = import.meta.glob<string>(
      ["../discovery/deduction*.ts", "../discovery/hint5*.ts", "../discovery/researchResultRows.ts", "../discovery/hintTarget.ts", "!../discovery/**/*.test.ts", "!../discovery/testSupport/**"],
      { query: "?raw", import: "default", eager: true },
    );
    expect(Object.keys(hint).length).toBeGreaterThanOrEqual(5);
    for (const [path, text] of Object.entries(hint)) expect(text, path).not.toMatch(/dimensions\.pan|\.pan\b|"tray"/);
  });

  it("the copy constants appear only in the registry, never inlined elsewhere in non-test sources", () => {
    const all = import.meta.glob<string>(["../../**/*.ts", "../../**/*.tsx", "!../../**/*.test.ts", "!../../**/*.test.tsx", "!../../**/testSupport/**"], {
      query: "?raw",
      import: "default",
      eager: true,
    });
    for (const [path, text] of Object.entries(all)) {
      if (path.endsWith("data/techniques.ts")) continue;
      expect(text, path).not.toContain("四つの角まで生地を広げてみよう");
      expect(text, path).not.toContain("四隅まで伸ばして");
    }
  });
});
