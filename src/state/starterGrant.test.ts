import { describe, expect, it } from "vitest";
import {
  applyStarterGrantsOnDexChange,
  EMPTY_STARTER_GRANT_CLAIMS,
  type StarterGrantCarry,
} from "./starterGrant";
import { STARTER_STOCK_PLAYS_CHAPTER_1 } from "../data/economyConfig";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { EMPTY_INVENTORY } from "./inventory";
import type { QualityStars } from "../logic/scoring";

/**
 * Economy & Progression 1.0 EP4: pure unit coverage of the starter-grant transaction itself,
 * isolated from the reducer/persistence wiring (see gameReducer.starterGrant.test.ts and
 * persistence.test.ts's own "migrateV2toV3" describe block for those integration points).
 */

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

const EMPTY_CARRY: StarterGrantCarry = {
  ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
  inventory: EMPTY_INVENTORY,
  starterGrantClaimedRecipeIds: EMPTY_STARTER_GRANT_CLAIMS,
};

/**
 * Simulates playing through the Chapter 1 chain one recipe at a time -- at each step, only the
 * newly-discovered recipe's own crossing is computed (`prevDex` is the chain *before* this
 * step, `nextDex` is the chain including it), exactly like real gameplay's incremental
 * REGISTER_TO_DEX dispatches. Returns the carry *after* each step, indexed the same as
 * `recipeIds`, so a test can assert "step N's own delta" without an earlier step's grant
 * leaking into the assertion (which `applyStarterGrantsOnDexChange(EMPTY_DEX, fullDex, ...)`
 * alone would do, since it treats every already-discovered recipe as newly crossing).
 */
function stepThroughChain(
  recipeIds: readonly string[],
  stars: QualityStars,
): StarterGrantCarry[] {
  const results: StarterGrantCarry[] = [];
  let dex: DexState = EMPTY_DEX;
  let carry = EMPTY_CARRY;
  for (const recipeId of recipeIds) {
    const prevDex = dex;
    dex = registerScoreToDex(dex, recipeId, {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: stars * 20,
      stars,
    }).dex;
    carry = applyStarterGrantsOnDexChange(prevDex, dex, carry);
    results.push(carry);
  }
  return results;
}

describe("starterStockPlays (named economy constant, required scenario #1)", () => {
  it("is exactly 10, a single named constant", () => {
    expect(STARTER_STOCK_PLAYS_CHAPTER_1).toBe(10);
  });
});

describe("Margherita (#1): no starter grant, ever (required scenarios #2/#3)", () => {
  it("never appears in the claim ledger even once discovered", () => {
    const dex = dexDiscovering(["margherita"], 1 as QualityStars);
    // funghi is the only thing that crosses here (margherita has no unlockCondition, so it
    // never enters grantStarterStockFor's ledger at all -- see its own guard).
    const result = applyStarterGrantsOnDexChange(EMPTY_DEX, dex, EMPTY_CARRY);
    expect(result.starterGrantClaimedRecipeIds).not.toContain("margherita");
  });

  it("margherita's own 3 ingredients never receive an inventory entry from any grant", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    const result = applyStarterGrantsOnDexChange(EMPTY_DEX, dex, EMPTY_CARRY);
    for (const starterId of STARTER_INGREDIENT_IDS) {
      expect(result.inventory[starterId]).toBeUndefined();
    }
  });
});

describe("Per-recipe grants (required scenarios #4-#9, #12): exactly minCount * 10 per scatter ingredient", () => {
  // Each recipe's `unlockCondition` chains to the *previous* recipe's own discovery (EP1) --
  // so discovering recipe N immediately crosses recipe N+1 from locked to unlocked, and that
  // is the exact dispatch that grants recipe N+1's starter stock (not N+1's own later
  // discovery). 5 stars/discovery so totalStars clears both #6's (8) and #7's (12) gates the
  // instant genovese/quattro-formaggi are discovered, same as real high-skill play would.
  const steps = stepThroughChain(
    ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi", "fugazza"],
    5 as QualityStars,
  );
  const [
    afterDiscoveringMargherita, // grants funghi
    afterDiscoveringFunghi, // grants marinara
    afterDiscoveringMarinara, // grants bismarck
    afterDiscoveringBismarck, // grants genovese
    afterDiscoveringGenovese, // grants quattro-formaggi (totalStars already >=8 here)
    afterDiscoveringQuattro, // grants fugazza (totalStars already >=12 here)
    afterDiscoveringFugazza, // last recipe -- nothing left to unlock
  ] = steps;

  it("#1 margherita itself never grants (it has no unlockCondition and is never claimed)", () => {
    expect(afterDiscoveringFugazza.starterGrantClaimedRecipeIds).not.toContain("margherita");
  });

  it("#2 funghi -> mushroom x30, granted the instant margherita is discovered", () => {
    expect(afterDiscoveringMargherita.starterGrantClaimedRecipeIds).toEqual(["funghi"]);
    expect(afterDiscoveringMargherita.inventory).toEqual({ mushroom: 30 });
    expect(afterDiscoveringMargherita.ownedIngredientIds).toContain("mushroom");
  });

  it("#3 marinara -> garlic x30, oregano x20, granted the instant funghi is discovered", () => {
    expect(afterDiscoveringFunghi.starterGrantClaimedRecipeIds).toEqual(["funghi", "marinara"]);
    expect(afterDiscoveringFunghi.inventory).toEqual({ mushroom: 30, garlic: 30, oregano: 20 });
  });

  it("#4 bismarck -> egg x10, granted the instant marinara is discovered", () => {
    expect(afterDiscoveringMarinara.starterGrantClaimedRecipeIds).toEqual([
      "funghi",
      "marinara",
      "bismarck",
    ]);
    expect(afterDiscoveringMarinara.inventory.egg).toBe(10);
  });

  it("#5 genovese -> pesto x10 uses (spread, not multiplied by minCount), cherry-tomato x30, granted the instant bismarck is discovered", () => {
    expect(afterDiscoveringBismarck.starterGrantClaimedRecipeIds).toEqual([
      "funghi",
      "marinara",
      "bismarck",
      "genovese",
    ]);
    expect(afterDiscoveringBismarck.inventory.pesto).toBe(10);
    expect(afterDiscoveringBismarck.inventory["cherry-tomato"]).toBe(30);
  });

  it("#6 quattro-formaggi -> olive-oil x10 uses, gorgonzola/parmigiano/fontina x20 each, granted the instant genovese is discovered (totalStars already >= 8)", () => {
    expect(afterDiscoveringGenovese.starterGrantClaimedRecipeIds).toEqual([
      "funghi",
      "marinara",
      "bismarck",
      "genovese",
      "quattro-formaggi",
    ]);
    expect(afterDiscoveringGenovese.inventory["olive-oil"]).toBe(10);
    expect(afterDiscoveringGenovese.inventory.gorgonzola).toBe(20);
    expect(afterDiscoveringGenovese.inventory.parmigiano).toBe(20);
    expect(afterDiscoveringGenovese.inventory.fontina).toBe(20);
  });

  it("#7 fugazza -> onion x40 (required scenario #13, no exception vs. every other recipe), granted the instant quattro-formaggi is discovered (totalStars already >= 12)", () => {
    expect(afterDiscoveringQuattro.starterGrantClaimedRecipeIds).toEqual([
      "funghi",
      "marinara",
      "bismarck",
      "genovese",
      "quattro-formaggi",
      "fugazza",
    ]);
    expect(afterDiscoveringQuattro.inventory.onion).toBe(40);
    // fugazza also additively tops up oregano/olive-oil, both already granted earlier in this
    // same chain -- see the additive-sharing describe block below for that interaction on its own.
    expect(afterDiscoveringQuattro.inventory.oregano).toBe(20 + 10);
    expect(afterDiscoveringQuattro.inventory["olive-oil"]).toBe(10 + 10);
  });

  it("discovering fugazza itself (the last recipe) grants nothing further", () => {
    expect(afterDiscoveringFugazza.starterGrantClaimedRecipeIds).toEqual(
      afterDiscoveringQuattro.starterGrantClaimedRecipeIds,
    );
    expect(afterDiscoveringFugazza.inventory).toEqual(afterDiscoveringQuattro.inventory);
  });
});

describe("Additive shared ingredients (required scenario #16): different-recipe grants add, never overwrite", () => {
  it("oregano: marinara's 20 + fugazza's 10 = 30 total, from two separate claim events", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    const result = applyStarterGrantsOnDexChange(EMPTY_DEX, dex, EMPTY_CARRY);
    expect(result.inventory.oregano).toBe(30); // marinara 2*10 + fugazza 1*10
    expect(result.starterGrantClaimedRecipeIds).toEqual(
      expect.arrayContaining(["marinara", "fugazza"]),
    );
  });

  it("olive-oil: quattro-formaggi's 10 uses + fugazza's 10 uses = 20 total", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    const result = applyStarterGrantsOnDexChange(EMPTY_DEX, dex, EMPTY_CARRY);
    expect(result.inventory["olive-oil"]).toBe(20);
  });

  it("an unlock that grants a second time for a DIFFERENT recipe adds onto real pre-existing stock, never resets it", () => {
    // Simulates a player who has already used some of marinara's granted oregano before
    // fugazza's own unlock event fires -- the additive top-up must land on top of whatever's
    // left, not the original 20.
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    const carryWithPartiallyUsedOregano: StarterGrantCarry = {
      ...EMPTY_CARRY,
      inventory: { oregano: 6 }, // 14 of marinara's original 20 already consumed
      starterGrantClaimedRecipeIds: ["funghi", "marinara"], // marinara's grant already claimed
    };
    const result = applyStarterGrantsOnDexChange(EMPTY_DEX, dex, carryWithPartiallyUsedOregano);
    expect(result.inventory.oregano).toBe(6 + 10); // fugazza's own 1*10 additive top-up
  });
});

describe("Exactly-once ledger (required scenario #15 and the reload/retry/replay family, #17-#22/#25/#26)", () => {
  it("calling again with the recipe already in the ledger is a complete no-op (same reference)", () => {
    const dex = dexDiscovering(["margherita"], 1 as QualityStars);
    const carry: StarterGrantCarry = {
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "mushroom"],
      inventory: { mushroom: 30 },
      starterGrantClaimedRecipeIds: ["funghi"],
    };
    // A duplicate dispatch of the exact same crossing (prevDex/nextDex identical to a call
    // that already applied) must never grant a second time.
    const result = applyStarterGrantsOnDexChange(EMPTY_DEX, dex, carry);
    expect(result).toBe(carry); // reference-stable no-op, not just value-equal
  });

  it("a Dex update that doesn't cross any new unlock is a no-op even for an already-unlocked recipe replayed again", () => {
    // Simulates RETRY_SAME_RECIPE / PLAY_AGAIN's own dex (unchanged) being passed through --
    // prevDex === nextDex is the degenerate "nothing crossed" case every carry-through path hits.
    const dex = dexDiscovering(["margherita"], 1 as QualityStars);
    const carry: StarterGrantCarry = {
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "mushroom"],
      inventory: { mushroom: 30 },
      starterGrantClaimedRecipeIds: ["funghi"],
    };
    const result = applyStarterGrantsOnDexChange(dex, dex, carry);
    expect(result).toBe(carry);
  });

  it("Achievement Reset simulation (#89 compatibility, required scenario #25/#26): a claimed recipe re-crossing false->true after Dex is cleared does NOT re-grant", () => {
    // Simulates a future Achievement Reset that clears `dex` (Mastery/stars) back to empty --
    // recipeUnlocked(funghi, EMPTY_DEX) is false again ("re-locked"), and re-discovering
    // margherita re-crosses it to true ("re-unlocked"). The ledger must survive the reset
    // untouched (the task's explicit requirement: "Achievement Resetは... ledgerを消してはいけない"
    // -- this test simulates the ledger surviving by construction, since nothing in this
    // module ever clears it itself).
    const claimedLedgerSurvivingReset: StarterGrantCarry = {
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "mushroom"],
      inventory: { mushroom: 30 },
      starterGrantClaimedRecipeIds: ["funghi"], // survives the reset -- never cleared by this module
    };
    const dexAfterReset = EMPTY_DEX; // Mastery/stars reset (hypothetical #89)
    const dexAfterReDiscovery = dexDiscovering(["margherita"], 1 as QualityStars); // re-unlocked
    const result = applyStarterGrantsOnDexChange(
      dexAfterReset,
      dexAfterReDiscovery,
      claimedLedgerSurvivingReset,
    );
    // funghi crosses false -> true again, but the ledger already has it -- no re-grant.
    expect(result).toBe(claimedLedgerSurvivingReset);
    expect(result.inventory.mushroom).toBe(30); // never doubled to 60
  });

  it("two recipes crossing in the same Dex update both grant exactly once, folded atomically", () => {
    // A single high-quality result can satisfy two chained thresholds at once (e.g. jumping
    // straight from an empty Dex to a fully-discovered one, as a test/debug seed might).
    const dex = dexDiscovering(["margherita", "funghi"], 5 as QualityStars);
    const result = applyStarterGrantsOnDexChange(EMPTY_DEX, dex, EMPTY_CARRY);
    expect([...result.starterGrantClaimedRecipeIds].sort()).toEqual(["funghi", "marinara"].sort());
    expect(result.inventory).toEqual({ mushroom: 30, garlic: 30, oregano: 20 });
  });
});

describe("Atomicity (required scenario #27): ownership, inventory, and the claim ledger always move together", () => {
  it("a successful grant updates all three fields in the same returned object -- never inventory without ownership or the ledger, or vice versa", () => {
    const dex = dexDiscovering(["margherita"], 1 as QualityStars);
    const result = applyStarterGrantsOnDexChange(EMPTY_DEX, dex, EMPTY_CARRY);
    expect(result.ownedIngredientIds).toContain("mushroom");
    expect(result.inventory.mushroom).toBe(30);
    expect(result.starterGrantClaimedRecipeIds).toContain("funghi");
  });

  it("a no-op call never partially updates any of the three fields", () => {
    const carry: StarterGrantCarry = {
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "mushroom"],
      inventory: { mushroom: 30 },
      starterGrantClaimedRecipeIds: ["funghi"],
    };
    const result = applyStarterGrantsOnDexChange(EMPTY_DEX, EMPTY_DEX, carry);
    expect(result).toEqual(carry);
    expect(result).toBe(carry);
  });
});
