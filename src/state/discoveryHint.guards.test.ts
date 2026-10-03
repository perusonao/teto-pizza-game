import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { RECIPE_HINT_ROLES } from "../data/recipeHintRoles";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES, type Recipe } from "../data/recipes";
import { discoverableHintCandidates, selectHintTarget } from "../logic/discovery/hintTarget";
import { evaluateDiscovery } from "../logic/discovery/matcher";
import { signatureOfPizza } from "../logic/discovery/signature";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { hintSheetView, resolveHintSession, unlockNextHint, type DiscoveryHintState } from "./discoveryHint";
import { resolveShopEntitlement } from "./materialEntitlement";
import { createDefaultSave } from "./persistence";
import { createEmptyPizza } from "./pizzaState";

/**
 * Discovery 3.0 PR-4b-A guards (OD-4b-A-1..3): production stays 25 recipes on save schema v2, a pool > 1
 * never leaks its size through the target / sheet, and the Dex-0 migration edge case is pinned as a spec.
 */

function discover(ids: readonly string[]): DexState {
  let dex = EMPTY_DEX;
  for (const id of ids) {
    dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return dex;
}

/** A migrated save: the first `n` recipes found, their materials owned and stocked (several DISCOVERABLE). */
function legacy(n: number): DiscoveryHintState {
  const found = RECIPES.slice(0, n);
  const mats = [...new Set(found.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)))];
  const owned = [...new Set([...STARTER_INGREDIENT_IDS, ...mats])];
  const dex = discover(found.map((r) => r.id));
  return {
    dex,
    ownedIngredientIds: owned,
    unlockedForShopIngredientIds: resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds,
    inventory: Object.fromEntries(mats.map((m) => [m, 30])),
    preDiscoveryFreeCookAttempts: 0,
    hintSession: null,
    pitzBalance: 1000,
    discoveryHintPurchases: {},
    discoveryHintFacts: {},
  };
}

describe("PR-4b-A leaves production and the save schema alone", () => {
  it("production is 25 credited recipes + the non-credit brazilian-calabresa as No.26 (PR-4b-B) + the credited pesto-pollo as No.27", () => {
    expect(RECIPES).toHaveLength(27);
    expect(RECIPES[25].id).toBe("brazilian-calabresa");
    expect(RECIPES[26].id).toBe("pesto-pollo");
    expect((RECIPES as readonly Recipe[]).filter((r) => r.ladderCredit !== false)).toHaveLength(26);
    expect(RECIPE_DISCOVERY_CATALOG).toHaveLength(27);
    expect(Object.keys(RECIPE_HINT_ROLES)).toHaveLength(27);
  });

  it("the save is still schema v2 with the same top-level fields", () => {
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

describe("anti-leak: the pool size never reaches the target or the sheet", () => {
  it("pools of different sizes (all > 1) give the same target result, sheet view and session", () => {
    const states = [14, 15, 16].map(legacy);
    const sizes = states.map((s) => discoverableHintCandidates(s).length);
    expect(sizes.every((n) => n > 1)).toBe(true);
    expect(new Set(sizes).size).toBeGreaterThan(1);
    for (const s of states) {
      expect(selectHintTarget(s)).toEqual({ kind: "OPEN_POOL" });
      expect(hintSheetView(s, false)).toEqual({ kind: "CHOOSE_RESEARCH" });
      expect(resolveHintSession(s)).toBeNull();
    }
  });
});

describe("OD-4b-A-3: Dex-0 migration save with pool > 1 (recorded spec, no Margherita exception)", () => {
  const mats = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
  const dex0: DiscoveryHintState = {
    dex: EMPTY_DEX,
    ownedIngredientIds: INGREDIENTS.map((i) => i.id),
    unlockedForShopIngredientIds: mats,
    inventory: Object.fromEntries(mats.map((m) => [m, 10])),
    preDiscoveryFreeCookAttempts: 0,
    hintSession: null,
    pitzBalance: 1000,
    discoveryHintPurchases: {},
    discoveryHintFacts: {},
  };

  it("the general rule holds: pool > 1 means no auto-target, so the free Margherita onboarding Hint is not offered", () => {
    expect(discoverableHintCandidates(dex0).map((r) => r.id)).toContain("margherita");
    expect(discoverableHintCandidates(dex0).length).toBeGreaterThan(1);
    expect(selectHintTarget(dex0)).toEqual({ kind: "OPEN_POOL" });
    expect(resolveHintSession(dex0)).toBeNull();
    // #353: these are 2+ registered Research Entries with no target, so the sheet only offers to choose one.
    expect(hintSheetView(dex0, false)).toEqual({ kind: "CHOOSE_RESEARCH" });
    expect(unlockNextHint({ ...dex0, hintSession: { targetId: "margherita", revealedIndex: 0 } }, 1)).toBeNull();
  });

  it("not a softlock: Margherita is still discovered by Free Cooking (starter materials only), whatever is owned", () => {
    const pizza = {
      ...createEmptyPizza(),
      sauceIds: ["tomato-sauce"],
      bakeResult: 70,
      toppings: ["mozzarella", "mozzarella", "mozzarella", "basil", "basil"].map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 30 + i * 4, y: 50 })),
    };
    expect(evaluateDiscovery(signatureOfPizza(pizza), RECIPE_DISCOVERY_CATALOG, [])).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: "margherita" });
  });

  it("an ordinary new save (starters only) keeps the free Margherita onboarding Hint", () => {
    const fresh: DiscoveryHintState = { ...dex0, ownedIngredientIds: [...STARTER_INGREDIENT_IDS], unlockedForShopIngredientIds: [], inventory: {} };
    expect(selectHintTarget(fresh)).toEqual({ kind: "TARGET", recipeId: "margherita", source: "auto" });
  });
});
