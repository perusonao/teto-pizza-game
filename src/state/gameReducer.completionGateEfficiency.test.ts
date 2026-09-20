import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { getRecipe } from "../data/recipes";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import type { CookingTimingState } from "../logic/cookingTiming";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * Cooking Time CT2 x Completion Gate Phase 1 integration (see
 * docs/reports/TETO_COOKING-TIME_CT2_Efficiency-Result.md's own "Completion Gate Integration"
 * section). A FAILED pizza never has a "手際" evaluation at all -- this file is specifically
 * about the boundary between the two systems, complementing:
 * - ../logic/completionGate.test.ts (pure PASS/FAILED boundaries)
 * - ./gameReducer.completionGate.test.ts (FAILED reward/Dex/progression/inventory semantics,
 *   pre-dating CT2's own Efficiency field)
 * - ../logic/efficiency.test.ts (the pure tier/bonus formula itself)
 * - ./gameReducer.efficiency.test.ts (Efficiency wiring, pre-dating the Completion Gate merge)
 */

function pizzaWith(overrides: Partial<PizzaState>): PizzaState {
  return { ...createEmptyPizza(), ...overrides };
}

/** Same shape as gameReducer.completionGate.test.ts's own `idealPizzaFor` -- an ideal,
 *  Reference-matching margherita that PASSes with a high (>90) Scoring 2.0 total. */
function idealMargherita(bakeResult: number): PizzaState {
  const reference = getReferencePizza("margherita")!;
  return pizzaWith({
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((group, gi) =>
      group.positions.map((p, i) => ({
        id: `margherita-ideal-${gi}-${i}`,
        ingredientId: group.ingredientId,
        ...p,
      })),
    ),
    bakeResult,
  });
}

function cookingTimingOf(completedMs: number): CookingTimingState {
  return {
    startedAt: 0,
    pausedAt: null,
    accumulatedPauseMs: 0,
    completedMs,
    activeStep: null,
    stepStartedAt: null,
    stepStartAccumulatedPauseMs: 0,
    perStepElapsedMs: {},
  };
}

/** Drives PREPARE -> BAKE -> RESULT for margherita from a directly-injected canonical `pizza`
 *  (same "bypass SELECT_RECIPE/progression, focus on CONFIRM_BAKE onward" pattern
 *  gameReducer.completionGate.test.ts's own `playToResultForRecipe` uses), then directly injects
 *  a finalized `cookingTiming` -- this file is about the FAILED/PASS x Efficiency boundary, not
 *  about re-proving CT1's own BEGIN_PREPARE -> START_BAKE clock math (already covered by
 *  ./gameReducer.cookingTiming.test.ts). `scoreOverride`, when given, replaces the real
 *  Scoring-2.0-computed `score.total` after CONFIRM_BAKE -- lets a PASS-quality-band test target
 *  an exact quality number without hand-crafting a pizza that happens to score there.
 */
function playToResult(
  pizza: PizzaState,
  completedMs: number,
  scoreOverride?: number,
): GameState {
  const recipe = getRecipe("margherita")!;
  let state: GameState = { ...createInitialGameState(), recipe, pizza };
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: pizza.bakeResult ?? recipe.bakeTarget.start });
  state = walkPostBakeToResult(state);
  state = { ...state, cookingTiming: cookingTimingOf(completedMs) };
  if (scoreOverride !== undefined && state.score) {
    state = { ...state, score: { ...state.score, total: scoreOverride } };
  }
  return state;
}

describe("Completion Gate FAILED x Efficiency: lastEfficiencyCredit is null for every FAILED reason", () => {
  it("1. FAILED (MISSING_REQUIRED_INGREDIENT) -> lastEfficiencyCredit null", () => {
    const pizza = idealMargherita(70);
    const withoutBasil = { ...pizza, toppings: pizza.toppings.filter((t) => t.ingredientId !== "basil") };
    const result = playToResult(withoutBasil, 10_000);
    expect(result.completion?.status).toBe("FAILED");
    expect(result.completion?.status === "FAILED" && result.completion.reason).toBe(
      "MISSING_REQUIRED_INGREDIENT",
    );
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.lastEfficiencyCredit).toBeNull();
  });

  it("2. FAILED (INSUFFICIENT_REQUIRED_AMOUNT) -> lastEfficiencyCredit null", () => {
    const pizza = idealMargherita(70);
    const mozzarella = pizza.toppings.filter((t) => t.ingredientId === "mozzarella");
    const oneShort = { ...pizza, toppings: pizza.toppings.filter((t) => t.id !== mozzarella[0].id) };
    const result = playToResult(oneShort, 10_000);
    expect(result.completion?.status === "FAILED" && result.completion.reason).toBe(
      "INSUFFICIENT_REQUIRED_AMOUNT",
    );
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.lastEfficiencyCredit).toBeNull();
  });

  it("3. FAILED (INSUFFICIENT_SAUCE) -> lastEfficiencyCredit null", () => {
    const pizza = idealMargherita(70);
    const barelyTouched = { ...pizza, sauceDeposits: [{ x: 55, y: 55, amount: 0.02 }] };
    const result = playToResult(barelyTouched, 10_000);
    expect(result.completion?.status === "FAILED" && result.completion.reason).toBe("INSUFFICIENT_SAUCE");
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.lastEfficiencyCredit).toBeNull();
  });

  it("4. FAILED (UNDERBAKED) -> lastEfficiencyCredit null", () => {
    // margherita's bakeTarget is {60, 80}; margin = (80-60)*0.5 = 10, so < 50 is a clear underbake.
    const pizza = idealMargherita(20);
    const result = playToResult(pizza, 10_000);
    expect(result.completion?.status === "FAILED" && result.completion.reason).toBe("UNDERBAKED");
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.lastEfficiencyCredit).toBeNull();
  });

  it("5. FAILED (OVERBAKED) -> lastEfficiencyCredit null", () => {
    const pizza = idealMargherita(100);
    const result = playToResult(pizza, 10_000);
    expect(result.completion?.status === "FAILED" && result.completion.reason).toBe("OVERBAKED");
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.lastEfficiencyCredit).toBeNull();
  });

  it("6. FAILED -> +0 Pitz regardless of how fast the round was made (GOOD-tier timing)", () => {
    const pizza = idealMargherita(20); // clear underbake
    // margherita's own comfortableMs is 43_000 -- 5_000ms is well within GOOD.
    const result = playToResult(pizza, 5_000);
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.pitzBalance).toBe(0);
    expect(after.lastPitzCredit).toBeNull();
    expect(after.lastEfficiencyCredit).toBeNull();
  });

  it("9/10/11. FAILED -> no Dex/progression/Starter Grant, and stays parked at RESULT (not DISCOVERED)", () => {
    const pizza = idealMargherita(20);
    const result = playToResult(pizza, 5_000);
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.phase).toBe("RESULT"); // never advances to DISCOVERED
    expect(after.dex).toEqual(result.dex); // untouched
    expect(after.justDiscovered).toBe(false);
    expect(after.justGotNewBest).toBe(false);
    expect(after.lastStarterGrantNotice).toBeNull();
    expect(after).toBe(result); // REGISTER_TO_DEX is a complete no-op -- same object identity
  });
});

describe("Completion Gate PASS x quality-first guard: FAILED != low-quality PASS", () => {
  it("12/13/14. PASS with score < 60 still evaluates Efficiency (tier computed), but the bonus is 0 -- distinct from FAILED", () => {
    const pizza = idealMargherita(70);
    // GOOD-tier timing (well within margherita's 43_000ms comfortable window), but score forced
    // below the quality-first guard's own 60 floor.
    const result = playToResult(pizza, 5_000, 45);
    expect(result.completion?.status).toBe("PASS"); // PASS, not FAILED -- a real, if mediocre, dish
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.phase).toBe("DISCOVERED"); // unlike FAILED, a low-quality PASS still registers
    expect(after.lastEfficiencyCredit).not.toBeNull(); // 手際 tier is still computed/displayable
    expect(after.lastEfficiencyCredit?.tier).toBe("GOOD");
    expect(after.lastEfficiencyCredit?.bonusPitz).toBe(0); // but the bonus itself is 0
    // The existing quality-reward formula (pitzReward.ts) is untouched by any of this.
    expect(after.lastPitzCredit?.multiplier).toBe(0.5); // score 45 -> the 40-59 band
  });

  it("15. PASS, score in 60-74 band + GOOD tier -> small additive bonus (3%)", () => {
    const pizza = idealMargherita(70);
    const result = playToResult(pizza, 5_000, 65);
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.lastEfficiencyCredit?.tier).toBe("GOOD");
    expect(after.lastEfficiencyCredit?.bonusPitz).toBe(3); // round(100 * 0.03)
  });

  it("16. PASS, score in 75-89 band + GOOD tier -> 6% bonus", () => {
    const pizza = idealMargherita(70);
    const result = playToResult(pizza, 5_000, 80);
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.lastEfficiencyCredit?.tier).toBe("GOOD");
    expect(after.lastEfficiencyCredit?.bonusPitz).toBe(6);
  });

  it("17. PASS, score 90+ + GOOD tier -> full 10% bonus", () => {
    const pizza = idealMargherita(70);
    const result = playToResult(pizza, 5_000, 95);
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.lastEfficiencyCredit?.tier).toBe("GOOD");
    expect(after.lastEfficiencyCredit?.bonusPitz).toBe(10);
  });

  it("18. PASS, score 90+ + NORMAL tier -> small 3% bonus", () => {
    const pizza = idealMargherita(70);
    // margherita: comfortableMs=43_000, normalUpperMs=78_000 -- 60_000ms lands in NORMAL.
    const result = playToResult(pizza, 60_000, 95);
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.lastEfficiencyCredit?.tier).toBe("NORMAL");
    expect(after.lastEfficiencyCredit?.bonusPitz).toBe(3);
  });

  it("19. PASS + SLOW tier -> 0 bonus even at the highest quality", () => {
    const pizza = idealMargherita(70);
    const result = playToResult(pizza, 200_000, 100); // well past normalUpperMs (78_000)
    const after = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(after.lastEfficiencyCredit?.tier).toBe("SLOW");
    expect(after.lastEfficiencyCredit?.bonusPitz).toBe(0);
    // The existing quality reward is completely unaffected by the 0 Efficiency bonus.
    expect(after.lastPitzCredit?.multiplier).toBe(1.2);
    expect(after.pitzBalance).toBe(after.lastPitzCredit?.balanceAfter);
  });
});
