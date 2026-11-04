import { afterEach, describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { FREE_COOK_RECIPE } from "../../data/freeCook";
import { resetPreviewPanShapeForTest, activePanShape } from "../../preview/panShapePreview";
import { createEmptyPizza } from "../../state/pizzaState";
import { effectivePanShape } from "./effectivePan";

/** Square Dough F4-a: `effectivePanShape` -- the explicit tray makes a round square; absent pan changes nothing. */
afterEach(() => {
  window.history.replaceState(null, "", "/");
  resetPreviewPanShapeForTest();
});

describe("effectivePanShape", () => {
  it("is exactly activePanShape(recipe) when the pizza has no pan -- all shipped recipes, the free-cook recipe, no recipe", () => {
    expect(RECIPES.length).toBeGreaterThan(50);
    for (const recipe of [...RECIPES, FREE_COOK_RECIPE, null, undefined]) {
      expect(effectivePanShape(recipe, createEmptyPizza())).toBe(activePanShape(recipe));
      // Square Dough E-2: grandma-pizza (panShape "square") is the one shipped recipe whose own pan is square; every other recipe is round.
      const own = (recipe as { panShape?: string } | null | undefined)?.panShape === "square" ? "square" : "round";
      expect(effectivePanShape(recipe, createEmptyPizza())).toBe(own);
      expect(effectivePanShape(recipe, null)).toBe(own);
      expect(effectivePanShape(recipe, undefined)).toBe(own);
      expect(effectivePanShape(recipe, { pan: null })).toBe(own);
    }
  });

  it("the explicit tray makes any round square", () => {
    for (const recipe of [...RECIPES, FREE_COOK_RECIPE, null]) {
      expect(effectivePanShape(recipe, { ...createEmptyPizza(), pan: "tray" })).toBe("square");
    }
  });

  it("only the explicit tray counts: an unknown pan value or a square dough grid alone stays round", () => {
    const pizza = { ...createEmptyPizza(), squareDough: [] as never, pan: "deep-pan" as never };
    expect(effectivePanShape(FREE_COOK_RECIPE, pizza)).toBe("round");
  });

  it("a square recipe pan stays square whatever the pizza says", () => {
    const square = { ...FREE_COOK_RECIPE, panShape: "square" as const };
    expect(effectivePanShape(square, createEmptyPizza())).toBe("square");
    expect(effectivePanShape(square, { pan: null })).toBe("square");
    expect(effectivePanShape(square, { pan: "tray" })).toBe("square");
  });

  it("the Preview / DEV override stays square, with or without a pan", () => {
    window.history.replaceState(null, "", "/?pan=square");
    resetPreviewPanShapeForTest();
    expect(effectivePanShape(FREE_COOK_RECIPE, createEmptyPizza())).toBe("square");
    expect(effectivePanShape(FREE_COOK_RECIPE, { pan: "tray" })).toBe("square");
  });

  it("does not mutate its arguments", () => {
    const pizza = Object.freeze({ ...createEmptyPizza(), pan: "tray" as const });
    expect(() => effectivePanShape(Object.freeze({ ...FREE_COOK_RECIPE }), pizza)).not.toThrow();
  });
});
