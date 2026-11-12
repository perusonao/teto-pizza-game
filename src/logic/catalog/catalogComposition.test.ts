import { describe, expect, it } from "vitest";
import { ingredientAttributeFamily } from "../../data/ingredientTaxonomy";
import { INGREDIENTS } from "../../data/ingredients";
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { LATE_ENTITLEMENT_FLOORS } from "../../data/lateCatalog";
import { pinsaEnabled } from "../../data/pinsaGate";
import { RECIPES, participatesInLunchRush } from "../../data/recipes";
import { buildRecipeChapters } from "../../state/recipeChapters";
import { ordinaryLadderSteps } from "./testSupport/lateIds";
import { FROZEN, LANDED, composeCatalog, composedFor } from "./testSupport/composedCatalog";

/**
 * R-1: THE one place that compares the shipped catalog to its composition  FROZEN BASELINE (+) landed train specs  with exact equality.
 * It replaces the per-train edit of `catalogLedger.test.ts` and of the "N steps / step K / floors { ... } / the 9th from the end" pins of the historical batch tests.
 *
 * Why this still catches a regression: the expectation is not read from the code under test. The baseline is history (one commit, committed JSON) and the landed
 * specs are the Owner-approved descriptions of what each train adds. Dropping a recipe, reordering the ladder, changing a floor, moving a family, adding an
 * unapproved material or shifting a late step all make the implementation differ from the composition and fail here (mutation evidence:
 * docs/reports/data/TETO_TRAIN-KIT-R1/mutation.result.json). A train that lands through `apply` adds its landed spec in the same PR, so this test needs no edit.
 */
const composed = composedFor(pinsaEnabled());

describe("the shipped catalog equals FROZEN BASELINE (+) the landed train specs", () => {
  it("the landing order is a strict 1..n sequence and every landed spec is complete", () => {
    expect(LANDED.map((t) => t.seq)).toEqual(LANDED.map((_, i) => i + 1));
    for (const t of LANDED) expect(t.recipes.length, t.tag).toBeGreaterThan(0);
    expect(FROZEN.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("recipes: the same ids, and the same credited ones", () => {
    expect([...RECIPES.map((r) => r.id as string)].sort()).toEqual([...composed.recipeIds].sort());
    expect(RECIPES.filter((r) => (r as { ladderCredit?: false }).ladderCredit !== false).map((r) => r.id as string).sort()).toEqual([...composed.creditedIds].sort());
  });

  it("ingredients: the same ids, categories and (for toppings) families; the shelf distribution follows", () => {
    expect(INGREDIENTS.map((i) => i.id).sort()).toEqual(composed.ingredients.map((i) => i.id).sort());
    const actual = Object.fromEntries(INGREDIENTS.map((i) => [i.id, [i.category, i.category === "topping" ? ingredientAttributeFamily(i.id) : null]]));
    for (const e of composed.ingredients) expect(actual[e.id], e.id).toEqual([e.category, e.category === "topping" ? e.family : null]);
    expect(INGREDIENTS.filter((i) => i.category === "topping")).toHaveLength(composed.toppingCount);
    const byShelf: Record<string, number> = {};
    for (const i of INGREDIENTS) byShelf[i.category === "topping" ? ingredientAttributeFamily(i.id)! : i.category] = (byShelf[i.category === "topping" ? ingredientAttributeFamily(i.id)! : i.category] ?? 0) + 1;
    expect(byShelf).toEqual(composed.byShelf);
  });

  it("the ladder: the same steps in the same order (ordinary first, then late), the derived numbers, and no star gate on a composed step", () => {
    const steps = DISCOVERY_LADDER.steps;
    const ordinary = ordinaryLadderSteps(steps);
    expect(ordinary.map((s) => [s.step, [...s.ingredientIds], s.keyRecipeId])).toEqual(composed.ordinarySteps.map((s) => [s.step, [...s.ingredientIds], s.keyRecipeId]));
    expect(steps.slice(ordinary.length).map((s) => [s.step, [...s.ingredientIds], s.keyRecipeId])).toEqual(composed.lateSteps.map((s) => [s.step, [...s.ingredientIds], s.keyRecipeId]));
    expect(steps).toHaveLength(composed.steps.length);
    for (const row of [...FROZEN.ordinaryLadder, ...FROZEN.lateLadder]) {
      const real = steps.find((s) => s.keyRecipeId === row.keyRecipeId)!;
      expect((real as { starGates?: unknown }).starGates, row.keyRecipeId).toEqual(row.starGates);
    }
  });

  it("the late entitlement floors are exactly the frozen ones plus each train's recorded floors", () => {
    expect(LATE_ENTITLEMENT_FLOORS).toEqual(composed.floors);
  });

  it("chapter sizes and the Lunch Rush pool", () => {
    expect(buildRecipeChapters().map((c) => c.recipes.length)).toEqual(composed.chapterSizes);
    expect(RECIPES.filter((r) => participatesInLunchRush(r.id)).length).toBe(composed.lunchRushPool);
  });

  it("the Pinsa gate is the only difference between the two builds", () => {
    const on = composeCatalog({ pinsa: true });
    const off = composeCatalog({ pinsa: false });
    expect(on.recipeIds.filter((id) => !off.recipeIds.includes(id))).toEqual(["pinsa-romana"]);
    expect(on.chapterSizes.reduce((a, b) => a + b, 0) - off.chapterSizes.reduce((a, b) => a + b, 0)).toBe(1);
  });
});
