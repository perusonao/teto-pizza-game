import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { DEFAULT_PAN_SHAPE, PAN_SHAPES, isPanShape, resolvePanShape } from "./panShape";

describe("panShape", () => {
  it("the default is the pre-existing round pizza", () => {
    expect(DEFAULT_PAN_SHAPE).toBe("round");
    expect(PAN_SHAPES).toEqual(["round", "square"]);
  });

  it("isPanShape accepts exactly the two shapes", () => {
    expect(isPanShape("round")).toBe(true);
    expect(isPanShape("square")).toBe(true);
    for (const bad of ["Round", "rect", "", null, undefined, 0, {}, ["round"]]) expect(isPanShape(bad)).toBe(false);
  });

  it("resolvePanShape: absent / unknown values resolve to round, a set value is kept", () => {
    expect(resolvePanShape(undefined)).toBe("round");
    expect(resolvePanShape(null)).toBe("round");
    expect(resolvePanShape({})).toBe("round");
    expect(resolvePanShape({ panShape: "round" })).toBe("round");
    expect(resolvePanShape({ panShape: "square" })).toBe("square");
    expect(resolvePanShape({ panShape: "hexagon" })).toBe("round");
    expect(resolvePanShape({ panShape: 3 })).toBe("round");
  });

  it("exactly grandma-pizza sets panShape (Square Dough E-2, the first user); every other recipe omits it and resolves to round", () => {
    expect(RECIPES.length).toBeGreaterThan(0);
    for (const recipe of RECIPES) {
      const square = recipe.id === "grandma-pizza";
      expect("panShape" in recipe, recipe.id).toBe(square);
      expect(resolvePanShape(recipe), recipe.id).toBe(square ? "square" : "round");
    }
  });
});
