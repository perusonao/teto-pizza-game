import { describe, expect, it } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { findOrderForRecipe } from "../data/orders";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { getRecipe, type RecipeId } from "../data/recipes";
import type { TechniqueId } from "../data/techniques";
import { getCookingProfile } from "../data/cookingProfiles";
import { createCutState } from "../logic/cut/state";
import { W1_ORDER } from "../logic/testSupport/branchingFixture";
import { EMPTY_DEX, type DexEntry, type DexState } from "./dex";
import { discoveryRevealOrder } from "./discoveryReveal";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { createEmptyPizza, type PizzaState, type PlacedTopping } from "./pizzaState";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * Cooking Techniques 1.0 TQ-1D (OD-TQ1D-1 / 2): the technique loop with the REAL production catalog and
 * Aussie, the first NO_SAUCE recipe. Nothing is mocked: the reducer, the matcher, the ladder and the
 * affordance are the production ones. The technique is derived from the finished pizza's own composition
 * (and, for a recipe, from the Dex the same write produced) -- never from a target identity.
 */

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const BAKE = 60; // inside Aussie's 50-70 window (and Margherita-like windows' completion floor)
const AUSSIE = "aussie" as RecipeId;

const dexOf = (ids: readonly string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));

function pieces(recipeId: RecipeId): PlacedTopping[] {
  return getReferencePizza(recipeId)!.pieceGroups.flatMap((g, gi) => g.positions.map((p, i) => ({ id: `${recipeId}-${gi}-${i}`, ingredientId: g.ingredientId, ...p })));
}

/** Aussie's ideal pizza: its seven pieces, NO sauce. */
const aussiePizza = (bake = BAKE): PizzaState => ({ ...createEmptyPizza(), toppings: pieces(AUSSIE), bakeResult: bake });
/** The same pieces under a tomato sauce: a different pizza (never Aussie, never a no-sauce pizza). */
const saucedAussiePizza = (): PizzaState => ({ ...aussiePizza(), sauceIds: ["tomato-sauce"], sauceDeposits: buildIdealSauceFixture() });
/** A finished sauce-free pizza that is no recipe: mozzarella + basil only. */
const plainNoSaucePizza = (): PizzaState => ({
  ...createEmptyPizza(),
  toppings: [
    { id: "m1", ingredientId: "mozzarella", x: 40, y: 50 },
    { id: "m2", ingredientId: "mozzarella", x: 60, y: 50 },
    { id: "b1", ingredientId: "basil", x: 50, y: 35 },
  ],
  bakeResult: BAKE,
});

function freeCookToResult(pizza: PizzaState, dex: DexState = EMPTY_DEX, ledger: readonly string[] = []): GameState {
  let state = createInitialGameState(dex, ALL_IDS, 0, {}, [], [], {}, {}, undefined, ledger as readonly TechniqueId[]);
  state = gameReducer(state, { type: "START_FREE_COOK" });
  state = { ...state, pizza };
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: pizza.bakeResult ?? BAKE });
  return walkPostBakeToResult(state);
}

function guidedToResult(pizza: PizzaState, dex: DexState, opts: { mission?: boolean } = {}): GameState {
  const recipe = getRecipe(AUSSIE)!;
  const cookingProfile = getCookingProfile(AUSSIE);
  let state = createInitialGameState(dex, ALL_IDS, 0, {}, []);
  state = {
    ...state,
    recipe,
    order: findOrderForRecipe(AUSSIE)!,
    pizza,
    cookingProfile,
    cutState: createCutState(cookingProfile.cutConfig),
    isMissionRound: opts.mission === true,
    roundKind: opts.mission ? "LUNCH_RUSH" : state.roundKind,
    freeCook: false,
  };
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: pizza.bakeResult ?? BAKE });
  return walkPostBakeToResult(state);
}

const register = (s: GameState) => gameReducer(s, { type: "REGISTER_TO_DEX" });
const credited = (n: number) => dexOf(W1_ORDER.slice(0, n));

describe("TQ-1D: Aussie's recipe path (the technique is revealed first, saved in the one write)", () => {
  it("discovering Aussie by its composition records no-sauce in the same REGISTER_TO_DEX write and reveals it before the recipe", () => {
    const result = freeCookToResult(aussiePizza());
    expect(result.completion?.status).toBe("PASS");
    const after = register(result);
    expect(after.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: AUSSIE });
    expect(after.dex.find((e) => e.recipeId === AUSSIE)?.discovered).toBe(true);
    expect(after.discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect(after.lastTechniqueDiscovery).toEqual(["no-sauce"]);
    expect(discoveryRevealOrder(after)).toEqual(["TECHNIQUE", "RECIPE"]);
  });

  it("a technique already known is never revealed again; the recipe alone is", () => {
    const after = register(freeCookToResult(aussiePizza(), EMPTY_DEX, ["no-sauce"]));
    expect(after.discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect(after.lastTechniqueDiscovery).toEqual([]);
    expect(discoveryRevealOrder(after)).toEqual(["RECIPE"]);
  });

  it("the technique adds no star and no Pitz: the round's score, Pitz and Dex row are identical with or without it known", () => {
    const fresh = register(freeCookToResult(aussiePizza()));
    const known = register(freeCookToResult(aussiePizza(), EMPTY_DEX, ["no-sauce"]));
    expect(fresh.score).toEqual(known.score);
    expect(fresh.lastPitzCredit).toEqual(known.lastPitzCredit);
    expect(fresh.pitzBalance).toBe(known.pitzBalance);
    expect(fresh.dex).toEqual(known.dex);
  });

  it("a sauced pizza of Aussie's pieces is not Aussie and records no technique", () => {
    const after = register(freeCookToResult(saucedAussiePizza()));
    expect(after.lastDiscovery?.kind).not.toBe("NEW_DISCOVERY");
    expect(after.discoveredTechniqueIds).toEqual([]);
    expect(after.lastTechniqueDiscovery).toEqual([]);
  });

  it("Aussie is a Free Cooking discovery only: Lunch Rush / Dinner rounds never discover the technique", () => {
    const after = register(guidedToResult(aussiePizza(), EMPTY_DEX, { mission: true }));
    expect(after.discoveredTechniqueIds).toEqual([]);
    expect(after.lastTechniqueDiscovery ?? []).toEqual([]);
  });
});

describe("TQ-1D: the usage path and the affordance (OD-TQ1D-2: credited discoveries only)", () => {
  it("a sauce-free original pizza discovers no-sauce once 12 credited recipes are found (the onion step) -- and no recipe", () => {
    const after = register(freeCookToResult(plainNoSaucePizza(), credited(12)));
    expect(after.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(after.discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect(after.lastTechniqueDiscovery).toEqual(["no-sauce"]);
    expect(discoveryRevealOrder(after)).toEqual(["TECHNIQUE"]);
  });

  it("with 11 credited recipes the affordance is closed: nothing is recorded or revealed", () => {
    const after = register(freeCookToResult(plainNoSaucePizza(), credited(11)));
    expect(after.discoveredTechniqueIds).toEqual([]);
    expect(after.lastTechniqueDiscovery).toEqual([]);
  });

  it("a non-credit recipe never opens it early: 11 credited + calabresa still closed (the ladder's own count)", () => {
    const dex = dexOf([...W1_ORDER.slice(0, 11), "brazilian-calabresa"]);
    expect(dex.filter((e) => e.discovered)).toHaveLength(12); // a raw count of 12 would have opened it
    const after = register(freeCookToResult(plainNoSaucePizza(), dex));
    expect(after.discoveredTechniqueIds).toEqual([]);
    expect(after.lastTechniqueDiscovery).toEqual([]);
  });

  it("the technique is derived from the pizza, not a target: a sauced pizza never records it, whatever is discovered", () => {
    const sauced: PizzaState = { ...plainNoSaucePizza(), sauceIds: ["tomato-sauce"], sauceDeposits: buildIdealSauceFixture() };
    for (const n of [0, 12, 25]) {
      const after = register(freeCookToResult(sauced, credited(n)));
      expect(after.discoveredTechniqueIds, `credited ${n}`).toEqual([]);
    }
  });

  it("Aussie needs no affordance: discovering the recipe records it even before the onion step (INV-TQ-1)", () => {
    const after = register(freeCookToResult(aussiePizza(), credited(3)));
    expect(after.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: AUSSIE });
    expect(after.discoveredTechniqueIds).toEqual(["no-sauce"]);
  });
});

describe("TQ-1D: starters + onion are all Aussie needs (no new ingredient, no new ladder step)", () => {
  it("every Aussie ingredient is a starter or an existing ladder material; the affordance step is the onion's (12)", () => {
    const need = getRecipe(AUSSIE)!.requiredIngredients.map((q) => q.ingredientId).sort();
    expect(need).toEqual(["bacon", "egg", "mozzarella", "onion"]);
    expect(STARTER_INGREDIENT_IDS).toContain("mozzarella");
  });
});
