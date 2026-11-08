import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * What-if Hint 5.0 (Issue #780 plan §7-2): the real `buildHint5Ladder` on "shipped + all staged" (module mocks append the
 * staged ingredients and their PROVISIONAL families). Measures (1) which staged recipes are Hint 5.0 targets as key-free
 * recipes (T-COV: every topping resolves to one family), and (2) that appending them leaves every shipped ladder in the
 * committed golden (hint5.ladders55.json) unchanged.
 */
vi.mock("../ingredients", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ingredients")>();
  const { whatIfIngredients } = await import("./whatIfSupport");
  const all = [...actual.INGREDIENTS, ...whatIfIngredients()] as typeof actual.INGREDIENTS;
  return { ...actual, INGREDIENTS: all, getIngredient: (id: string) => all.find((i) => i.id === id) };
});
vi.mock("../ingredientTaxonomy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ingredientTaxonomy")>();
  const { whatIfFamily } = await import("./whatIfSupport");
  return { ...actual, ingredientAttributeFamily: (id: unknown) => actual.ingredientAttributeFamily(id) ?? (typeof id === "string" ? whatIfFamily(id) : null) };
});

import { buildHint5Ladder } from "../../logic/discovery/hint5Ladder";
import { RECIPE_HINT_ROLES } from "../recipeHintRoles";
import { RECIPES } from "../recipes";
import { STAGED_RECIPES } from "./testSupport/stagedRecipes";
import { whatIfRecipes } from "./whatIfSupport";

const ALL = [...RECIPES, ...whatIfRecipes()] as never;

describe("What-if: Hint 5.0 with all staged recipes", () => {
  it("every staged recipe is a key-free Hint 5.0 target (T-COV), with its rung shape recorded", async () => {
    const rows = STAGED_RECIPES.map((r) => {
      const ladder = buildHint5Ladder(r.id, ALL, { [r.id]: { keyFree: true } } as never);
      return { id: r.id, target: ladder !== null, rungs: ladder ? ladder.rungs.map((g) => g.kind).join(",") : null };
    });
    const notTarget = rows.filter((r) => !r.target).map((r) => r.id);
    await expect(JSON.stringify({ targets: rows.length - notTarget.length, notTarget, rows }, null, 1) + "\n").toMatchFileSnapshot("./__golden__/whatIf.hint5.json");
    expect(notTarget).toEqual([]);
  });

  it("shipped ladders in the committed golden are unchanged when the staged catalog is appended", () => {
    const golden = JSON.parse(readFileSync(join(__dirname, "..", "..", "logic", "discovery", "__golden__", "hint5.ladders55.json"), "utf8")) as { id: string; rungs: unknown[][] }[];
    expect(golden.length).toBeGreaterThan(50);
    const diffs: string[] = [];
    for (const g of golden) {
      const ladder = buildHint5Ladder(g.id, ALL, RECIPE_HINT_ROLES);
      const now = ladder ? ladder.rungs.map((r) => [r.index, r.kind, r.ordinal, ...r.subjectIds]) : null;
      if (JSON.stringify(now) !== JSON.stringify(g.rungs)) diffs.push(g.id);
    }
    expect(diffs).toEqual([]);
  });
});
