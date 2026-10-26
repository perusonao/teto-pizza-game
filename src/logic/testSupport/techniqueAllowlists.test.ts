import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { LATE_ADDITION_RECIPE_IDS, PAN_TRAY_RECIPE_IDS } from "./techniqueAllowlists";

describe("PAN_TRAY_RECIPE_IDS (E-0, OD-544-1/2)", () => {
  it("lists real, unique recipe ids, limited to grandma-pizza", () => {
    expect(new Set(PAN_TRAY_RECIPE_IDS).size).toBe(PAN_TRAY_RECIPE_IDS.length);
    for (const id of PAN_TRAY_RECIPE_IDS) {
      expect(RECIPES.map((r) => r.id), id).toContain(id);
      expect(id).toBe("grandma-pizza");
    }
  });
  it("is defined once: neither production gate declares its own copy", () => {
    for (const f of ["deductionProduction.gate.test.ts", "hint5Production.gate.test.ts"]) {
      const src = readFileSync(resolve(process.cwd(), "src/logic/discovery", f), "utf8");
      expect(src, f).toContain("../testSupport/techniqueAllowlists");
      expect(src, f).not.toMatch(/(const|let)\s+PAN_TRAY_RECIPE_IDS/);
    }
  });
});

describe("LATE_ADDITION_RECIPE_IDS (New Sauces Phase B U1 / U2)", () => {
  it("lists real, unique late recipe ids with a POST_BAKE requirement, limited to yuzu-shrimp-pizza and eggplant-dengaku-pizza (ikura is NO_SAUCE and Pinsa is in the dough list: neither is repeated here)", () => {
    expect(new Set(LATE_ADDITION_RECIPE_IDS).size).toBe(LATE_ADDITION_RECIPE_IDS.length);
    for (const id of LATE_ADDITION_RECIPE_IDS) {
      const recipe = RECIPES.find((r) => r.id === id);
      expect(recipe, id).toBeDefined();
      expect(recipe!.requiredIngredients.some((q) => "applicationPhase" in q && q.applicationPhase === "POST_BAKE"), id).toBe(true);
      expect(["yuzu-shrimp-pizza", "eggplant-dengaku-pizza"]).toContain(id);
    }
  });
  it("is read from this one file by the DH4 and Hint 5.0 gates (neither declares its own copy)", () => {
    for (const f of ["deductionProduction.gate.test.ts", "hint5Production.gate.test.ts"]) {
      const src = readFileSync(resolve(process.cwd(), "src/logic/discovery", f), "utf8");
      expect(src, f).toContain("LATE_ADDITION_RECIPE_IDS");
      expect(src, f).not.toMatch(/(const|let)\s+LATE_ADDITION_RECIPE_IDS/);
    }
  });
});
