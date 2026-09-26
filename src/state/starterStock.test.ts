import { describe, expect, it } from "vitest";
import { applyStarterGrants, STARTER_STOCK_PLAYS_CHAPTER_1 } from "./starterStock";
import { registerScoreToDex, EMPTY_DEX, type DexState } from "./dex";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { hasStock, remainingStock, EMPTY_INVENTORY, type InventoryState } from "./inventory";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import type { QualityStars } from "../logic/scoring";
import { getRecipe } from "../data/recipes";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";
import { createGuidedInitialState } from "./testSupport/guidedRound";

/**
 * Economy & Progression 1.0 EP4: dedicated unit/integration tests for the Starter Grant
 * (../state/starterStock.ts). Complements the EP1/EP2/EP3 regression suites (progression.test.ts,
 * inventory.test.ts, gameReducer.inventoryConsumption.test.ts, gameReducer.restock.test.ts),
 * which pin that this feature doesn't change any of those systems' own established behavior.
 */

/** Builds a Dex where `recipeIds` are discovered at `stars` each, in order -- mirrors the same
 *  helper this codebase's other progression-adjacent test files already use. */
function dexDiscovering(recipeIds: readonly string[], stars: QualityStars): DexState {
  let dex: DexState = EMPTY_DEX;
  for (const recipeId of recipeIds) {
    dex = registerScoreToDex(dex, recipeId, {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: stars * 20,
      stars,
    }).dex;
  }
  return dex;
}

describe("STARTER_STOCK_PLAYS_CHAPTER_1", () => {
  it("is the named constant 10", () => {
    expect(STARTER_STOCK_PLAYS_CHAPTER_1).toBe(10);
  });
});

describe("applyStarterGrants: Margherita exemption", () => {
  it("never grants anything for margherita, even though it is always unlocked", () => {
    const result = applyStarterGrants(EMPTY_DEX, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    expect(result.grantedRecipeIds).toEqual([]);
    expect(result.inventory).toBe(EMPTY_INVENTORY);
    expect(result.ownedIngredientIds).toBe(STARTER_INGREDIENT_IDS);
    expect(result.claimedRecipeIds).toEqual([]);
  });

  it("margherita's own ingredients stay permanently unlimited regardless of inventory", () => {
    for (const id of ["tomato-sauce", "mozzarella", "basil"]) {
      const ingredient = getIngredient(id)!;
      expect(ingredient.unlockCondition).toBeUndefined();
      expect(hasStock(ingredient, {}, 9999)).toBe(true);
      expect(remainingStock(ingredient, {})).toBe("UNLIMITED");
    }
  });

  it("margherita is never added to starterGrantClaimedRecipeIds even after every other recipe unlocks", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    expect(result.claimedRecipeIds).not.toContain("margherita");
  });
});

describe("applyStarterGrants: Recipe #2-#7 grant amounts", () => {
  it("Recipe #2 (funghi) grants mushroom = minCount(3) x 10 = 30 on first unlock", () => {
    const dex = dexDiscovering(["margherita"], 1 as QualityStars);
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    expect(result.grantedRecipeIds).toEqual(["funghi"]);
    expect(result.inventory).toEqual({ mushroom: 30 });
    expect(result.ownedIngredientIds).toContain("mushroom");
    expect(result.claimedRecipeIds).toEqual(["funghi"]);
  });

  it("Recipe #3 (marinara) grants garlic = 3x10=30 and oregano = 2x10=20", () => {
    const dex = dexDiscovering(["margherita", "funghi"], 1 as QualityStars);
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, ["funghi"]);
    expect(result.grantedRecipeIds).toEqual(["marinara"]);
    expect(result.inventory).toEqual({ garlic: 30, oregano: 20 });
  });

  it("Recipe #4 (bismarck) grants egg = 1x10=10 (tomato-sauce/mozzarella stay ungranted)", () => {
    const dex = dexDiscovering(["margherita", "funghi", "marinara"], 1 as QualityStars);
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, [
      "funghi",
      "marinara",
    ]);
    expect(result.grantedRecipeIds).toEqual(["bismarck"]);
    expect(result.inventory).toEqual({ egg: 10 });
  });

  it("Recipe #5 (genovese) grants pesto = 10 (spread/sauce) and cherry-tomato = 3x10=30", () => {
    const dex = dexDiscovering(["margherita", "funghi", "marinara", "bismarck"], 1 as QualityStars);
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, [
      "funghi",
      "marinara",
      "bismarck",
    ]);
    expect(result.grantedRecipeIds).toEqual(["genovese"]);
    expect(result.inventory).toEqual({ pesto: 10, "cherry-tomato": 30 });
  });

  it("Recipe #6 (quattro-formaggi, requires genovese discovered + 8 stars) grants olive-oil=10, gorgonzola/parmigiano/fontina = 2x10=20 each", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese"],
      5 as QualityStars, // 5 discoveries x 5 stars = 25 totalStars, >= 8
    );
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, [
      "funghi",
      "marinara",
      "bismarck",
      "genovese",
    ]);
    expect(result.grantedRecipeIds).toEqual(["quattro-formaggi"]);
    expect(result.inventory).toEqual({ "olive-oil": 10, gorgonzola: 20, parmigiano: 20, fontina: 20 });
  });

  it("Recipe #7 (fugazza) grants onion = 4x10=40, and floors (not adds onto) olive-oil/oregano against quattro-formaggi/marinara's own untouched grants", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars, // >= 12 totalStars for fugazza's own gate
    );
    // Simulate marinara's and quattro-formaggi's own grants already having landed (oregano 20,
    // olive-oil 10), exactly as production would have applied them at those earlier moments,
    // and never touched since (Case A: the "never consumed" shared-ingredient scenario).
    const priorInventory: InventoryState = {
      garlic: 30,
      oregano: 20,
      egg: 10,
      pesto: 10,
      "cherry-tomato": 30,
      "olive-oil": 10,
      gorgonzola: 20,
      parmigiano: 20,
      fontina: 20,
      mushroom: 30,
    };
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, priorInventory, [
      "funghi",
      "marinara",
      "bismarck",
      "genovese",
      "quattro-formaggi",
    ]);
    expect(result.grantedRecipeIds).toEqual(["fugazza"]);
    expect(result.inventory.onion).toBe(40);
    // Economy Tuning 1 P0b: floor (Math.max), not add. Both shared ingredients already exceed
    // fugazza's own 10-play grant amount, so neither changes -- no stacking on top of what
    // marinara/quattro-formaggi already granted.
    expect(result.inventory["olive-oil"]).toBe(10); // max(10, 10) -- unchanged, not 20
    expect(result.inventory.oregano).toBe(20); // max(20, 10) -- unchanged, not 30
    expect(result.ownedIngredientIds).toContain("onion");
  });

  // Economy & Progression 1.0 EP4 (finalized product decision, EP4 Result report §7): onion's
  // old Phase 3C-6 manual-purchase path is retired -- its Starter Grant is now the *only* path
  // to first ownership, so this exactly-once guarantee is exactly as load-bearing for onion as
  // it already is for every other Starter Grant ingredient (the generic "exactly-once" describe
  // block below covers the same code path with margherita/funghi; this test pins it against
  // fugazza/onion specifically, per the task's own required scenario).
  it("does not double-grant onion when fugazza's own unlock is (re-)evaluated again with the same claimed ledger", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    const alreadyClaimed = [
      "funghi",
      "marinara",
      "bismarck",
      "genovese",
      "quattro-formaggi",
      "fugazza",
    ];
    // Simulates: reload, PLAY_AGAIN, RETRY_SAME_RECIPE, HOME round-trip, Shop open/close, a
    // second REGISTER_TO_DEX/MISSION_NEXT_ORDER call -- fugazza is already claimed.
    const priorInventory: InventoryState = { onion: 40 };
    const priorOwned = [...STARTER_INGREDIENT_IDS, "onion"];
    const result = applyStarterGrants(dex, priorOwned, priorInventory, alreadyClaimed);
    expect(result.grantedRecipeIds).toEqual([]);
    expect(result.inventory).toEqual({ onion: 40 }); // still 40, never 80
    expect(result.inventory).toBe(priorInventory); // same reference -- no-op, not just same value
    expect(result.ownedIngredientIds).toBe(priorOwned);
    expect(result.claimedRecipeIds).toBe(alreadyClaimed);
  });
});

/**
 * Recipe Expansion Batch 1A (docs/reports/TETO_RECIPE-EXPANSION_BATCH-1A_Implementation-Result.md):
 * dedicated Starter Grant coverage for the 4 new recipes (#8-#11), mirroring the #2-#7 suite
 * above exactly -- each recipe's own grant is `minCount x STARTER_STOCK_PLAYS_CHAPTER_1` per
 * scatter ingredient, granted exactly once, gated by the same chain unlockCondition.
 */
describe("applyStarterGrants: Batch 1A recipe grant amounts (#8-#11)", () => {
  const CHAIN_TO_FUGAZZA = [
    "margherita",
    "funghi",
    "marinara",
    "bismarck",
    "genovese",
    "quattro-formaggi",
    "fugazza",
  ];

  // `mozzarella` has no `unlockCondition` -- it is a Starter (permanently-unlimited) ingredient
  // exactly like `tomato-sauce`/`basil` (see ../data/ingredients.ts's STARTER_INGREDIENT_IDS),
  // so `starterGrantForRecipe` skips it entirely (see that function's own doc comment) even
  // though every Batch 1A recipe requires it -- no inventory entry, ever, for a Starter
  // ingredient. Only the genuinely finite (unlockCondition-bearing) new toppings get a grant.
  it("Recipe #8 (salsiccia, requires fugazza discovered + 16 stars) grants sausage=3x10=30 only (mozzarella stays ungranted/unlimited)", () => {
    const dex = dexDiscovering(CHAIN_TO_FUGAZZA, 5 as QualityStars); // 7 x 5 = 35 >= 16
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, [
      "funghi",
      "marinara",
      "bismarck",
      "genovese",
      "quattro-formaggi",
      "fugazza",
    ]);
    expect(result.grantedRecipeIds).toEqual(["salsiccia"]);
    expect(result.inventory).toEqual({ sausage: 30 });
    expect(result.ownedIngredientIds).toContain("sausage");
  });

  it("Recipe #9 (pepperoni, requires salsiccia discovered + 20 stars) grants pepperoni=4x10=40 only", () => {
    const dex = dexDiscovering([...CHAIN_TO_FUGAZZA, "salsiccia"], 5 as QualityStars); // 8x5=40>=20
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, [
      "funghi",
      "marinara",
      "bismarck",
      "genovese",
      "quattro-formaggi",
      "fugazza",
      "salsiccia",
    ]);
    expect(result.grantedRecipeIds).toEqual(["pepperoni"]);
    expect(result.inventory).toEqual({ pepperoni: 40 });
  });

  it("Recipe #10 (napoletana, requires pepperoni discovered + 24 stars) grants anchovy=3x10=30, and floors oregano against marinara's existing grant", () => {
    const dex = dexDiscovering(
      [...CHAIN_TO_FUGAZZA, "salsiccia", "pepperoni"],
      5 as QualityStars, // 9x5=45>=24
    );
    const priorInventory: InventoryState = { oregano: 20 }; // marinara's own untouched grant
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, priorInventory, [
      "funghi",
      "marinara",
      "bismarck",
      "genovese",
      "quattro-formaggi",
      "fugazza",
      "salsiccia",
      "pepperoni",
    ]);
    expect(result.grantedRecipeIds).toEqual(["napoletana"]);
    expect(result.inventory.anchovy).toBe(30);
    // napoletana's own oregano grant is 1x10=10; floor keeps marinara's existing 20 unchanged.
    expect(result.inventory.oregano).toBe(20);
  });

  it("Recipe #11 (tonno-e-cipolla, requires napoletana discovered + 28 stars) grants tuna=3x10=30, and floors onion against fugazza's existing 40", () => {
    const dex = dexDiscovering(
      [...CHAIN_TO_FUGAZZA, "salsiccia", "pepperoni", "napoletana"],
      5 as QualityStars, // 10x5=50>=28
    );
    const priorInventory: InventoryState = { onion: 40 }; // fugazza's own untouched grant
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, priorInventory, [
      "funghi",
      "marinara",
      "bismarck",
      "genovese",
      "quattro-formaggi",
      "fugazza",
      "salsiccia",
      "pepperoni",
      "napoletana",
    ]);
    expect(result.grantedRecipeIds).toEqual(["tonno-e-cipolla"]);
    expect(result.inventory.tuna).toBe(30);
    // tonno-e-cipolla's own onion grant is 2x10=20; floor keeps fugazza's existing 40 unchanged.
    expect(result.inventory.onion).toBe(40);
  });

  it.each(["salsiccia", "pepperoni", "napoletana", "tonno-e-cipolla"])(
    "%s is never re-granted once already claimed (exact-once ledger)",
    (recipeId) => {
      const dex = dexDiscovering(
        [...CHAIN_TO_FUGAZZA, "salsiccia", "pepperoni", "napoletana", "tonno-e-cipolla"],
        5 as QualityStars,
      );
      const alreadyClaimed = [
        "funghi",
        "marinara",
        "bismarck",
        "genovese",
        "quattro-formaggi",
        "fugazza",
        "salsiccia",
        "pepperoni",
        "napoletana",
        "tonno-e-cipolla",
        // pizza-bianca's own unlockCondition (requiresRecipeId: tonno-e-cipolla,
        // minTotalStars: 32) is also satisfied by this test's 10x5=50-star chain, so it must
        // already be claimed here too, or it would be newly (correctly) granted by this exact
        // call -- this test's subject is Batch 1A's own exact-once ledger, not Batch 1B-A's.
        "pizza-bianca",
      ];
      const priorInventory: InventoryState = {
        sausage: 30,
        pepperoni: 40,
        anchovy: 30,
        oregano: 20,
        tuna: 30,
        onion: 40,
      };
      const priorOwned = [...STARTER_INGREDIENT_IDS, "sausage", "pepperoni", "anchovy", "tuna", "onion"];
      const result = applyStarterGrants(dex, priorOwned, priorInventory, alreadyClaimed);
      expect(result.grantedRecipeIds).toEqual([]);
      expect(result.inventory).toBe(priorInventory);
      expect(result.ownedIngredientIds).toBe(priorOwned);
      expect(result.claimedRecipeIds).toBe(alreadyClaimed);
      expect(recipeId).toBeTruthy(); // parameterized purely for a readable test name per recipe
    },
  );

});

describe("applyStarterGrants: Batch 1B-B recipe grant amounts (#14, capricciosa)", () => {
  const CHAIN_TO_BREAKFAST_PIZZA = [
    "margherita",
    "funghi",
    "marinara",
    "bismarck",
    "genovese",
    "quattro-formaggi",
    "fugazza",
    "salsiccia",
    "pepperoni",
    "napoletana",
    "tonno-e-cipolla",
    "pizza-bianca",
    "breakfast-pizza",
  ];
  const ALREADY_CLAIMED = [
    "funghi",
    "marinara",
    "bismarck",
    "genovese",
    "quattro-formaggi",
    "fugazza",
    "salsiccia",
    "pepperoni",
    "napoletana",
    "tonno-e-cipolla",
    "pizza-bianca",
    "breakfast-pizza",
  ];

  it("Recipe #14 (capricciosa, requires breakfast-pizza discovered + 40 stars) grants ham=1x10=10 and black-olive=2x10=20 fresh, and floors mushroom/oregano against their existing grants (no duplicate-farming stacking)", () => {
    const dex = dexDiscovering(CHAIN_TO_BREAKFAST_PIZZA, 5 as QualityStars); // 13x5=65>=40
    // funghi's own untouched mushroom grant (3x10=30) and marinara's own untouched oregano
    // grant (2x10=20) -- capricciosa's own mushroom/oregano minCount (2, 1) would only ask for
    // 20/10, both lower than what's already stocked.
    const priorInventory: InventoryState = { mushroom: 30, oregano: 20 };
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, priorInventory, ALREADY_CLAIMED);
    expect(result.grantedRecipeIds).toEqual(["capricciosa"]);
    expect(result.inventory.ham).toBe(10);
    expect(result.inventory["black-olive"]).toBe(20);
    // Floor, not add: capricciosa's own mushroom (20)/oregano (10) grant never stacks on top of
    // the existing 30/20 -- the shared ingredient is only ever topped up to the higher floor.
    expect(result.inventory.mushroom).toBe(30);
    expect(result.inventory.oregano).toBe(20);
    expect(result.ownedIngredientIds).toContain("ham");
    expect(result.ownedIngredientIds).toContain("black-olive");
  });

  it("capricciosa is never re-granted once already claimed (exact-once ledger, no farming via repeated calls)", () => {
    const dex = dexDiscovering(CHAIN_TO_BREAKFAST_PIZZA, 5 as QualityStars);
    const alreadyClaimedWithCapricciosa = [...ALREADY_CLAIMED, "capricciosa"];
    const priorInventory: InventoryState = {
      mushroom: 30,
      oregano: 20,
      ham: 10,
      "black-olive": 20,
    };
    const priorOwned = [...STARTER_INGREDIENT_IDS, "ham", "black-olive"];
    const result = applyStarterGrants(dex, priorOwned, priorInventory, alreadyClaimedWithCapricciosa);
    expect(result.grantedRecipeIds).toEqual([]);
    expect(result.inventory).toBe(priorInventory);
    expect(result.ownedIngredientIds).toBe(priorOwned);
    expect(result.claimedRecipeIds).toBe(alreadyClaimedWithCapricciosa);
  });

});

describe("applyStarterGrants: scatter vs spread/sauce derivation", () => {
  it("every scatter ingredient's grant is exactly requiredIngredients.minCount x STARTER_STOCK_PLAYS_CHAPTER_1", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    const genovese = getRecipe("genovese")!;
    const cherryTomatoReq = genovese.requiredIngredients.find((r) => r.ingredientId === "cherry-tomato")!;
    expect(getIngredient("cherry-tomato")!.placement).toBe("scatter");
    expect(result.inventory["cherry-tomato"]).toBe(cherryTomatoReq.minCount * STARTER_STOCK_PLAYS_CHAPTER_1);
  });

  it("every spread/sauce ingredient's grant is exactly STARTER_STOCK_PLAYS_CHAPTER_1 (1 use x plays), independent of minCount", () => {
    const dex = dexDiscovering(["margherita", "funghi", "marinara", "bismarck"], 1 as QualityStars);
    const result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, [
      "funghi",
      "marinara",
      "bismarck",
    ]);
    expect(getIngredient("pesto")!.placement).toBe("spread");
    expect(result.inventory.pesto).toBe(STARTER_STOCK_PLAYS_CHAPTER_1);
  });
});

describe("applyStarterGrants: exactly-once", () => {
  it("calling it again with the same (already-claimed) recipe is a complete no-op -- no double grant", () => {
    const dex = dexDiscovering(["margherita"], 1 as QualityStars);
    const first = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    expect(first.inventory).toEqual({ mushroom: 30 });

    // Simulates: reload, PLAY_AGAIN, RETRY_SAME_RECIPE, HOME round-trip, Shop open/close, mode
    // switch, Dex recomputation -- every one of these is, from this function's own perspective,
    // just "call it again with the same dex/claimed ledger."
    const second = applyStarterGrants(dex, first.ownedIngredientIds, first.inventory, first.claimedRecipeIds);
    expect(second.grantedRecipeIds).toEqual([]);
    expect(second.inventory).toBe(first.inventory); // same reference -- no-op, not just same value
    expect(second.ownedIngredientIds).toBe(first.ownedIngredientIds);
    expect(second.claimedRecipeIds).toBe(first.claimedRecipeIds);
  });

  it("calling it many times in a row (simulating repeated reducer/load calls) never compounds", () => {
    const dex = dexDiscovering(["margherita"], 1 as QualityStars);
    let result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    for (let i = 0; i < 10; i++) {
      result = applyStarterGrants(dex, result.ownedIngredientIds, result.inventory, result.claimedRecipeIds);
    }
    expect(result.inventory).toEqual({ mushroom: 30 });
  });

  it("shared ingredient grant (Economy Tuning 1 P0b floor): two different recipes unlocking separately both reach the shared pool's floor, but neither recipe is ever charged twice", () => {
    // oregano is shared by marinara (2/play) and fugazza (1/play) -- unlock marinara first.
    let dex = dexDiscovering(["margherita", "funghi"], 1 as QualityStars);
    let result = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, ["funghi"]);
    expect(result.inventory.oregano).toBe(20); // marinara's own 2 x 10

    // Re-running against the *same* unlocked-marinara dex must never add oregano again.
    result = applyStarterGrants(dex, result.ownedIngredientIds, result.inventory, result.claimedRecipeIds);
    expect(result.grantedRecipeIds).toEqual([]);
    expect(result.inventory.oregano).toBe(20);

    // Now unlock the rest of the chain through fugazza -- fugazza's own grant amount (1 x 10 =
    // 10) is already below the untouched 20 marinara left behind, so the floor leaves it
    // unchanged (Case A below covers this exact scenario in isolation).
    dex = dexDiscovering(
      ["marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    result = applyStarterGrants(dex, result.ownedIngredientIds, result.inventory, result.claimedRecipeIds);
    expect(result.inventory.oregano).toBe(20); // max(20, 10) -- not 30
    expect(result.claimedRecipeIds).toContain("fugazza");
  });

  /**
   * Economy Tuning 1 P0b implementation gate: Cases A-D below pin the exact shared-ingredient
   * floor semantics (`Math.max(current, grantAmount)`) against every point on the "how much of
   * the shared pool is left when the second recipe unlocks" spectrum, using oregano's real
   * production numbers (marinara grants 20, fugazza grants 10 -- see the recipe/ingredient data).
   * In every case the invariant is the same: after fugazza's own grant, `oregano >= 10`, i.e. at
   * least `STARTER_STOCK_PLAYS_CHAPTER_1` fugazza plays (1 oregano/play) are guaranteed, and the
   * floor never *reduces* whatever was already there.
   */
  describe("Economy Tuning 1 P0b: shared ingredient floor Cases A-D (oregano, marinara -> fugazza)", () => {
    const CLAIMED_THROUGH_QUATTRO = [
      "funghi",
      "marinara",
      "bismarck",
      "genovese",
      "quattro-formaggi",
    ];
    const DEX_UNLOCKING_FUGAZZA = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );

    it("Case A: shared ingredient never consumed before the next recipe unlocks -- floor leaves the untouched surplus alone", () => {
      // marinara's own 20 oregano, never spent.
      const priorInventory: InventoryState = { oregano: 20 };
      const result = applyStarterGrants(
        DEX_UNLOCKING_FUGAZZA,
        STARTER_INGREDIENT_IDS,
        priorInventory,
        CLAIMED_THROUGH_QUATTRO,
      );
      expect(result.inventory.oregano).toBe(20); // max(20, 10)
      expect(result.inventory.oregano).toBeGreaterThanOrEqual(10);
    });

    it("Case B: shared ingredient partially consumed (5 marinara plays, 10 of 20 spent) -- floor tops up to exactly fugazza's own 10-play amount", () => {
      const priorInventory: InventoryState = { oregano: 10 }; // 20 - (2 x 5)
      const result = applyStarterGrants(
        DEX_UNLOCKING_FUGAZZA,
        STARTER_INGREDIENT_IDS,
        priorInventory,
        CLAIMED_THROUGH_QUATTRO,
      );
      expect(result.inventory.oregano).toBe(10); // max(10, 10)
      expect(result.inventory.oregano).toBeGreaterThanOrEqual(10);
    });

    it("Case C: shared ingredient nearly used up (9 marinara plays, 18 of 20 spent) -- floor tops the remainder back up to fugazza's own guarantee", () => {
      const priorInventory: InventoryState = { oregano: 2 }; // 20 - (2 x 9)
      const result = applyStarterGrants(
        DEX_UNLOCKING_FUGAZZA,
        STARTER_INGREDIENT_IDS,
        priorInventory,
        CLAIMED_THROUGH_QUATTRO,
      );
      expect(result.inventory.oregano).toBe(10); // max(2, 10)
      expect(result.inventory.oregano).toBeGreaterThanOrEqual(10);
    });

    it("Case D: shared ingredient stock is exactly 0 when the next recipe unlocks -- floor still guarantees the full 10-play amount", () => {
      const priorInventory: InventoryState = { oregano: 0 };
      const result = applyStarterGrants(
        DEX_UNLOCKING_FUGAZZA,
        STARTER_INGREDIENT_IDS,
        priorInventory,
        CLAIMED_THROUGH_QUATTRO,
      );
      expect(result.inventory.oregano).toBe(10); // max(0, 10)
    });

    it("Case E: re-running the same already-claimed grant never re-floors or re-grants the shared ingredient", () => {
      const priorInventory: InventoryState = { oregano: 10 };
      const claimedWithFugazza = [...CLAIMED_THROUGH_QUATTRO, "fugazza"];
      const result = applyStarterGrants(
        DEX_UNLOCKING_FUGAZZA,
        [...STARTER_INGREDIENT_IDS, "onion"],
        priorInventory,
        claimedWithFugazza,
      );
      expect(result.grantedRecipeIds).toEqual([]);
      expect(result.inventory).toBe(priorInventory); // same reference -- true no-op
      expect(result.inventory.oregano).toBe(10);
    });

    it("the floor never reduces existing stock, in any of Cases A-D", () => {
      for (const current of [0, 2, 10, 20, 999]) {
        const result = applyStarterGrants(
          DEX_UNLOCKING_FUGAZZA,
          STARTER_INGREDIENT_IDS,
          { oregano: current },
          CLAIMED_THROUGH_QUATTRO,
        );
        expect(result.inventory.oregano).toBeGreaterThanOrEqual(current);
        expect(result.inventory.oregano).toBeGreaterThanOrEqual(10);
      }
    });
  });
});

describe("applyStarterGrants: future Achievement Reset compatibility", () => {
  it("a Dex reset back to empty does not re-grant a recipe whose Starter Grant is already claimed", () => {
    const dex = dexDiscovering(["margherita"], 1 as QualityStars);
    const granted = applyStarterGrants(dex, STARTER_INGREDIENT_IDS, EMPTY_INVENTORY, []);
    expect(granted.claimedRecipeIds).toEqual(["funghi"]);

    // Simulates a future "reset achievements" feature: dex/stars go back to empty, but the
    // ledger (a deliberately separate, persistent concept from `dex`) is untouched.
    const afterReset = applyStarterGrants(
      EMPTY_DEX,
      granted.ownedIngredientIds,
      granted.inventory,
      granted.claimedRecipeIds,
    );
    expect(afterReset.grantedRecipeIds).toEqual([]);
    expect(afterReset.inventory).toBe(granted.inventory);

    // Re-discovering margherita again (as the reset flow would have the player do) re-unlocks
    // funghi's `recipeUnlocked` axis, but the ledger still blocks a second grant.
    const rediscovered = dexDiscovering(["margherita"], 1 as QualityStars);
    const afterRediscovery = applyStarterGrants(
      rediscovered,
      afterReset.ownedIngredientIds,
      afterReset.inventory,
      afterReset.claimedRecipeIds,
    );
    expect(afterRediscovery.grantedRecipeIds).toEqual([]);
    expect(afterRediscovery.inventory).toEqual({ mushroom: 30 }); // still exactly the one grant
  });
});

describe("Starter Grant integration via the reducer (REGISTER_TO_DEX / MISSION_NEXT_ORDER)", () => {
  /** Plays margherita through PREPARE -> BAKE -> RESULT, scoring inside its perfect zone. */
  function playMargheritaToResult(
    isMissionRound = false,
    initial: GameState = createGuidedInitialState(),
  ): GameState {
    let state = initial;
    if (isMissionRound) state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 60, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 50, y: 30 });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 50, y: 65 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 35, y: 65 });
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    return walkPostBakeToResult(state);
  }

  // Progression 2.0 W1 Integration I4b-3 (REC-04 OD-REC04-2): EP4 is retired. `applyStarterGrants`
  // stays as a pure module (covered above) but no runtime path calls it: a discovery unlocks the
  // next Discovery Ladder material for the Shop at stock 0 instead of granting free stock.
  it("FREE: REGISTER_TO_DEX grants nothing -- margherita's discovery unlocks egg for the Shop at stock 0", () => {
    const discovered = gameReducer(playMargheritaToResult(), { type: "REGISTER_TO_DEX" });
    expect(discovered.phase).toBe("DISCOVERED");
    expect(discovered.starterGrantClaimedRecipeIds).toEqual([]);
    expect(discovered.inventory).toEqual({});
    expect(discovered.ownedIngredientIds).toEqual(STARTER_INGREDIENT_IDS);
    expect(discovered.unlockedForShopIngredientIds).toEqual(["egg"]);
    expect(discovered.lastMaterialUnlockNotice?.ingredientIds).toEqual(["egg"]);
  });

  it("Lunch Rush: MISSION_NEXT_ORDER grants nothing either", () => {
    const next = gameReducer(playMargheritaToResult(true), { type: "MISSION_NEXT_ORDER" });
    expect(next.phase).toBe("ORDER");
    expect(next.starterGrantClaimedRecipeIds).toEqual([]);
    expect(next.inventory).toEqual({});
    expect(next.ownedIngredientIds).toEqual(STARTER_INGREDIENT_IDS);
  });

  it("an existing claimed ledger and its granted stock are carried through untouched (never re-granted, never removed)", () => {
    const legacyDex = [
      { recipeId: "margherita", discovered: true, bestScore: 80, bestStars: 4 as const, timesMade: 3 },
    ];
    const initial = createInitialGameState(
      legacyDex,
      [...STARTER_INGREDIENT_IDS, "mushroom"],
      0,
      { mushroom: 12 },
      ["funghi"],
    );
    const claimed = initial.starterGrantClaimedRecipeIds;
    let state = gameReducer(playMargheritaToResult(false, initial), { type: "REGISTER_TO_DEX" });
    expect(state.starterGrantClaimedRecipeIds).toBe(claimed);
    expect(state.ownedIngredientIds).toContain("mushroom");
    for (const action of [
      { type: "PLAY_AGAIN" } as const,
      { type: "RETRY_SAME_RECIPE" } as const,
      { type: "MISSION_RESET_ORDER" } as const,
      { type: "PURCHASE_INGREDIENT", ingredientId: "mushroom" } as const,
      { type: "RESTOCK_INGREDIENT", ingredientId: "mushroom" } as const,
    ]) {
      expect(gameReducer(state, action).starterGrantClaimedRecipeIds).toBe(claimed);
    }
  });

  it("the next margherita round unlocks nothing new: no NEW MATERIAL notice either", () => {
    const first = gameReducer(playMargheritaToResult(), { type: "REGISTER_TO_DEX" });
    const retried = gameReducer(first, { type: "RETRY_SAME_RECIPE" });
    const secondBaked = walkPostBakeToResult(
      gameReducer(gameReducer(retried, { type: "START_BAKE" }), { type: "CONFIRM_BAKE", value: 70 }),
    );
    const second = gameReducer(secondBaked, { type: "REGISTER_TO_DEX" });
    expect(second.lastMaterialUnlockNotice).toBeNull();
    expect(second.inventory).toEqual({});
  });
});
