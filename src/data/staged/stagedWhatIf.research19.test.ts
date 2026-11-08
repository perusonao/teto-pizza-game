import { describe, expect, it, vi } from "vitest";

/**
 * What-if Research, attribution table (Issue #780, Owner 2026-11-08 item 6): for every SHIPPED recipe whose cohort letter changes in the
 * canonical ladder order when the staged catalog is added, list the letter before -> after, the cohort (unlock) material and the first
 * canonical prefix where it happens, and the staged recipes that cause it on their own. Same module mock as stagedWhatIf.research.test.ts;
 * the real `researchCohortLetters` runs, no shipped file changes.
 */
vi.mock("../ingredients", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ingredients")>();
  const { whatIfIngredients } = await import("./whatIfSupport");
  const all = [...actual.INGREDIENTS, ...whatIfIngredients()] as typeof actual.INGREDIENTS;
  return { ...actual, INGREDIENTS: all, getIngredient: (id: string) => all.find((i) => i.id === id) };
});

import { researchCohortLetters } from "../../logic/discovery/researchEntry";
import { DISCOVERY_LADDER } from "../discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../ingredients";
import { pinsaEnabled } from "../pinsaGate";
import { RECIPES } from "../recipes";
import { whatIfRecipes } from "./whatIfSupport";

describe("What-if: canonical-order Research letter changes, per shipped recipe", () => {
  it.skipIf(!pinsaEnabled())("ID, letter before -> after, cohort material, first prefix, and the staged recipes that cause it alone (golden)", async () => {
    const ladder = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds as readonly string[]);
    const staged = whatIfRecipes();
    const ALL = [...RECIPES, ...staged] as never;
    const prefixes = Array.from({ length: ladder.length + 1 }, (_, k) => [...STARTER_INGREDIENT_IDS, ...ladder.slice(0, k)]);
    const base = prefixes.map((o) => researchCohortLetters(o, RECIPES));
    const finite = (r: { requiredIngredients: readonly { ingredientId: string }[] }) => r.requiredIngredients.map((q) => q.ingredientId).filter((i) => ladder.includes(i));
    const cohortMaterial = (rid: string, owned: readonly string[]) => {
      const r = RECIPES.find((x) => x.id === rid)!;
      return finite(r).sort((a, b) => owned.indexOf(b) - owned.indexOf(a))[0] ?? "(starter only)";
    };
    type Row = { id: string; changes: string[]; cohortMaterial: string; firstPrefix: number; causedAloneBy: string[] };
    const rows = new Map<string, Row>();
    prefixes.forEach((o, k) => {
      const now = researchCohortLetters(o, ALL);
      for (const r of RECIPES) {
        const b = base[k].get(r.id);
        const a = now.get(r.id);
        if (a === b) continue;
        const row = rows.get(r.id) ?? { id: r.id, changes: [], cohortMaterial: cohortMaterial(r.id, o), firstPrefix: k, causedAloneBy: [] };
        const c = `${b ?? "-"}->${a ?? "-"}`;
        if (!row.changes.includes(c)) row.changes.push(c);
        rows.set(r.id, row);
      }
    });
    for (const s of staged) {
      const one = [...RECIPES, s] as never;
      const hit = new Set<string>();
      prefixes.forEach((o, k) => {
        const now = researchCohortLetters(o, one);
        for (const r of RECIPES) if (base[k].get(r.id) !== now.get(r.id)) hit.add(r.id);
      });
      for (const id of hit) rows.get(id)?.causedAloneBy.push(s.id);
    }
    const table = [...rows.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
    const culprits = [...new Set(table.flatMap((r) => r.causedAloneBy))].sort();
    expect(table).toHaveLength(19);
    await expect(JSON.stringify({ shippedRecipes: table.length, distinctCulprits: culprits.length, culprits, table }, null, 1) + "\n").toMatchFileSnapshot("./__golden__/whatIf.research19.json");
  }, 300_000);
});
