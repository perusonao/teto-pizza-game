import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { pinsaEnabled } from "../../data/pinsaGate";
import { panProfileIdFromLegacy } from "./legacyAdapter";

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
      expect(panProfileIdFromLegacy(undefined, pinsa?.panShape)).toBe("legacy-round");
    } else {
      expect(pinsa).toBeUndefined();
      expect(panProfileIdFromLegacy(undefined, undefined)).toBe("legacy-round");
    }
  });

  it("every existing non-square recipe resolves to legacy-round", () => {
    for (const recipe of RECIPES) {
      if (recipe.panShape === "square") continue;
      expect(panProfileIdFromLegacy(undefined, recipe.panShape), recipe.id).toBe("legacy-round");
    }
  });
});
