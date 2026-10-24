import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { PAN_TRAY_RECIPE_IDS } from "./techniqueAllowlists";

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
