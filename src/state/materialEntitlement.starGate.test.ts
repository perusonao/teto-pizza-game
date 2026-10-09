import { describe, expect, it } from "vitest";
import type { DiscoveryLadder } from "../data/discoveryLadder";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { appendLadderSteps, ladderUnlockedMaterialIds, validateAppendOnlyExtension, validateDiscoveryLadder } from "../logic/discoveryLadder";
import type { DexEntry, DexState } from "./dex";
import { resolveShopEntitlement } from "./materialEntitlement";

/**
 * Batch 6 PR-1 (#420, OD-420-1): per-ingredient accumulated-star gate on a ladder step. Uses a
 * synthetic ladder -- no production step carries a gate yet (PR-1 is the foundation only).
 */
const LADDER: DiscoveryLadder = {
  populationId: "star-gate-test",
  steps: [
    { step: 1, kind: "MATERIAL", ingredientIds: ["egg"], keyRecipeId: "a" },
    { step: 2, kind: "MATERIAL", ingredientIds: ["avocado", "goat-cheese"], starGates: { "goat-cheese": 10 }, keyRecipeId: "b" },
  ],
};

function dexOf(...stars: number[]): DexState {
  return stars.map(
    (s, i): DexEntry => ({
      recipeId: `r${i}`,
      discovered: true,
      bestScore: 0,
      bestStars: s as DexEntry["bestStars"],
      timesMade: 1,
    }),
  );
}

const resolve = (dex: DexState, unlocked: readonly string[] = []) =>
  resolveShopEntitlement(dex, [], unlocked, LADDER, () => true);

describe("starGate (Batch 6 PR-1)", () => {
  it("keeps a gated ingredient locked at the step until the cumulative stars reach the gate", () => {
    const r = resolve(dexOf(1, 1)); // step 2 reached, 2 stars
    expect(r.unlockedForShopIngredientIds).toEqual(["egg", "avocado"]);
    expect(r.newlyUnlockedMaterialIds).not.toContain("goat-cheese");
  });

  it("does not unlock on stars alone when the step is not reached", () => {
    expect(resolve(dexOf(5)).unlockedForShopIngredientIds).toEqual(["egg"]); // 1 discovery, 5 stars
  });

  it("unlocks exactly at the gate (>=), including retroactively for an existing save", () => {
    expect(resolve(dexOf(5, 4)).unlockedForShopIngredientIds).toEqual(["egg", "avocado"]); // 9
    expect(resolve(dexOf(5, 5)).unlockedForShopIngredientIds).toEqual(["egg", "avocado", "goat-cheese"]); // 10
  });

  it("is idempotent and never re-locks when stars drop or the ledger is fed back", () => {
    const first = resolve(dexOf(5, 5));
    const again = resolve(dexOf(5, 5), first.unlockedForShopIngredientIds);
    expect(again.unlockedForShopIngredientIds).toBe(first.unlockedForShopIngredientIds);
    expect(again.newlyUnlockedMaterialIds).toEqual([]);
    const lowered = resolve(dexOf(1, 1), first.unlockedForShopIngredientIds);
    expect(lowered.unlockedForShopIngredientIds).toEqual(first.unlockedForShopIngredientIds);
  });

  it("reports the star-gated unlock as newly unlocked exactly once", () => {
    const early = resolve(dexOf(1, 1));
    const later = resolve(dexOf(5, 5), early.unlockedForShopIngredientIds);
    expect(later.newlyUnlockedMaterialIds).toEqual(["goat-cheese"]);
  });

  it("does not spend stars (the derived total is unchanged by resolving)", () => {
    const dex = dexOf(5, 5);
    resolve(dex);
    expect(dex.map((e) => e.bestStars)).toEqual([5, 5]);
  });

  it("treats non-finite or negative totals as 0 and defaults to locked", () => {
    expect(ladderUnlockedMaterialIds(LADDER, 2)).toEqual(["egg", "avocado"]);
    expect(ladderUnlockedMaterialIds(LADDER, 2, Number.NaN)).toEqual(["egg", "avocado"]);
    expect(ladderUnlockedMaterialIds(LADDER, 2, -3)).toEqual(["egg", "avocado"]);
    expect(ladderUnlockedMaterialIds(LADDER, 2, Infinity)).toEqual(["egg", "avocado"]);
    expect(ladderUnlockedMaterialIds(LADDER, 2, 10)).toEqual(["egg", "avocado", "goat-cheese"]);
  });

  it("gates only the two Batch 6 materials in production (OD-420-1) and validates gate shape", () => {
    expect(DISCOVERY_LADDER.steps.filter((s) => s.starGates).map((s) => s.step)).toEqual([50, 51]);
    expect(validateDiscoveryLadder(LADDER)).toEqual([]);
    const bad: DiscoveryLadder = {
      populationId: "bad",
      steps: [{ step: 1, kind: "MATERIAL", ingredientIds: ["egg"], starGates: { ham: 5, egg: 0 }, keyRecipeId: "a" }],
    };
    expect(validateDiscoveryLadder(bad)).toHaveLength(2);
  });

  it("carries star gates through appended steps and compares them as part of a fixed step", () => {
    const base: DiscoveryLadder = { populationId: "b", steps: [LADDER.steps[0]] };
    const appended = appendLadderSteps(base, [
      { ingredientIds: ["avocado", "goat-cheese"], starGates: { "goat-cheese": 10 }, keyRecipeId: "b" },
    ]);
    expect(appended.steps[1].starGates).toEqual({ "goat-cheese": 10 });
    expect(ladderUnlockedMaterialIds(appended, 2, 0)).toEqual(["egg", "avocado"]);
    expect(validateAppendOnlyExtension(LADDER, appended)).toEqual([]);

    const changed: DiscoveryLadder = {
      ...LADDER,
      steps: [LADDER.steps[0], { ...LADDER.steps[1], starGates: { "goat-cheese": 11 } }],
    };
    const removed: DiscoveryLadder = { ...LADDER, steps: [LADDER.steps[0], { ...LADDER.steps[1], starGates: undefined }] };
    expect(validateAppendOnlyExtension(LADDER, changed)).toEqual(["FIXED_STEP_CHANGED: step 2"]);
    expect(validateAppendOnlyExtension(LADDER, removed)).toEqual(["FIXED_STEP_CHANGED: step 2"]);
  });
});
