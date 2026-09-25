import { describe, expect, it } from "vitest";
import { getPlayerReferencePizza } from "./playerReference";
import { RECIPES } from "./recipes";
import { getIngredient } from "./ingredients";
import { getReferencePizza } from "./referencePizza";
import { REFERENCE_SLOT_MIN_GAP, getReferenceSlots, minimumSlotGap } from "../logic/pizzaReferenceLayout";
import type { Recipe, RecipeId } from "./recipes";

/**
 * Issue #47 Slice B (Findings F/H): pins the player-facing reference generator's own
 * contract -- available for every playable recipe, deterministic, and independent of
 * Scoring 2.0's own Margherita-only `referencePizza.ts` (which this suite also pins as
 * unchanged, per the task's explicit scope guard).
 */
describe("getPlayerReferencePizza", () => {
  it("is available for every recipe in RECIPES (Finding F: no recipe is left without a player reference)", () => {
    for (const recipe of RECIPES) {
      const reference = getPlayerReferencePizza(recipe);
      expect(reference.recipeId).toBe(recipe.id);
      expect(reference.sauceIngredientId).not.toBeNull();
    }
  });

  it("communicates sauce identity via a real sauce-category ingredient id", () => {
    for (const recipe of RECIPES) {
      const reference = getPlayerReferencePizza(recipe);
      const sauceIngredient = getIngredient(reference.sauceIngredientId ?? "");
      expect(sauceIngredient?.category).toBe("sauce");
    }
  });

  it("communicates cheese/topping identity and approximate piece counts matching requiredIngredients", () => {
    for (const recipe of RECIPES) {
      const reference = getPlayerReferencePizza(recipe);
      const nonSauceRequirements = recipe.requiredIngredients.filter(
        (req) => getIngredient(req.ingredientId)?.category !== "sauce",
      );
      expect(reference.pieceGroups).toHaveLength(nonSauceRequirements.length);
      reference.pieceGroups.forEach((group, index) => {
        const requirement = nonSauceRequirements[index];
        expect(group.ingredientId).toBe(requirement.ingredientId);
        expect(group.positions).toHaveLength(requirement.minCount);
      });
    }
  });

  it("never places two pieces of the same recipe at a colliding slot", () => {
    for (const recipe of RECIPES) {
      const reference = getPlayerReferencePizza(recipe);
      const allPositions = reference.pieceGroups.flatMap((group) => group.positions);
      const keys = allPositions.map((p) => `${p.x},${p.y}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("is deterministic: two calls for the same recipe produce identical output", () => {
    const margherita = RECIPES.find((r) => r.id === "margherita")!;
    const first = getPlayerReferencePizza(margherita);
    const second = getPlayerReferencePizza(margherita);
    expect(first).toEqual(second);
  });

  /** B2 PART C2: bismarck now has a Scoring 2.0 Reference fixture too (coverage is 7/7), so
   *  this no longer demonstrates independence via a real recipe lacking one -- a synthetic
   *  recipe id (never registered in referencePizza.ts's lookup map) is used instead to prove
   *  getPlayerReferencePizza genuinely never reads getReferencePizza at all, rather than only
   *  coincidentally working whenever both happen to exist. */
  it("works even for a recipe id with no Scoring 2.0 Reference fixture (independence, not coincidence)", () => {
    const bismarck = RECIPES.find((r) => r.id === "bismarck")!;
    const syntheticRecipe = { ...bismarck, id: "no-such-recipe" as typeof bismarck.id };
    expect(getReferencePizza(syntheticRecipe.id)).toBeNull();
    const reference = getPlayerReferencePizza(syntheticRecipe);
    expect(reference.pieceGroups.map((g) => g.ingredientId)).toEqual(["mozzarella", "egg"]);
    expect(reference.sauceIngredientId).toBe("tomato-sauce");
  });

  it("Margherita's player reference matches its requiredIngredients (mozzarella x3, basil x2)", () => {
    const margherita = RECIPES.find((r) => r.id === "margherita")!;
    const reference = getPlayerReferencePizza(margherita);
    expect(reference.pieceGroups).toEqual([
      { ingredientId: "mozzarella", positions: expect.any(Array) },
      { ingredientId: "basil", positions: expect.any(Array) },
    ]);
    expect(reference.pieceGroups[0].positions).toHaveLength(3);
    expect(reference.pieceGroups[1].positions).toHaveLength(2);
  });
});

describe("Scoring 2.0 Reference fixtures unchanged (scope guard)", () => {
  /** B2 PART C2 (docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md): coverage is now
   *  all 7 recipes -- this playerReference.ts guard test is updated to match; it still pins
   *  that this file (`getPlayerReferencePizza`) stays entirely independent of whatever
   *  `getReferencePizza` covers, for every recipe, now that there is nothing left uncovered. */
  it("Scoring 2.0 Reference coverage is 7/7 -- getPlayerReferencePizza stays independent regardless", () => {
    for (const recipe of RECIPES) {
      expect(getReferencePizza(recipe.id)).not.toBeNull();
      // getPlayerReferencePizza itself never reads getReferencePizza -- already pinned by this
      // file's own header comment/imports; re-confirmed here by simply calling it too.
      expect(getPlayerReferencePizza(recipe)).toBeTruthy();
    }
  });
});

/**
 * RT-01b (Owner Decision RT-01-OD-1): recipes with 9+ non-sauce pieces never wrap onto used
 * slots. Synthetic, unregistered recipes built from shipped ingredients only -- no new recipe or
 * ingredient is added to production data.
 */
describe("getPlayerReferencePizza beyond 8 pieces (RT-01b)", () => {
  function synthetic(groups: [string, number][]): Recipe {
    return {
      ...RECIPES[0],
      id: "rt01-synthetic" as RecipeId,
      requiredIngredients: [
        { ingredientId: "tomato-sauce", minCount: 1 },
        ...groups.map(([ingredientId, minCount]) => ({ ingredientId, minCount })),
      ],
    };
  }

  const CASES: [number, [string, number][]][] = [
    [9, [["mozzarella", 2], ["mushroom", 3], ["parmigiano", 2], ["basil", 2]]],
    [10, [["mozzarella", 2], ["ham", 3], ["egg", 1], ["onion", 2], ["black-olive", 2]]],
    [12, [["mozzarella", 2], ["mushroom", 3], ["ham", 2], ["black-olive", 2], ["onion", 2], ["basil", 1]]],
    [15, [["mozzarella", 2], ["pepperoni", 3], ["mushroom", 2], ["onion", 2], ["black-olive", 2], ["bacon", 2], ["basil", 2]]],
  ];

  it.each(CASES)("%i pieces: every piece gets its own getReferenceSlots slot, counts preserved", (total, groups) => {
    const reference = getPlayerReferencePizza(synthetic(groups));
    expect(reference.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual(groups);
    const all = reference.pieceGroups.flatMap((g) => g.positions);
    expect(all).toHaveLength(total);
    expect(new Set(all.map((p) => `${p.x},${p.y}`)).size).toBe(total);
    expect(new Set(all.map((p) => `${p.x},${p.y}`))).toEqual(
      new Set(getReferenceSlots(total).map((p) => `${p.x},${p.y}`)),
    );
    expect(minimumSlotGap(all)).toBeGreaterThanOrEqual(REFERENCE_SLOT_MIN_GAP);
  });

  it.each(CASES)("%i pieces: same-ingredient pieces are interleaved, not clustered", (total, groups) => {
    const reference = getPlayerReferencePizza(synthetic(groups));
    const slots = getReferenceSlots(total);
    // Consecutive (legacy-style) assignment for comparison: group i takes the next minCount slots.
    let cursor = 0;
    const consecutive = groups.map(([, count]) => {
      const positions = slots.slice(cursor, cursor + count);
      cursor += count;
      return positions;
    });
    const layoutGap = minimumSlotGap(slots);
    reference.pieceGroups.forEach((group, i) => {
      if (group.positions.length < 2) return;
      expect(minimumSlotGap(group.positions)).toBeGreaterThanOrEqual(minimumSlotGap(consecutive[i]) - 1e-9);
      // No two pieces of one ingredient are nearest neighbours in the layout.
      expect(minimumSlotGap(group.positions)).toBeGreaterThanOrEqual(layoutGap * 1.25);
    });
  });

  it("is deterministic for a 10-piece recipe", () => {
    const recipe = synthetic(CASES[1][1]);
    expect(getPlayerReferencePizza(recipe)).toEqual(getPlayerReferencePizza(recipe));
  });
});
