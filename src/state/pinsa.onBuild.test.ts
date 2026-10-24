import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pinsa Romana P3-b-2/b-4 (#577): the REAL reducer end to end with the Pinsa gate (src/data/pinsaGate.ts) mocked ON -- Guided start (dough from the recipe, P3-a1),
 * Free Cooking with the dough chip, 後乗せ in FINISH, discovery, the technique ledger, the Dex / save round trip and the pending-round journal. The shipped (gate
 * closed) state is in src/data/pinsaGate.test.ts. Nothing here changes Production: the gate literal stays false.
 */
const PINSA = "pinsa-romana";
const JAMON = "jamon-serrano-pizza";
const DOUGH = "material-multigrain-long-ferment";

async function loadOn() {
  vi.resetModules();
  vi.doMock("../data/pinsaGate", () => ({ PINSA_PRODUCTION: true, pinsaEnabled: () => true }));
  await import("../data/pinsaGate");
  const reducer = await import("./gameReducer");
  const guided = await import("./testSupport/guidedRound");
  const dexLib = await import("./dex");
  const preview = await import("../preview/doughKindPreview");
  const journal = await import("./pendingRound");
  const ingredients = await import("../data/ingredients");
  const recipes = await import("../data/recipes");
  const signature = await import("../logic/discovery/signature");
  const pizzaState = await import("./pizzaState");
  return { reducer, guided, dexLib, preview, journal, ingredients, recipes, signature, pizzaState };
}
type On = Awaited<ReturnType<typeof loadOn>>;

function setSearch(on: On | null, search: string): void {
  window.history.replaceState(null, "", `/${search}`);
  on?.preview.resetDoughKindPreviewForTest();
}
beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.doUnmock("../data/pinsaGate");
  vi.resetModules();
});

/** Plays a round whose pre-bake pizza is `pizza`, places `post` in FINISH, confirms 完成 and registers to the Dex. */
function playFromBake(on: On, state: import("./gameReducer").GameState, pizza: import("./pizzaState").PizzaState, post: readonly string[]) {
  const { gameReducer } = on.reducer;
  let s = gameReducer({ ...state, pizza }, { type: "START_BAKE", now: 20_000 });
  s = gameReducer(s, { type: "CONFIRM_BAKE", value: 68, now: 25_000 });
  expect([s.phase, s.makingStep]).toEqual(["POST_BAKE", "FINISH"]);
  post.forEach((ingredientId, i) => {
    s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId, x: 30 + i * 14, y: 52 });
  });
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 40_000 });
  expect(s.phase).toBe("RESULT");
  return gameReducer(s, { type: "REGISTER_TO_DEX" });
}

function prePizza(on: On, opts: { dough: boolean; pre?: readonly string[] }) {
  const toppings = (opts.pre ?? ["mozzarella", "mozzarella", "prosciutto-crudo", "prosciutto-crudo", "prosciutto-crudo"]).map((ingredientId, i) => ({
    id: `p${i}`,
    ingredientId,
    x: 34 + ((i * 11) % 34),
    y: 40 + ((i * 7) % 24),
  }));
  return { ...on.pizzaState.createEmptyPizza(), sauceIds: ["tomato-sauce"], toppings, ...(opts.dough ? { dough: DOUGH } : {}) } as import("./pizzaState").PizzaState;
}

describe("Guided Pinsa (gate ON)", () => {
  it("starts with the recipe's dough (P3-a1), offers no dough choice, and the dough survives to the pending-round journal and a JSON round trip", async () => {
    const on = await loadOn();
    const { gameReducer } = on.reducer;
    const state = gameReducer(on.guided.createGuidedInitialState(PINSA as never), { type: "SELECT_RECIPE", recipeId: PINSA as never, now: 0 });
    expect(state.recipe.id).toBe(PINSA);
    expect(state.pizza.dough).toBe(DOUGH);
    expect(gameReducer(state, { type: "SELECT_DOUGH", dough: "standard" })).toBe(state); // a recipe that fixes its dough has no choice
    const round = on.journal.buildPendingRound({ recipe: state.recipe, roundKind: state.roundKind, pizza: state.pizza, researchTargetId: null, researchTargetValidAtStart: false, cookingProfile: state.cookingProfile }, "r1", 70, 1);
    const read = on.journal.readStoredPendingRound(JSON.parse(JSON.stringify(round)));
    expect(read.kind).toBe("round");
    if (read.kind !== "round") throw new Error("unreachable");
    expect(on.journal.pizzaFromJournal(read.round.pizza).dough).toBe(DOUGH);
    // RESET_PIZZA keeps the recipe's own dough
    const reset = gameReducer(gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 }), { type: "RESET_PIZZA" });
    expect(reset.pizza.dough).toBe(DOUGH);
    expect(reset.pizza.toppings).toEqual([]);
  });

  it("the Guided round discovers pinsa-romana through the real FINISH flow (arugula after the bake), records both techniques and does not advance the ladder", async () => {
    const on = await loadOn();
    const { gameReducer } = on.reducer;
    const initial = on.guided.createGuidedInitialState(PINSA as never);
    const state = gameReducer(initial, { type: "SELECT_RECIPE", recipeId: PINSA as never, now: 0 });
    const registered = playFromBake(on, state, prePizza(on, { dough: true }), ["arugula", "arugula"]);
    // (a Guided round replays a recipe the Dex already holds: the verdict is ALREADY_DISCOVERED, i.e. the dough + moment identified Pinsa and nothing else)
    expect(registered.lastDiscovery).toMatchObject({ kind: "ALREADY_DISCOVERED", recipeId: PINSA });
    expect(registered.discoveredTechniqueIds).toEqual(expect.arrayContaining(["dough-pinsa-romana", "late-addition"]));
    expect(on.recipes.countsTowardLadder(PINSA)).toBe(false); // credited count unchanged: no ladder step, no Pitz double award from the ladder
  });
});

describe("Free Cooking (gate ON): the chip, the dough and the moment are all part of the pizza", () => {
  function freeCook(on: On) {
    const { createInitialGameState, gameReducer } = on.reducer;
    const owned = on.ingredients.INGREDIENTS.map((i) => i.id);
    const stock = Object.fromEntries(on.ingredients.INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 99]));
    const initial = createInitialGameState(on.dexLib.EMPTY_DEX, owned, 0, stock);
    return gameReducer(gameReducer(initial, { type: "START_FREE_COOK", now: 0 }), { type: "BEGIN_PREPARE", now: 0 });
  }

  it("with the chip open, choosing the other dough + arugula after the bake discovers Pinsa; the same cook on the standard dough is an ORIGINAL (D2)", async () => {
    const on = await loadOn();
    setSearch(on, "?doughSwitch=open");
    const prepared = freeCook(on);
    const chosen = on.reducer.gameReducer(prepared, { type: "SELECT_DOUGH", dough: DOUGH as never });
    expect(chosen.pizza.dough).toBe(DOUGH);
    const pinsa = playFromBake(on, chosen, prePizza(on, { dough: true }), ["arugula", "arugula"]);
    expect(pinsa.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: PINSA });
    const standard = playFromBake(on, prepared, prePizza(on, { dough: false }), ["arugula", "arugula"]);
    expect(standard.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(on.dexLib.discoveredRecipeIds(standard.dex)).not.toContain(PINSA);
    expect(standard.discoveredTechniqueIds).not.toContain("dough-pinsa-romana"); // the standard dough never records the dough technique
    expect(pinsa.discoveredTechniqueIds).toEqual(expect.arrayContaining(["dough-pinsa-romana", "late-addition"]));
  });

  it("jamon is still discovered by its own pre-bake cook, and a Pinsa cook never discovers jamon", async () => {
    const on = await loadOn();
    const prepared = freeCook(on);
    const jamon = playFromBake(on, prepared, prePizza(on, { dough: false, pre: ["mozzarella", "mozzarella", "prosciutto-crudo", "prosciutto-crudo", "prosciutto-crudo", "arugula", "arugula"] }), []);
    expect(jamon.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: JAMON });
    setSearch(on, "?doughSwitch=open");
    const pinsaDoughAllPre = playFromBake(on, freeCook(on), prePizza(on, { dough: true, pre: ["mozzarella", "mozzarella", "prosciutto-crudo", "prosciutto-crudo", "prosciutto-crudo", "arugula", "arugula"] }), []);
    expect(pinsaDoughAllPre.lastDiscovery?.kind).toBe("ORIGINAL");
  });

  it("the Dex saved by a Pinsa discovery is plain JSON: it round-trips and an old save (no Pinsa) loads unchanged", async () => {
    const on = await loadOn();
    const registered = playFromBake(on, freeCook(on), prePizza(on, { dough: true }), ["arugula", "arugula"]);
    // (the chip is closed in this plain cook, so the dough is set on the pizza directly: only the verdict matters here)
    expect(registered.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: PINSA });
    const roundTrip = JSON.parse(JSON.stringify(registered.dex));
    expect(on.dexLib.discoveredRecipeIds(roundTrip)).toContain(PINSA);
    const old = [{ recipeId: JAMON, discovered: true, bestScore: 80, bestStars: 3 as const, timesMade: 2 }];
    expect(JSON.parse(JSON.stringify(old))).toEqual(old);
    expect(on.dexLib.discoveredRecipeIds(old)).toEqual([JAMON]);
  });
});
