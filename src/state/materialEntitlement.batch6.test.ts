import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { RECIPES } from "../data/recipes";
import { validateAppendOnlyExtension } from "../logic/discoveryLadder";
import type { DexEntry, DexState } from "./dex";
import { resolveShopEntitlement } from "./materialEntitlement";

/**
 * Batch 6 PR-2 (#420, OD-420-1): the production star gates -- goat-cheese = step 50 AND 120 cumulative
 * stars, spinach = step 51 AND 130. avocado / artichoke unlock on the Ladder alone. Boundary values,
 * retroactive existing saves, no re-lock, no star spending.
 */
const GATE_GOAT_CHEESE = 120;
const GATE_SPINACH = 130;

/** `count` discovered recipes whose BEST stars sum to exactly `totalStars` (each entry 0..5). */
function dexOf(count: number, totalStars: number): DexState {
  let left = totalStars;
  return Array.from({ length: count }, (_, i): DexEntry => {
    const stars = Math.min(5, left);
    left -= stars;
    return { recipeId: `r${i}`, discovered: true, bestScore: 0, bestStars: stars as DexEntry["bestStars"], timesMade: 1 };
  });
}

const resolve = (dex: DexState, unlocked: readonly string[] = []) =>
  resolveShopEntitlement(dex, [], unlocked, DISCOVERY_LADDER, () => true);

describe("Batch 6 PR-2 production star gates", () => {
  it("pins the two steps, their gates and key recipes", () => {
    const [s50, s51] = [DISCOVERY_LADDER.steps[49], DISCOVERY_LADDER.steps[50]];
    expect(s50).toEqual({ step: 50, kind: "MATERIAL", ingredientIds: ["avocado", "goat-cheese"], starGates: { "goat-cheese": GATE_GOAT_CHEESE }, keyRecipeId: "california-style-pizza" });
    expect(s51).toEqual({ step: 51, kind: "MATERIAL", ingredientIds: ["artichoke", "spinach"], starGates: { spinach: GATE_SPINACH }, keyRecipeId: "spinach-artichoke-pizza" });
    expect(DISCOVERY_LADDER.steps).toHaveLength(51);
  });

  it("keeps the frozen steps 1..49 byte-identical in meaning (append-only extension)", () => {
    const fixed49 = { ...DISCOVERY_LADDER, steps: DISCOVERY_LADDER.steps.slice(0, 49) };
    expect(validateAppendOnlyExtension(fixed49, DISCOVERY_LADDER)).toEqual([]);
    expect(DISCOVERY_LADDER.steps.slice(0, 49).some((s) => s.starGates)).toBe(false);
  });

  it("step 49 reached: neither Batch 6 material is available", () => {
    const ids = resolve(dexOf(49, 500)).unlockedForShopIngredientIds;
    for (const id of ["avocado", "goat-cheese", "artichoke", "spinach"]) expect(ids).not.toContain(id);
  });

  it("step 50 reached: avocado unlocks on the Ladder alone; goat-cheese needs 120 stars (119 locked / 120 unlocked)", () => {
    const low = resolve(dexOf(50, GATE_GOAT_CHEESE - 1)).unlockedForShopIngredientIds;
    expect(low).toContain("avocado");
    expect(low).not.toContain("goat-cheese");
    expect(resolve(dexOf(50, GATE_GOAT_CHEESE)).unlockedForShopIngredientIds).toContain("goat-cheese");
    expect(resolve(dexOf(50, GATE_GOAT_CHEESE)).unlockedForShopIngredientIds).not.toContain("artichoke");
  });

  it("step 51 reached: artichoke unlocks on the Ladder alone; spinach needs 130 stars (129 locked / 130 unlocked)", () => {
    const low = resolve(dexOf(51, GATE_SPINACH - 1)).unlockedForShopIngredientIds;
    expect(low).toContain("artichoke");
    expect(low).not.toContain("spinach");
    expect(low).toContain("goat-cheese"); // 129 >= 120
    expect(resolve(dexOf(51, GATE_SPINACH)).unlockedForShopIngredientIds).toContain("spinach");
  });

  it("stars alone never unlock before the step is reached", () => {
    const ids = resolve(dexOf(49, 245)).unlockedForShopIngredientIds;
    expect(ids).not.toContain("goat-cheese");
    expect(ids).not.toContain("spinach");
  });

  it("an existing save that already satisfies a gate unlocks retroactively, exactly once, and never re-locks", () => {
    const first = resolve(dexOf(53, 200));
    for (const id of ["avocado", "goat-cheese", "artichoke", "spinach"]) expect(first.unlockedForShopIngredientIds).toContain(id);
    expect(first.newlyUnlockedMaterialIds).toEqual(expect.arrayContaining(["avocado", "goat-cheese", "artichoke", "spinach"]));
    const again = resolve(dexOf(53, 200), first.unlockedForShopIngredientIds);
    expect(again.newlyUnlockedMaterialIds).toEqual([]);
    const lowered = resolve(dexOf(53, 10), first.unlockedForShopIngredientIds);
    expect(lowered.unlockedForShopIngredientIds).toEqual(first.unlockedForShopIngredientIds);
  });

  it("does not spend stars", () => {
    const dex = dexOf(51, 200);
    const before = dex.map((e) => e.bestStars);
    resolve(dex);
    expect(dex.map((e) => e.bestStars)).toEqual(before);
  });

  it("both new recipes need the star-gated material, so each is only makeable once the gate is met", () => {
    const needs = (id: string) => RECIPES.find((r) => r.id === id)!.requiredIngredients.map((q) => q.ingredientId);
    expect(needs("california-style-pizza")).toContain("goat-cheese");
    expect(needs("spinach-artichoke-pizza")).toContain("spinach");
  });
});
