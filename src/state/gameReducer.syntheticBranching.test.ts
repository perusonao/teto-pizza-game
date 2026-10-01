import { describe, expect, it, vi } from "vitest";

// Discovery 3.0 PR-4a: the REAL reducer over the production recipes + one synthetic non-credit recipe.
// Production data files are untouched: the population is extended only inside this test file's module graph.
vi.mock("../data/recipes", async (orig) => (await import("../logic/testSupport/syntheticModuleMocks")).mockRecipes(await orig()));
vi.mock("../data/discoveryCatalog", async (orig) => (await import("../logic/testSupport/syntheticModuleMocks")).mockCatalog(await orig()));

const { getIngredient } = await import("../data/ingredients");
const { RECIPES } = await import("../data/recipes");
const { discoverIds, ladderCountOf, walkInputs } = await import("../logic/testSupport/discoveryWalk");
const { SYNTH_BRANCH_A_ID, SYNTH_BRANCH_B_ID } = await import("../logic/testSupport/syntheticPopulation");
const { discoverableHintCandidates } = await import("../logic/discovery/hintTarget");
const { recipeDiscoveryState } = await import("./recipeDiscoveryState");
const { createInitialGameState, gameReducer } = await import("./gameReducer");
const { createEmptyPizza } = await import("./pizzaState");
type GameAction = Parameters<typeof gameReducer>[1];
type GameState = ReturnType<typeof gameReducer>;
type PizzaState = ReturnType<typeof createEmptyPizza>;

const FIRST_12 = ["margherita", "bismarck", "breakfast-pizza", "funghi", "melanzane-pizza", "parmigiana-pizza", "pepperoni", "salsiccia", "meat-lovers", "bambino", "hawaiian", "capricciosa"];
const BAKE = 68;
const isSauce = (id: string) => getIngredient(id)?.category === "sauce";
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);

function pizzaOf(recipeId: string): PizzaState {
  const r = RECIPES.find((x) => x.id === recipeId)!;
  const ids = r.requiredIngredients.map((q) => q.ingredientId);
  const toppings = r.requiredIngredients.filter((q) => !isSauce(q.ingredientId)).flatMap((q) => Array.from({ length: Math.max(1, q.minCount) }, () => q.ingredientId));
  return {
    ...createEmptyPizza(),
    sauceIds: ids.filter(isSauce).slice(0, 1),
    toppings: toppings.map((ingredientId, i) => ({ id: `w${i}`, ingredientId, x: 30 + (i % 8) * 5, y: 40 + Math.floor(i / 8) * 8 })),
    bakeResult: BAKE,
  };
}

/** A save at ladder count 12 (A and B both DISCOVERABLE), every entitled material bought and stocked. */
function poolOfTwoState(): GameState {
  const base = createInitialGameState(undefined, undefined, 1_000_000);
  const inputs = walkInputs(discoverIds([], FIRST_12), RECIPES);
  return { ...base, dex: inputs.dex, ownedIngredientIds: inputs.ownedIngredientIds, unlockedForShopIngredientIds: inputs.unlockedForShopIngredientIds, inventory: { ...inputs.inventory } };
}

function cook(s: GameState, recipeId: string): GameState {
  s = { ...act(s, { type: "START_FREE_COOK" }), pizza: pizzaOf(recipeId) };
  s = act(s, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: BAKE });
  for (let i = 0; i < 6 && s.phase !== "RESULT"; i += 1) s = act(s, { type: "CONFIRM_MAKING_STEP" });
  expect(s.phase).toBe("RESULT");
  return act(s, { type: "REGISTER_TO_DEX" });
}

const countOf = (s: GameState) => ladderCountOf(s.dex, RECIPES);
const poolOf = (s: GameState) => discoverableHintCandidates(s, RECIPES).map((r) => r.id).sort();

describe("real reducer: pool = 2 at the branching step", () => {
  it("both recipes are DISCOVERABLE at ladder count 12", () => {
    const s = poolOfTwoState();
    expect(countOf(s)).toBe(12);
    expect(poolOf(s)).toEqual([SYNTH_BRANCH_A_ID, SYNTH_BRANCH_B_ID].sort());
  });

  it("A -> B: A advances the ladder and unlocks step 13; B (non-credit) then changes neither the count nor the entitlement", () => {
    let s = poolOfTwoState();
    s = cook(s, SYNTH_BRANCH_A_ID);
    expect(s.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: SYNTH_BRANCH_A_ID });
    expect(countOf(s)).toBe(13);
    expect(s.unlockedForShopIngredientIds).toContain("olive-oil");
    // Step 13's key recipe (fugazza) is Shop-entitled but not bought yet (Shop state); B is still discoverable.
    expect(poolOf(s)).toEqual([SYNTH_BRANCH_B_ID]);
    expect(recipeDiscoveryState(RECIPES.find((r) => r.id === "fugazza")!, s)).toBe("KNOWN_BUT_MISSING_MATERIAL");
    const entitled = [...s.unlockedForShopIngredientIds];
    s = cook(s, SYNTH_BRANCH_B_ID);
    expect(s.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: SYNTH_BRANCH_B_ID });
    expect(countOf(s)).toBe(13);
    expect(s.unlockedForShopIngredientIds).toEqual(entitled);
    expect(poolOf(s)).toEqual([]); // nothing discoverable but no softlock: the Shop sells fugazza's olive-oil
    s = act(s, { type: "PURCHASE_INGREDIENT", ingredientId: "olive-oil" });
    expect(poolOf(s)).toEqual(["fugazza"]);
  });

  it("B -> A: B does not advance the ladder (same entitlement, A the only target); A then advances it", () => {
    let s = poolOfTwoState();
    const entitled = [...s.unlockedForShopIngredientIds];
    s = cook(s, SYNTH_BRANCH_B_ID);
    expect(s.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: SYNTH_BRANCH_B_ID });
    expect(countOf(s)).toBe(12);
    expect(s.unlockedForShopIngredientIds).toEqual(entitled);
    expect(poolOf(s)).toEqual([SYNTH_BRANCH_A_ID]);
    s = cook(s, SYNTH_BRANCH_A_ID);
    expect(s.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: SYNTH_BRANCH_A_ID });
    expect(countOf(s)).toBe(13);
    expect(s.unlockedForShopIngredientIds).toContain("olive-oil");
    expect(poolOf(s)).toEqual([]); // B and A both found: only the Shop path (olive-oil) is left
    s = act(s, { type: "PURCHASE_INGREDIENT", ingredientId: "olive-oil" });
    expect(poolOf(s)).toEqual(["fugazza"]);
  });
});
