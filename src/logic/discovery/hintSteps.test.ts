import { describe, expect, it } from "vitest";
import { getIngredient, INGREDIENTS } from "../../data/ingredients";
import { RECIPES, type Recipe, type RecipeId } from "../../data/recipes";
import { buildHintSteps, HINT_EXISTENCE_TEXT, hintKeyIngredientId, type HintAxis } from "./hintSteps";

const recipe = (id: string): Recipe => RECIPES.find((r) => r.id === id)!;
const label = (id: string): string => getIngredient(id)!.nameJa;
const distinct = (r: Recipe): string[] => [...new Set(r.requiredIngredients.map((q) => q.ingredientId))];
const named = (r: Recipe, discoveredCount: number): string[] =>
  buildHintSteps(r, { discoveredCount }).flatMap((s) => (s.namedIngredientId ? [s.namedIngredientId] : []));
const axes = (r: Recipe, discoveredCount = 1): HintAxis[] => buildHintSteps(r, { discoveredCount }).map((s) => s.axis);
const NO_CHEESE = ["marinara", "fugazza", "pizza-bianca", "pesto-tonno", "puttanesca-pizza"];

describe("buildHintSteps -- progressive order and n-1 cap (T-5)", () => {
  it.each(RECIPES.map((r) => r.id))("%s at Dex >= 1: H0 -> key -> sauce -> count/cheese -> the rest, n-1 named, no repeats", (id) => {
    const r = recipe(id);
    const steps = buildHintSteps(r, { discoveredCount: 5 });
    expect(steps[0]).toMatchObject({ level: 0, axis: "EXISTENCE", textJa: HINT_EXISTENCE_TEXT });
    steps.forEach((s, i) => expect(s.level).toBe(Math.min(i, 4)));

    const order: HintAxis[] = ["EXISTENCE", "KEY", "SAUCE", "COUNT_CHEESE", "INGREDIENT"];
    const ranks = steps.map((s) => order.indexOf(s.axis));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(steps.filter((s) => s.axis === "COUNT_CHEESE")).toHaveLength(1);

    const ids = named(r, 5);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(distinct(r).length - 1);
    expect(ids.every((i) => distinct(r).includes(i))).toBe(true);
  });

  it("H1 is the key (latest-unlocked) ingredient", () => {
    expect(buildHintSteps(recipe("bismarck"), { discoveredCount: 1 })[1]).toEqual({
      level: 1,
      axis: "KEY",
      textJa: `${label("egg")} を使うピザが作れそう！`,
      namedIngredientId: "egg",
    });
    // Two materials unlock on the same step: the first in requiredIngredients order is the key.
    expect(hintKeyIngredientId(recipe("capricciosa"))).toBe("oregano");
    expect(hintKeyIngredientId(recipe("quattro-formaggi"))).toBe("gorgonzola");
    expect(hintKeyIngredientId(recipe("margherita"))).toBeNull();
  });

  it("breakfast-pizza: key, sauce, count/cheese, then mozzarella; egg (last) is withheld", () => {
    const steps = buildHintSteps(recipe("breakfast-pizza"), { discoveredCount: 2 });
    expect(steps.map((s) => s.textJa)).toEqual([
      HINT_EXISTENCE_TEXT,
      `${label("bacon")} を使うピザが作れそう！`,
      `ソースは ${label("tomato-sauce")} みたい`,
      "材料は全部で4種類。チーズを使うみたい",
      `${label("mozzarella")} も使うみたい`,
    ]);
    expect(named(recipe("breakfast-pizza"), 2)).not.toContain("egg");
  });

  it("key is the sauce (fugazza, pesto-tonno): count/cheese moves up to H2, the sauce is not repeated", () => {
    expect(axes(recipe("fugazza"))).toEqual(["EXISTENCE", "KEY", "COUNT_CHEESE", "INGREDIENT"]);
    expect(named(recipe("fugazza"), 13)).toEqual(["olive-oil", "onion"]);
    expect(buildHintSteps(recipe("fugazza"), { discoveredCount: 13 })[2]).toMatchObject({
      level: 2,
      textJa: "材料は全部で3種類。チーズは使わないみたい",
    });
    expect(axes(recipe("pesto-tonno"))).toEqual(["EXISTENCE", "KEY", "COUNT_CHEESE", "INGREDIENT", "INGREDIENT"]);
    expect(named(recipe("pesto-tonno"), 17)).toEqual(["pesto", "tuna", "black-olive"]);
  });

  it("pizza-bianca (2 ingredients): coarse sauce line, olive oil never named", () => {
    const steps = buildHintSteps(recipe("pizza-bianca"), { discoveredCount: 22 });
    expect(steps.map((s) => s.textJa)).toEqual([
      HINT_EXISTENCE_TEXT,
      `${label("rosemary")} を使うピザが作れそう！`,
      "ソースはトマトじゃないみたい",
      "材料は全部で2種類。チーズは使わないみたい",
    ]);
    expect(steps[2].namedIngredientId).toBeUndefined();
    expect(steps.some((s) => s.textJa.includes(getIngredient("olive-oil")!.nameJa))).toBe(false);
  });

  it("the cheese line is always there, and says so when there is no cheese", () => {
    for (const r of RECIPES) {
      const line = buildHintSteps(r, { discoveredCount: 3 }).find((s) => s.axis === "COUNT_CHEESE")!;
      expect(line.textJa).toBe(
        `材料は全部で${distinct(r).length}種類。${NO_CHEESE.includes(r.id) ? "チーズは使わないみたい" : "チーズを使うみたい"}`,
      );
    }
  });
});

describe("buildHintSteps -- Margherita onboarding (T-13 logic)", () => {
  it("Dex 0 Margherita may name every starter ingredient", () => {
    expect(named(recipe("margherita"), 0)).toEqual(["tomato-sauce", "mozzarella", "basil"]);
    expect(axes(recipe("margherita"), 0)).toEqual(["EXISTENCE", "SAUCE", "COUNT_CHEESE", "INGREDIENT", "INGREDIENT"]);
  });

  it("the exception is Margherita at Dex 0 only: any other recipe / Dex count keeps the n-1 cap", () => {
    expect(named(recipe("margherita"), 1)).toHaveLength(2);
    expect(named(recipe("bismarck"), 0)).toHaveLength(2);
    const lookalike = { ...recipe("margherita"), id: "not-margherita" as RecipeId };
    expect(named(lookalike, 0)).toHaveLength(2);
  });
});

describe("buildHintSteps -- anti-spoiler (T-1) and determinism (T-4)", () => {
  const recipeNames = RECIPES.map((r) => r.nameJa);
  const ingredientNames = new Set(INGREDIENTS.map((i) => i.nameJa));

  it("no recipe name / description / id / ASCII id in any line: 25 recipes x Dex 0..24", () => {
    // Ingredient names are allowed (A-3, already public in the tray / Shop). Two recipe names are
    // also (part of) an ingredient name, so they are checked with ingredient names stripped out.
    expect(recipeNames.filter((n) => [...ingredientNames].some((i) => i.includes(n)))).toEqual(["ジェノベーゼ", "ペパロニ"]);
    const byLength = [...ingredientNames].sort((a, b) => b.length - a.length);
    for (const r of RECIPES) {
      for (let dex = 0; dex <= 24; dex += 1) {
        for (const { textJa } of buildHintSteps(r, { discoveredCount: dex })) {
          const stripped = byLength.reduce((t, n) => t.split(n).join("□"), textJa);
          for (const other of RECIPES) {
            expect(stripped).not.toContain(other.nameJa);
            expect(textJa).not.toContain(other.description);
          }
          expect(textJa).not.toMatch(/[A-Za-z]/);
        }
      }
    }
  });

  it("normal progression never names every ingredient (full answer only at Dex-0 Margherita)", () => {
    for (const r of RECIPES) {
      for (let dex = 0; dex <= 24; dex += 1) {
        const full = named(r, dex).length === distinct(r).length;
        expect(full).toBe(dex === 0 && r.id === "margherita");
      }
    }
  });

  it("identical input -> identical steps", () => {
    for (const r of RECIPES) expect(buildHintSteps(r, { discoveredCount: 7 })).toEqual(buildHintSteps(r, { discoveredCount: 7 }));
  });
});
