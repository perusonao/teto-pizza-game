import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { isValidRecipePanAuthoring, validateRecipePanAuthoring } from "./recipeAuthoring";

describe("PAN_PROFILE recipe authoring schema", () => {
  it("keeps every existing recipe valid when both optional fields are absent", () => {
    expect(RECIPES.every(isValidRecipePanAuthoring)).toBe(true);
    expect(RECIPES.every((recipe) => !("panProfileId" in recipe) && !("doughShapeTargetId" in recipe))).toBe(true);
  });

  it("accepts known compatible authoring IDs", () => {
    expect(validateRecipePanAuthoring({ panProfileId: "pan", doughShapeTargetId: "round" })).toEqual([]);
    expect(validateRecipePanAuthoring({ panProfileId: "steel-pan", doughShapeTargetId: "rectangle" })).toEqual([]);
  });

  it("allows either optional field to be authored independently", () => {
    expect(validateRecipePanAuthoring({ panProfileId: "deep-pan" })).toEqual([]);
    expect(validateRecipePanAuthoring({ doughShapeTargetId: "boat" })).toEqual([]);
  });

  it.each([
    [{ panProfileId: "future-pan" }, "UNKNOWN_PAN_PROFILE"],
    [{ doughShapeTargetId: "triangle" }, "UNKNOWN_DOUGH_SHAPE_TARGET"],
    [{ panProfileId: 1 }, "INVALID_PAN_PROFILE_ID"],
    [{ doughShapeTargetId: null }, "INVALID_DOUGH_SHAPE_TARGET_ID"],
  ] as const)("rejects unknown or malformed registry IDs: %j", (recipe, code) => {
    expect(validateRecipePanAuthoring(recipe)).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });

  it.each(["constructor", "toString", "__proto__"])("does not accept prototype-chain ID %s", (id) => {
    expect(validateRecipePanAuthoring({ panProfileId: id, doughShapeTargetId: id }).map((issue) => issue.code)).toEqual([
      "UNKNOWN_PAN_PROFILE",
      "UNKNOWN_DOUGH_SHAPE_TARGET",
    ]);
  });

  it("rejects a known but incompatible profile and shape", () => {
    expect(validateRecipePanAuthoring({ panProfileId: "deep-pan", doughShapeTargetId: "square" })).toEqual([
      expect.objectContaining({ code: "INCOMPATIBLE_PAN_SHAPE", field: "doughShapeTargetId" }),
    ]);
  });

  it.each([null, [], "recipe", 1])("fails closed without throwing for malformed recipe input %j", (recipe) => {
    expect(() => validateRecipePanAuthoring(recipe)).not.toThrow();
    expect(validateRecipePanAuthoring(recipe)).toEqual([expect.objectContaining({ code: "INVALID_RECIPE" })]);
  });
});
