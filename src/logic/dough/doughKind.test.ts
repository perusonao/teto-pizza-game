import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { DEFAULT_DOUGH_KIND, DOUGH_KINDS, isDoughKind, resolveDoughKind } from "./doughKind";

describe("DoughKind (Dough Kind P1, #577)", () => {
  it("uses the 172-recipe vocabulary and keeps 'standard'", () => {
    expect(DOUGH_KINDS).toEqual(["standard", "material-multigrain-long-ferment"]);
    expect(DEFAULT_DOUGH_KIND).toBe("standard");
  });

  it("recognises only the two kinds", () => {
    for (const v of DOUGH_KINDS) expect(isDoughKind(v)).toBe(true);
    for (const v of [undefined, null, "", "pinsa", "Standard", 1, {}, []]) expect(isDoughKind(v)).toBe(false);
  });

  it("resolveDoughKind: absent / unknown / malformed resolve to standard, never throw", () => {
    for (const source of [undefined, null, {}, { doughKind: "pinsa" }, { doughKind: 3 }, { doughKind: null }]) {
      expect(resolveDoughKind(source as object | null | undefined)).toBe("standard");
    }
    expect(resolveDoughKind({ doughKind: "material-multigrain-long-ferment" })).toBe("material-multigrain-long-ferment");
  });

  it("is inert in Production: no RECIPES entry sets doughKind", () => {
    expect(RECIPES.filter((r) => "doughKind" in r)).toEqual([]);
    for (const r of RECIPES) expect(resolveDoughKind(r)).toBe("standard");
  });
});
