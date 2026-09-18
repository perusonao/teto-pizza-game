import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX } from "./dex";
import { getRecipe } from "../data/recipes";
import { calculatePitzReward } from "../logic/pitzReward";
import { loadSave, persistProgress, type StorageLike } from "./persistence";

/**
 * Issue #38 E-P1/E-P2: FREE per-pizza Pitz reward, wired into REGISTER_TO_DEX
 * (../state/gameReducer.ts). Reuses `gameReducer.test.ts`'s own `playToResult` shape (Margherita,
 * PREPARE -> BAKE -> RESULT through the real reducer, never a hand-built RESULT fixture) so this
 * suite exercises the exact same production path -- see that file's `playToResult` for the
 * pattern this mirrors.
 */

function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

/** Plays a full FREE Margherita round through PREPARE -> BAKE -> RESULT, confirming the bake at
 *  `bakeValue` (60-80 is Margherita's perfect zone). Mirrors gameReducer.test.ts's own
 *  `playToResult` exactly, duplicated here (rather than imported) since that helper isn't
 *  exported and this suite's own file header documents the equivalence. */
function playFreeMargheritaToResult(bakeValue: number, startState?: GameState): GameState {
  let state = startState ?? createInitialGameState();
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
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: bakeValue });
  return state;
}

/** An intentionally minimal/incomplete round (no sauce, no cheese, no topping, baked at the
 *  extreme edge) -- exercises Scoring 2.0's own low-score path so this suite can assert a
 *  real 0-Pitz FREE credit without hand-faking `state.score`. */
function playFreeMargheritaMinimalToResult(): GameState {
  let state = createInitialGameState();
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: 5 }); // far outside 60-80
  return state;
}

describe("FREE per-pizza Pitz credit (REGISTER_TO_DEX)", () => {
  it("credits a high-quality FREE pizza using the recipe's baseRewardPitz and the round's score", () => {
    const resultState = playFreeMargheritaToResult(70); // Margherita's perfect zone
    const totalBefore = resultState.score?.total;
    expect(typeof totalBefore).toBe("number");

    const after = gameReducer(resultState, { type: "REGISTER_TO_DEX" });
    const expected = calculatePitzReward(getRecipe("margherita")!.baseRewardPitz, totalBefore!);

    expect(after.lastPitzCredit).not.toBeNull();
    expect(after.lastPitzCredit?.baseReward).toBe(expected.baseReward);
    expect(after.lastPitzCredit?.multiplier).toBe(expected.multiplier);
    expect(after.lastPitzCredit?.earnedPitz).toBe(expected.earnedPitz);
    expect(after.lastPitzCredit?.balanceBefore).toBe(0);
    expect(after.lastPitzCredit?.balanceAfter).toBe(expected.earnedPitz);
    expect(after.pitzBalance).toBe(expected.earnedPitz);
  });

  it("credits a mid-quality FREE pizza (a real Scoring 2.0 mid-range score, not a fabricated one)", () => {
    // A baked-outside-target-but-not-extreme value still yields a real, non-zero, non-perfect
    // Scoring 2.0 score -- exercising the mid multiplier band without hand-faking `score.total`.
    const resultState = playFreeMargheritaToResult(85);
    const totalBefore = resultState.score!.total;
    const after = gameReducer(resultState, { type: "REGISTER_TO_DEX" });
    const expected = calculatePitzReward(100, totalBefore);

    expect(after.lastPitzCredit?.earnedPitz).toBe(expected.earnedPitz);
    expect(after.pitzBalance).toBe(expected.earnedPitz);
  });

  it("a real low-quality FREE pizza (0-39 band) credits exactly 0 Pitz, balance unchanged", () => {
    const resultState = playFreeMargheritaMinimalToResult();
    expect(resultState.score!.total).toBeLessThan(40);

    const after = gameReducer(resultState, { type: "REGISTER_TO_DEX" });
    expect(after.lastPitzCredit).not.toBeNull();
    expect(after.lastPitzCredit?.earnedPitz).toBe(0);
    expect(after.lastPitzCredit?.balanceBefore).toBe(0);
    expect(after.lastPitzCredit?.balanceAfter).toBe(0);
    expect(after.pitzBalance).toBe(0);
  });

  it("REGISTER_TO_DEX credits Pitz exactly once, even if dispatched twice (double-click/duplicate dispatch)", () => {
    const resultState = playFreeMargheritaToResult(70);
    const afterFirst = gameReducer(resultState, { type: "REGISTER_TO_DEX" });
    const earnedFirst = afterFirst.lastPitzCredit?.earnedPitz ?? 0;
    expect(earnedFirst).toBeGreaterThan(0);

    // Same atomicity guard as Dex registration (phase already DISCOVERED) -- the second
    // dispatch must be a structural no-op, not merely "the amount happens to be the same".
    const afterSecond = gameReducer(afterFirst, { type: "REGISTER_TO_DEX" });
    expect(afterSecond).toBe(afterFirst);
    expect(afterSecond.pitzBalance).toBe(earnedFirst);
  });

  it("an un-registered RESULT leaves pitzBalance unchanged (no credit without the player's REGISTER_TO_DEX action)", () => {
    const resultState = playFreeMargheritaToResult(70);
    expect(resultState.pitzBalance).toBe(0);
    expect(resultState.lastPitzCredit).toBeNull();
  });

  it("RETRY_SAME_RECIPE after a credited RESULT resets lastPitzCredit to null for the fresh round", () => {
    const resultState = playFreeMargheritaToResult(70);
    const discovered = gameReducer(resultState, { type: "REGISTER_TO_DEX" });
    expect(discovered.lastPitzCredit).not.toBeNull();
    const creditedBalance = discovered.pitzBalance;

    const retried = gameReducer(discovered, { type: "RETRY_SAME_RECIPE" });
    expect(retried.lastPitzCredit).toBeNull();
    // The credited balance itself is progression, not round state -- it must carry forward.
    expect(retried.pitzBalance).toBe(creditedBalance);
  });

  it("PLAY_AGAIN after a credited RESULT resets lastPitzCredit to null for the fresh round", () => {
    const resultState = playFreeMargheritaToResult(70);
    const discovered = gameReducer(resultState, { type: "REGISTER_TO_DEX" });
    const playAgain = gameReducer(discovered, { type: "PLAY_AGAIN" });
    expect(playAgain.lastPitzCredit).toBeNull();
    expect(playAgain.pitzBalance).toBe(discovered.pitzBalance);
  });

  it("a second full round accumulates on top of the first round's credited balance", () => {
    const firstResult = playFreeMargheritaToResult(70);
    const firstDiscovered = gameReducer(firstResult, { type: "REGISTER_TO_DEX" });
    const firstBalance = firstDiscovered.pitzBalance;
    expect(firstBalance).toBeGreaterThan(0);

    const retried = gameReducer(firstDiscovered, { type: "RETRY_SAME_RECIPE" });
    const secondResult = playFreeMargheritaToResult(70, retried);
    const secondDiscovered = gameReducer(secondResult, { type: "REGISTER_TO_DEX" });

    expect(secondDiscovered.lastPitzCredit?.balanceBefore).toBe(firstBalance);
    expect(secondDiscovered.pitzBalance).toBe(firstBalance + (secondDiscovered.lastPitzCredit?.earnedPitz ?? 0));
  });
});

describe("Lunch Rush isolation -- no per-pizza FREE reward leakage", () => {
  function playMissionMargheritaToResult(): GameState {
    let state = createInitialGameState();
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    for (let i = 0; i < 30 && state.recipe.id !== "margherita"; i++) {
      state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    }
    expect(state.recipe.id).toBe("margherita");
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 60, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 50, y: 30 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 50, y: 65 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 35, y: 65 });
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    expect(state.isMissionRound).toBe(true);
    expect(state.phase).toBe("RESULT");
    return state;
  }

  it("MISSION_NEXT_ORDER (Lunch Rush's own advance action) never sets lastPitzCredit and never touches pitzBalance", () => {
    const resultState = playMissionMargheritaToResult();
    const before = resultState.pitzBalance;
    const after = gameReducer(resultState, { type: "MISSION_NEXT_ORDER" });
    expect(after.lastPitzCredit).toBeNull();
    expect(after.pitzBalance).toBe(before);
  });

  it("a stray REGISTER_TO_DEX dispatched against a Mission RESULT never applies a per-pizza credit (reducer-level backstop)", () => {
    const resultState = playMissionMargheritaToResult();
    const before = resultState.pitzBalance;
    const after = gameReducer(resultState, { type: "REGISTER_TO_DEX" });
    expect(after.lastPitzCredit).toBeNull();
    expect(after.pitzBalance).toBe(before);
  });
});

describe("Persistence -- credited pitzBalance round-trips, no schema migration", () => {
  it("a FREE-credited pitzBalance survives persistProgress -> loadSave unchanged, schemaVersion stays 2", () => {
    const resultState = playFreeMargheritaToResult(70);
    const discovered = gameReducer(resultState, { type: "REGISTER_TO_DEX" });
    expect(discovered.pitzBalance).toBeGreaterThan(0);

    const storage = fakeStorage();
    persistProgress(
      {
        dex: discovered.dex,
        pitzBalance: discovered.pitzBalance,
        ownedIngredientIds: discovered.ownedIngredientIds,
        inventory: discovered.inventory,
      },
      storage,
    );

    const loaded = loadSave(storage);
    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.pitzBalance).toBe(discovered.pitzBalance);
  });

  it("createInitialGameState hydrated from a loaded save carries the credited pitzBalance forward, with no leftover round credit", () => {
    const resultState = playFreeMargheritaToResult(70);
    const discovered = gameReducer(resultState, { type: "REGISTER_TO_DEX" });

    const storage = fakeStorage();
    persistProgress(
      {
        dex: discovered.dex,
        pitzBalance: discovered.pitzBalance,
        ownedIngredientIds: discovered.ownedIngredientIds,
        inventory: discovered.inventory,
      },
      storage,
    );
    const loaded = loadSave(storage);

    const rehydrated = createInitialGameState(EMPTY_DEX, loaded.ownedIngredientIds, loaded.pitzBalance);
    expect(rehydrated.phase).toBe("ORDER");
    expect(rehydrated.pitzBalance).toBe(discovered.pitzBalance);
    expect(rehydrated.lastPitzCredit).toBeNull();
  });
});
