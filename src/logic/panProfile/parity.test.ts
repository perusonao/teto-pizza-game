import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { pinsaEnabled } from "../../data/pinsaGate";
import { panProfileIdFromLegacy } from "./legacyAdapter";

const panShapeOf = (recipe: object): "round" | "square" | undefined =>
  "panShape" in recipe && (recipe.panShape === "round" || recipe.panShape === "square") ? recipe.panShape : undefined;

describe("existing recipe parity", () => {
  it("grandma keeps the existing tray/square meaning", () => {
    const grandma = RECIPES.find((recipe) => recipe.id === "grandma-pizza");
    const target = RECIPE_DISCOVERY_CATALOG.find((entry) => entry.recipeId === "grandma-pizza");
    expect(grandma).toBeDefined();
    expect(target?.identityDimensions?.pan).toBe("tray");
    expect(panProfileIdFromLegacy(target?.identityDimensions?.pan as "tray", grandma?.panShape)).toBe("tray");
  });

  it("pinsa stays on the legacy round path", () => {
    const pinsa = RECIPES.find((recipe) => recipe.id === "pinsa-romana");
    expect(Boolean(pinsa)).toBe(pinsaEnabled());
    if (pinsaEnabled()) {
      expect(pinsa).toBeDefined();
      expect(pinsa?.doughKind).toBe("material-multigrain-long-ferment");
      expect(panProfileIdFromLegacy(undefined, panShapeOf(pinsa!))).toBe("legacy-round");
    } else {
      expect(pinsa).toBeUndefined();
      expect(panProfileIdFromLegacy(undefined, undefined)).toBe("legacy-round");
    }
  });

  it("every existing non-square recipe resolves to legacy-round", () => {
    for (const recipe of RECIPES) {
      const panShape = panShapeOf(recipe);
      if (panShape === "square") continue;
      expect(panProfileIdFromLegacy(undefined, panShape), recipe.id).toBe("legacy-round");
    }
  });
});
