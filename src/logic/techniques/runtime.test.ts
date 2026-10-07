import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import type { DexEntry, DexState } from "../../state/dex";
import { discoveryRevealOrder } from "../../state/discoveryReveal";
import {
  initialTechniqueLedger,
  productionTechniqueContext,
  resolveRoundTechniques,
  techniqueRoundEligibility,
  type RoundTechniqueInput,
  type TechniqueRuntimeContext,
} from "./runtime";
import { noSauceRecipeIds } from "../../data/recipeSauceProfiles";

/**
 * Cooking Techniques 1.0 TQ-1C (Issue #287): the pure per-round technique step
 * (docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md P4 / P5 / P8 / P10; gate §8 T5, T10, T16, T19).
 */

const dex = (ids: readonly string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));

const noSauceSignature = {
  ingredientSet: { status: "OBSERVED" as const, value: ["basil", "mozzarella"] },
  sauceBase: { status: "OBSERVED" as const, value: [] as string[] },
};
const tomatoSignature = {
  ingredientSet: { status: "OBSERVED" as const, value: ["basil", "mozzarella", "tomato-sauce"] },
  sauceBase: { status: "OBSERVED" as const, value: ["tomato-sauce"] },
};

/** Affordance open at step 0 (a starters-only no-sauce target); `syn-aussie` requires NO_SAUCE. */
const OPEN: TechniqueRuntimeContext = {
  catalog: [{ recipeId: "syn-aussie", items: ["basil", "mozzarella"], sauceBase: [] }],
  materialStep: () => 0,
};

function input(overrides: Partial<RoundTechniqueInput>): RoundTechniqueInput {
  return {
    eligibility: "FREE_COOK",
    ledger: [],
    signature: noSauceSignature,
    completionPassed: true,
    dexBefore: [],
    dexAfter: [],
    context: OPEN,
    ...overrides,
  };
}

describe("techniqueRoundEligibility (OD-TQ1C-3)", () => {
  it("Free Cooking uses both paths, a guided FREE round the recipe path, Lunch Rush and Dinner none", () => {
    expect(techniqueRoundEligibility({ isMissionRound: false, isDinnerRound: false, freeCook: true })).toBe("FREE_COOK");
    expect(techniqueRoundEligibility({ isMissionRound: false, isDinnerRound: false, freeCook: false })).toBe("FREE_GUIDED");
    expect(techniqueRoundEligibility({ isMissionRound: true, isDinnerRound: false, freeCook: false })).toBe("NONE");
    expect(techniqueRoundEligibility({ isMissionRound: false, isDinnerRound: true, freeCook: false })).toBe("NONE");
    // A malformed round claiming both Free Cooking and a mission is still NONE (fail closed).
    expect(techniqueRoundEligibility({ isMissionRound: true, isDinnerRound: true, freeCook: true })).toBe("NONE");
  });
});

describe("resolveRoundTechniques", () => {
  it("usage path: Free Cooking + open affordance + used technique -> discovered", () => {
    expect(resolveRoundTechniques(input({}))).toEqual({ ledger: ["no-sauce"], newlyDiscovered: ["no-sauce"] });
  });

  it("usage path is off in a guided FREE round and on a non-PASS pizza; NONE records nothing at all", () => {
    expect(resolveRoundTechniques(input({ eligibility: "FREE_GUIDED" })).newlyDiscovered).toEqual([]);
    expect(resolveRoundTechniques(input({ completionPassed: false })).newlyDiscovered).toEqual([]);
    expect(resolveRoundTechniques(input({ eligibility: "NONE", dexAfter: dex(["syn-aussie"]) }))).toEqual({ ledger: [], newlyDiscovered: [] });
  });

  it("the recipe path follows the Dex this transition wrote, whatever the completion (INV-TQ-1)", () => {
    const result = resolveRoundTechniques(input({ completionPassed: false, signature: tomatoSignature, dexAfter: dex(["syn-aussie"]) }));
    expect(result).toEqual({ ledger: ["no-sauce"], newlyDiscovered: ["no-sauce"] });
  });

  it("a pizza that used a sauce never triggers the usage path", () => {
    expect(resolveRoundTechniques(input({ signature: tomatoSignature })).newlyDiscovered).toEqual([]);
  });

  it("recipe path: a discovered requiring recipe records its technique in FREE_COOK and FREE_GUIDED, affordance closed or not", () => {
    const closed = { ...OPEN, materialStep: () => null };
    for (const eligibility of ["FREE_COOK", "FREE_GUIDED"] as const) {
      const result = resolveRoundTechniques(
        input({ eligibility, signature: tomatoSignature, dexAfter: dex(["syn-aussie"]), context: closed }),
      );
      expect(result, eligibility).toEqual({ ledger: ["no-sauce"], newlyDiscovered: ["no-sauce"] });
    }
  });

  it("the affordance reads the Dex *before* the round (a step-1 affordance is still closed on the first discovery)", () => {
    const stepOne = { ...OPEN, materialStep: () => 1 };
    expect(resolveRoundTechniques(input({ context: stepOne, dexBefore: [], dexAfter: dex(["margherita"]) })).newlyDiscovered).toEqual([]);
    expect(resolveRoundTechniques(input({ context: stepOne, dexBefore: dex(["margherita"]) })).newlyDiscovered).toEqual(["no-sauce"]);
  });

  it("exactly once: a technique already in the ledger is not reported again; unknown ids never reach the ledger", () => {
    expect(resolveRoundTechniques(input({ ledger: ["no-sauce"] }))).toEqual({ ledger: ["no-sauce"], newlyDiscovered: [] });
    const withUnknown = resolveRoundTechniques(input({ ledger: ["future-x" as never] }));
    expect(withUnknown).toEqual({ ledger: ["no-sauce"], newlyDiscovered: ["no-sauce"] });
  });

  it("T16 / INV-TQ-4 (TQ-1D): with the production context only the NO_SAUCE recipes' no-sauce is recorded (aussie shown; the set is derived from the sauce-profile authority), and only by their own paths", () => {
    const production = productionTechniqueContext();
    expect(production.catalog).toBe(RECIPE_DISCOVERY_CATALOG);
    const others = RECIPE_DISCOVERY_CATALOG.filter((t) => !(noSauceRecipeIds() as readonly string[]).includes(t.recipeId)).map((t) => t.recipeId);
    const withoutAussie = dex(others);
    const withAussie = dex([...others, "aussie"]);
    for (const eligibility of ["FREE_COOK", "FREE_GUIDED"] as const) {
      // A sauced pizza that matched no aussie never records it.
      expect(resolveRoundTechniques(input({ eligibility, signature: tomatoSignature, context: production, dexBefore: withoutAussie, dexAfter: withoutAussie }))).toEqual({
        ledger: [],
        newlyDiscovered: [],
      });
      // The recipe path: aussie newly in the Dex records it in every FREE round (INV-TQ-1).
      expect(resolveRoundTechniques(input({ eligibility, signature: tomatoSignature, context: production, dexBefore: withoutAussie, dexAfter: withAussie }))).toEqual({
        ledger: ["no-sauce"],
        newlyDiscovered: ["no-sauce"],
      });
    }
    // The usage path: Free Cooking only, and only once the affordance (credited discoveries >= step 12) is open.
    const base = { eligibility: "FREE_COOK" as const, signature: noSauceSignature, context: production };
    const credited = (n: number) => dex(others.slice(0, n));
    expect(resolveRoundTechniques(input({ ...base, dexBefore: credited(11), dexAfter: credited(11) }))).toEqual({ ledger: [], newlyDiscovered: [] });
    expect(resolveRoundTechniques(input({ ...base, dexBefore: credited(12), dexAfter: credited(12) }))).toEqual({ ledger: ["no-sauce"], newlyDiscovered: ["no-sauce"] });
    expect(resolveRoundTechniques(input({ ...base, eligibility: "FREE_GUIDED", dexBefore: credited(12), dexAfter: credited(12) }))).toEqual({ ledger: [], newlyDiscovered: [] });
  });
});

describe("T19: initialTechniqueLedger (INV-TQ-1 at load)", () => {
  it("repairs a save whose discovered recipe requires a missing technique, keeps known ids, drops unknown ones", () => {
    expect(initialTechniqueLedger([], dex(["syn-aussie"]), OPEN)).toEqual(["no-sauce"]);
    expect(initialTechniqueLedger(["no-sauce", "future-x"], [], OPEN)).toEqual(["no-sauce"]);
    expect(initialTechniqueLedger([], [], OPEN)).toEqual([]);
  });

  it("is a no-op for every production save without aussie; a save with aussie is backfilled (INV-TQ-1)", () => {
    const others = dex(RECIPE_DISCOVERY_CATALOG.filter((t) => !(noSauceRecipeIds() as readonly string[]).includes(t.recipeId)).map((t) => t.recipeId));
    expect(initialTechniqueLedger([], others)).toEqual([]);
    expect(initialTechniqueLedger(["no-sauce"], others)).toEqual(["no-sauce"]);
    const everything = dex(RECIPE_DISCOVERY_CATALOG.map((t) => t.recipeId));
    expect(initialTechniqueLedger([], everything)).toEqual(["no-sauce"]);
    expect(initialTechniqueLedger(["no-sauce"], everything)).toEqual(["no-sauce"]);
  });
});

describe("T5: discoveryRevealOrder (SSOT P5: Technique -> Recipe)", () => {
  const base = { lastTechniqueDiscovery: null, lastDiscovery: null, justDiscovered: false } as const;
  it("orders the technique stage before the recipe stage", () => {
    expect(
      discoveryRevealOrder({ ...base, lastTechniqueDiscovery: ["no-sauce"], lastDiscovery: { kind: "NEW_DISCOVERY", recipeId: "margherita", targetId: "t" } }),
    ).toEqual(["TECHNIQUE", "RECIPE"]);
    expect(discoveryRevealOrder({ ...base, lastTechniqueDiscovery: ["no-sauce"] })).toEqual(["TECHNIQUE"]);
    expect(discoveryRevealOrder({ ...base, justDiscovered: true })).toEqual(["RECIPE"]);
    expect(discoveryRevealOrder({ ...base, lastTechniqueDiscovery: [] })).toEqual([]);
    expect(discoveryRevealOrder(base)).toEqual([]);
  });
});
