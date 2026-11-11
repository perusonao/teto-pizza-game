import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { FREE_COOK_FINISH_PRODUCTION, freeCookFinishEnabled } from "../data/freeCookFinishGate";
import { INGREDIENTS } from "../data/ingredients";
import { LATE_CATALOG_PRODUCTION, lateCatalogEnabled } from "../data/lateCatalog";
import { RECIPES } from "../data/recipes";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { discoveredRecipeIds, EMPTY_DEX } from "./dex";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { pinsaEnabled } from "../data/pinsaGate";

/**
 * E5 (Owner decision: FINISH first, ikura only): the REAL Production gates -- nothing is mocked here -- take the first late recipe through the real
 * reducer, end to end: pre-bake pieces -> bake -> 後乗せ in FINISH -> 完成 -> RESULT -> Dex. This is the Production path that
 * `lateCatalog.ikura.test.ts` (data) and `gameReducer.finishFreeCook.test.ts` (gate mocked) do not run together.
 *
 * The late axis is presence-only (a late kind present or absent); counts only move the score; a late ingredient placed BEFORE the bake is a
 * different (ORIGINAL) pizza.
 */
const IKURA = "ikura-salmon-pizza";
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const STOCK = Object.fromEntries(INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 99]));
const act = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);

const piece = (ingredientId: string, n: number, i: number) => ({
  id: `e5-${ingredientId}-${i}`,
  ingredientId,
  x: DOUGH_CENTER - 28 + ((n * 17) % 56),
  y: DOUGH_CENTER - 24 + ((n * 11) % 48),
});
function pizzaWith(pre: Record<string, number>): PizzaState {
  const toppings: PizzaState["toppings"] = [];
  let n = 0;
  for (const [ingredientId, count] of Object.entries(pre)) {
    for (let i = 0; i < count; i += 1) toppings.push(piece(ingredientId, n++, i));
  }
  return { ...createEmptyPizza(), toppings };
}
function baked(pre: Record<string, number>): GameState {
  const initial = createInitialGameState(EMPTY_DEX, ALL_IDS, 0, STOCK);
  const prepared = act(initial, { type: "START_FREE_COOK", now: 0 }, { type: "BEGIN_PREPARE", now: 0 });
  const atBake = act({ ...prepared, pizza: pizzaWith(pre) }, { type: "START_BAKE", now: 20_000 });
  return gameReducer(atBake, { type: "CONFIRM_BAKE", value: 68, now: 25_000 });
}
function finishWith(state: GameState, post: Record<string, number>): GameState {
  let next = state;
  for (const [ingredientId, count] of Object.entries(post)) {
    for (let i = 0; i < count; i += 1) {
      next = gameReducer(next, { type: "PLACE_TOPPING", ingredientId, x: DOUGH_CENTER - 20 + i * 14, y: DOUGH_CENTER + 6 + (ingredientId === "shiso" ? 14 : 0) });
    }
  }
  return gameReducer(next, { type: "CONFIRM_MAKING_STEP", now: 40_000 });
}
const PRE = { "cream-cheese": 2, salmon: 3 };

describe("E5: the Production switches", () => {
  it("both are the shipped literals, ON (changing either is a separate Owner decision)", () => {
    expect(LATE_CATALOG_PRODUCTION).toBe(true);
    expect(FREE_COOK_FINISH_PRODUCTION).toBe(true);
    expect(lateCatalogEnabled()).toBe(true);
    expect(freeCookFinishEnabled()).toBe(true);
  });

  it("the catalog ends with the late content: ikura-salmon-pizza + salmon-roe + its late ladder step (ordinary length + 1), then yuzu-shrimp-pizza + yuzu-kosho + its late step (New Sauces Phase B U1), then eggplant-dengaku-pizza + miso-sauce + white-sesame + their shared late step (U2), then eggplant-tahini-pizza + tahini + pomegranate + their shared late step (U3)", () => {
    // (with the Pinsa gate open, pinsa-romana follows them as the last recipe: it adds no material and no ladder step)
    expect(RECIPES.slice(-(pinsaEnabled() ? 16 : 15)).map((r) => r.id)).toEqual([IKURA, "yuzu-shrimp-pizza", "eggplant-dengaku-pizza", "eggplant-tahini-pizza", "bbq-chicken-pizza", "wasabi-beef-pizza", "tarako-cream-pizza", "taco-pizza", "okonomiyaki-style-pizza", "pizza-finocchi-salad", "pizza-cavolo-carote", "pizza-radicchio-noci", "black-truffle-pizza", "nutella-dessert-pizza", "smore-dessert-pizza", ...(pinsaEnabled() ? ["pinsa-romana"] : [])]);
    expect(INGREDIENTS.slice(-31).map((i) => i.id)).toEqual(["salmon-roe", "yuzu-kosho", "miso-sauce", "white-sesame", "tahini", "pomegranate", "bbq-sauce", "soy-sauce", "wasabi", "cod-roe", "fresh-cream-sauce", "nori", "cheddar", "lettuce", "tortilla-chips", "okonomiyaki-sauce", "cabbage", "bonito-flakes", "fennel", "orange", "carrot", "red-cabbage", "sunflower-seeds", "radicchio", "truffle", "balsamic-vinegar", "banana", "chocolate", "powdered-sugar", "graham-cracker", "marshmallow"]); // (Expansion Batch 23-b: + five dessert materials) (Expansion Batch 21: + six materials)
    const steps = DISCOVERY_LADDER.steps;
    expect(steps.at(-15)).toMatchObject({ step: steps.length - 14, ingredientIds: ["salmon-roe"], keyRecipeId: IKURA });
    expect(steps.at(-14)).toMatchObject({ step: steps.length - 13, ingredientIds: ["yuzu-kosho"], keyRecipeId: "yuzu-shrimp-pizza" });
    expect(steps.at(-13)).toMatchObject({ step: steps.length - 12, ingredientIds: ["miso-sauce", "white-sesame"], keyRecipeId: "eggplant-dengaku-pizza" });
    expect(steps.at(-12)).toMatchObject({ step: steps.length - 11, ingredientIds: ["tahini", "pomegranate"], keyRecipeId: "eggplant-tahini-pizza" });
    expect(steps.at(-11)).toMatchObject({ step: steps.length - 10, ingredientIds: ["bbq-sauce"], keyRecipeId: "bbq-chicken-pizza" }); // BBQ Chicken (#611)
    expect(steps.at(-10)).toMatchObject({ step: steps.length - 9, ingredientIds: ["soy-sauce", "wasabi"], keyRecipeId: "wasabi-beef-pizza" }); // PR-2 late4
    expect(steps.at(-9)).toMatchObject({ step: steps.length - 8, ingredientIds: ["cod-roe", "fresh-cream-sauce", "nori"], keyRecipeId: "tarako-cream-pizza" });
    expect(steps.at(-8)).toMatchObject({ step: steps.length - 7, ingredientIds: ["cheddar", "lettuce", "tortilla-chips"], keyRecipeId: "taco-pizza" }); // Expansion Batch 21 (#780)
    expect(steps.at(-7)).toMatchObject({ step: steps.length - 6, ingredientIds: ["okonomiyaki-sauce", "cabbage", "bonito-flakes"], keyRecipeId: "okonomiyaki-style-pizza" });
    expect(steps.at(-6)).toMatchObject({ step: steps.length - 5, ingredientIds: ["fennel", "orange"], keyRecipeId: "pizza-finocchi-salad" }); // Expansion Batch 22 (#780)
    expect(steps.at(-5)).toMatchObject({ step: steps.length - 4, ingredientIds: ["carrot", "red-cabbage", "sunflower-seeds"], keyRecipeId: "pizza-cavolo-carote" });
    expect(steps.at(-4)).toMatchObject({ step: steps.length - 3, ingredientIds: ["radicchio", "balsamic-vinegar"], keyRecipeId: "pizza-radicchio-noci" });
    expect(steps.at(-3)).toMatchObject({ step: steps.length - 2, ingredientIds: ["truffle"], keyRecipeId: "black-truffle-pizza" });
    expect(steps.at(-2)).toMatchObject({ step: steps.length - 1, ingredientIds: ["banana", "chocolate", "powdered-sugar"], keyRecipeId: "nutella-dessert-pizza" }); // Expansion Batch 23-b (#780)
    expect(steps.at(-1)).toMatchObject({ step: steps.length, ingredientIds: ["graham-cracker", "marshmallow"], keyRecipeId: "smore-dessert-pizza" });
  });
});

describe("E5: a Free Cooking round through the real Production reducer", () => {
  it("pre-bake cream cheese x2 + salmon x3, roe x2 + shiso x1 placed in FINISH after the bake: discovers ikura-salmon-pizza and records 後乗せ", () => {
    const afterBake = baked(PRE);
    expect([afterBake.phase, afterBake.makingStep]).toEqual(["POST_BAKE", "FINISH"]);
    expect(afterBake.score).toBeNull(); // nothing is identified before 完成
    const result = finishWith(afterBake, { "salmon-roe": 2, shiso: 1 });
    expect(result.phase).toBe("RESULT");
    expect(result.recipe.id).toBe(IKURA);
    expect(result.completion?.status).toBe("PASS");
    const registered = gameReducer(result, { type: "REGISTER_TO_DEX" });
    expect(registered.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: IKURA });
    expect(discoveredRecipeIds(registered.dex)).toContain(IKURA);
    expect(registered.discoveredTechniqueIds).toEqual(expect.arrayContaining(["no-sauce", "late-addition"]));
  });

  it("fewer late pieces still discover it (presence-only late axis; the count only moves the score)", () => {
    const registered = gameReducer(finishWith(baked(PRE), { "salmon-roe": 1, shiso: 1 }), { type: "REGISTER_TO_DEX" });
    expect(registered.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: IKURA });
  });

  it("a missing late kind (no shiso) or a nothing-in-FINISH round is an ORIGINAL, not the recipe -- and 後乗せ is still recorded when something was placed late", () => {
    const noShiso = gameReducer(finishWith(baked(PRE), { "salmon-roe": 2 }), { type: "REGISTER_TO_DEX" });
    expect(noShiso.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(discoveredRecipeIds(noShiso.dex)).not.toContain(IKURA);
    const nothing = gameReducer(finishWith(baked(PRE), {}), { type: "REGISTER_TO_DEX" });
    expect(nothing.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(nothing.discoveredTechniqueIds).not.toContain("late-addition");
  });

  it("roe and shiso placed BEFORE the bake make a different pizza (ORIGINAL): the moment is part of the pizza, never announced", () => {
    const state = baked({ ...PRE, "salmon-roe": 2, shiso: 1 });
    const registered = gameReducer(finishWith(state, {}), { type: "REGISTER_TO_DEX" });
    expect(registered.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(discoveredRecipeIds(registered.dex)).not.toContain(IKURA);
  });

  it("an ordinary Free pizza (Margherita) still ends the same way with an empty FINISH: 完成 identifies it", () => {
    const state = baked({ mozzarella: 3, basil: 2 });
    expect([state.phase, state.makingStep]).toEqual(["POST_BAKE", "FINISH"]);
    // (no sauce: this is an ORIGINAL; the parity of every ordinary recipe with FINISH off is pinned in gameReducer.finishFreeCook.test.ts)
    expect(gameReducer(state, { type: "CONFIRM_MAKING_STEP", now: 40_000 }).phase).toBe("RESULT");
  });
});
