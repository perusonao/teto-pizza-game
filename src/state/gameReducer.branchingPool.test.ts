import { describe, expect, it, vi } from "vitest";

/**
 * Discovery 3.0 PR-4a post-merge hardening (gap in #327, the canonical PR-4a): #327's branching-pool suite is pure-layer, so the
 * REAL reducer (Free Cooking matcher -> REGISTER_TO_DEX -> entitlement) was never run over a pool of 2. This does that, for
 * both discovery orders, with the synthetic non-credit recipe B of `branchingFixture`.
 *
 * Production data is untouched: the population is extended inside THIS file's module graph only (`vi.mock`). The base is the
 * credited recipes, so the meaning does not change if a production non-credit recipe is added later. `B_LITERAL` is a copy of
 * `SYNTHETIC_BRANCH_B` (a factory cannot import the fixture: it imports the module being mocked); the first test pins them equal.
 */
const B_LITERAL = {
  id: "synthetic-branch-b",
  nameJa: "合成ブランチB",
  description: "test fixture",
  requiredIngredients: [
    { ingredientId: "tomato-sauce", minCount: 1 },
    { ingredientId: "sausage", minCount: 2 },
    { ingredientId: "onion", minCount: 2 },
    { ingredientId: "black-olive", minCount: 2 },
    { ingredientId: "oregano", minCount: 1 },
  ],
  bakeTarget: { start: 58, end: 78 },
  baseRewardPitz: 100,
  ladderCredit: false,
} as const;

vi.mock("../data/recipes", async (importOriginal) => {
  const m = await importOriginal<typeof import("../data/recipes")>();
  const RECIPES = [
    ...m.RECIPES.filter((r) => (r as { ladderCredit?: false }).ladderCredit !== false),
    B_LITERAL,
  ] as unknown as typeof m.RECIPES;
  return {
    ...m,
    RECIPES,
    getRecipe: (id: string) => RECIPES.find((r) => r.id === id),
    getRecipeIndex: (id: string) => RECIPES.findIndex((r) => r.id === id),
    countsTowardLadder: (id: string, recipes: readonly { id: string; ladderCredit?: false }[] = RECIPES) =>
      recipes.find((r) => r.id === id)?.ladderCredit !== false,
  };
});
vi.mock("../data/discoveryCatalog", async (importOriginal) => {
  const m = await importOriginal<typeof import("../data/discoveryCatalog")>();
  return {
    ...m,
    RECIPE_DISCOVERY_CATALOG: m.RECIPE_DISCOVERY_CATALOG.map((t) =>
      (t.recipeId as string) === B_LITERAL.id ? { ...t, targetId: `synthetic:${B_LITERAL.id}` } : t,
    ),
  };
});

const { getIngredient } = await import("../data/ingredients");
const { RECIPES } = await import("../data/recipes");
const { branchPoint, poolOf, SYNTHETIC_BRANCH_B, SYNTHETIC_BRANCH_ID, W1_ORDER, walkState } = await import("../logic/testSupport/branchingFixture");
const { createInitialGameState, gameReducer } = await import("./gameReducer");
const { createEmptyPizza } = await import("./pizzaState");
type GameAction = Parameters<typeof gameReducer>[1];
type GameState = ReturnType<typeof gameReducer>;

const B = SYNTHETIC_BRANCH_ID as string;
const { step: STEP, w1Recipe: A } = branchPoint(SYNTHETIC_BRANCH_B);
const BASE = W1_ORDER.slice(0, STEP); // everything before the branch point
const NEXT_W1 = W1_ORDER[STEP + 1];
const BAKE = 68;
const isSauce = (id: string) => getIngredient(id)?.category === "sauce";
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const poolIds = (s: GameState) => poolOf(s, RECIPES).sort();
const ladderCount = (s: GameState) => walkState(s.dex.filter((e) => e.discovered).map((e) => e.recipeId), RECIPES).ladderCount;

/** A save at the branch point: both A and B DISCOVERABLE, every entitled material bought and stocked. */
function branchPointState(): GameState {
  const w = walkState(BASE, RECIPES);
  const base = createInitialGameState(undefined, undefined, 1_000_000);
  return { ...base, dex: w.dex, ownedIngredientIds: w.ownedIngredientIds, unlockedForShopIngredientIds: w.unlockedForShopIngredientIds, inventory: { ...w.inventory } };
}

/** One Free Cooking round with exactly `recipeId`'s ingredients (each at its required count), baked and registered. */
function cook(s: GameState, recipeId: string): GameState {
  const r = RECIPES.find((x) => x.id === recipeId)!;
  const pizza = {
    ...createEmptyPizza(),
    sauceIds: r.requiredIngredients.filter((q) => isSauce(q.ingredientId)).map((q) => q.ingredientId).slice(0, 1),
    toppings: r.requiredIngredients
      .filter((q) => !isSauce(q.ingredientId))
      .flatMap((q) => Array.from({ length: Math.max(1, q.minCount) }, () => q.ingredientId))
      .map((ingredientId, i) => ({ id: `w${i}`, ingredientId, x: 30 + (i % 8) * 5, y: 40 + Math.floor(i / 8) * 8 })),
    bakeResult: BAKE,
  };
  s = { ...act(s, { type: "START_FREE_COOK" }), pizza };
  s = act(s, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: BAKE });
  for (let i = 0; i < 6 && s.phase !== "RESULT"; i += 1) s = act(s, { type: "CONFIRM_MAKING_STEP" });
  expect(s.phase).toBe("RESULT");
  return act(s, { type: "REGISTER_TO_DEX" });
}

describe("real reducer over a pool of 2 (A = next W1 recipe, B = non-credit)", () => {
  it("the mocked B is the fixture's B, and both are DISCOVERABLE at the branch point", () => {
    expect(B_LITERAL).toEqual(SYNTHETIC_BRANCH_B);
    expect(RECIPES.map((r) => r.id)).toContain(B);
    const s = branchPointState();
    expect(ladderCount(s)).toBe(STEP);
    expect(poolIds(s)).toEqual([A, B].sort());
  });

  it("A -> B: A advances the ladder and entitles the next material; B then changes neither count nor entitlement", () => {
    let s = branchPointState();
    const before = [...s.unlockedForShopIngredientIds];
    s = cook(s, A);
    expect(s.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: A });
    expect(ladderCount(s)).toBe(STEP + 1);
    expect(s.unlockedForShopIngredientIds.length).toBeGreaterThan(before.length); // the next material is entitled
    expect(poolIds(s)).toContain(B); // B is still discoverable beside whatever the new step offers
    const entitled = [...s.unlockedForShopIngredientIds];
    s = cook(s, B);
    expect(s.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: B });
    expect(ladderCount(s)).toBe(STEP + 1); // a non-credit discovery never advances it
    expect(s.unlockedForShopIngredientIds).toEqual(entitled);
    expect(poolIds(s)).not.toContain(B);
  });

  it("B -> A: B changes neither count nor entitlement and leaves A the only target; A then advances the ladder", () => {
    let s = branchPointState();
    const entitled = [...s.unlockedForShopIngredientIds];
    s = cook(s, B);
    expect(s.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: B });
    expect(ladderCount(s)).toBe(STEP);
    expect(s.unlockedForShopIngredientIds).toEqual(entitled);
    expect(poolIds(s)).toEqual([A]);
    s = cook(s, A);
    expect(s.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: A });
    expect(ladderCount(s)).toBe(STEP + 1);
    expect(s.unlockedForShopIngredientIds.length).toBeGreaterThan(entitled.length);
  });

  it("both orders end in the same Dex, ladder count and entitlement (order is not authority); the next W1 recipe stays reachable", () => {
    const run = (first: string, second: string) => cook(cook(branchPointState(), first), second);
    const ab = run(A, B);
    const ba = run(B, A);
    expect(ab.dex.map((e) => e.recipeId).sort()).toEqual(ba.dex.map((e) => e.recipeId).sort());
    expect(ladderCount(ab)).toBe(ladderCount(ba));
    expect([...ab.unlockedForShopIngredientIds].sort()).toEqual([...ba.unlockedForShopIngredientIds].sort());
    // Entitled but not bought is a Shop state, not a softlock: buying the new material makes the next W1 recipe discoverable.
    for (const s of [ab, ba]) {
      const fresh = s.unlockedForShopIngredientIds.filter((id) => !s.ownedIngredientIds.includes(id));
      const bought = fresh.reduce((acc, id) => act(acc, { type: "PURCHASE_INGREDIENT", ingredientId: id }), s);
      expect(poolIds(bought)).toContain(NEXT_W1);
    }
  });
});
