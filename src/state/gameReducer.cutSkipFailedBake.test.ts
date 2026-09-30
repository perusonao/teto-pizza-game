import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX, registerScoreToDex } from "./dex";
import { consumePizzaInventory } from "./inventory";
import { buildIdealMargheritaSauceFixture, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { bakeCompletionFailure } from "../logic/completionGate";
import { LUNCH_RUSH_RULESET_VERSION, calculateLunchRushMissionScore } from "../shared/lunchRushScoring";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";
import { createGuidedInitialState } from "./testSupport/guidedRound";

/**
 * Issue #256 (OD-CUT256-1..6): a pizza the Completion Gate fails for its bake (UNDERBAKED /
 * OVERBAKED anywhere in `failures`) skips CUT and lands on RESULT at CONFIRM_BAKE, in Guided and
 * Lunch Rush alike. A servable pizza -- including a ★4 whose bake badge reads 生焼け / 焦げ -- and a
 * composition-only failure keep CUT. Margherita: bakeTarget 60-80, Completion Gate band 50-90.
 * The Dinner half is in gameReducer.dinner.test.ts / dinnerResultDetection.test.ts.
 */

const [MOZZARELLA_GROUP, BASIL_GROUP] = MARGHERITA_REFERENCE.pieceGroups;

const MARGHERITA_DISCOVERED_DEX = registerScoreToDex(EMPTY_DEX, "margherita", {
  total: 80,
  stars: 4,
  matchScore: 80,
  ingredientScore: 80,
  placementScore: 80,
  bakeScore: 80,
}).dex;

interface Cook {
  bake: number;
  /** "ideal" (Reference sauce), "thin" (one deposit: INSUFFICIENT_SAUCE) or "none". */
  sauce?: "ideal" | "thin" | "none";
  basil?: boolean;
  lunchRush?: boolean;
  now?: number;
}

/** PREPARE -> BAKE for margherita, returning the BAKE state (before CONFIRM_BAKE). */
function atBake({ sauce = "ideal", basil = true, lunchRush = false, now }: Omit<Cook, "bake">): GameState {
  let state: GameState = lunchRush
    ? gameReducer(createInitialGameState(MARGHERITA_DISCOVERED_DEX), { type: "MISSION_RESET_ORDER" })
    : createGuidedInitialState();
  const t = (ms: number) => (now === undefined ? undefined : now + ms);
  state = gameReducer(state, { type: "BEGIN_PREPARE", now: t(0) });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: t(1_000) }); // DOUGH -> SAUCE
  if (sauce !== "none") {
    const deposits = buildIdealMargheritaSauceFixture();
    state = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: sauce === "thin" ? deposits.slice(0, 1) : deposits,
    });
  }
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: t(2_000) }); // SAUCE -> CHEESE
  for (const p of MOZZARELLA_GROUP.positions) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: p.x, y: p.y });
  }
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: t(3_000) }); // CHEESE -> TOPPING
  if (basil) {
    for (const p of BASIL_GROUP.positions) {
      state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: p.x, y: p.y });
    }
  }
  return gameReducer(state, { type: "START_BAKE", now: t(4_000) });
}

function cook(options: Cook): { before: GameState; after: GameState } {
  const before = atBake(options);
  const after = gameReducer(before, {
    type: "CONFIRM_BAKE",
    value: options.bake,
    now: options.now === undefined ? undefined : options.now + 5_000,
  });
  return { before, after };
}

const failureReasons = (s: GameState) =>
  s.completion?.status === "FAILED" ? s.completion.failures.map((f) => f.reason) : [];

describe("#256 G-1: bakeCompletionFailure reads the full failures list", () => {
  it("null / PASS -> null", () => {
    expect(bakeCompletionFailure(null)).toBeNull();
    expect(bakeCompletionFailure(undefined)).toBeNull();
    expect(bakeCompletionFailure({ status: "PASS" })).toBeNull();
  });
  it("a bake failure anywhere in failures, never only the primary reason", () => {
    expect(bakeCompletionFailure({ status: "FAILED", reason: "UNDERBAKED", failures: [{ reason: "UNDERBAKED" }] })).toBe("UNDERBAKED");
    expect(bakeCompletionFailure({ status: "FAILED", reason: "OVERBAKED", failures: [{ reason: "OVERBAKED" }] })).toBe("OVERBAKED");
    expect(
      bakeCompletionFailure({
        status: "FAILED",
        reason: "MISSING_REQUIRED_INGREDIENT",
        failures: [{ reason: "MISSING_REQUIRED_INGREDIENT", ingredientId: "basil" }, { reason: "UNDERBAKED" }],
      }),
    ).toBe("UNDERBAKED");
  });
  it("composition-only failures -> null", () => {
    expect(
      bakeCompletionFailure({ status: "FAILED", reason: "MISSING_REQUIRED_INGREDIENT", failures: [{ reason: "MISSING_REQUIRED_INGREDIENT" }] }),
    ).toBeNull();
    expect(bakeCompletionFailure({ status: "FAILED", reason: "INSUFFICIENT_SAUCE", failures: [{ reason: "INSUFFICIENT_SAUCE" }] })).toBeNull();
    expect(
      bakeCompletionFailure({ status: "FAILED", reason: "INSUFFICIENT_REQUIRED_AMOUNT", failures: [{ reason: "INSUFFICIENT_REQUIRED_AMOUNT" }] }),
    ).toBeNull();
  });
});

describe("#256 C-1 / C-2: a Completion-Gate bake failure skips CUT (Guided)", () => {
  it.each([
    [5, "UNDERBAKED"],
    [49, "UNDERBAKED"],
    [91, "OVERBAKED"],
    [98, "OVERBAKED"],
  ] as const)("bake %d -> RESULT at CONFIRM_BAKE (%s)", (bake, reason) => {
    const { before, after } = cook({ bake, now: 10_000 });
    expect(after.phase).toBe("RESULT");
    expect(after.completion?.status).toBe("FAILED");
    expect(failureReasons(after)).toContain(reason);
    // Nothing of the CUT step started: same step, no lines, no CUT timing.
    expect(after.makingStep).toBe(before.makingStep);
    expect(after.cutState.lines).toHaveLength(0);
    expect(after.cutState.evaluation).toBeNull();
    expect(after.cookingTiming?.activeStep ?? null).toBeNull();
    expect(after.cookingTiming?.perStepElapsedMs.CUT).toBeUndefined();
    // Consumed exactly once, from the pre-bake stock.
    expect(after.inventory).toEqual(consumePizzaInventory(after.pizza, before.inventory));
  });
});

describe("#256 C-3: a servable pizza keeps CUT (OD-CUT256-1)", () => {
  it.each([
    [50, "raw"],
    [55, "raw"],
    [70, "perfect"],
    [85, "burnt"],
    [90, "burnt"],
  ] as const)("bake %d (badge %s, Completion Gate PASS) -> POST_BAKE / CUT", (bake, badge) => {
    const { after } = cook({ bake });
    expect(after.bakeState).toBe(badge);
    expect(after.completion?.status).toBe("PASS");
    expect(after.phase).toBe("POST_BAKE");
    expect(after.makingStep).toBe("CUT");
    if (badge !== "perfect") expect(after.score?.stars).toBeLessThanOrEqual(4);
  });
});

describe("#256 C-4 / C-5: composition failures keep CUT unless the bake failed too (OD-CUT256-2 / 6)", () => {
  it("MISSING only (no basil, bake 70) keeps CUT, then still FAILS", () => {
    const { after } = cook({ bake: 70, basil: false });
    expect(failureReasons(after)).toEqual(["MISSING_REQUIRED_INGREDIENT"]);
    expect(after.phase).toBe("POST_BAKE");
    const result = walkPostBakeToResult(after);
    expect(result.phase).toBe("RESULT");
    expect(result.completion?.status).toBe("FAILED");
  });

  it("thin sauce only (INSUFFICIENT_SAUCE, bake 70) keeps CUT", () => {
    const { after } = cook({ bake: 70, sauce: "thin" });
    expect(failureReasons(after)).toEqual(["INSUFFICIENT_SAUCE"]);
    expect(after.phase).toBe("POST_BAKE");
  });

  it("MISSING + UNDERBAKED skips CUT although the primary reason is MISSING", () => {
    const { after } = cook({ bake: 5, basil: false });
    expect(after.completion?.status === "FAILED" && after.completion.reason).toBe("MISSING_REQUIRED_INGREDIENT");
    expect(failureReasons(after)).toContain("UNDERBAKED");
    expect(after.phase).toBe("RESULT");
  });

  it("MISSING + OVERBAKED skips CUT", () => {
    const { after } = cook({ bake: 98, sauce: "none" });
    expect(failureReasons(after)).toContain("MISSING_REQUIRED_INGREDIENT");
    expect(failureReasons(after)).toContain("OVERBAKED");
    expect(after.phase).toBe("RESULT");
  });
});

describe("#256 C-6: Lunch Rush follows the same rule; serve semantics unchanged", () => {
  it("bake failure -> RESULT with the same FAILED completion and a score (the serve CTA's precondition)", () => {
    const { after } = cook({ bake: 98, lunchRush: true });
    expect(after.isMissionRound).toBe(true);
    expect(after.phase).toBe("RESULT");
    expect(after.completion?.status).toBe("FAILED");
    // handleMissionServeNext requires state.score; a FAILED guided / Lunch Rush round keeps one.
    expect(after.score).not.toBeNull();
    // The next order proceeds from RESULT exactly as it does after a CUT confirm.
    const next = gameReducer(after, { type: "MISSION_NEXT_ORDER" });
    expect(next.phase).toBe("ORDER");
    expect(next.cutState.lines).toHaveLength(0);
  });

  it("servable Lunch Rush pizza keeps CUT", () => {
    const { after } = cook({ bake: 70, lunchRush: true });
    expect(after.phase).toBe("POST_BAKE");
    expect(after.makingStep).toBe("CUT");
  });

  it("OD-CUT256-5: score formula and ruleset version are unchanged", () => {
    expect(LUNCH_RUSH_RULESET_VERSION).toBe("lunch-rush-v1");
    expect(
      calculateLunchRushMissionScore([
        { recipeId: "margherita", qualityTotal: 80, completionStatus: "PASS" },
        { recipeId: "margherita", qualityTotal: 0, completionStatus: "FAILED" },
      ]).score,
    ).toBe(180);
  });
});

describe("#256 C-8: nothing of CUT can run after a skip", () => {
  it("ADD_CUT_LINE / CONFIRM_MAKING_STEP / a second CONFIRM_BAKE are no-ops at RESULT", () => {
    const { after } = cook({ bake: 5 });
    expect(gameReducer(after, { type: "ADD_CUT_LINE", line: { start: { x: 0, y: 0 }, end: { x: 100, y: 100 } } })).toBe(after);
    expect(gameReducer(after, { type: "CONFIRM_MAKING_STEP" })).toBe(after);
    expect(gameReducer(after, { type: "CONFIRM_BAKE", value: 70 })).toBe(after);
  });

  it("REGISTER_TO_DEX stays a no-op for the skipped FAILED round (same as after CUT)", () => {
    const { after } = cook({ bake: 5 });
    expect(gameReducer(after, { type: "REGISTER_TO_DEX" })).toBe(after);
  });
});
