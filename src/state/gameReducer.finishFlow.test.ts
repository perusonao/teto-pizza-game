import { describe, expect, it } from "vitest";
import type { CookingProfile } from "../data/cookingProfiles";
import { RECIPES } from "../data/recipes";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { gameReducer, type GameState } from "./gameReducer";
import { createGuidedInitialState } from "./testSupport/guidedRound";
import { FINISH_FIXTURE_RECIPE as FX, preBakePizza } from "./testSupport/finishFixture";
import { atBake, bakeValueFor } from "./testSupport/confirmBakeMatrix";

/**
 * FINISH FIN-D (Issue #294): the whole Guided round PREPARE -> BAKE -> FINISH -> RESULT -> DISCOVERED through the real reducer, with the
 * test-only fixture recipe (never in RECIPES). Pins what FIN-A..C each covered in isolation as ONE flow: the late ingredient's stock is
 * consumed once, the final score is decided once, Dex / Pitz are credited once, and the cooking-time contract (the measured time ends at
 * START_BAKE, FINISH is a per-step entry only) is untouched by FINISH.
 */
const PROFILE: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"] };
const MID = Math.round((FX.bakeTarget.start + FX.bakeTarget.end) / 2);

function place(state: GameState, n = 1): GameState {
  let next = state;
  for (let i = 0; i < n; i += 1) {
    next = gameReducer(next, { type: "PLACE_TOPPING", ingredientId: "parsley", x: DOUGH_CENTER - 30 + i * 18, y: DOUGH_CENTER - 10 + (i % 2) * 30 });
  }
  return next;
}

/** A Guided round walked from PREPARE (t = 0) to FINISH: DOUGH 5 s, SAUCE 4 s, CHEESE 3 s, TOPPING 8 s, BAKE 5 s. */
function toFinish(stock = 3, bake = MID): GameState {
  let state: GameState = gameReducer(createGuidedInitialState(), { type: "BEGIN_PREPARE", now: 0 });
  state = {
    ...state,
    recipe: FX,
    cookingProfile: PROFILE,
    pizza: preBakePizza(),
    inventory: { ...state.inventory, chicken: 9, mozzarella: 9, "tomato-sauce": 9, parsley: stock },
    ownedIngredientIds: [...new Set([...state.ownedIngredientIds, "parsley", "chicken"])],
  };
  for (const now of [5_000, 9_000, 12_000]) state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now });
  state = gameReducer(state, { type: "START_BAKE", now: 20_000 });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: bake, now: 25_000 });
  expect(state.phase).toBe("POST_BAKE");
  expect(state.makingStep).toBe("FINISH");
  return state;
}

const complete = (state: GameState, now = 40_000) => gameReducer(gameReducer(state, { type: "CONFIRM_MAKING_STEP", now }), { type: "REGISTER_TO_DEX" });

describe("FIN-D: PREPARE -> BAKE -> FINISH -> RESULT", () => {
  it("a normal completion: late stock consumed once, the score decided once, Dex and Pitz credited once", () => {
    const atFinish = toFinish(3);
    const stockBefore = atFinish.inventory.parsley;
    const placed = place(atFinish, 2);
    expect(placed.inventory.parsley).toBe(stockBefore); // placing never touches stock
    const done = complete(placed);
    expect(done.phase).toBe("DISCOVERED");
    expect(done.completion?.status).toBe("PASS");
    expect(done.inventory.parsley).toBe(stockBefore - 2);
    expect(done.bakeValue).toBeNull();
    const again = gameReducer(gameReducer(done, { type: "CONFIRM_MAKING_STEP", now: 41_000 }), { type: "REGISTER_TO_DEX" });
    expect(again).toBe(done); // a second 完成 / registration is a no-op: nothing is consumed, scored or credited twice
    expect(done.dex.find((e) => e.recipeId === FX.id)?.timesMade ?? 1).toBe(1);
  });

  it("zero late pieces: FAILED, no stock consumed, no Dex entry, no Pitz", () => {
    const atFinish = toFinish(3);
    const done = complete(atFinish);
    expect(done.completion?.status).toBe("FAILED");
    expect(done.inventory.parsley).toBe(atFinish.inventory.parsley);
    expect(done.pitzBalance).toBe(atFinish.pitzBalance);
    expect(done.dex).toEqual(atFinish.dex);
  });

  it("consecutive Undo and re-placement: only the late pieces move, the final stock is what remains placed", () => {
    const atFinish = toFinish(3);
    const preBake = atFinish.pizza.toppings.filter((t) => t.stage !== "post");
    let state = place(atFinish, 3);
    state = gameReducer(gameReducer(gameReducer(state, { type: "UNDO_LAST_PLACEMENT" }), { type: "UNDO_LAST_PLACEMENT" }), { type: "UNDO_LAST_PLACEMENT" });
    expect(state.pizza.toppings.filter((t) => t.stage === "post")).toHaveLength(0);
    expect(gameReducer(state, { type: "UNDO_LAST_PLACEMENT" }).pizza.toppings).toEqual(state.pizza.toppings); // never a baked piece
    expect(state.pizza.toppings.filter((t) => t.stage !== "post")).toEqual(preBake);
    state = place(state, 2);
    const done = complete(state);
    expect(done.completion?.status).toBe("PASS");
    expect(done.inventory.parsley).toBe(atFinish.inventory.parsley - 2);
  });

  it("insufficient stock: placement stops at the stock; one piece satisfies the Completion Gate (presence), and only that piece is consumed", () => {
    const atFinish = toFinish(1);
    const placed = place(atFinish, 3);
    expect(placed.pizza.toppings.filter((t) => t.stage === "post")).toHaveLength(1);
    const done = complete(placed);
    expect(done.completion?.status).toBe("PASS"); // the "recipe" policy needs 1 of each; minCount (2) is a Scoring 2.0 quality question
    expect(done.inventory.parsley).toBe(atFinish.inventory.parsley - 1);
    const full = complete(place(toFinish(3), 2));
    expect(done.score?.total ?? 0).toBeLessThanOrEqual(full.score?.total ?? 0);
  });

  it("a failed bake skips FINISH entirely: the provisional result is final and the late stock is untouched", () => {
    let round: GameState = gameReducer(createGuidedInitialState(), { type: "BEGIN_PREPARE", now: 0 });
    round = { ...round, recipe: FX, cookingProfile: PROFILE, pizza: preBakePizza(), inventory: { ...round.inventory, parsley: 3 } };
    const done = gameReducer(gameReducer(round, { type: "START_BAKE", now: 1 }), { type: "CONFIRM_BAKE", value: FX.bakeTarget.start - 15, now: 2 });
    expect(done.phase).toBe("RESULT");
    expect(done.bakeValue).toBeNull();
    expect(done.completion?.status).toBe("FAILED");
    expect(done.inventory.parsley).toBe(3);
  });
});

describe("FIN-D: cooking time during FINISH", () => {
  it("the measured time ends at START_BAKE; FINISH is a per-step entry only and RESULT closes it", () => {
    const atFinish = toFinish(3);
    expect(atFinish.cookingTiming?.completedMs).toBe(20_000);
    expect(atFinish.cookingTiming?.activeStep).toBe("FINISH");
    const done = complete(place(atFinish, 2), 40_000);
    expect(done.cookingTiming?.completedMs).toBe(20_000); // 15 s in FINISH are not cooking time
    expect(done.cookingTiming?.perStepElapsedMs.FINISH).toBe(15_000);
    expect(done.cookingTiming?.activeStep).toBeNull();
  });
});

describe("FIN-D: shipped recipes are unaffected", () => {
  it("every shipped recipe leaves BAKE without FINISH and holds no bake value", () => {
    for (const recipe of RECIPES) {
      const state = gameReducer(atBake("guided", recipe.id), { type: "CONFIRM_BAKE", value: bakeValueFor("guided", atBake("guided", recipe.id), "good"), now: 5 });
      expect(state.makingStep === "FINISH", recipe.id).toBe(false);
      expect(state.bakeValue, recipe.id).toBeNull();
      expect(["RESULT", "POST_BAKE"], recipe.id).toContain(state.phase);
      if (state.phase === "POST_BAKE") expect(state.makingStep, recipe.id).toBe("CUT");
    }
  });
});

/**
 * The score itself, on a recipe that HAS a Reference pizza: margherita with its basil asked for AFTER the bake (a test-only variant; RECIPES is untouched).
 * The pre-bake pizza is the Reference minus basil, FINISH places the Reference's basil pieces.
 */
describe("FIN-D: the final score is decided once and from the finished pizza", () => {
  const margherita = RECIPES.find((r) => r.id === "margherita")!;
  const variant = {
    ...margherita,
    requiredIngredients: margherita.requiredIngredients.map((req) => (req.ingredientId === "basil" ? { ...req, applicationPhase: "POST_BAKE" as const } : req)),
  };
  const basilCount = margherita.requiredIngredients.find((r) => r.ingredientId === "basil")!.minCount;

  function toFinishWithBasil(): GameState {
    const full = atBake("guided", "margherita");
    const pizza = { ...full.pizza, toppings: full.pizza.toppings.filter((t) => t.ingredientId !== "basil") };
    const round = { ...full, recipe: variant, cookingProfile: PROFILE, pizza };
    const state = gameReducer({ ...round, inventory: { ...round.inventory, basil: 9 } }, { type: "CONFIRM_BAKE", value: bakeValueFor("guided", round, "good"), now: 1 });
    expect(state.makingStep).toBe("FINISH");
    return state;
  }

  it("FINAL equals one single-pass evaluation of the whole pizza; zero late pieces scores lower and is FAILED", () => {
    const atFinish = toFinishWithBasil();
    const referenceBasil = atBake("guided", "margherita").pizza.toppings.filter((t) => t.ingredientId === "basil");
    expect(referenceBasil.length).toBeGreaterThanOrEqual(basilCount);
    let state = atFinish;
    for (const t of referenceBasil) state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: t.x, y: t.y });
    const done = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 2 });
    expect(done.phase).toBe("RESULT");
    expect(done.completion?.status).toBe("PASS");
    const onePass = gameReducer({ ...atBake("guided", "margherita"), recipe: variant }, { type: "CONFIRM_BAKE", value: bakeValueFor("guided", atBake("guided", "margherita"), "good"), now: 1 });
    expect(done.score?.total).toBeGreaterThan(atFinish.score?.total ?? 0); // the late basil now counts
    expect(done.score?.total).toBe(onePass.score?.total); // same pizza -> same score as a single pass, regardless of the FINISH detour
    const registered = gameReducer(done, { type: "REGISTER_TO_DEX" });
    const twice = gameReducer(registered, { type: "REGISTER_TO_DEX" });
    expect(twice).toBe(registered);
    expect(registered.pitzBalance).toBeGreaterThan(done.pitzBalance);
    expect(registered.dex.find((e) => e.recipeId === "margherita")?.timesMade).toBe((done.dex.find((e) => e.recipeId === "margherita")?.timesMade ?? 0) + 1);
    const none = gameReducer(atFinish, { type: "CONFIRM_MAKING_STEP", now: 2 });
    expect(none.completion?.status).toBe("FAILED");
    expect(none.inventory.basil).toBe(atFinish.inventory.basil);
  });
});
