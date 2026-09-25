import type { DiscoveryLadder } from "../../data/discoveryLadder";

/**
 * Test-only support for the Discovery Ladder (I4a). Never imported by production code.
 *
 * - `buildKeyRecipeLadder`: a TypeScript port of REC-04's `key_recipe_ladder`
 *   (`tools/progression2_rec04_fresh_design.py` @ 6fe02e2d23610e926bab2367405fe9f717d25421), used to
 *   prove the authored ladder data equals what the confirmed rule derives from the recipe data.
 * - `W1_RECIPE_POPULATION_FIXTURE` / `REC04_W1_25_LADDER_FIXTURE`: the W1 recipe snapshot REC-04
 *   simulated (PR #221 @ 070afc0827f382bec8bc813d62e7fafe663a0991) and the 24-step ladder REC-04
 *   recorded for shipped 15 + W1 10 (`recommended.ladder` in
 *   `docs/reports/data/TETO_PROGRESS2_REC-04_FRESH-DESIGN.json`). Fixtures only: they exist to test
 *   that the logic extends to 25 recipes and that a regenerated ladder never re-locks. They are not
 *   W1 content -- W1 recipes/ingredients are not part of I4a.
 */

export interface LadderRecipe {
  id: string;
  ingredientIds: readonly string[];
}

export const REC04_STARTERS: readonly string[] = ["basil", "mozzarella", "tomato-sauce"];

function isSubset(items: readonly string[], owned: ReadonlySet<string>): boolean {
  return items.every((i) => owned.has(i));
}

function reachable(recipes: readonly LadderRecipe[], owned: ReadonlySet<string>): Set<string> {
  return new Set(recipes.filter((r) => isSubset(r.ingredientIds, owned)).map((r) => r.id));
}

/** Python's default string ordering (code point), which the REC-04 tool's tie-breaks rely on. */
function compareCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface KeyRecipeStep {
  ingredientIds: string[];
  keyRecipeId: string;
  newlyReachable: string[];
}

/** Port of `key_recipe_ladder`: each step unlocks the smallest missing set that completes >= 1 new
 *  recipe. Ties: most recipes newly reachable, then most reuse by still-unmakeable recipes, then
 *  recipe id. */
export function buildKeyRecipeLadder(
  recipes: readonly LadderRecipe[],
  starters: readonly string[] = REC04_STARTERS,
): KeyRecipeStep[] {
  const owned = new Set(starters);
  const steps: KeyRecipeStep[] = [];
  let remaining = recipes.filter((r) => !isSubset(r.ingredientIds, owned));
  while (remaining.length > 0) {
    const before = reachable(recipes, owned);
    let best: { key: [number, number, number, string]; recipe: LadderRecipe; missing: string[] } | null =
      null;
    for (const r of remaining) {
      const missing = [...new Set(r.ingredientIds.filter((i) => !owned.has(i)))].sort(compareCodePoint);
      const after = reachable(recipes, new Set([...owned, ...missing]));
      const gain = [...after].filter((id) => !before.has(id)).length;
      let reuse = 0;
      for (const x of recipes) {
        if (isSubset(x.ingredientIds, owned)) continue;
        for (const i of missing) if (x.ingredientIds.includes(i)) reuse += 1;
      }
      const key: [number, number, number, string] = [missing.length, -gain, -reuse, r.id];
      if (best === null || compareKey(key, best.key) < 0) best = { key, recipe: r, missing };
    }
    // `remaining` is non-empty, so `best` is always set here.
    const chosen = best!;
    for (const i of chosen.missing) owned.add(i);
    const now = reachable(recipes, owned);
    steps.push({
      ingredientIds: chosen.missing,
      keyRecipeId: chosen.recipe.id,
      newlyReachable: [...now].filter((id) => !before.has(id)).sort(compareCodePoint),
    });
    remaining = remaining.filter((x) => !isSubset(x.ingredientIds, owned));
  }
  return steps;
}

function compareKey(a: [number, number, number, string], b: [number, number, number, string]): number {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return (a[i] as number) - (b[i] as number);
  }
  return compareCodePoint(a[3], b[3]);
}

/** Wrap a derived step list as a `MATERIAL` ladder (W1: every step is `MATERIAL`). */
export function toMaterialLadder(populationId: string, steps: readonly KeyRecipeStep[]): DiscoveryLadder {
  return {
    populationId,
    steps: steps.map((s, index) => ({
      step: index + 1,
      kind: "MATERIAL" as const,
      ingredientIds: s.ingredientIds,
      keyRecipeId: s.keyRecipeId,
    })),
  };
}

/** REC-04 `inputs.w1Snapshot.recipes` (ingredient sets only; minCount does not affect the ladder). */
export const W1_RECIPE_POPULATION_FIXTURE: readonly LadderRecipe[] = [
  { id: "bambino", ingredientIds: ["corn", "ham", "mozzarella", "tomato-sauce"] },
  { id: "hawaiian", ingredientIds: ["ham", "mozzarella", "pineapple", "tomato-sauce"] },
  { id: "melanzane-pizza", ingredientIds: ["basil", "eggplant", "mozzarella", "tomato-sauce"] },
  { id: "new-haven-apizza", ingredientIds: ["clam", "garlic", "olive-oil", "parmigiano"] },
  {
    id: "parmigiana-pizza",
    ingredientIds: ["basil", "eggplant", "mozzarella", "parmigiano", "tomato-sauce"],
  },
  { id: "pesto-caprese", ingredientIds: ["basil", "fresh-tomato", "mozzarella", "pesto"] },
  { id: "pesto-patate", ingredientIds: ["bacon", "mozzarella", "pesto", "potato"] },
  { id: "pesto-tonno", ingredientIds: ["black-olive", "onion", "pesto", "tuna"] },
  {
    id: "pizza-portuguesa",
    ingredientIds: ["black-olive", "egg", "ham", "mozzarella", "onion", "tomato-sauce"],
  },
  {
    id: "puttanesca-pizza",
    ingredientIds: ["anchovy", "black-olive", "capers", "garlic", "tomato-sauce"],
  },
];

/** REC-04 `recommended.ladder` (24 steps, shipped 15 + W1 10), kind/items/keyRecipe only. */
export const REC04_W1_25_LADDER_FIXTURE: DiscoveryLadder = {
  populationId: "rec04-w1-25-fixture",
  steps: [
    ["egg", "bismarck"],
    ["bacon", "breakfast-pizza"],
    ["mushroom", "funghi"],
    ["eggplant", "melanzane-pizza"],
    ["parmigiano", "parmigiana-pizza"],
    ["pepperoni", "pepperoni"],
    ["sausage", "salsiccia"],
    ["ham", "meat-lovers"],
    ["corn", "bambino"],
    ["pineapple", "hawaiian"],
    ["black-olive+oregano", "capricciosa"],
    ["onion", "pizza-portuguesa"],
    ["olive-oil", "fugazza"],
    ["garlic", "marinara"],
    ["anchovy", "napoletana"],
    ["tuna", "tonno-e-cipolla"],
    ["pesto", "pesto-tonno"],
    ["cherry-tomato", "genovese"],
    ["clam", "new-haven-apizza"],
    ["fresh-tomato", "pesto-caprese"],
    ["potato", "pesto-patate"],
    ["rosemary", "pizza-bianca"],
    ["capers", "puttanesca-pizza"],
    ["fontina+gorgonzola", "quattro-formaggi"],
  ].map(([items, keyRecipeId], index) => ({
    step: index + 1,
    kind: "MATERIAL" as const,
    ingredientIds: items.split("+"),
    keyRecipeId,
  })),
};
