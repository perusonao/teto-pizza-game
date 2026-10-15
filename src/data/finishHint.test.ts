import { describe, expect, it } from "vitest";
import { RECIPES } from "./recipes";
import { buildFinishHintLine } from "./finishHint";
import { FREE_COOK_RECIPE } from "./freeCook";
import { FINISH_FIXTURE_RECIPE as FX, finishedPizza, piece, preBakePizza } from "../state/testSupport/finishFixture";

describe("buildFinishHintLine (FINISH D2-0)", () => {
  it("names the missing late ingredient of a Guided recipe, and only that one", () => {
    const line = buildFinishHintLine(FX, preBakePizza());
    expect(line).toEqual({ speaker: "mito", id: `hint.finish.${FX.id}`, textJa: "パセリを仕上げにのせよう！" });
    expect(line.textJa).not.toContain("チキン");
  });

  it("the explicit hint says how many are still missing", () => {
    expect(buildFinishHintLine(FX, preBakePizza(), true).textJa).toBe("パセリをあと2個、仕上げにのせてね。");
    expect(buildFinishHintLine(FX, finishedPizza(1), true).textJa).toBe("パセリをあと1個、仕上げにのせてね。");
  });

  it("counts only post-bake pieces: a pre-bake piece of the late ingredient does not satisfy the hint", () => {
    const pizza = { ...preBakePizza(), toppings: [...preBakePizza().toppings, piece("parsley"), piece("parsley", "pre")] };
    expect(buildFinishHintLine(FX, pizza).textJa).toBe("パセリを仕上げにのせよう！");
  });

  it("is ready once the late requirement is met", () => {
    expect(buildFinishHintLine(FX, finishedPizza(2)).textJa).toBe("仕上がり！「次へ」で完成しよう。");
    expect(buildFinishHintLine(FX, finishedPizza(3)).textJa).toBe("仕上がり！「次へ」で完成しよう。");
  });

  it("a recipe with no late requirement gets a neutral line that names no ingredient (every RECIPES entry)", () => {
    for (const recipe of RECIPES) {
      const line = buildFinishHintLine(recipe, preBakePizza());
      expect(line.textJa, recipe.id).toBe("仕上げはなくてもOK。「次へ」で進もう。");
    }
  });

  it("Free Cooking never names an ingredient, whatever the pizza holds", () => {
    for (const pizza of [preBakePizza(), finishedPizza(2)]) {
      for (const explicit of [false, true]) {
        const line = buildFinishHintLine(FREE_COOK_RECIPE, pizza, explicit);
        expect(line.id).toBe("hint.finish.free-cook");
        expect(line.speaker).toBe("mito");
        for (const name of ["パセリ", "チキン", "モッツァレラ"]) expect(line.textJa).not.toContain(name);
      }
    }
  });
});
