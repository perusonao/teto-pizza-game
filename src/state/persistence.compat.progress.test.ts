import { describe, expect, it } from "vitest";
import { SAVE_STORAGE_KEY, loadSave, persistProgress, type PersistentSaveV2, type ProgressionSnapshot } from "./persistence";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX, type DexEntry, type DexState } from "./dex";
import { creditedDiscoveredCount, resolveShopEntitlement } from "./materialEntitlement";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import type { InventoryState } from "./inventory";
import { getRecipe } from "../data/recipes";
import { findOrderForRecipe } from "../data/orders";
import { getCookingProfile } from "../data/cookingProfiles";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { createCutState } from "../logic/cut/state";
import { DEFAULT_IDENTITY_DIMENSIONS } from "../logic/discovery/signature";
import type { RecipeDiscoveryTarget } from "../logic/discovery/matcher";
import { techniqueAffordanceStep } from "../logic/techniques/registration";
import { productionTechniqueContext, type TechniqueRuntimeContext } from "../logic/techniques/runtime";
import { isTrayAffordanceOpen } from "../logic/techniques/panSwitch";
import { W1_ORDER } from "../logic/testSupport/branchingFixture";
import { ladderSave, materialsUpTo } from "../logic/catalog/testSupport/catalogDerived";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";
import { V2_I4B } from "./testSupport/saveGoldenFixtures";
import { memoryStorage } from "./testSupport/memoryStorage";

/**
 * Save Compatibility Phase A (Issue #559): unlock conditions and mid-round reloads. Desired-behaviour tests unless the
 * title says "CURRENT BEHAVIOUR (known risk)", which pins today's behaviour only (see persistence.compat.risks.test.ts).
 */

const dexOf = (ids: readonly string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));

function snapshotOf(save: PersistentSaveV2): ProgressionSnapshot {
  return { ...save };
}

describe("material unlocks are a ledger (never re-locked, never re-announced)", () => {
  it("a stored entitlement stays unlocked even when the Dex no longer justifies it", () => {
    const result = resolveShopEntitlement(EMPTY_DEX, [...STARTER_INGREDIENT_IDS], ["onion"]);
    expect(result.unlockedForShopIngredientIds).toContain("onion");
    expect(result.newlyUnlockedMaterialIds).not.toContain("onion");
  });

  it("an existing save is unlocked retroactively on load, and a second resolve announces nothing (the 'already announced' marker is the ledger)", () => {
    const raw = ladderSave(8);
    const first = resolveShopEntitlement(loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(raw) })).dex, [], []);
    for (const id of materialsUpTo(8)) expect(first.unlockedForShopIngredientIds).toContain(id);

    const second = resolveShopEntitlement(dexOf(raw.dex.map((e) => e.recipeId)), [], first.unlockedForShopIngredientIds);
    expect(second.newlyUnlockedMaterialIds).toEqual([]);
    expect(second.unlockedForShopIngredientIds).toEqual(first.unlockedForShopIngredientIds);
  });

  it("the ledger is persisted by the ordinary save, so a reload does not unlock (or announce) the same material twice", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(ladderSave(8, { pitz: 5 })) });
    const loaded = loadSave(storage);
    const entitlement = resolveShopEntitlement(loaded.dex, loaded.ownedIngredientIds, loaded.unlockedForShopIngredientIds);
    persistProgress({ ...snapshotOf(loaded), unlockedForShopIngredientIds: entitlement.unlockedForShopIngredientIds }, storage);

    const reloaded = loadSave(storage);
    const again = resolveShopEntitlement(reloaded.dex, reloaded.ownedIngredientIds, reloaded.unlockedForShopIngredientIds);
    expect(again.newlyUnlockedMaterialIds).toEqual([]);
  });

  it("the unlock notice itself is never stored: the saved bytes carry no notice field", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(ladderSave(8)) });
    persistProgress(snapshotOf(loadSave(storage)), storage);
    const keys = Object.keys(JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!));
    expect(keys.filter((k) => /notice|announce|seen/i.test(k))).toEqual([]);
  });
});

describe("the tray / square-pan unlock is derived from the Dex, not stored (R6)", () => {
  const SYN_TRAY: RecipeDiscoveryTarget = {
    targetId: "syn:tray-pizza",
    recipeId: "syn-tray" as RecipeDiscoveryTarget["recipeId"],
    items: ["garlic", "mozzarella", "olive-oil", "tomato-sauce"],
    sauceBase: ["olive-oil", "tomato-sauce"],
    capabilities: [],
    identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, pan: "tray" },
    eligibility: { status: "ELIGIBLE" },
  };
  const TRAY_CONTEXT: TechniqueRuntimeContext = { ...productionTechniqueContext(), catalog: [...RECIPE_DISCOVERY_CATALOG, SYN_TRAY] };
  const STEP = techniqueAffordanceStep("tray", TRAY_CONTEXT.catalog, TRAY_CONTEXT.materialStep)!;

  it("in the production catalog (which holds the tray recipe grandma-pizza, E-2) the switch is derived from the Dex depth: closed on a fresh save, open on a complete one", () => {
    const production = productionTechniqueContext();
    const productionStep = techniqueAffordanceStep("tray", production.catalog, production.materialStep)!;
    for (const era of [ladderSave(0), ladderSave(8), ladderSave(20, { complete: true })]) {
      const dex = loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(era) })).dex;
      expect(isTrayAffordanceOpen(dex), `${creditedDiscoveredCount(dex)}`).toBe(creditedDiscoveredCount(dex) >= productionStep);
    }
    expect(isTrayAffordanceOpen(loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(ladderSave(0)) })).dex)).toBe(false);
    expect(isTrayAffordanceOpen(loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(ladderSave(20, { complete: true })) })).dex)).toBe(true);
  });

  it("a save has no tray / pan / square field, and writing never adds one", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: V2_I4B });
    persistProgress({ ...snapshotOf(loadSave(storage)), pitzBalance: 1 }, storage);
    const raw = storage.getItem(SAVE_STORAGE_KEY)!;
    expect(raw).not.toMatch(/tray|square|"pan"|panShape/i);
  });

  it("CURRENT BEHAVIOUR (known risk): the same stored bytes open or close the switch depending only on the catalog (no ledger)", () => {
    const dex = dexOf(W1_ORDER.slice(0, STEP));
    expect(creditedDiscoveredCount(dex)).toBeGreaterThanOrEqual(STEP);
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify({ schemaVersion: 2, dex, pitzBalance: 0, ownedIngredientIds: [], missionBest: {}, inventory: {} }) });
    const stored = storage.getItem(SAVE_STORAGE_KEY);

    expect(isTrayAffordanceOpen(loadSave(storage).dex, TRAY_CONTEXT)).toBe(true); // a catalog with a tray recipe
    expect(isTrayAffordanceOpen(loadSave(storage).dex, { ...TRAY_CONTEXT, catalog: RECIPE_DISCOVERY_CATALOG.filter((t) => t.recipeId !== "grandma-pizza") })).toBe(false); // a catalog without
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(stored); // nothing was written either way
  });

  it("a fewer-by-one Dex does not open it (the threshold is the credited discovery count)", () => {
    expect(isTrayAffordanceOpen(dexOf(W1_ORDER.slice(0, STEP - 1)), TRAY_CONTEXT)).toBe(false);
  });

  it.todo("SAFETY REQUIREMENT (decision pending, Phase B): once a player has seen the tray switch open, a catalog change does not close it again");
});

describe("a reload in the middle of a round", () => {
  function onions(count: number): PizzaState {
    return {
      ...createEmptyPizza(),
      sauceIds: ["olive-oil"],
      // fugazza = olive-oil + 4 onion + 1 oregano (src/data/recipes.ts); `count` onions beyond that are consumed too.
      toppings: [
        ...Array.from({ length: count }, (_, i) => ({ id: `onion-${i}`, ingredientId: "onion", x: i, y: i })),
        { id: "oregano-0", ingredientId: "oregano", x: 20, y: 20 },
      ],
    };
  }

  function bakingFugazza(inventory: InventoryState): GameState {
    const recipe = getRecipe("fugazza");
    const order = findOrderForRecipe("fugazza");
    if (!recipe || !order) throw new Error("Missing fugazza recipe/order fixture");
    const cookingProfile = getCookingProfile(recipe.id);
    const state = {
      ...createInitialGameState(EMPTY_DEX, [...STARTER_INGREDIENT_IDS, "onion"], 40, inventory),
      recipe,
      order,
      pizza: onions(5),
      isMissionRound: false,
      // A guided FREE round (the recipe was picked), so CONFIRM_BAKE scores it and REGISTER_TO_DEX writes the Dex.
      freeCook: false,
      roundKind: "GUIDED" as const,
      cookingProfile,
      cutState: createCutState(cookingProfile.cutConfig),
    };
    return gameReducer(state, { type: "START_BAKE" });
  }

  /** What App.tsx's persistence effect writes for a state. */
  function save(state: GameState, storage: ReturnType<typeof memoryStorage>) {
    persistProgress(
      {
        dex: state.dex,
        pitzBalance: state.pitzBalance,
        ownedIngredientIds: state.ownedIngredientIds,
        inventory: state.inventory,
        starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
        unlockedForShopIngredientIds: state.unlockedForShopIngredientIds,
        discoveryHintPurchases: state.discoveryHintPurchases,
        discoveryHintFacts: state.discoveryHintFacts,
        researchExclusions: state.researchExclusions,
        discoveredTechniqueIds: state.discoveredTechniqueIds,
      },
      storage,
    );
  }

  function reload(storage: ReturnType<typeof memoryStorage>): GameState {
    const s = loadSave(storage);
    return createInitialGameState(s.dex, s.ownedIngredientIds, s.pitzBalance, s.inventory, s.starterGrantClaimedRecipeIds, s.unlockedForShopIngredientIds, s.discoveryHintPurchases, s.discoveryHintFacts);
  }

  const baseSave = JSON.stringify({ schemaVersion: 2, dex: [], pitzBalance: 40, ownedIngredientIds: ["onion"], missionBest: {}, inventory: { onion: 20 } });

  it("before CONFIRM_BAKE a reload costs nothing: stock and Dex are as saved, and the round starts fresh", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: baseSave });
    const baking = bakingFugazza(loadSave(storage).inventory);
    save(baking, storage); // the effect may fire mid-round; nothing in progress is stored

    const after = reload(storage);
    expect(after.inventory.onion).toBe(20);
    expect(after.dex).toEqual([]);
    expect(after.phase).toBe("ORDER");
    expect(after.pizza.toppings).toEqual([]);
  });

  it("once CONFIRM_BAKE and REGISTER_TO_DEX have run and been saved, a reload keeps both the discovery and the consumed stock", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: baseSave });
    const baked = gameReducer(bakingFugazza(loadSave(storage).inventory), { type: "CONFIRM_BAKE", value: 70 });
    const atResult = walkPostBakeToResult(baked);
    const registered = gameReducer(atResult, { type: "REGISTER_TO_DEX" });
    save(registered, storage);

    const after = reload(storage);
    expect(after.inventory.onion).toBe(15);
    expect(after.dex.map((e) => e.recipeId)).toContain("fugazza");
    expect(after.pitzBalance).toBe(registered.pitzBalance);
  });

  it("CURRENT BEHAVIOUR (known risk): a reload between CONFIRM_BAKE and REGISTER_TO_DEX keeps the consumed stock but not the pizza", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: baseSave });
    const baked = gameReducer(bakingFugazza(loadSave(storage).inventory), { type: "CONFIRM_BAKE", value: 70 });
    expect(baked.inventory.onion).toBe(15);
    save(baked, storage); // the effect fires on the inventory change; the Dex has not been registered yet

    const after = reload(storage);
    expect(after.inventory.onion).toBe(15); // stock is gone ...
    expect(after.dex).toEqual([]); // ... with no discovery, BEST or Pitz to show for it
  });

  it.todo("SAFETY REQUIREMENT (decision pending, Phase B): consumption and registration are saved together or not at all in every round kind (Lunch Rush result screen included)");
});
