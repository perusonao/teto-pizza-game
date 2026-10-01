import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../../data/ingredients";
import { RECIPE_HINT_ROLES, type HintRolesEntry } from "../../data/recipeHintRoles";
import { RECIPES, type Recipe } from "../../data/recipes";
import {
  buildHint5Ladder,
  hint5Ownership,
  hint5Presentation,
  HINT5_RUNG_PRICE,
  hint5RolesValid,
  isKeyFreeRoles,
  requestHint5Rung,
  type Hint5RungKind,
} from "./hint5Ladder";

/**
 * Discovery 3.0 PR-3 (OD-D3-19 Migration A + OD-D3-21): key-free Hint authoring. Synthetic fixtures
 * only -- no production recipe is key-free. Existing-25 equality lives in hint5Existing25.golden.test.ts.
 */

const catalogOrder = (ids: readonly string[]) => [...ids].sort((a, b) => INGREDIENTS.findIndex((i) => i.id === a) - INGREDIENTS.findIndex((i) => i.id === b));

function fixture(id: string, ingredientIds: readonly string[]): Recipe {
  return {
    id,
    nameJa: id,
    description: "synthetic key-free fixture",
    requiredIngredients: ingredientIds.map((ingredientId) => ({ ingredientId, minCount: 1 })),
    bakeTarget: { start: 60, end: 80 },
    baseRewardPitz: 100,
  } as unknown as Recipe;
}

const FIXTURES = {
  full: fixture("kf-full", ["black-olive", "oregano", "tomato-sauce", "mozzarella", "onion", "sausage"]), // deliberately unordered
  noCheese: fixture("kf-no-cheese", ["tomato-sauce", "sausage", "onion"]),
  noSauce: fixture("kf-no-sauce", ["mozzarella", "sausage", "onion"]),
  noSauceNoCheese: fixture("kf-bare", ["sausage", "onion"]),
  noTopping: fixture("kf-no-topping", ["tomato-sauce", "mozzarella"]),
};
const RECIPE_LIST = Object.values(FIXTURES);
const ROLES: Record<string, HintRolesEntry> = Object.fromEntries(RECIPE_LIST.map((r) => [r.id, { keyFree: true } as const]));

const EXPECTED_KINDS: Record<string, readonly Hint5RungKind[]> = {
  "kf-full": ["SAUCE", "CHEESE", "STRUCTURE", "SUB_CLASS", "SUB_CLASS", "SUB_CLASS", "SUB_CLASS"],
  "kf-no-cheese": ["SAUCE", "STRUCTURE", "SUB_CLASS", "SUB_CLASS"],
  "kf-no-sauce": ["CHEESE", "STRUCTURE", "SUB_CLASS", "SUB_CLASS"],
  "kf-bare": ["STRUCTURE", "SUB_CLASS", "SUB_CLASS"],
  "kf-no-topping": ["SAUCE", "CHEESE", "STRUCTURE"],
};

const ladderOf = (r: Recipe) => buildHint5Ladder(r.id, RECIPE_LIST, ROLES)!;

describe("key-free ladder composition (OD-D3-21)", () => {
  for (const recipe of RECIPE_LIST) {
    it(`${recipe.id}: only the applicable rungs, no KEY_TOPPING`, () => {
      const ladder = ladderOf(recipe);
      expect(ladder).not.toBeNull();
      expect(ladder.rungs.map((r) => r.kind)).toEqual(EXPECTED_KINDS[recipe.id]);
      expect(ladder.rungs.map((r) => r.index)).toEqual(ladder.rungs.map((_, i) => i + 1));
      expect(ladder.total).toBe(recipe.requiredIngredients.length);
    });

    it(`${recipe.id}: no empty / dummy rung (every non-STRUCTURE rung has a subject)`, () => {
      const ladder = ladderOf(recipe);
      for (const rung of ladder.rungs) {
        if (rung.kind !== "STRUCTURE") expect(rung.subjectIds.length).toBeGreaterThan(0);
      }
    });
  }

  it("no-cheese / no-sauce / neither: the missing rung is simply absent", () => {
    expect(ladderOf(FIXTURES.noCheese).rungs.some((r) => r.kind === "CHEESE")).toBe(false);
    expect(ladderOf(FIXTURES.noSauce).rungs.some((r) => r.kind === "SAUCE")).toBe(false);
    const bare = ladderOf(FIXTURES.noSauceNoCheese).rungs.map((r) => r.kind);
    expect(bare).not.toContain("SAUCE");
    expect(bare).not.toContain("CHEESE");
  });

  it("SAUCE / CHEESE subjects are the recipe's own; SUB_CLASS follow catalog order whatever the recipe order", () => {
    const ladder = ladderOf(FIXTURES.full);
    expect(ladder.rungs[0].subjectIds).toEqual(["tomato-sauce"]);
    expect(ladder.rungs[1].subjectIds).toEqual(["mozzarella"]);
    const subs = ladder.rungs.filter((r) => r.kind === "SUB_CLASS");
    expect(subs.map((r) => r.subjectIds[0])).toEqual(catalogOrder(["black-olive", "oregano", "onion", "sausage"]));
    expect(subs.map((r) => r.ordinal)).toEqual([1, 2, 3, 4]);
  });

  it("fail closed: an unknown ingredient is not a target", () => {
    const bad = fixture("kf-bad", ["tomato-sauce", "no-such-ingredient"]);
    expect(hint5RolesValid(bad, { keyFree: true })).toBe(false);
    expect(buildHint5Ladder(bad.id, [bad], { [bad.id]: { keyFree: true } })).toBeNull();
  });

  it("a recipe absent from the roles table is not a target (no implicit key-free)", () => {
    expect(buildHint5Ladder(FIXTURES.full.id, RECIPE_LIST, {})).toBeNull();
  });
});

describe("key-free purchase + presentation (ordering / presentation regression)", () => {
  function walk(recipe: Recipe) {
    let stored: string[] = [];
    const labels: string[] = [];
    const boardKinds: string[][] = [];
    let spent = 0;
    for (let guard = 0; guard < 20; guard += 1) {
      const input = { recipeId: recipe.id, discoveredCount: 5, storedFactIds: stored, legacyPurchases: {}, pitzBalance: 1000 };
      const view = hint5Presentation(input, RECIPE_LIST, ROLES)!;
      boardKinds.push(view.board.map((e) => e.kind));
      for (const entry of view.board) if ("none" in entry) expect(entry.none).toBe(false);
      if (!view.next) {
        expect(view.completeText).not.toBeNull();
        break;
      }
      labels.push(view.next.labelJa);
      expect(view.next.price).toBe(HINT5_RUNG_PRICE[view.next.kind]);
      const result = requestHint5Rung({ ...input, expectedRungIndex: view.next.rungIndex }, RECIPE_LIST, ROLES);
      expect(result.outcome).toBe("ANSWERED");
      if (result.outcome !== "ANSWERED") break;
      expect(result.kind).toBe(view.next.kind);
      spent += result.charge;
      stored = [...stored, ...result.addFactIds];
    }
    return { stored, labels, boardKinds, spent };
  }

  for (const recipe of RECIPE_LIST) {
    it(`${recipe.id}: rungs are offered in order, numbered 1..n with no gap, at the normal prices`, () => {
      const { labels, spent, boardKinds } = walk(recipe);
      const kinds = EXPECTED_KINDS[recipe.id];
      expect(labels).toHaveLength(kinds.length);
      labels.forEach((label, i) => expect(label.startsWith(`ヒント${i + 1}: `)).toBe(true));
      expect(spent).toBe(kinds.reduce((sum, k) => sum + HINT5_RUNG_PRICE[k], 0));
      // the board grows one entry per purchase, in ladder order
      expect(boardKinds[boardKinds.length - 1]).toEqual(kinds);
      expect(labels.some((l) => l.includes("キートッピング"))).toBe(false);
    });
  }

  it("uses the same fact ids as the production ladder (no new fact kind)", () => {
    const { stored } = walk(FIXTURES.full);
    expect(stored).toEqual(expect.arrayContaining(["h5:sauce", "h5:cheese", "h5:structure"]));
    expect(stored.every((id) => /^(ing:|h5:|meta:|cls:)/.test(id))).toBe(true);
    expect(stored).not.toContain("h5:key");
  });

  it("SUB_CLASS entries stay hidden until STRUCTURE is completed, even if a cls: record is stored early", () => {
    const view = hint5Presentation(
      { recipeId: "kf-full", discoveredCount: 5, storedFactIds: ["h5:sauce", "cls:sausage"], legacyPurchases: {}, pitzBalance: 1000 },
      RECIPE_LIST,
      ROLES,
    )!;
    expect(view.board.map((e) => e.kind)).toEqual(["SAUCE"]);
    expect(view.next!.kind).toBe("CHEESE");
  });

  it("a stale / out-of-order request is refused with no rung skipped", () => {
    const stale = requestHint5Rung({ recipeId: "kf-no-cheese", discoveredCount: 5, storedFactIds: [], legacyPurchases: {}, expectedRungIndex: 2, pitzBalance: 1000 }, RECIPE_LIST, ROLES);
    expect(stale).toEqual({ outcome: "REJECTED", reason: "STALE" });
  });

  it("never reports an EMPTY (reserved) rung", () => {
    for (const recipe of RECIPE_LIST) {
      const own = hint5Ownership(ladderOf(recipe), [], {}, RECIPE_LIST);
      expect(own.statuses).not.toContain("EMPTY");
    }
  });
});

describe("production data stays key-ful", () => {
  it("no shipped recipe is key-free, and the roles table still covers exactly the 25", () => {
    expect(RECIPES).toHaveLength(25);
    expect(Object.keys(RECIPE_HINT_ROLES).sort()).toEqual(RECIPES.map((r) => r.id).sort());
    for (const roles of Object.values(RECIPE_HINT_ROLES)) expect(isKeyFreeRoles(roles)).toBe(false);
  });

  it("the shipped ladders still keep their fixed 4 rungs (empty CHEESE / KEY rungs included)", () => {
    expect(buildHint5Ladder("marinara")!.rungs.slice(0, 4).map((r) => r.kind)).toEqual(["SAUCE", "CHEESE", "KEY_TOPPING", "STRUCTURE"]);
    expect(buildHint5Ladder("marinara")!.rungs[1].subjectIds).toEqual([]);
    expect(buildHint5Ladder("quattro-formaggi")!.rungs[2].subjectIds).toEqual([]);
  });
});
