import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { panProfileIdFromLegacy } from "./legacyAdapter";

describe("existing recipe parity", () => {
  it("grandma keeps the existing tray/square meaning", () => {
    const grandma = RECIPES.find((recipe) => recipe.id === "grandma-pizza");
    expect(grandma).toBeDefined();
    expect(panProfileIdFromLegacy("tray", grandma?.panShape)).toBe("tray");
  });

  it("pinsa stays on the legacy round path", () => {
    const pinsa = RECIPES.find((recipe) => recipe.id === "pinsa-romana");
    if (pinsa) expect(panProfileIdFromLegacy(undefined, pinsa.panShape)).toBe("legacy-round");
  });

  it("every existing non-square recipe resolves to legacy-round", () => {
    for (const recipe of RECIPES) {
      if (recipe.panShape === "square") continue;
      expect(panProfileIdFromLegacy(undefined, recipe.panShape), recipe.id).toBe("legacy-round");
    }
  });
});
