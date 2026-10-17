import { describe, expect, it } from "vitest";
import { buildHintLine, RECIPE_HINTS } from "./hints";
import { getIngredient } from "./ingredients";
import { RECIPES, type Recipe } from "./recipes";
import { countUsedIngredient } from "../logic/scoring";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import type { MakingStep } from "../state/gameReducer";

/**
 * Issue #521 S2: `buildHintLine` checks EVERY required sauce. Before, it looked at the first sauce requirement only and its missing-ingredient
 * loop skipped every sauce, so a recipe needing two sauces said "ready" as soon as the first was painted.
 *
 * Production has no 2-sauce recipe yet, so the multi-sauce cases use a synthetic recipe (not in `RECIPES`); the single-sauce guarantee is pinned
 * against a frozen copy of the previous implementation over every production recipe.
 */

/** The pre-S2 implementation of the non-free-cook branch, copied verbatim (sauce handling as it was). */
function legacyHintText(recipe: Recipe, pizza: PizzaState, isExplicitHint: boolean): string {
  const hints = RECIPE_HINTS[recipe.id];
  const sauceRequirement = recipe.requiredIngredients.find((req) => getIngredient(req.ingredientId)?.category === "sauce");
  const hasCorrectSauce = sauceRequirement ? pizza.sauceIds.includes(sauceRequirement.ingredientId) : false;
  if (sauceRequirement && !hasCorrectSauce) {
    const fallback = "まずはソースを塗ってみて！ピザを指でなぞると塗れるよ。";
    return isExplicitHint ? (hints?.emptyHint ?? fallback) : (hints?.empty ?? fallback);
  }
  const missingReq = recipe.requiredIngredients.find((req) => {
    if (getIngredient(req.ingredientId)?.category === "sauce") return false;
    return countUsedIngredient(pizza, req.ingredientId) < req.minCount;
  });
  if (missingReq) {
    const ingredient = getIngredient(missingReq.ingredientId);
    return hints?.missing[missingReq.ingredientId] ?? `${ingredient?.nameJa}をのせてみよう！`;
  }
  return hints?.ready ?? "いい感じ！「焼く！」を押してみよう。";
}

function pizzaWith(sauceIds: string[], pieces: Record<string, number> = {}): PizzaState {
  const pizza = createEmptyPizza();
  pizza.sauceIds = sauceIds;
  let n = 0;
  for (const [ingredientId, count] of Object.entries(pieces)) {
    for (let i = 0; i < count; i += 1) pizza.toppings.push({ id: `t${n}`, ingredientId, x: 15 + n * 9, y: 50 });
    n += 1;
  }
  return pizza;
}

const STEPS: MakingStep[] = ["SAUCE", "CHEESE", "TOPPING"];
const SAUCE_STATES = [[], ["tomato-sauce"], ["olive-oil"], ["pesto"], ["tomato-sauce", "olive-oil"], ["pesto", "tomato-sauce"]];

describe("every production recipe: the hint is byte-identical to the previous implementation", () => {
  it("57+ recipes x 3 steps x sauce states x piece states x explicit/not", () => {
    let checked = 0;
    for (const recipe of RECIPES) {
      const nonSauce = recipe.requiredIngredients.filter((r) => getIngredient(r.ingredientId)?.category !== "sauce");
      const pieceStates: Array<Record<string, number>> = [
        {},
        Object.fromEntries(nonSauce.slice(0, 1).map((r) => [r.ingredientId, r.minCount])),
        Object.fromEntries(nonSauce.map((r) => [r.ingredientId, r.minCount])),
        Object.fromEntries(nonSauce.map((r) => [r.ingredientId, 1])),
      ];
      for (const step of STEPS) {
        for (const sauces of SAUCE_STATES) {
          for (const pieces of pieceStates) {
            for (const explicit of [false, true]) {
              const pizza = pizzaWith(sauces, pieces);
              const line = buildHintLine(recipe, pizza, step, explicit);
              expect(line.textJa, `${recipe.id} ${step} ${sauces.join("+")} ${JSON.stringify(pieces)} explicit=${explicit}`).toBe(legacyHintText(recipe, pizza, explicit));
              expect(line.id).toBe(`hint.${recipe.id}`);
              checked += 1;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(RECIPES.length * 100);
  });

  it("no production recipe has two sauce requirements yet (the new branch is only reachable from a fixture today)", () => {
    for (const recipe of RECIPES) {
      const sauces = recipe.requiredIngredients.filter((r) => getIngredient(r.ingredientId)?.category === "sauce");
      expect(sauces.length, recipe.id).toBeLessThanOrEqual(1);
    }
  });
});

describe("a recipe with two required sauces (synthetic: tomato-sauce + olive-oil + mozzarella 3 + garlic 2)", () => {
  const twoSauce = {
    id: "synthetic-two-sauce",
    nameJa: "テスト",
    description: "",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "olive-oil", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 3 },
      { ingredientId: "garlic", minCount: 2 },
    ],
    bakeTarget: { start: 56, end: 76 },
    baseRewardPitz: 100,
  } as unknown as Recipe;
  const allPieces = { mozzarella: 3, garlic: 2 };
  const FIRST_FALLBACK = "まずはソースを塗ってみて！ピザを指でなぞると塗れるよ。";
  const text = (sauces: string[], pieces: Record<string, number> = {}, step: MakingStep = "TOPPING", explicit = false) =>
    buildHintLine(twoSauce, pizzaWith(sauces, pieces), step, explicit).textJa;

  it("nothing painted: the first sauce's line", () => {
    expect(text([])).toBe(FIRST_FALLBACK);
  });

  it("only the first sauce painted, everything else placed: NOT 'ready' -- it asks for the second sauce", () => {
    const line = text(["tomato-sauce"], allPieces);
    expect(line).toBe("オリーブオイルも塗ってみよう！");
    expect(line).not.toContain("焼く");
  });

  it("only the second sauce painted: the FIRST sauce is still asked for first", () => {
    expect(text(["olive-oil"], allPieces)).toBe(FIRST_FALLBACK);
  });

  it("both sauces, in either order: the sauce lines are gone and the normal piece / ready logic takes over", () => {
    for (const order of [["tomato-sauce", "olive-oil"], ["olive-oil", "tomato-sauce"]]) {
      expect(text(order)).toBe("モッツァレラをのせてみよう！");
      expect(text(order, { mozzarella: 3 })).toBe("にんにくをのせてみよう！");
      expect(text(order, allPieces)).toBe("いい感じ！「焼く！」を押してみよう。");
    }
  });

  it("the second sauce's line shows at every making step (it is the pizza that is incomplete, not the step)", () => {
    for (const step of ["SAUCE", "CHEESE", "TOPPING"] as const) expect(text(["tomato-sauce"], allPieces, step)).toBe("オリーブオイルも塗ってみよう！");
  });

  it("an authored `missing[<second sauce>]` line wins over the default, and the explicit hint still uses it", () => {
    RECIPE_HINTS["synthetic-two-sauce"] = {
      empty: "トマトを塗ろう",
      emptyHint: "くわしく：トマト",
      missing: { "olive-oil": "仕上げにオイルも！" },
      ready: "できた！",
    };
    try {
      expect(text(["tomato-sauce"], allPieces)).toBe("仕上げにオイルも！");
      expect(text(["tomato-sauce"], allPieces, "SAUCE", true)).toBe("仕上げにオイルも！");
      expect(text([])).toBe("トマトを塗ろう");
      expect(text([], {}, "SAUCE", true)).toBe("くわしく：トマト");
      expect(text(["tomato-sauce", "olive-oil"], allPieces)).toBe("できた！");
    } finally {
      delete RECIPE_HINTS["synthetic-two-sauce"];
    }
  });

  it("the line names no recipe, count or sauce the player has not been told about (only the missing required sauce's own name)", () => {
    const line = text(["tomato-sauce"], allPieces);
    expect(line).not.toMatch(/2|二|ふたつ|２種|両方/);
  });
});
