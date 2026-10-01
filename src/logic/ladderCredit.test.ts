import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { RECIPES, countsTowardLadder } from "../data/recipes";
import { resolveShopEntitlement } from "../state/materialEntitlement";
import type { DexEntry, DexState } from "../state/dex";
import { discoveredRecipeCount, reachedStepNumber } from "./discoveryLadder";
import { nextMaterialHint } from "./materialShop";

/** Discovery 3.0 PR-2 (OD-D3-17 O3): a recipe can opt out of the ladder count with
 *  `ladderCredit: false`. No production recipe does, so every existing behaviour must be identical. */

const NON_CREDIT_ID = "synthetic-non-credit";
const counts = (id: string) => id !== NON_CREDIT_ID;

function entry(recipeId: string, discovered = true): DexEntry {
  return { recipeId, discovered, bestScore: discovered ? 80 : 0, bestStars: 4, timesMade: discovered ? 1 : 0 };
}
const dexOf = (ids: readonly string[]): DexState => ids.map((id) => entry(id));
const ALL_IDS = RECIPES.map((r) => r.id);

describe("countsTowardLadder (existing 25 parity)", () => {
  it("has the 25 shipped recipes, none opting out", () => {
    expect(RECIPES).toHaveLength(25);
    for (const r of RECIPES) {
      expect("ladderCredit" in r).toBe(false);
      expect(countsTowardLadder(r.id)).toBe(true);
    }
  });

  it("counts an id that is not in RECIPES (old / unknown save ids)", () => {
    expect(countsTowardLadder("not-a-recipe")).toBe(true);
  });

  it("gives the same count as the unparameterised call for every prefix of the 25", () => {
    for (let n = 0; n <= ALL_IDS.length; n++) {
      const dex = dexOf(ALL_IDS.slice(0, n));
      expect(discoveredRecipeCount(dex, countsTowardLadder)).toBe(discoveredRecipeCount(dex));
      expect(discoveredRecipeCount(dex, countsTowardLadder)).toBe(n);
    }
  });

  it("keeps duplicate, undiscovered and unknown-id entries exactly as before", () => {
    const dex: DexState = [entry("margherita"), entry("margherita"), entry("funghi", false), entry("ghost-id")];
    expect(discoveredRecipeCount(dex, countsTowardLadder)).toBe(discoveredRecipeCount(dex));
    expect(discoveredRecipeCount(dex, countsTowardLadder)).toBe(2);
  });
});

describe("synthetic non-credit recipe", () => {
  it("is not counted toward the ladder, however often it is discovered", () => {
    const base = dexOf(ALL_IDS.slice(0, 7));
    const withNonCredit: DexState = [...base, entry(NON_CREDIT_ID), entry(NON_CREDIT_ID)];
    expect(discoveredRecipeCount(base, counts)).toBe(7);
    expect(discoveredRecipeCount(withNonCredit, counts)).toBe(7);
    expect(reachedStepNumber(DISCOVERY_LADDER, discoveredRecipeCount(withNonCredit, counts))).toBe(
      reachedStepNumber(DISCOVERY_LADDER, discoveredRecipeCount(base, counts)),
    );
  });

  it("does not stop credited recipes from counting", () => {
    const dex: DexState = [entry(NON_CREDIT_ID), entry("margherita")];
    expect(discoveredRecipeCount(dex, counts)).toBe(1);
  });

  it("leaves the Shop entitlement and next-material hint unchanged (pool stays at the same step)", () => {
    const base = dexOf(ALL_IDS.slice(0, 11));
    const withNonCredit: DexState = [...base, entry(NON_CREDIT_ID)];
    const a = resolveShopEntitlement(base, [], [], DISCOVERY_LADDER, counts);
    const b = resolveShopEntitlement(withNonCredit, [], [], DISCOVERY_LADDER, counts);
    expect(b.unlockedForShopIngredientIds).toEqual(a.unlockedForShopIngredientIds);
    expect(b.newlyUnlockedMaterialIds).toEqual(a.newlyUnlockedMaterialIds);
    expect(nextMaterialHint(discoveredRecipeCount(withNonCredit, counts), a.unlockedForShopIngredientIds)).toEqual(
      nextMaterialHint(discoveredRecipeCount(base, counts), a.unlockedForShopIngredientIds),
    );
    // Without the opt-out the same Dex WOULD advance (guards against a vacuous test).
    const advanced = resolveShopEntitlement(withNonCredit, [], [], DISCOVERY_LADDER, () => true);
    expect(discoveredRecipeCount(withNonCredit)).toBe(12);
    expect(advanced.unlockedForShopIngredientIds.length).toBeGreaterThanOrEqual(a.unlockedForShopIngredientIds.length);
  });
});

describe("entitlement progression / save compatibility", () => {
  it("default predicate (countsTowardLadder) equals the legacy result at every count of the 25", () => {
    let ledger: readonly string[] = [];
    for (let n = 0; n <= ALL_IDS.length; n++) {
      const dex = dexOf(ALL_IDS.slice(0, n));
      const legacy = resolveShopEntitlement(dex, [], ledger, DISCOVERY_LADDER, () => true);
      const current = resolveShopEntitlement(dex, [], ledger);
      expect(current).toEqual(legacy);
      ledger = current.unlockedForShopIngredientIds;
    }
  });

  it("never shrinks an existing ledger (no re-lock) even when a non-credit discovery is present", () => {
    const dex = dexOf(ALL_IDS.slice(0, 5));
    const ledger = resolveShopEntitlement(dex, [], []).unlockedForShopIngredientIds;
    const again = resolveShopEntitlement([...dex, entry(NON_CREDIT_ID)], [], ledger, DISCOVERY_LADDER, counts);
    for (const id of ledger) expect(again.unlockedForShopIngredientIds).toContain(id);
    expect(again.newlyUnlockedMaterialIds).toEqual([]);
  });

  it("an old save whose Dex holds an id unknown to RECIPES keeps counting it", () => {
    const dex: DexState = [...dexOf(ALL_IDS.slice(0, 3)), entry("retired-recipe-id")];
    expect(discoveredRecipeCount(dex, countsTowardLadder)).toBe(4);
  });
});
