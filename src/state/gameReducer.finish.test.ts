import { describe, expect, it } from "vitest";
import { RECIPES } from "../data/recipes";
import type { CookingProfile } from "../data/cookingProfiles";
import { signatureOfPizza } from "../logic/discovery/signature";
import { requiredCutCount } from "../logic/cut/evaluation";
import { finalizeRound } from "./finalizeRound";
import { gameReducer, type GameState } from "./gameReducer";
import { atBake, atBakeFreeWith, bakeValueFor, confirmBake, ROUND_MODES } from "./testSupport/confirmBakeMatrix";
import { FINISH_FIXTURE_RECIPE as FX, piece, preBakePizza } from "./testSupport/finishFixture";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";
import { resolveRequestedSliceCount } from "../logic/cut/types";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { ordinaryRecipes } from "../logic/catalog/testSupport/lateIds";

/**
 * Cooking Steps 2.0 FINISH engine, slice D1b (Issue #294): the reducer wiring, driven by the test-only BBQ-shaped
 * fixture (never in RECIPES). Owner Decisions of 2026-10-14: FINAL runs once, on leaving FINISH; the pre-bake pieces are
 * consumed at CONFIRM_BAKE and only the FINISH pieces after; a failed bake skips FINISH; Guided only.
 */
const PROFILE: CookingProfile = {
  steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", "CUT"],
  cutConfig: { requestedSliceCount: 6 },
};
const T = 1_000_000;
const MID = Math.round((FX.bakeTarget.start + FX.bakeTarget.end) / 2);

/** A Guided round at BAKE with the fixture recipe and its pre-bake pizza. */
function fixtureAtBake(over: Partial<GameState> = {}): GameState {
  const base = atBake("guided", "margherita");
  return { ...base, recipe: FX, cookingProfile: PROFILE, pizza: preBakePizza(), ...over };
}

function atFinish(over: Partial<GameState> = {}): GameState {
  const state = gameReducer(fixtureAtBake(over), { type: "CONFIRM_BAKE", value: MID, now: T });
  expect(state.phase).toBe("POST_BAKE");
  expect(state.makingStep).toBe("FINISH");
  return state;
}

function place(state: GameState, ingredientId = "parsley"): GameState {
  return gameReducer(state, { type: "PLACE_TOPPING", ingredientId, x: DOUGH_CENTER, y: DOUGH_CENTER });
}

function postCount(state: GameState): number {
  return state.pizza.toppings.filter((t) => t.stage === "post").length;
}

describe("CONFIRM_BAKE -> FINISH (PROVISIONAL)", () => {
  it("enters FINISH, holds the bake value, judges without the late requirement and consumes the pre-bake pieces", () => {
    const before = fixtureAtBake();
    const state = gameReducer(before, { type: "CONFIRM_BAKE", value: MID, now: T });
    expect(state.phase).toBe("POST_BAKE");
    expect(state.makingStep).toBe("FINISH");
    expect(state.bakeValue).toBe(MID);
    expect(state.completion?.status).toBe("PASS"); // parsley is not demanded yet
    expect(state.inventory.chicken).toBe((before.inventory.chicken ?? 0) - 2);
    expect(state.inventory.parsley).toBe(before.inventory.parsley); // the late ingredient is not touched yet
  });

  it("a failed bake skips FINISH (and CUT): the provisional result is final, nothing is held", () => {
    for (const level of ["raw", "burnt"] as const) {
      const before = fixtureAtBake();
      const state = gameReducer(before, { type: "CONFIRM_BAKE", value: bakeValueFor("guided", before, level), now: T });
      expect(state.phase).toBe("RESULT");
      expect(state.bakeValue).toBeNull();
      expect(state.completion?.status).toBe("FAILED");
      expect(state.inventory.parsley).toBe(before.inventory.parsley);
      expect(state.inventory.chicken).toBe((before.inventory.chicken ?? 0) - 2);
    }
  });
});

describe("FINISH placement", () => {
  it("marks the piece stage:'post', keeps the pre-bake pieces untouched and leaves inventory alone", () => {
    const state = atFinish();
    const placed = place(state);
    expect(postCount(placed)).toBe(1);
    expect(placed.pizza.toppings.slice(0, 4)).toEqual(state.pizza.toppings);
    expect(placed.pizza.toppings[4].ingredientId).toBe("parsley");
    expect(placed.placement?.status === "placed" || placed.placement?.status === "adjusted").toBe(true);
    expect(placed.inventory).toBe(state.inventory);
    expect(placed.hint).toBe(state.hint);
  });

  it("takes toppings only: cheese, sauce, an unowned ingredient and an out-of-dough point are refused", () => {
    const state = atFinish();
    expect(place(state, "mozzarella")).toBe(state);
    expect(place(state, "tomato-sauce")).toBe(state);
    expect(place(state, "not-an-ingredient")).toBe(state);
    expect(gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "parsley", x: -50, y: -50 })).toBe(state);
    expect(gameReducer({ ...state, ownedIngredientIds: state.ownedIngredientIds.filter((id) => id !== "parsley") }, { type: "PLACE_TOPPING", ingredientId: "parsley", x: DOUGH_CENTER, y: DOUGH_CENTER }).pizza.toppings).toHaveLength(4);
  });

  it("only FINISH pieces count against the stock (a pre-bake piece of the same ingredient is not charged twice)", () => {
    const withEarlyParsley = fixtureAtBake({ pizza: { ...preBakePizza(), toppings: [...preBakePizza().toppings, piece("parsley")] } });
    const state = gameReducer(withEarlyParsley, { type: "CONFIRM_BAKE", value: MID, now: T });
    const stocked = { ...state, inventory: { ...state.inventory, parsley: 1 } };
    const one = place(stocked);
    expect(postCount(one)).toBe(1); // 1 in stock after the bake, despite the pre-bake parsley piece
    const two = place(one);
    expect(postCount(two)).toBe(1);
    expect(two.placement?.status).toBe("rejected");
  });

  it("is refused outside FINISH: PREPARE-only ingredients keep their step gate and RESULT places nothing", () => {
    const result = walkPostBakeToResult(place(place(atFinish())), T);
    expect(place(result)).toBe(result);
  });

  it("is refused in every round that does not run FINISH", () => {
    for (const roundKind of ["LUNCH_RUSH", "DINNER"] as const) {
      const state = { ...atFinish(), roundKind };
      expect(place(state)).toBe(state);
    }
    // FIN-E3a: a Free Cooking round runs FINISH only when its profile carries it (the gate is open); without FINISH in the profile it does not.
    const free = { ...atFinish(), roundKind: "FREE_COOK" as const, cookingProfile: { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"] } as CookingProfile };
    expect(place(free)).toBe(free);
  });
});

describe("FINISH Undo", () => {
  it("takes back the last FINISH piece only, never a pre-bake piece", () => {
    const placed = place(place(atFinish()));
    const undone = gameReducer(placed, { type: "UNDO_LAST_PLACEMENT" });
    expect(postCount(undone)).toBe(1);
    const none = gameReducer(gameReducer(undone, { type: "UNDO_LAST_PLACEMENT" }), { type: "UNDO_LAST_PLACEMENT" });
    expect(postCount(none)).toBe(0);
    expect(none.pizza.toppings).toHaveLength(4);
    expect(none.inventory).toBe(placed.inventory);
  });
});

describe("FINISH confirmation (FINAL)", () => {
  it("runs FINAL once: the full recipe is judged, only the FINISH pieces are consumed, the bake is released", () => {
    const placed = place(place(atFinish()));
    const state = gameReducer(placed, { type: "CONFIRM_MAKING_STEP", now: T + 1 });
    expect(state.phase).toBe("POST_BAKE");
    expect(state.makingStep).toBe("CUT");
    expect(state.bakeValue).toBeNull();
    expect(state.completion?.status).toBe("PASS");
    expect(state.inventory.parsley).toBe((placed.inventory.parsley ?? 0) - 2);
    expect(state.inventory.chicken).toBe(placed.inventory.chicken);
  });

  it("zero FINISH pieces is a FAILED result, not an inherited success", () => {
    const state = gameReducer(atFinish(), { type: "CONFIRM_MAKING_STEP", now: T + 1 });
    expect(state.completion?.status).toBe("FAILED");
    expect(state.inventory.parsley).toBe(atFinish().inventory.parsley);
    expect(state.makingStep).toBe("CUT"); // a composition-only failure keeps CUT (#256)
  });

  it("FINAL replaces the provisional score and the CUT confirmation does not run it again", () => {
    const provisional = atFinish();
    const placed = place(place(provisional));
    const atCut = gameReducer(placed, { type: "CONFIRM_MAKING_STEP", now: T + 1 });
    const expected = finalizeRound({
      recipe: FX, pizza: placed.pizza, bakeValue: MID, freeCook: false, isMissionRound: false,
      roundKind: "GUIDED", dex: placed.dex, inventory: placed.inventory, finalization: "FINAL",
    });
    if (expected.kind !== "SCORED") throw new Error("unexpected");
    expect(atCut.score).toEqual(expected.score);
    expect(atCut.completion).toEqual(expected.completion);
    expect(atCut.inventory).toEqual(expected.inventory);
    const result = walkPostBakeToResult(atCut, T + 2);
    expect(result.phase).toBe("RESULT");
    expect(result.score).toBe(atCut.score);
    expect(result.scoringV2Result).toBe(atCut.scoringV2Result);
    expect(result.completion).toBe(atCut.completion);
    expect(result.inventory).toBe(atCut.inventory);
    expect(result.cutState.config).toEqual(PROFILE.cutConfig);
    expect(requiredCutCount(resolveRequestedSliceCount(result.cutState.config))).toBeGreaterThan(0);
  });

  it("a stray second confirmation never evaluates again", () => {
    const atCut = gameReducer(place(place(atFinish())), { type: "CONFIRM_MAKING_STEP", now: T + 1 });
    const again = gameReducer(atCut, { type: "CONFIRM_MAKING_STEP", now: T + 2 }); // CUT without lines: refused
    expect(again).toBe(atCut);
  });

  it("FINISH without a held bake cannot be finalized (fail closed)", () => {
    const state = { ...place(place(atFinish())), bakeValue: null };
    expect(gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: T + 1 })).toBe(state);
  });

  it("a round that does not run FINISH cannot finalize it", () => {
    for (const roundKind of ["LUNCH_RUSH", "FREE_COOK"] as const) {
      // A Free round whose profile has no FINISH (gate OFF) does not run it either (FIN-E3a: the ON case is in gameReducer.finishFreeCook.test.ts).
      const cookingProfile = roundKind === "FREE_COOK" ? ({ steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"] } as CookingProfile) : atFinish().cookingProfile;
      const state = { ...atFinish(), roundKind, cookingProfile };
      expect(gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: T + 1 })).toBe(state);
    }
  });

  it("FINISH as the last step goes straight to RESULT", () => {
    const profile: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"] };
    const placed = place(place(atFinish({ cookingProfile: profile })));
    const result = gameReducer(placed, { type: "CONFIRM_MAKING_STEP", now: T + 1 });
    expect(result.phase).toBe("RESULT");
    expect(result.bakeValue).toBeNull();
    expect(result.completion?.status).toBe("PASS");
  });
});

describe("rounds that do not run FINISH", () => {
  it("Lunch Rush judges in one pass even with a FINISH profile and never enters FINISH; Free Cooking does too while its profile has no FINISH", () => {
    for (const mode of ["lunchRush"] as const) {
      const base = atBake(mode, "margherita");
      const state = gameReducer({ ...base, recipe: FX, cookingProfile: PROFILE, pizza: preBakePizza() }, { type: "CONFIRM_BAKE", value: MID, now: T });
      expect(state.phase).toBe("POST_BAKE"); // the profile's CUT, never FINISH
      expect(state.makingStep).toBe("CUT");
      expect(state.bakeValue).toBeNull();
      expect(state.completion?.status).toBe("FAILED"); // the late requirement is demanded at once
    }
    // FIN-E3a: Free Cooking enters FINISH only when its own profile carries it (gate OFF: it does not, whatever a Guided profile says).
    const freeProfile: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING"] };
    const free = gameReducer({ ...atBakeFreeWith(preBakePizza()), cookingProfile: freeProfile }, { type: "CONFIRM_BAKE", value: MID, now: T });
    expect(free.phase).toBe("RESULT");
    expect(free.bakeValue).toBeNull();
  });

  it("Dinner refuses a FINISH profile for every cooking action (fail closed) and keeps its normal flow", () => {
    const normal = atBake("dinner", "margherita");
    expect(normal.phase).toBe("BAKE");
    expect(confirmBake(normal, bakeValueFor("dinner", normal, "good")).phase).not.toBe("BAKE");
    const poisoned: GameState = { ...normal, cookingProfile: PROFILE };
    for (const action of [
      { type: "CONFIRM_BAKE", value: 70, now: T },
      { type: "CONFIRM_MAKING_STEP", now: T },
      { type: "PLACE_TOPPING", ingredientId: "parsley", x: DOUGH_CENTER, y: DOUGH_CENTER },
    ] as const) {
      expect(gameReducer(poisoned, action)).toBe(poisoned);
    }
  });
});

describe("existing recipes are unchanged", () => {
  it("no ordinary RECIPES entry reaches FINISH or holds a bake value, in any mode", () => {
    // E5: a Free Cooking round runs FINISH (UD-B, gate ON), pinned in gameReducer.finishFreeCook.test.ts; the other modes never enter it.
    for (const mode of ROUND_MODES.filter((m) => m !== "free")) {
      for (const recipe of ordinaryRecipes(RECIPES)) {
        const bake = atBake(mode, recipe.id);
        const state = confirmBake(bake, bakeValueFor(mode, bake, "good"));
        expect(state.bakeValue, `${mode}/${recipe.id}`).toBeNull();
        expect(state.makingStep === "FINISH", `${mode}/${recipe.id}`).toBe(false);
        expect(state.pizza.toppings.some((t) => t.stage !== undefined), `${mode}/${recipe.id}`).toBe(false);
      }
    }
  });
});

describe("Research / Dex: the piece stage does not leak", () => {
  it("the ingredient identity ignores stage (only the `late` axis reads it, FIN-E2), and no ordinary placement carries one", () => {
    const pizza = preBakePizza();
    const staged = { ...pizza, toppings: pizza.toppings.map((t) => ({ ...t, stage: "post" as const })) };
    const sigStaged = signatureOfPizza(staged);
    const sigPlain = signatureOfPizza(pizza);
    expect(sigStaged.ingredientSet).toEqual(sigPlain.ingredientSet);
    expect(sigPlain.dimensions.late.value).toEqual([]);
    expect(sigStaged.dimensions.late.value).not.toEqual([]);
    expect({ ...sigStaged, dimensions: { ...sigStaged.dimensions, late: sigPlain.dimensions.late } }).toEqual(sigPlain);
    const free = atBakeFreeWith(pizza);
    const prepare = gameReducer({ ...free, phase: "PREPARE", makingStep: "TOPPING" }, { type: "PLACE_TOPPING", ingredientId: "chicken", x: DOUGH_CENTER, y: DOUGH_CENTER });
    expect(prepare.pizza.toppings.every((t) => !("stage" in t))).toBe(true);
  });
});
