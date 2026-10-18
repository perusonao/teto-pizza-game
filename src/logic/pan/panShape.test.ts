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

  it("Production is inert: no RECIPES entry sets panShape, so every recipe resolves to round (#534; #521 E is the first user)", () => {
    expect(RECIPES.length).toBeGreaterThan(0);
    for (const recipe of RECIPES) {
      expect("panShape" in recipe, recipe.id).toBe(false);
      expect(resolvePanShape(recipe), recipe.id).toBe("round");
    }
  });
});
