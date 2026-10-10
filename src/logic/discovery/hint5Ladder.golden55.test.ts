import { describe, expect, it } from "vitest";
import { RECIPE_HINT_ROLES } from "../../data/recipeHintRoles";
import { INGREDIENTS } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import { KEY_FREE_RECIPES, KEYED_RECIPES } from "../testSupport/hintRoles";
import {
  HINT5_RUNG_MARKER,
  buildHint5Ladder,
  hint5ClassFactId,
  hint5EmptyFixedRungs,
  hint5Presentation,
  hint5ReservedRungs,
  requestHint5Rung,
} from "./hint5Ladder";

/**
 * Hint 5.0 PR-B (docs/decisions/TETO_HINT-5_BASE-RUNG_OWNER-DECISIONS.md section 7 "Pin first", section 9):
 * a golden of the ladder of ALL 55 production recipes. `hint5Ladder.keyFree.test.ts` pins only the 25 keyed
 * recipes (`hint5.production25.json`); the 30 key-free sub orders were not pinned and silently depended on
 * the catalog being append-only. This test pins them as they are on main (tests only, no behaviour change).
 *
 * The snapshot holds, per recipe: the rung kinds and subjects (so the sub order), and for every prefix of
 * completed rungs the next offer (kind, label, price) and the request result (outcome, kind, facts, charge).
 * A change to any of these needs an explicit golden re-baseline with a stated reason.
 */

function snapshot(): string {
  const out = RECIPES.map((r) => {
    const ladder = buildHint5Ladder(r.id)!;
    const completed: string[] = [];
    const states = [];
    for (let n = 0; n <= ladder.rungs.length; n++) {
      if (n > 0) {
        const rung = ladder.rungs[n - 1];
        completed.push(rung.kind === "SUB_CLASS" ? hint5ClassFactId(rung.subjectIds[0]) : HINT5_RUNG_MARKER[rung.kind]);
      }
      const input = { recipeId: r.id, discoveredCount: 5, storedFactIds: [...completed], legacyPurchases: [], pitzBalance: 100 };
      const view = hint5Presentation(input)!;
      const res = requestHint5Rung({ ...input, expectedRungIndex: n + 1 });
      states.push({
        n,
        next: view.next && { rungIndex: view.next.rungIndex, kind: view.next.kind, labelJa: view.next.labelJa, price: view.next.price },
        board: view.board.map((e) => ({ rungIndex: e.rungIndex, kind: e.kind })),
        request: "addFactIds" in res ? { outcome: res.outcome, addFactIds: res.addFactIds, charge: res.charge } : res,
      });
    }
    return {
      id: r.id,
      keyFree: KEY_FREE_RECIPES.includes(r),
      total: ladder.total,
      rungs: ladder.rungs.map((x) => [x.index, x.kind, x.ordinal, ...x.subjectIds]),
      empty: hint5EmptyFixedRungs(r.id),
      reserved: hint5ReservedRungs(r.id),
      states,
    };
  });
  return JSON.stringify(out, null, 1) + "\n";
}

describe("PR-B golden: the Hint 5.0 ladder of every production recipe", () => {
  it("every production recipe is a Hint 5.0 target, and the keyed / key-free split is derived from the roles table", () => {
    expect(RECIPES.every((r) => buildHint5Ladder(r.id) !== null)).toBe(true);
    expect(KEYED_RECIPES.length + KEY_FREE_RECIPES.length).toBe(RECIPES.length);
    expect(Object.keys(RECIPE_HINT_ROLES).sort()).toEqual(RECIPES.map((r) => r.id).sort());
  });

  it("matches the 55-ladder golden (kinds, sub order, next offers and request facts per prefix)", async () => {
    await expect(snapshot()).toMatchFileSnapshot("./__golden__/hint5.ladders55.json");
  });

  it("a key-free recipe's sub order is the catalog order of its toppings (OD-H5-SUBORD-2: forever for the existing ones)", () => {
    const index = new Map(INGREDIENTS.map((ingredient, i) => [ingredient.id, i]));
    for (const r of KEY_FREE_RECIPES) {
      const subs = buildHint5Ladder(r.id)!.rungs.filter((x) => x.kind === "SUB_CLASS").map((x) => x.subjectIds[0]);
      const sorted = [...subs].sort((a, b) => index.get(a)! - index.get(b)!);
      expect(subs, r.id).toEqual(sorted);
    }
  });

  it("the keyed ladders keep the authored fixed shape, and no production recipe has a reserved rung", () => {
    for (const r of KEYED_RECIPES) {
      const kinds = buildHint5Ladder(r.id)!.rungs.map((x) => x.kind);
      expect(kinds.slice(0, 4), r.id).toEqual(["SAUCE", "CHEESE", "KEY_TOPPING", "STRUCTURE"]);
    }
    for (const r of RECIPES) expect(hint5ReservedRungs(r.id), r.id).toEqual([]);
  });
});
