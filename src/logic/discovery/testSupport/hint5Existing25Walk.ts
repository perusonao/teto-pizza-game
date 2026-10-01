import { RECIPES } from "../../../data/recipes";
import { buildHint5Ladder, hint5Presentation, requestHint5Rung } from "../hint5Ladder";

/**
 * Discovery 3.0 PR-3: a deterministic, JSON-serialisable walk of the 25 shipped recipes' Hint 5.0
 * output (ladder, presentation and request result at every purchase step, plus the Dex-0 Margherita
 * onboarding and a zero-Pitz view). `hint5Existing25.golden.json` was generated from `main` BEFORE
 * the key-free change, so the golden test proves Migration A: the production output is identical.
 */
export function walkExisting25(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const recipe of RECIPES) {
    const steps: unknown[] = [];
    for (const [discoveredCount, pitzBalance] of [[5, 1000], [0, 1000], [5, 0]] as const) {
      let stored: string[] = [];
      const walk: unknown[] = [];
      for (let guard = 0; guard < 20; guard += 1) {
        const input = { recipeId: recipe.id, discoveredCount, storedFactIds: stored, legacyPurchases: {}, pitzBalance };
        const view = hint5Presentation(input);
        walk.push({ view });
        if (!view?.next) break;
        const result = requestHint5Rung({ ...input, expectedRungIndex: view.next.rungIndex });
        walk.push({ result });
        if (result.outcome !== "ANSWERED" && result.outcome !== "ALREADY_KNOWN") break;
        stored = [...stored, ...result.addFactIds];
      }
      steps.push({ discoveredCount, pitzBalance, walk });
    }
    out[recipe.id] = { ladder: buildHint5Ladder(recipe.id), steps };
  }
  return out;
}
