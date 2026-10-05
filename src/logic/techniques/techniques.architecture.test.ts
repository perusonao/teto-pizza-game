import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { evaluateDiscovery, type RecipeDiscoveryTarget } from "../discovery/matcher";
import { DEFAULT_IDENTITY_DIMENSIONS, signatureOfPizza } from "../discovery/signature";
import { registerTechniqueDiscovery } from "./registration";

/**
 * Cooking Techniques 1.0 TQ-1A (Issue #262): the architecture invariants.
 *
 * INV-TQ-NB (no blocking): Recipe Discovery never depends on techniques. The recipe matcher and
 * everything it reads must not import the technique modules or read the technique ledger, so
 * "a technique must be discovered before a recipe can be" is impossible by construction.
 * INV-TQ-3: scoring, Pitz, stars and the Dex never read techniques either (OD-TQ-7).
 */

const raw = (sources: Record<string, string>) => Object.entries(sources);
const TECHNIQUE_REFERENCE = /techniques|discoveredTechniqueIds|TechniqueId/;

describe("architecture: the recipe matcher never reads techniques (INV-TQ-NB)", () => {
  const matcherSide = import.meta.glob<string>(
    [
      "../discovery/**/*.ts",
      "!../discovery/**/*.test.ts",
      "../../data/discoveryCatalog.ts",
      "../../data/recipes.ts",
      "../completionGate.ts",
      "../../state/discoveryRegistration.ts",
    ],
    { query: "?raw", import: "default", eager: true },
  );

  it("covers the matcher, signature, free-cook resolver, catalog and discovery registration", () => {
    const paths = Object.keys(matcherSide);
    for (const needle of ["discovery/matcher.ts", "discovery/signature.ts", "discovery/freeCook.ts", "data/discoveryCatalog.ts", "state/discoveryRegistration.ts"]) {
      expect(paths.some((p) => p.endsWith(needle)), needle).toBe(true);
    }
  });

  it("none of them imports a technique module or mentions the technique ledger", () => {
    for (const [path, source] of raw(matcherSide)) expect(TECHNIQUE_REFERENCE.test(source), path).toBe(false);
  });

  it("the matcher's inputs are (signature, catalog, discovered ids[, options]) -- there is no technique parameter", () => {
    expect(evaluateDiscovery.length).toBeLessThanOrEqual(4);
  });
});

describe("architecture: scoring, Pitz, stars and the Dex never read techniques (INV-TQ-3)", () => {
  const rewardSide = import.meta.glob<string>(
    ["../scoringV2/**/*.ts", "!../scoringV2/**/*.test.ts", "../pitzReward.ts", "../scoring.ts", "../mastery.ts", "../../state/dex.ts"],
    { query: "?raw", import: "default", eager: true },
  );

  it("none of them mentions a technique", () => {
    expect(Object.keys(rewardSide).length).toBeGreaterThan(5);
    for (const [path, source] of raw(rewardSide)) expect(TECHNIQUE_REFERENCE.test(source), path).toBe(false);
  });
});

describe("INV-TQ-NB: a recipe is discoverable while its technique is undiscovered", () => {
  function pizza(sauceIds: readonly string[], pieces: readonly string[]): PizzaState {
    return { ...createEmptyPizza(), sauceIds: [...sauceIds], toppings: pieces.map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i, y: 50 })) };
  }

  const SYN_NO_SAUCE: RecipeDiscoveryTarget = {
    targetId: "syn:aussie-shape",
    recipeId: "syn-aussie" as RecipeDiscoveryTarget["recipeId"],
    // A subset of the real aussie (TQ-1D), so it collides with no production recipe.
    items: ["egg", "mozzarella", "onion"],
    sauceBase: [],
    capabilities: [],
    identityDimensions: DEFAULT_IDENTITY_DIMENSIONS,
    eligibility: { status: "ELIGIBLE" },
  };
  const CATALOG = [...RECIPE_DISCOVERY_CATALOG, SYN_NO_SAUCE];

  it("a synthetic no-sauce target is a NEW_DISCOVERY with an empty technique ledger", () => {
    const sig = signatureOfPizza(pizza([], ["onion", "mozzarella", "egg"]));
    expect(evaluateDiscovery(sig, CATALOG, [])).toEqual({ kind: "NEW_DISCOVERY", recipeId: "syn-aussie", targetId: "syn:aussie-shape" });
  });

  it("registering techniques under any ledger never changes a recipe outcome, for every target", () => {
    const ledgers: string[][] = [[], ["no-sauce"], ["no-sauce", "future-x"], ["future-x"]];
    for (const target of CATALOG) {
      const sauces = target.sauceBase ?? [];
      const sig = signatureOfPizza(pizza(sauces, target.items.filter((i) => !sauces.includes(i))));
      const before = evaluateDiscovery(sig, CATALOG, []);
      for (const ledger of ledgers) {
        registerTechniqueDiscovery({ ledger, signature: sig, completionPassed: true, matchedTarget: target, isAffordanceOpen: () => ledger.length % 2 === 0 });
        expect(evaluateDiscovery(sig, CATALOG, []), `${target.targetId} / ${ledger.join(",")}`).toEqual(before);
      }
      expect(before.kind === "NEW_DISCOVERY" || before.kind === "AMBIGUOUS", target.targetId).toBe(true);
    }
  });
});
