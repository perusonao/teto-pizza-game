import { describe, expect, it } from "vitest";
import { RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { DISCOVERY_LADDER, SHIPPED_15_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { resolveShopEntitlement } from "../state/materialEntitlement";
import type { DexEntry, DexState } from "../state/dex";

/**
 * Progression 2.0 W1 I5b-3: 25/25 reachability on the production 25-recipe / 24-step ladder
 * (Fresh Audit §11). A discovery needs every ingredient of a recipe; a player can own exactly the
 * starters + what the Shop entitlement ledger allows (materials are bought, never granted). No
 * state -- fresh, or migrated from any point of the old 15-recipe ladder -- may run out of
 * makeable undiscovered recipes before 25.
 */

const ALL = RECIPES as readonly Recipe[];
const PRE_W1 = ALL.filter((r) => r.id === "margherita" || r.unlockCondition);

function dexOf(ids: readonly string[]): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId: recipeId as RecipeId, discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }));
}

function makeable(recipes: readonly Recipe[], ledger: readonly string[]): Recipe[] {
  const owned = new Set([...STARTER_INGREDIENT_IDS, ...ledger]);
  return recipes.filter((r) => r.requiredIngredients.every((q) => owned.has(q.ingredientId)));
}

/** Plays forward on the production ladder from (discovered, ledger); returns the final count. */
function playForward(discovered: string[], ledger: readonly string[], pick: (options: Recipe[]) => Recipe): number {
  let current = [...ledger];
  for (let guard = 0; guard < 40; guard += 1) {
    current = [...resolveShopEntitlement(dexOf(discovered), [...STARTER_INGREDIENT_IDS], current).unlockedForShopIngredientIds];
    const options = makeable(ALL, current).filter((r) => !discovered.includes(r.id));
    if (options.length === 0) break;
    discovered.push(pick(options).id);
  }
  return discovered.length;
}

function seeded(seed: number): () => number {
  let x = seed * 9301 + 49297;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

describe("25/25 reachability on the production ladder", () => {
  it("the production ladder is the 24-step W1 ladder over 25 recipes", () => {
    expect(ALL).toHaveLength(25);
    expect(DISCOVERY_LADDER.steps).toHaveLength(24);
  });

  it("deterministic: from a fresh save, always taking the first / the last makeable recipe, reaches 25", () => {
    expect(playForward([], [], (o) => o[0])).toBe(25);
    expect(playForward([], [], (o) => o[o.length - 1])).toBe(25);
  });

  it("at every discovery count N there are at least N + 1 makeable recipes (no dead end)", () => {
    const ledger: string[] = [];
    for (let n = 0; n < ALL.length; n += 1) {
      const r = resolveShopEntitlement(dexOf(ALL.slice(0, n).map((x) => x.id)), [...STARTER_INGREDIENT_IDS], ledger);
      expect(makeable(ALL, r.unlockedForShopIngredientIds).length).toBeGreaterThanOrEqual(n + 1);
    }
  });

  it.each([0, 1, 5, 10, 15])("representative migration: %i old-ladder discoveries, then the switch, reaches 25", (k) => {
    // Progress on the old 15-recipe ladder, discovering in EP1 order where possible.
    const discovered: string[] = [];
    let ledger: string[] = [];
    for (let i = 0; i < k; i += 1) {
      ledger = [...resolveShopEntitlement(dexOf(discovered), [...STARTER_INGREDIENT_IDS], ledger, SHIPPED_15_DISCOVERY_LADDER).unlockedForShopIngredientIds];
      const next = makeable(PRE_W1, ledger).find((r) => !discovered.includes(r.id))!;
      discovered.push(next.id);
    }
    expect(playForward(discovered, ledger, (o) => o[0])).toBe(25);
  });

  it("2000 random playthroughs (random old-ladder progress, then the switch, random choices) all reach 25", () => {
    let stuck = 0;
    for (let seed = 0; seed < 2000; seed += 1) {
      const rand = seeded(seed);
      const discovered: string[] = [];
      let ledger: string[] = [];
      const k = Math.floor(rand() * 16);
      for (let i = 0; i < k; i += 1) {
        ledger = [...resolveShopEntitlement(dexOf(discovered), [...STARTER_INGREDIENT_IDS], ledger, SHIPPED_15_DISCOVERY_LADDER).unlockedForShopIngredientIds];
        const options = makeable(PRE_W1, ledger).filter((r) => !discovered.includes(r.id));
        if (options.length === 0) break;
        discovered.push(options[Math.floor(rand() * options.length)].id);
      }
      if (playForward(discovered, ledger, (o) => o[Math.floor(rand() * o.length)]) !== 25) stuck += 1;
    }
    expect(stuck).toBe(0);
  });
});
