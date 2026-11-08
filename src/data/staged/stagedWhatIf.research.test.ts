import { describe, expect, it, vi } from "vitest";

/**
 * What-if Research labels (Issue #780 plan §7-2): the real `researchCohortLetters` on "shipped + all 84 staged recipes"
 * (+ the in-flight burrata / honey / walnut), measured with the same scenarios Batch 18/19 used per batch
 * (`researchLetterChangesAcrossOrders`). Only this test process sees the extra rows (module mock); no shipped file changes.
 */
vi.mock("../ingredients", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ingredients")>();
  const { whatIfIngredients } = await import("./whatIfSupport");
  const all = [...actual.INGREDIENTS, ...whatIfIngredients()] as typeof actual.INGREDIENTS;
  return { ...actual, INGREDIENTS: all, getIngredient: (id: string) => all.find((i) => i.id === id) };
});

import { researchLetterChangesAcrossOrders } from "../../logic/catalog/testSupport/researchLabelAudit";
import { researchCohortLetters } from "../../logic/discovery/researchEntry";
import { DISCOVERY_LADDER } from "../discoveryLadder";
import { pinsaEnabled } from "../pinsaGate";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../ingredients";
import { RECIPES } from "../recipes";
import { STAGED_RECIPES } from "./testSupport/stagedRecipes";
import { whatIfRecipes } from "./whatIfSupport";

describe("What-if: Research cohort letters with all staged recipes", () => {
  it("the mock is in effect (staged ingredients resolve as finite materials)", () => {
    expect(getIngredient("lettuce")?.unlockCondition).toBeDefined();
    expect(getIngredient("burrata")).toBeDefined();
  });

  // Golden measured on the Production catalog (Pinsa ON); skipped in the Pinsa rollback build.
  it.skipIf(!pinsaEnabled())("measures letter changes of the shipped recipes (canonical order = stop condition; others need per-ID Owner approval)", async () => {
    const all = [...RECIPES, ...whatIfRecipes()] as never;
    const newIds = STAGED_RECIPES.map((r) => r.id);
    const changes = researchLetterChangesAcrossOrders(newIds, all, 4);
    const affected = [...changes.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    const canonical = affected.filter(([, l]) => l.some((c) => c.canonical)).map(([id, l]) => `${id}: ${[...new Set(l.filter((c) => c.canonical).map((c) => c.change))].join(" ")}`);
    const nonCanonical = affected.map(([id, l]) => `${id}: ${[...new Set(l.filter((c) => !c.canonical).map((c) => c.change))].join(" ")}`).filter((s) => !s.endsWith(": "));
    // Canonical ladder order owns only shipped materials, so a staged recipe can join a canonical cohort only if it uses shipped materials only.
    const owned = [...STARTER_INGREDIENT_IDS, ...DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds as readonly string[])];
    const registrableInCanonical = STAGED_RECIPES.filter((r) => r.requiredIngredients.every((q) => owned.includes(q.ingredientId))).map((r) => r.id);
    // Attribution: which staged recipe, added ALONE, re-letters a shipped recipe at some canonical prefix (the stop condition per train).
    const ladder = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds as readonly string[]);
    const staged = whatIfRecipes();
    const canonicalCulprits = registrableInCanonical.filter((id) => {
      const one = [...RECIPES, staged.find((r) => r.id === id)!] as never;
      for (let k = 0; k <= ladder.length; k += 1) {
        const o = [...STARTER_INGREDIENT_IDS, ...ladder.slice(0, k)];
        const before = researchCohortLetters(o, RECIPES);
        const after = researchCohortLetters(o, one);
        if (RECIPES.some((r) => before.get(r.id) !== after.get(r.id))) return true;
      }
      return false;
    });
    await expect(
      JSON.stringify({ shippedRecipesWithCanonicalChange: canonical.length, shippedRecipesWithAnyChange: affected.length, canonical, nonCanonical, stagedRegistrableInCanonicalOrder: registrableInCanonical, stagedRecipesThatAloneChangeACanonicalLetter: canonicalCulprits }, null, 1) + "\n",
    ).toMatchFileSnapshot("./__golden__/whatIf.research.json");
  }, 600_000);
});
