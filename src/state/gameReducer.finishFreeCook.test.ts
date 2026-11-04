import { describe, expect, it, vi } from "vitest";
import { DEFAULT_COOKING_PROFILE, getCookingProfile, visibleCookingTabCount } from "../data/cookingProfiles";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { FREE_COOK_RECIPE_ID } from "../data/freeCook";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { EMPTY_DEX } from "./dex";
import { roundRunsFinish } from "./finishEngine";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { consumePizzaInventory } from "./inventory";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { atBake, bakeValueFor, referencePizzaFor, UNMATCHED_FREE_PIZZAS } from "./testSupport/confirmBakeMatrix";
import { discoveredDex } from "./testSupport/guidedRound";
import { ordinaryRecipes } from "../logic/catalog/testSupport/lateIds";

/**
 * FINISH FIN-E3a (Issue #604 / #294, Owner Decision UD-B): the Free Cooking FINISH step through the real reducer, behind the gate.
 *
 * `gate.open` stands in for `freeCookFinishEnabled()` -- the only thing that differs between a Free round without FINISH (the pre-E5
 * Production state and the rollback) and a round with the permanent 仕上げ tab. E5 switched Production ON: the ON tests below are the shipped
 * behaviour, the OFF ones pin the rollback. (e5.ikuraProduction.test.ts runs the real, unmocked Production gate.)
 * The central property is parity: a Free round that places nothing in FINISH ends exactly as the same round without FINISH.
 */
const gate = vi.hoisted(() => ({ open: false }));
vi.mock("../data/freeCookFinishGate", () => ({
  FREE_COOK_FINISH_PRODUCTION: false,
  freeCookFinishEnabled: () => gate.open,
}));

const ALL_IDS = ["tomato-sauce", ...STARTER_INGREDIENT_IDS];
const FINITE = Object.fromEntries(
  (["parsley", "basil", "mozzarella", "chicken", "pesto", "fresh-tomato", "egg"] as const).map((id) => [id, 99]),
);
const act = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);

/** A Free Cooking round at BAKE (START_BAKE at t = 20 s) carrying `pizza`, with the gate `open` or not at round start. */
function atBakeFree(pizza: PizzaState, open: boolean, base?: GameState): GameState {
  gate.open = open;
  const initial = base ?? createInitialGameState(EMPTY_DEX, ["tomato-sauce", ...STARTER_INGREDIENT_IDS, "parsley"], 0, FINITE);
  const prepared = act(initial, { type: "START_FREE_COOK", now: 0 }, { type: "BEGIN_PREPARE", now: 0 });
  return act({ ...prepared, pizza }, { type: "START_BAKE", now: 20_000 });
}
const bakeAt = (state: GameState, value: number, now = 25_000) => gameReducer(state, { type: "CONFIRM_BAKE", value, now });
const goodBake = (state: GameState) => bakeValueFor("free", state, "good");
const place = (state: GameState, ingredientId = "parsley", n = 1): GameState => {
  let next = state;
  for (let i = 0; i < n; i += 1) {
    next = gameReducer(next, { type: "PLACE_TOPPING", ingredientId, x: DOUGH_CENTER - 30 + i * 18, y: DOUGH_CENTER - 10 + (i % 2) * 30 });
  }
  return next;
};
const complete = (state: GameState, now = 40_000) => gameReducer(state, { type: "CONFIRM_MAKING_STEP", now });
const register = (state: GameState) => gameReducer(state, { type: "REGISTER_TO_DEX" });
/** Walks a baked round to RESULT with nothing placed in FINISH and registers it -- the "same round" for both gate settings. */
function finish(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < 4 && next.phase === "POST_BAKE"; i += 1) next = complete(next);
  return register(next);
}

/** Pesto + fresh tomato + egg: no recipe (an ORIGINAL pizza), as in the Research tests. */
const originalPizza = (): PizzaState => ({
  ...createEmptyPizza(),
  sauceIds: ["pesto"],
  toppings: ["fresh-tomato", "egg"].map((ingredientId, i) => ({ id: `t${i}`, ingredientId, x: 30 + i * 5, y: 40 })),
});

/** Everything a Free round's outcome consists of (the profile, step bookkeeping and timing differ by design). */
function outcome(state: GameState) {
  return {
    phase: state.phase,
    recipe: state.recipe,
    pizza: state.pizza,
    score: state.score,
    bakeState: state.bakeState,
    scoringV2Result: state.scoringV2Result,
    completion: state.completion,
    inventory: state.inventory,
    dex: state.dex,
    pitzBalance: state.pitzBalance,
    preDiscoveryFreeCookAttempts: state.preDiscoveryFreeCookAttempts,
    discoveryHintFacts: state.discoveryHintFacts,
    researchExclusions: state.researchExclusions,
    lastResearchRows: state.lastResearchRows,
    trialNotebook: state.trialNotebook,
    lastTrialAttempt: state.lastTrialAttempt,
    lastDiscovery: state.lastDiscovery,
    discoveredTechniqueIds: state.discoveredTechniqueIds,
    lastPitzCredit: state.lastPitzCredit,
    bakeValue: state.bakeValue,
    hint: state.hint,
    justDiscovered: state.justDiscovered,
    justGotNewBest: state.justGotNewBest,
    lastMaterialUnlockNotice: state.lastMaterialUnlockNotice,
    lastTechniqueDiscovery: state.lastTechniqueDiscovery,
  };
}

describe("the Free Cooking FINISH profile (gate)", () => {
  it("OFF: a Free round has exactly the profile it always had, the same object", () => {
    gate.open = false;
    const free = act(createInitialGameState(EMPTY_DEX, ALL_IDS, 0, FINITE), { type: "START_FREE_COOK" });
    expect(free.cookingProfile).toBe(DEFAULT_COOKING_PROFILE);
    expect(free.cookingProfile.steps).not.toContain("FINISH");
    expect(roundRunsFinish(free)).toBe(false);
  });

  it("ON: a Free round (and a Research round) ends in FINISH -- 6 tabs, the Production ceiling -- and nothing else changes", () => {
    gate.open = true;
    const initial = createInitialGameState(EMPTY_DEX, ALL_IDS, 0, FINITE);
    for (const action of [{ type: "START_FREE_COOK" }, { type: "START_FREE_COOK", researchTargetId: "pizza-portuguesa" }] as const) {
      const free = gameReducer(initial, action);
      expect(free.cookingProfile.steps).toEqual([...DEFAULT_COOKING_PROFILE.steps, "FINISH"]);
      expect(visibleCookingTabCount(free.cookingProfile)).toBe(6);
      expect(free.cookingProfile.cutConfig).toBeUndefined();
      expect(roundRunsFinish(free)).toBe(true);
    }
    expect(DEFAULT_COOKING_PROFILE.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]); // the shared default is never mutated
  });

  it("ON: the profile survives the mid-round re-derivation (RESET_PIZZA of a tray choice)", () => {
    gate.open = true;
    const free = act(createInitialGameState(EMPTY_DEX, ALL_IDS, 0, FINITE), { type: "START_FREE_COOK" }, { type: "BEGIN_PREPARE" });
    const chosen = { ...free, pizza: { ...free.pizza, pan: "tray" as const } };
    const reset = gameReducer(chosen, { type: "RESET_PIZZA" });
    expect(reset.cookingProfile.steps).toContain("FINISH");
  });

  it("ON: Guided, Lunch Rush and Dinner profiles and FINISH availability are untouched", () => {
    gate.open = true;
    for (const recipe of ordinaryRecipes(RECIPES)) {
      for (const mode of ["guided", "lunchRush", "dinner"] as const) {
        const state = atBake(mode, recipe.id);
        if (mode !== "dinner") expect(state.cookingProfile, `${mode}/${recipe.id}`).toEqual(getCookingProfile(recipe.id));
        expect(state.cookingProfile.steps, `${mode}/${recipe.id}`).not.toContain("FINISH");
        expect(roundRunsFinish(state), `${mode}/${recipe.id}`).toBe(mode === "guided"); // Guided is eligible, but its profile has no FINISH
      }
    }
  });
});

describe("ON: CONFIRM_BAKE defers the identification", () => {
  const reference = () => referencePizzaFor("margherita");

  it("a held bake enters FINISH unidentified: no recipe, score, completion, discovery, counter, Notebook or Research row yet", () => {
    const before = atBakeFree(reference(), true);
    const start = before.inventory;
    const state = bakeAt(before, goodBake(before));
    expect(state.phase).toBe("POST_BAKE");
    expect(state.makingStep).toBe("FINISH");
    expect(state.bakeValue).toBe(goodBake(before));
    // nothing about the dish
    expect(state.recipe).toBe(before.recipe);
    expect(state.recipe.id).toBe(FREE_COOK_RECIPE_ID);
    expect(state.order).toBe(before.order);
    expect(state.score).toBeNull();
    expect(state.scoringV2Result).toBeNull();
    expect(state.completion).toBe(before.completion);
    expect(state.lastDiscovery).toBe(before.lastDiscovery);
    expect(state.dex).toBe(before.dex);
    expect(state.pitzBalance).toBe(before.pitzBalance);
    expect(state.preDiscoveryFreeCookAttempts).toBe(before.preDiscoveryFreeCookAttempts);
    expect(state.discoveryHintFacts).toBe(before.discoveryHintFacts);
    expect(state.researchExclusions).toBe(before.researchExclusions);
    expect(state.lastResearchRows).toBe(before.lastResearchRows);
    expect(state.trialNotebook).toBe(before.trialNotebook);
    expect(state.lastTrialAttempt).toBe(before.lastTrialAttempt);
    expect(state.hint).toBe(before.hint);
    // anti-oracle: the matched recipe's id and name are nowhere the FINISH screen reads
    const visible = JSON.stringify({ recipe: state.recipe, order: state.order, hint: state.hint, score: state.score, completion: state.completion, bakeState: state.bakeState, lastDiscovery: state.lastDiscovery, scoringV2Result: state.scoringV2Result });
    expect(visible).not.toContain("margherita");
    expect(visible).not.toContain(RECIPES.find((r) => r.id === "margherita")!.nameJa);
    // only the pre-bake pieces are consumed, once
    expect(state.inventory).toEqual(consumePizzaInventory(state.pizza, start));
    expect(state.pizza.bakeResult).toBe(goodBake(before));
  });

  it("a failed bake (raw / burnt) skips FINISH and finalizes at once, exactly as without the gate", () => {
    for (const level of ["raw", "burnt"] as const) {
      for (const pizza of [reference(), ...Object.values(UNMATCHED_FREE_PIZZAS)]) {
        const off = atBakeFree(pizza, false);
        const on = atBakeFree(pizza, true);
        const value = bakeValueFor("free", off, level);
        const offDone = bakeAt(off, value);
        const onDone = bakeAt(on, value);
        expect(onDone.phase, level).toBe("RESULT");
        expect(onDone.bakeValue).toBeNull();
        expect(outcome(onDone)).toEqual(outcome(offDone));
        expect(finish(onDone).completion).toEqual(finish(offDone).completion);
      }
    }
  });

  it("an empty / composition-only failure does not skip FINISH (only a failed bake does, OD-CS-7)", () => {
    const on = atBakeFree(UNMATCHED_FREE_PIZZAS.empty, true);
    const state = bakeAt(on, goodBake(on));
    expect(state.phase).toBe("POST_BAKE");
    const done = complete(state);
    expect(done.phase).toBe("RESULT");
    expect(done.completion?.status).toBe("FAILED");
  });

  it("a stray CONFIRM_BAKE while waiting in FINISH changes nothing (no second consumption)", () => {
    const before = atBakeFree(reference(), true);
    const inFinish = bakeAt(before, goodBake(before));
    expect(bakeAt(inFinish, goodBake(before), 26_000)).toBe(inFinish);
  });
});

describe("ON: parity with the one-pass round when nothing is placed in FINISH", () => {
  const cases: [string, PizzaState][] = [
    ...RECIPES.flatMap((r): [string, PizzaState][] => [
      [`${r.id} full`, referencePizzaFor(r.id, "full")],
      [`${r.id} partial`, referencePizzaFor(r.id, "partial")],
    ]),
    ...Object.entries(UNMATCHED_FREE_PIZZAS),
  ];

  it("every Reference / partial / unmatched pizza at every bake level ends exactly as the gate-OFF round (state, score, inventory, Dex, Pitz, Notebook)", () => {
    for (const [name, pizza] of cases) {
      for (const level of ["raw", "good", "burnt"] as const) {
        const off = atBakeFree(pizza, false);
        const on = atBakeFree(pizza, true);
        const value = bakeValueFor("free", off, level);
        const offDone = finish(bakeAt(off, value));
        const onDone = finish(bakeAt(on, value));
        expect(outcome(onDone), `${name} ${level}`).toEqual(outcome(offDone));
      }
    }
  });
});

describe("ON: pieces placed in FINISH decide the dish", () => {
  const reference = () => referencePizzaFor("margherita");
  const ownsParsley = getIngredient("parsley");

  it("a finite late ingredient is consumed exactly once, on 完成; the pre-bake pieces exactly once, at the bake", () => {
    expect(ownsParsley?.unlockCondition).toBeTruthy(); // finite, so the counts below are real
    const before = atBakeFree(reference(), true);
    const start = before.inventory;
    const inFinish = bakeAt(before, goodBake(before));
    const preBakeInventory = inFinish.inventory;
    const placed = place(inFinish, "parsley", 2);
    expect(placed.pizza.toppings.filter((t) => t.stage === "post")).toHaveLength(2);
    expect(placed.inventory).toBe(preBakeInventory); // placing never touches stock
    const done = complete(placed);
    expect(done.phase).toBe("RESULT");
    expect(done.bakeValue).toBeNull();
    expect(done.inventory).toEqual(consumePizzaInventory(done.pizza, start)); // provisional + FINISH = one whole-pizza consumption
    expect(done.inventory.parsley).toBe((start.parsley ?? 0) - 2);
    // a second 完成 / registration is a no-op: nothing is consumed, identified or recorded twice
    const registered = register(done);
    expect(complete(registered)).toBe(registered);
    expect(register(registered)).toBe(registered);
  });

  it("an unmatched finished pizza charges the pre-bake pieces once and the FINISH pieces once (no double count of a finite ingredient)", () => {
    const pizza: PizzaState = { ...originalPizza(), toppings: [...originalPizza().toppings, { id: "early-parsley", ingredientId: "parsley", x: DOUGH_CENTER, y: DOUGH_CENTER - 40 }] };
    for (const id of ["parsley", "fresh-tomato", "egg", "pesto"]) expect(getIngredient(id)?.unlockCondition, id).toBeTruthy();
    const before = atBakeFree(pizza, true);
    const start = before.inventory;
    const inFinish = bakeAt(before, goodBake(before));
    const done = complete(place(inFinish, "parsley", 2));
    expect(done.score).toBeNull(); // unmatched: the Free Cooking original path
    expect(done.inventory.parsley).toBe((start.parsley ?? 0) - 3); // 1 before the bake + 2 in FINISH
    expect(done.inventory["fresh-tomato"]).toBe((start["fresh-tomato"] ?? 0) - 1);
    expect(done.inventory.pesto).toBe((start.pesto ?? 0) - 1);
    expect(done.inventory).toEqual(consumePizzaInventory(done.pizza, start));
  });

  it("the identification reads the finished pizza: a baked-on piece of an ingredient the dish does not use makes it an original", () => {
    const before = atBakeFree(reference(), true);
    const inFinish = bakeAt(before, goodBake(before));
    const plain = register(complete(inFinish));
    const garnished = register(complete(place(inFinish, "parsley", 2)));
    expect(plain.recipe.id).toBe("margherita"); // no piece: the margherita it is
    expect(plain.score).not.toBeNull();
    expect(garnished.recipe.id).toBe(FREE_COOK_RECIPE_ID); // D-1 strict: a post piece is part of the dish's identity
    expect(garnished.score).toBeNull();
    expect(garnished.lastDiscovery?.kind).not.toBe("NEW_DISCOVERY");
    expect(garnished.dex).toEqual(before.dex); // nothing registered
    expect(garnished.phase).toBe("DISCOVERED");
  });

  it("the unmatched side effects run once, on the FINISH confirmation: hint counter, Notebook", () => {
    const before = atBakeFree(originalPizza(), true);
    const inFinish = bakeAt(before, goodBake(before));
    expect(inFinish.preDiscoveryFreeCookAttempts).toBe(before.preDiscoveryFreeCookAttempts);
    const done = complete(inFinish);
    expect(done.preDiscoveryFreeCookAttempts).toBe(before.preDiscoveryFreeCookAttempts + 1);
    const registered = register(done);
    expect(registered.preDiscoveryFreeCookAttempts).toBe(done.preDiscoveryFreeCookAttempts);
    expect(registered.trialNotebook).not.toBe(before.trialNotebook);
    expect(register(registered)).toBe(registered);
  });

  it("stock: placement stops at what is left after the bake; a piece also used before the bake is not counted twice", () => {
    const withParsley: PizzaState = { ...reference(), toppings: [...reference().toppings, { id: "early-parsley", ingredientId: "parsley", x: DOUGH_CENTER, y: DOUGH_CENTER - 40 }] };
    const base = createInitialGameState(EMPTY_DEX, ["tomato-sauce", ...STARTER_INGREDIENT_IDS, "parsley"], 0, { ...FINITE, parsley: 2 });
    const before = atBakeFree(withParsley, true, base);
    const inFinish = bakeAt(before, goodBake(before));
    expect(inFinish.inventory.parsley).toBe(1); // 2 - the pre-bake piece
    const placed = place(inFinish, "parsley", 3);
    expect(placed.pizza.toppings.filter((t) => t.stage === "post")).toHaveLength(1);
  });

  it("Undo takes back only FINISH pieces", () => {
    const before = atBakeFree(reference(), true);
    const inFinish = bakeAt(before, goodBake(before));
    const placed = place(inFinish, "parsley", 2);
    const undone = act(placed, { type: "UNDO_LAST_PLACEMENT" }, { type: "UNDO_LAST_PLACEMENT" });
    expect(undone.pizza.toppings).toEqual(inFinish.pizza.toppings);
    expect(gameReducer(undone, { type: "UNDO_LAST_PLACEMENT" }).pizza.toppings).toEqual(inFinish.pizza.toppings); // never a baked piece
  });
});

describe("ON: leaving FINISH midway", () => {
  it("starting another round keeps exactly what the bake consumed: the pieces placed in FINISH are never charged, nothing is recorded", () => {
    const before = atBakeFree(referencePizzaFor("margherita"), true);
    const inFinish = bakeAt(before, goodBake(before));
    const placed = place(inFinish, "parsley", 2);
    const next = gameReducer(placed, { type: "START_FREE_COOK" });
    expect(next.inventory).toEqual(inFinish.inventory);
    expect(next.inventory.parsley).toBe(before.inventory.parsley);
    expect(next.dex).toBe(before.dex);
    expect(next.pitzBalance).toBe(before.pitzBalance);
    expect(next.trialNotebook).toBe(before.trialNotebook);
    expect(next.phase).not.toBe("POST_BAKE");
    expect(next.bakeValue).toBeNull();
    expect(next.score).toBeNull();
  });
});

describe("ON: Research", () => {
  const owned = [...STARTER_INGREDIENT_IDS, ...DISCOVERY_LADDER.steps.filter((s) => s.step <= 25).flatMap((s) => s.ingredientIds)];
  const known = ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < 25).map((s) => s.keyRecipeId), "brazilian-calabresa", "aussie", "chilean-napolitana"];
  const save = () => ({ ...createInitialGameState(discoveredDex(known), owned, 1000), inventory: Object.fromEntries(owned.map((id) => [id, 10])) });
  const researchPizza = originalPizza;
  const research = (open: boolean, bakeValue: number) => {
    gate.open = open;
    const started = gameReducer(save(), { type: "START_FREE_COOK", researchTargetId: "pesto-pollo" });
    expect(started.researchTargetId).toBe("pesto-pollo");
    const baked = act({ ...started, pizza: researchPizza() }, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: bakeValue });
    return baked;
  };

  it("good and failed bakes: rows, facts and the Notebook entry end exactly as the one-pass Research round, recorded once", () => {
    for (const value of [68, 5, 100]) {
      const off = finish(research(false, value));
      const onBaked = research(true, value);
      if (value === 68) expect(onBaked.phase).toBe("POST_BAKE"); // a held bake does wait in FINISH (the checks below are not skipped)
      if (onBaked.phase === "POST_BAKE") {
        // waiting in FINISH: no Research row, fact or Notebook line yet
        expect(onBaked.lastResearchRows).toBeNull();
        expect(onBaked.trialNotebook).toEqual(save().trialNotebook);
        expect(onBaked.discoveryHintFacts).toEqual(save().discoveryHintFacts);
      }
      const on = finish(onBaked);
      expect(outcome(on), `bake ${value}`).toEqual(outcome(off));
    }
  });
});

describe("ON: Cooking Time and Hint", () => {
  it("the measured time ends at START_BAKE; FINISH is a per-step entry only and 完成 closes it (OD-CS-8)", () => {
    const before = atBakeFree(originalPizza(), true);
    const inFinish = bakeAt(before, goodBake(before), 25_000);
    expect(inFinish.cookingTiming?.completedMs).toBe(20_000);
    expect(inFinish.cookingTiming?.activeStep).toBe("FINISH");
    const done = complete(inFinish, 40_000);
    expect(done.cookingTiming?.completedMs).toBe(20_000);
    expect(done.cookingTiming?.perStepElapsedMs.FINISH).toBe(15_000);
    expect(done.cookingTiming?.activeStep).toBeNull();
  });

  it("the FINISH hint is the Free Cooking line and names no recipe; placing a piece leaves the hint as it was", () => {
    const before = atBakeFree(referencePizzaFor("margherita"), true);
    const inFinish = bakeAt(before, goodBake(before));
    const hinted = gameReducer(inFinish, { type: "SHOW_HINT" });
    expect(hinted.hint?.id).toBe("hint.finish.free-cook");
    for (const recipe of RECIPES) expect(hinted.hint?.textJa ?? "").not.toContain(recipe.nameJa);
    const placed = place(hinted, "parsley");
    expect(placed.hint).toBe(hinted.hint);
  });
});
