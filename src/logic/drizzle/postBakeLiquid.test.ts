import { describe, expect, it } from "vitest";
import { getIngredient } from "../../data/ingredients";
import { DOUGH_RADIUS } from "../pizzaCoordinates";
import {
  COORD_ABS_MAX,
  DISPLAY_MAX_POINTS_PER_STROKE,
  DISPLAY_MAX_STROKES,
  LAB_DOUGH_RADIUS,
  LIQUID_ID_PATTERN,
  MAX_RAW_LIQUIDS,
  MAX_RAW_TRAIL_POINTS,
  MIN_POINT_DISTANCE,
  PERSIST_MAX_LIQUIDS,
  PERSIST_MAX_POINTS_PER_STROKE,
  POST_BAKE_LIQUID_INGREDIENT_IDS,
  POST_BAKE_LIQUID_STAGE,
  QUANT_STEP,
  TAP_LINE_LENGTH,
  TAP_TRAVEL,
  isPostBakeLiquidIngredient,
  labToDough,
} from "./postBakeLiquid";

describe("the first material (Owner 2026-11-06)", () => {
  it("is exactly the existing olive-oil", () => {
    expect([...POST_BAKE_LIQUID_INGREDIENT_IDS]).toEqual(["olive-oil"]);
  });
  it("is a real catalog sauce (the allow-list breaks if the catalog changes under it)", () => {
    for (const id of POST_BAKE_LIQUID_INGREDIENT_IDS) {
      const ing = getIngredient(id);
      expect(ing, id).toBeDefined();
      expect(ing?.category, id).toBe("sauce");
    }
  });
  it("accepts only that id, and only as a string", () => {
    expect(isPostBakeLiquidIngredient("olive-oil")).toBe(true);
    for (const v of ["honey", "tomato-sauce", "mayo", "", "Olive-Oil", undefined, null, 1, {}, ["olive-oil"]]) expect(isPostBakeLiquidIngredient(v)).toBe(false);
  });
});

describe("limits (PROVISIONAL, pinned so a change is a reviewed edit)", () => {
  it("persist limits are the Owner's 24 points x 4 liquids", () => {
    expect(PERSIST_MAX_POINTS_PER_STROKE).toBe(24);
    expect(PERSIST_MAX_LIQUIDS).toBe(4);
  });
  it("display limits keep the lab's (#746) counts as literals (the lab is not imported)", () => {
    expect(DISPLAY_MAX_POINTS_PER_STROKE).toBe(160);
    expect(DISPLAY_MAX_STROKES).toBe(24);
  });
  it("the lab's sizes are converted from its radius 44 to the production radius 48", () => {
    expect(LAB_DOUGH_RADIUS).toBe(44);
    expect(DOUGH_RADIUS).toBe(48);
    expect(labToDough(44)).toBe(48);
    expect(MIN_POINT_DISTANCE).toBe(1.5); // 1.4 * 48 / 44 = 1.527
    expect(TAP_TRAVEL).toBe(3.3); // 3 * 48 / 44 = 3.272
    expect(TAP_LINE_LENGTH).toBe(17.5); // 16 * 48 / 44 = 17.454
  });
  it("coordinates are kept to one decimal", () => {
    expect(QUANT_STEP).toBe(0.1);
  });
  it("the untrusted-input defences are far above any real stroke", () => {
    expect(MAX_RAW_TRAIL_POINTS).toBeGreaterThan(DISPLAY_MAX_POINTS_PER_STROKE);
    expect(MAX_RAW_LIQUIDS).toBeGreaterThan(PERSIST_MAX_LIQUIDS);
    expect(COORD_ABS_MAX).toBeGreaterThan(100);
  });
  it("the stage tag is the literal 'post'", () => {
    expect(POST_BAKE_LIQUID_STAGE).toBe("post");
  });
  it("the id pattern is a short hyphenated ASCII token", () => {
    for (const ok of ["a", "liquid-1", "A1-b2", "x".repeat(40)]) expect(LIQUID_ID_PATTERN.test(ok), ok).toBe(true);
    for (const bad of ["", "x".repeat(41), "a b", "a_b", "日本", "a/b", "__proto__", "a\n"]) expect(LIQUID_ID_PATTERN.test(bad), JSON.stringify(bad)).toBe(false);
  });
});
