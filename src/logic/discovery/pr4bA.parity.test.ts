import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { RECIPE_HINT_ROLES, type HintRoles } from "../../data/recipeHintRoles";
import { inLunchRush, RECIPES, type Recipe, type RecipeId } from "../../data/recipes";
import { hintSheetView, resolveHintSession, type DiscoveryHintState } from "../../state/discoveryHint";
import { createDefaultSave } from "../../state/persistence";
import { buildPizzaSelectView } from "../../state/pizzaSelect";
import { cookableMissionRecipeIds, missionOrderRecipeIds } from "../../mission/lunchRush";
import { isKeyFreeHintRoles } from "./hint5Ladder";
import { discoverableHintCandidates, selectHintTarget } from "./hintTarget";
import { W1_ORDER, walkState } from "../testSupport/branchingFixture";

/**
 * Discovery 3.0 PR-4b-A: the existing 25 are untouched. This PR adds rules that only act on a pool larger than
 * one (no auto-target, an aggregated Dex notice) and foundations (`lunchRush: false`, `HintRoles`); the 25
 * production recipes are not changed, and the normal W1 walk never reaches a pool > 1, so nothing a player sees
 * moves. Pinned here so a later change that adds a recipe cannot silently alter the 25.
 */

describe("production recipes: PR-4b-A adds none", () => {
  it("is exactly 25 recipes, none new, no brazilian-calabresa", () => {
    expect(RECIPES).toHaveLength(25);
    expect(RECIPES.map((r) => r.id)).not.toContain("brazilian-calabresa");
    expect(RECIPE_DISCOVERY_CATALOG).toHaveLength(25);
    expect(Object.keys(RECIPE_HINT_ROLES)).toHaveLength(25);
  });

  it("no production recipe opts out of the ladder or Lunch Rush, and none is key-free", () => {
    for (const r of RECIPES) {
      expect((r as Recipe).ladderCredit, r.id).toBeUndefined();
      expect((r as Recipe).lunchRush, r.id).toBeUndefined();
      expect(inLunchRush(r.id), r.id).toBe(true);
      expect(isKeyFreeHintRoles(RECIPE_HINT_ROLES[r.id]), r.id).toBe(false);
    }
  });
});

describe("RECIPE_HINT_ROLES is typed HintRoles (PR-4b-A)", () => {
  it("accepts a key-free entry for any RecipeId without another type change (compile-time), and the table is unchanged", () => {
    const table: Readonly<Record<RecipeId, HintRoles>> = { ...RECIPE_HINT_ROLES, hawaiian: { keyFree: true } };
    expect(isKeyFreeHintRoles(table.hawaiian)).toBe(true);
    expect(isKeyFreeHintRoles(RECIPE_HINT_ROLES.hawaiian)).toBe(false);
    expect(RECIPE_HINT_ROLES.margherita).toEqual({ hintKeyToppingId: "basil", hintSubToppingOrder: [] });
  });
});

describe("the normal W1 progression never reaches a pool > 1 and keeps its automatic target", () => {
  it.each(W1_ORDER.map((_, i) => i))("after %i discoveries: exactly one DISCOVERABLE recipe, the W1 key recipe, auto-targeted", (count) => {
    const s = walkState(W1_ORDER.slice(0, count));
    expect(discoverableHintCandidates(s).map((r) => r.id)).toEqual([W1_ORDER[count]]);
    expect(selectHintTarget(s)).toEqual({ kind: "TARGET", recipeId: W1_ORDER[count], source: "auto" });
    const hint: DiscoveryHintState = {
      dex: s.dex,
      ownedIngredientIds: s.ownedIngredientIds,
      unlockedForShopIngredientIds: s.unlockedForShopIngredientIds,
      inventory: s.inventory,
      preDiscoveryFreeCookAttempts: 0,
      hintSession: null,
      pitzBalance: 100,
      discoveryHintPurchases: {},
      discoveryHintFacts: {},
    };
    expect(resolveHintSession(hint)).toMatchObject({ targetId: W1_ORDER[count] });
    expect(hintSheetView(hint).kind).not.toBe("POOL");
  });

  it("a Dex pin with a pool of one is still honoured (source dex)", () => {
    const s = walkState(W1_ORDER.slice(0, 5));
    expect(selectHintTarget(s, { pinnedRecipeId: W1_ORDER[5] })).toEqual({ kind: "TARGET", recipeId: W1_ORDER[5], source: "dex" });
  });
});

describe("Lunch Rush: the flag is the only thing that changes the pool", () => {
  const full = walkState(W1_ORDER.slice(0, 12));
  const inputs = { dex: full.dex, ownedIngredientIds: full.ownedIngredientIds, inventory: full.inventory };

  it("without the flag the pool is exactly what it was", () => {
    const ids = missionOrderRecipeIds(inputs);
    expect(ids.length).toBeGreaterThan(5);
    expect(ids).toEqual(missionOrderRecipeIds(inputs, [], RECIPES));
  });

  it("a recipe with lunchRush: false is out of the order pool and the cookable pool, and nothing else moves", () => {
    const flagged = RECIPES.map((r) => (r.id === "salsiccia" ? { id: r.id, lunchRush: false as const } : { id: r.id }));
    const base = missionOrderRecipeIds(inputs);
    expect(base).toContain("salsiccia");
    expect(missionOrderRecipeIds(inputs, [], flagged)).toEqual(base.filter((id) => id !== "salsiccia"));
    expect(cookableMissionRecipeIds(inputs, [], flagged)).not.toContain("salsiccia");
    expect(cookableMissionRecipeIds(inputs, [], flagged)).toEqual(cookableMissionRecipeIds(inputs).filter((id) => id !== "salsiccia"));
  });

  it("an excluded recipe stays discoverable, guided-startable data-wise: only the Lunch Rush pool changes", () => {
    const flagged = [{ id: "salsiccia", lunchRush: false as const }];
    expect(inLunchRush("salsiccia", flagged)).toBe(false);
    expect(inLunchRush("margherita", flagged)).toBe(true);
    expect(inLunchRush("no-such-recipe", flagged)).toBe(true);
    // The flag does not touch the discovery pool.
    expect(discoverableHintCandidates(walkState(W1_ORDER.slice(0, 6))).map((r) => r.id)).toEqual([W1_ORDER[6]]);
  });
});

describe("anti-leak: nothing a pool > 1 shows carries the candidate count", () => {
  function pooled(found: number): DiscoveryHintState {
    const old15 = RECIPES.slice(0, 15);
    const mats = [...new Set(old15.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)))];
    const base = walkState(RECIPES.slice(0, found).map((r) => r.id));
    return {
      dex: base.dex,
      ownedIngredientIds: [...new Set([...base.ownedIngredientIds, ...mats])],
      unlockedForShopIngredientIds: base.unlockedForShopIngredientIds,
      inventory: Object.fromEntries(mats.map((m) => [m, 30])),
      preDiscoveryFreeCookAttempts: 0,
      hintSession: null,
      pitzBalance: 1000,
      discoveryHintPurchases: {},
      discoveryHintFacts: {},
    };
  }
  const states = [8, 10, 12].map(pooled);

  it("the pools differ in size, yet the target result and the sheet view are the same value", () => {
    const sizes = states.map((s) => discoverableHintCandidates(s).length);
    expect(sizes.every((n) => n > 1)).toBe(true);
    expect(new Set(sizes).size).toBeGreaterThan(1);
    for (const s of states) {
      expect(selectHintTarget(s)).toEqual({ kind: "POOL" });
      expect(hintSheetView(s)).toEqual({ kind: "POOL" });
      expect(resolveHintSession(s)).toBeNull();
    }
  });

  it("Pizza Select's prompt carries no candidate count", () => {
    const view = buildPizzaSelectView(states[0]);
    expect(view.prompt).toEqual({ kind: "DISCOVERABLE" });
  });
});

describe("save schema is unchanged", () => {
  it("still schema v2 with the same top-level fields", () => {
    expect(createDefaultSave().schemaVersion).toBe(2);
    expect(Object.keys(createDefaultSave()).sort()).toEqual([
      "dex",
      "dinnerMissionRecordsState",
      "discoveredTechniqueIds",
      "discoveryHintFacts",
      "discoveryHintPurchases",
      "inventory",
      "missionBest",
      "ownedIngredientIds",
      "pitzBalance",
      "schemaVersion",
      "starterGrantClaimedRecipeIds",
      "unlockedForShopIngredientIds",
    ]);
  });
});
