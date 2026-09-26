import { describe, expect, it } from "vitest";
import { RECIPES, type Recipe } from "../data/recipes";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import {
  canStartGuidedRound,
  countRecipeDiscoveryStates,
  isRecipeCookable,
  recipeDiscoveryState,
  type RecipeDiscoveryInputs,
} from "./recipeDiscoveryState";
import { resolveShopEntitlement } from "./materialEntitlement";
import { recipeUnlocked } from "./progression";

const recipe = (id: string): Recipe => RECIPES.find((r) => r.id === id)!;
function discover(ids: readonly string[], dex: DexState = EMPTY_DEX): DexState {
  for (const id of ids) {
    dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return dex;
}
function inputs(partial: Partial<RecipeDiscoveryInputs>): RecipeDiscoveryInputs {
  const dex = partial.dex ?? EMPTY_DEX;
  const owned = partial.ownedIngredientIds ?? [...STARTER_INGREDIENT_IDS];
  return {
    dex,
    ownedIngredientIds: owned,
    unlockedForShopIngredientIds:
      partial.unlockedForShopIngredientIds ?? resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds,
    inventory: partial.inventory ?? {},
  };
}

describe("recipeDiscoveryState (W1-a1)", () => {
  it("fresh save: margherita DISCOVERABLE (starters only), every other recipe UNKNOWN", () => {
    const counts = countRecipeDiscoveryStates(RECIPES, inputs({}));
    expect(recipeDiscoveryState(recipe("margherita"), inputs({}))).toBe("DISCOVERABLE");
    expect(counts).toEqual({ DISCOVERED: 0, DISCOVERABLE: 1, KNOWN_BUT_MISSING_MATERIAL: 0, UNKNOWN: 24 });
  });

  it("first discovery: egg arrives in the Shop -> bismarck KBMM until bought, DISCOVERABLE with stock, KBMM again at stock 0", () => {
    const dex = discover(["margherita"]);
    expect(recipeDiscoveryState(recipe("margherita"), inputs({ dex }))).toBe("DISCOVERED");
    expect(recipeDiscoveryState(recipe("bismarck"), inputs({ dex }))).toBe("KNOWN_BUT_MISSING_MATERIAL");
    const owned = [...STARTER_INGREDIENT_IDS, "egg"];
    expect(recipeDiscoveryState(recipe("bismarck"), inputs({ dex, ownedIngredientIds: owned, inventory: { egg: 10 } }))).toBe("DISCOVERABLE");
    expect(recipeDiscoveryState(recipe("bismarck"), inputs({ dex, ownedIngredientIds: owned, inventory: { egg: 0 } }))).toBe(
      "KNOWN_BUT_MISSING_MATERIAL",
    );
    expect(recipeDiscoveryState(recipe("hawaiian"), inputs({ dex }))).toBe("UNKNOWN");
  });

  it("legacy save (15 discovered, EP4 materials owned) can hold several DISCOVERABLE at once", () => {
    const old15 = RECIPES.slice(0, 15).map((r) => r.id);
    const dex = discover(old15);
    const mats = [...new Set(RECIPES.slice(0, 15).flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)))];
    const owned = [...new Set([...STARTER_INGREDIENT_IDS, ...mats])];
    const inventory = Object.fromEntries(mats.map((m) => [m, 30]));
    const counts = countRecipeDiscoveryStates(RECIPES, inputs({ dex, ownedIngredientIds: owned, inventory }));
    expect(counts.DISCOVERED).toBe(15);
    expect(counts.DISCOVERABLE).toBeGreaterThanOrEqual(2);
    expect(counts.DISCOVERED + counts.DISCOVERABLE + counts.KNOWN_BUT_MISSING_MATERIAL + counts.UNKNOWN).toBe(25);
  });

  it("does not read the EP1 chain (OD-DISC-5): stripping unlockCondition/mysteryLock changes nothing", () => {
    const dex = discover(["margherita", "bismarck"]);
    const owned = [...STARTER_INGREDIENT_IDS, "egg", "bacon", "mushroom"];
    const inv = { egg: 10, bacon: 30, mushroom: 10 };
    for (const r of RECIPES) {
      const bare = { ...r, unlockCondition: undefined, mysteryLock: undefined } as Recipe;
      expect(recipeDiscoveryState(bare, inputs({ dex, ownedIngredientIds: owned, inventory: inv }))).toBe(
        recipeDiscoveryState(r, inputs({ dex, ownedIngredientIds: owned, inventory: inv })),
      );
    }
  });
});

describe("canStartGuidedRound / isRecipeCookable (LK-8, F-15)", () => {
  const owned = [...STARTER_INGREDIENT_IDS, "egg"];
  it("rejects an undiscovered recipe even when fully cookable", () => {
    expect(canStartGuidedRound("margherita", { dex: EMPTY_DEX, ownedIngredientIds: [...STARTER_INGREDIENT_IDS], inventory: {} })).toBe(false);
    expect(canStartGuidedRound("bismarck", { dex: discover(["margherita"]), ownedIngredientIds: owned, inventory: { egg: 10 } })).toBe(false);
  });

  it("accepts a discovered recipe with starters (unlimited) or enough finite stock", () => {
    const dex = discover(["margherita", "bismarck"]);
    expect(canStartGuidedRound("margherita", { dex, ownedIngredientIds: [...STARTER_INGREDIENT_IDS], inventory: {} })).toBe(true);
    expect(canStartGuidedRound("bismarck", { dex, ownedIngredientIds: owned, inventory: { egg: 10 } })).toBe(true);
  });

  it("rejects a discovered recipe that is owned but out of stock, or below its own minCount", () => {
    const dex = discover(["margherita", "bismarck"]);
    expect(canStartGuidedRound("bismarck", { dex, ownedIngredientIds: owned, inventory: { egg: 0 } })).toBe(false);
    expect(canStartGuidedRound("bismarck", { dex, ownedIngredientIds: [...STARTER_INGREDIENT_IDS], inventory: { egg: 10 } })).toBe(false);
    const meat = recipe("meat-lovers");
    const ham = meat.requiredIngredients.find((q) => q.ingredientId === "ham")!;
    const full = Object.fromEntries(meat.requiredIngredients.map((q) => [q.ingredientId, 99]));
    const ownedAll = [...STARTER_INGREDIENT_IDS, ...meat.requiredIngredients.map((q) => q.ingredientId)];
    expect(isRecipeCookable(meat, { ownedIngredientIds: ownedAll, inventory: full })).toBe(true);
    expect(isRecipeCookable(meat, { ownedIngredientIds: ownedAll, inventory: { ...full, ham: ham.minCount - 1 } })).toBe(false);
  });

  it("rejects unknown recipe ids", () => {
    expect(canStartGuidedRound("brazilian-calabresa", { dex: discover(["margherita"]), ownedIngredientIds: owned, inventory: {} })).toBe(false);
  });
});

describe("OD-DISC-5: EP1 is out of every W1 gate", () => {
  it("any discovered recipe is EP1-unlocked (A2), so the Lunch Rush pool (discovered ∩ available) is ownership-only", () => {
    // Discover every recipe one at a time in reverse chain order -- no EP1 predecessor is ever
    // discovered first -- and check each one is unlocked the moment it is discovered.
    const ids = [...RECIPES].reverse().map((r) => r.id);
    for (let n = 1; n <= ids.length; n++) {
      const dex = discover(ids.slice(0, n));
      for (const id of ids.slice(0, n)) expect(recipeUnlocked(recipe(id), dex), `${id} @${n}`).toBe(true);
    }
  });
});
