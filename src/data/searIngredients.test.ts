import { describe, expect, it } from "vitest";
import { getIngredient } from "./ingredients";
import { canSearIngredient, SEAR_TARGET_INGREDIENT_IDS } from "./searIngredients";
import { canPrepIngredient } from "./prepIngredients";

describe("canSearIngredient", () => {
  it("Phase 1 targets sausage only", () => {
    expect(SEAR_TARGET_INGREDIENT_IDS).toEqual(["sausage"]);
    expect(canSearIngredient("sausage")).toBe(true);
    for (const id of ["beef", "pineapple", "bell-pepper", "hot-dog", "wurstel", "eggplant", "pepperoni", "nope"]) expect(canSearIngredient(id)).toBe(false);
  });
  it("the dormancy guard: sausage still has its dedicated drawing", () => {
    expect(getIngredient("sausage")?.pieceVisual).toBe("sausage-slices");
  });
  it("does not overlap the 炒める prep (the two never apply to the same ingredient)", () => {
    expect(canPrepIngredient("sausage")).toBe(false);
    expect(canSearIngredient("beef")).toBe(false);
  });
});
