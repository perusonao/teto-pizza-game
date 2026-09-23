import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX, registerScoreToDex } from "./dex";
import { buildIdealMargheritaSauceFixture, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

const MARGHERITA_DISCOVERED_DEX = registerScoreToDex(EMPTY_DEX, "margherita", {
  total: 80,
  stars: 4,
  matchScore: 80,
  ingredientScore: 80,
  placementScore: 80,
  bakeScore: 80,
}).dex;

/**
 * Cooking Time CT2: `REGISTER_TO_DEX`'s `lastEfficiencyCredit` wiring (../logic/efficiency.ts).
 * See docs/reports/TETO_COOKING-TIME_CT2_Efficiency-Result.md for the full design; this suite
 * covers the reducer-level wiring (additive Pitz balance, FREE/Mission boundary, reset policy),
 * not the pure tier/bonus formula itself (already covered by ../logic/efficiency.test.ts).
 */

const [MOZZARELLA_GROUP, BASIL_GROUP] = MARGHERITA_REFERENCE.pieceGroups;

/** Mirrors gameReducer.test.ts's own `playMargheritaToResultWithShadowSauce` (a Reference-exact
 *  placement that scores > 90), extended with CT1/CT2 `now` payloads so `cookingTiming` actually
 *  finalizes a `completedMs` for `lastEfficiencyCredit` to read. Margherita's own
 *  `comfortableMs` is 43_000 (6 required pieces: 25_000 base + 6 x 3_000), `normalUpperMs`
 *  78_000 -- see efficiency.ts's own constants. */
function playHighQualityMargheritaToResult(bakeNow: number, isMissionRound = false): GameState {
  let state: GameState = isMissionRound
    ? gameReducer(createInitialGameState(MARGHERITA_DISCOVERED_DEX), { type: "MISSION_RESET_ORDER" })
    : createInitialGameState();
  state = gameReducer(state, { type: "BEGIN_PREPARE", now: 0 });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
  state = gameReducer(state, {
    type: "COMMIT_SAUCE_DISPENSE",
    ingredientId: "tomato-sauce",
    deposits: buildIdealMargheritaSauceFixture(),
  });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
  for (const p of MOZZARELLA_GROUP.positions) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: p.x, y: p.y });
  }
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
  for (const p of BASIL_GROUP.positions) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: p.x, y: p.y });
  }
  state = gameReducer(state, { type: "START_BAKE", now: bakeNow });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
  return walkPostBakeToResult(state);
}

describe("REGISTER_TO_DEX: lastEfficiencyCredit (CT2)", () => {
  it("a high-quality, GOOD-tier round gets a non-zero additive bonus, credited on top of the quality reward", () => {
    const result = playHighQualityMargheritaToResult(10_000); // 10s -- well within the 43s comfortable window
    expect(result.score?.total as number).toBeGreaterThan(90);
    const discovered = gameReducer(result, { type: "REGISTER_TO_DEX" });

    expect(discovered.lastEfficiencyCredit).not.toBeNull();
    expect(discovered.lastEfficiencyCredit?.tier).toBe("GOOD");
    expect(discovered.lastEfficiencyCredit?.cookingTimeMs).toBe(10_000);
    expect(discovered.lastEfficiencyCredit?.bonusPitz).toBeGreaterThan(0);

    // Additive: the final pitzBalance is the quality credit's own balanceAfter PLUS the bonus --
    // never folded into lastPitzCredit.multiplier/earnedPitz themselves (pitzReward.ts untouched).
    const bonus = discovered.lastEfficiencyCredit?.bonusPitz ?? 0;
    expect(discovered.pitzBalance).toBe((discovered.lastPitzCredit?.balanceAfter ?? 0) + bonus);
    expect(bonus).toBeGreaterThan(0); // sanity: this test is only meaningful if there IS a bonus
  });

  it("a SLOW round earns zero Efficiency bonus even at high quality -- pitzBalance is exactly the quality credit's own balanceAfter", () => {
    const result = playHighQualityMargheritaToResult(200_000); // 200s -- well past the 78s normalUpperMs
    const discovered = gameReducer(result, { type: "REGISTER_TO_DEX" });

    expect(discovered.lastEfficiencyCredit?.tier).toBe("SLOW");
    expect(discovered.lastEfficiencyCredit?.bonusPitz).toBe(0);
    expect(discovered.pitzBalance).toBe(discovered.lastPitzCredit?.balanceAfter);
  });

  it("is null for a Mission round -- Lunch Rush never gets an Efficiency bonus (double speed-evaluation is banned)", () => {
    const result = playHighQualityMargheritaToResult(10_000, true);
    expect(result.isMissionRound).toBe(true);
    expect(result.cookingTiming).toBeNull(); // CT1: Cooking Time never starts for Mission at all
    const discovered = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(discovered.lastEfficiencyCredit).toBeNull();
  });

  it("is null when cookingTiming never finalized (e.g. `now` omitted -- back-compat/no timing concern)", () => {
    let state = createInitialGameState();
    state = gameReducer(state, { type: "BEGIN_PREPARE" }); // no `now` -- cookingTiming stays null
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    state = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: buildIdealMargheritaSauceFixture(),
    });
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    for (const p of MOZZARELLA_GROUP.positions) {
      state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: p.x, y: p.y });
    }
    state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    for (const p of BASIL_GROUP.positions) {
      state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: p.x, y: p.y });
    }
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    state = walkPostBakeToResult(state);
    expect(state.cookingTiming).toBeNull();

    const discovered = gameReducer(state, { type: "REGISTER_TO_DEX" });
    expect(discovered.lastEfficiencyCredit).toBeNull();
  });

  it("stays populated across the RESULT -> DISCOVERED transition (same round, no recompute)", () => {
    const result = playHighQualityMargheritaToResult(10_000);
    const discovered = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(discovered.phase).toBe("DISCOVERED");
    expect(discovered.lastEfficiencyCredit?.tier).toBe("GOOD");
  });

  it("a stray/repeated REGISTER_TO_DEX dispatch never re-credits the Efficiency bonus a second time", () => {
    const result = playHighQualityMargheritaToResult(10_000);
    const afterFirst = gameReducer(result, { type: "REGISTER_TO_DEX" });
    const afterSecond = gameReducer(afterFirst, { type: "REGISTER_TO_DEX" });
    expect(afterSecond).toBe(afterFirst); // whole-state identity, same atomicity guarantee as lastPitzCredit
  });

  it("resets to null for every fresh round (PLAY_AGAIN) -- a stale previous round's credit can never leak forward", () => {
    const result = playHighQualityMargheritaToResult(10_000);
    const discovered = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(discovered.lastEfficiencyCredit).not.toBeNull();
    const fresh = gameReducer(discovered, { type: "PLAY_AGAIN" });
    expect(fresh.lastEfficiencyCredit).toBeNull();
  });
});

describe("Scoring 2.0 / economy regression check (CT2 must not perturb either)", () => {
  it("lastPitzCredit's own multiplier/earnedPitz are unaffected by the Efficiency bonus existing alongside it", () => {
    const result = playHighQualityMargheritaToResult(10_000);
    const discovered = gameReducer(result, { type: "REGISTER_TO_DEX" });
    // Same formula as pitzReward.ts's own contract: baseReward(100) x qualityMultiplier(>90 -> 1.2).
    expect(discovered.lastPitzCredit?.baseReward).toBe(100);
    expect(discovered.lastPitzCredit?.multiplier).toBe(1.2);
    expect(discovered.lastPitzCredit?.earnedPitz).toBe(120);
  });
});
