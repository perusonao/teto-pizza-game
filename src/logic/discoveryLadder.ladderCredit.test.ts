import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { RECIPES, countsTowardLadder, type Recipe } from "../data/recipes";
import { resolveShopEntitlement } from "../state/materialEntitlement";
import { EMPTY_DEX, type DexEntry, type DexState } from "../state/dex";
import { discoveredRecipeCount, reachedStepNumber } from "./discoveryLadder";
import { W1_ORDER } from "./testSupport/branchingFixture";

// Discovery 3.0 PR-2 (OD-D3-17 O3): per-recipe W1 ladder credit.

const SYNTHETIC_ID = "synthetic-non-credit";
const SYNTHETIC = { id: SYNTHETIC_ID as Recipe["id"], ladderCredit: false } as const;
const WITH_SYNTHETIC = [...RECIPES, SYNTHETIC] as readonly Pick<Recipe, "id" | "ladderCredit">[];
const syntheticCounts = (id: string) => countsTowardLadder(id, WITH_SYNTHETIC);

function entry(recipeId: string, discovered = true): DexEntry {
  return { recipeId, discovered, bestScore: 0, bestStars: 1, timesMade: 1 };
}

/** The pre-O3 definition, kept verbatim as the oracle for the equivalence tests. */
function legacyCount(dex: DexState): number {
  return new Set(dex.filter((e) => e.discovered).map((e) => e.recipeId)).size;
}

// The 25 W1 recipes are the ones the ladder authority names; a production recipe added later may
// opt out (`ladderCredit: false`) without touching these.
const W1_IDS = new Set(W1_ORDER);
const W1_RECIPES_ONLY = RECIPES.filter((r) => W1_IDS.has(r.id));

describe("A. existing recipes are unchanged", () => {
  it("no existing W1 recipe sets ladderCredit", () => {
    expect(W1_RECIPES_ONLY).toHaveLength(25);
    for (const r of W1_RECIPES_ONLY) expect("ladderCredit" in r).toBe(false);
  });

  it("every existing W1 recipe counts toward the ladder", () => {
    for (const r of W1_RECIPES_ONLY) expect(countsTowardLadder(r.id)).toBe(true);
  });

  it("count equals the legacy count for every prefix of the existing W1 recipes", () => {
    for (let n = 0; n <= W1_RECIPES_ONLY.length; n++) {
      const dex = W1_RECIPES_ONLY.slice(0, n).map((r) => entry(r.id));
      expect(discoveredRecipeCount(dex, countsTowardLadder)).toBe(legacyCount(dex));
      expect(discoveredRecipeCount(dex)).toBe(legacyCount(dex));
    }
  });

  it("an unknown / legacy id still counts (old saves)", () => {
    const dex = [entry("some-removed-recipe"), entry("margherita"), entry("x", false)];
    expect(countsTowardLadder("some-removed-recipe")).toBe(true);
    expect(discoveredRecipeCount(dex, countsTowardLadder)).toBe(legacyCount(dex));
  });

  it("the ladder definition is untouched (step count and step numbering)", () => {
    expect(DISCOVERY_LADDER.steps.map((s) => s.step)).toEqual(
      DISCOVERY_LADDER.steps.map((_, i) => i + 1),
    );
  });
});

describe("B. a non-credit recipe does not advance the count", () => {
  it("countsTowardLadder is false only for the explicit opt-out", () => {
    expect(syntheticCounts(SYNTHETIC_ID)).toBe(false);
    expect(syntheticCounts("margherita")).toBe(true);
  });

  it("discovering it leaves the count and reached step unchanged", () => {
    const base = RECIPES.slice(0, 5).map((r) => entry(r.id));
    const withSynthetic = [...base, entry(SYNTHETIC_ID)];
    const before = discoveredRecipeCount(base, syntheticCounts);
    expect(discoveredRecipeCount(withSynthetic, syntheticCounts)).toBe(before);
    expect(reachedStepNumber(DISCOVERY_LADDER, discoveredRecipeCount(withSynthetic, syntheticCounts))).toBe(
      reachedStepNumber(DISCOVERY_LADDER, before),
    );
  });

  it("a Dex holding only the non-credit recipe counts 0", () => {
    expect(discoveredRecipeCount([entry(SYNTHETIC_ID)], syntheticCounts)).toBe(0);
  });
});

describe("C. save compatibility", () => {
  it("count is derived from the Dex alone: the Dex entry shape has no ladder field", () => {
    const e = entry("margherita");
    expect(Object.keys(e).sort()).toEqual(
      ["bestScore", "bestStars", "discovered", "recipeId", "timesMade"].sort(),
    );
  });

  it("an old-format Dex gives the same count with and without the predicate", () => {
    const dex = W1_RECIPES_ONLY.map((r) => entry(r.id));
    expect(discoveredRecipeCount(dex, countsTowardLadder)).toBe(W1_RECIPES_ONLY.length);
    expect(discoveredRecipeCount(EMPTY_DEX, countsTowardLadder)).toBe(0);
  });
});

describe("D. entitlement: a non-credit discovery does not unlock the next material early", () => {
  const base = RECIPES.slice(0, 3).map((r) => entry(r.id));
  const withSynthetic = [...base, entry(SYNTHETIC_ID)];

  it("resolveShopEntitlement is identical with and without the non-credit discovery", () => {
    const a = resolveShopEntitlement(base, [], [], DISCOVERY_LADDER, syntheticCounts);
    const b = resolveShopEntitlement(withSynthetic, [], [], DISCOVERY_LADDER, syntheticCounts);
    expect(b).toEqual(a);
  });

  it("without the opt-out the same extra discovery WOULD unlock earlier (the guard bites)", () => {
    const a = resolveShopEntitlement(base, [], [], DISCOVERY_LADDER, () => true);
    const b = resolveShopEntitlement(withSynthetic, [], [], DISCOVERY_LADDER, () => true);
    expect(b.unlockedForShopIngredientIds.length).toBeGreaterThan(a.unlockedForShopIngredientIds.length);
  });

  it("the default entitlement for production Dexes is unchanged", () => {
    const dex = RECIPES.slice(0, 7).map((r) => entry(r.id));
    expect(resolveShopEntitlement(dex, [], [])).toEqual(
      resolveShopEntitlement(dex, [], [], DISCOVERY_LADDER, () => true),
    );
  });
});
