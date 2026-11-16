import { describe, expect, it } from "vitest";
import { getCookingProfile } from "../data/cookingProfiles";
import { findOrderForRecipe } from "../data/orders";
import { INGREDIENTS } from "../data/ingredients";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { getRecipe, RECIPES } from "../data/recipes";
import { createCutState } from "../logic/cut/state";
import { gameReducer, type GameState } from "./gameReducer";
import { PENDING_ROUND_KEY } from "./pendingRound";
import { SAVE_STORAGE_KEY, loadSave, readStoredJournal } from "./persistence";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { memoryStorage } from "./testSupport/memoryStorage";
import { Tab } from "./testSupport/r8Harness";

/**
 * Batch 25: pizza-salad played through the REAL reducer, the real save code and the real journal (no mocks), as the player does:
 * tomato-sauce painted (scored), yogurt-sauce as ONE presence dab (1 deposit, 0.02), pieces, bake, FINISH garnish (lettuce), result.
 * Then: a save restored from the journal, a corrupt journal, and the dab rules a long press / drag / second tap must not break.
 */
const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const ALL = INGREDIENTS.map((i) => i.id);
const STOCK = Object.fromEntries(FINITE.map((id) => [id, 30]));
const SEED = JSON.stringify({
  schemaVersion: 2,
  dex: RECIPES.filter((r) => r.id !== "pizza-salad").map((r) => ({ recipeId: r.id, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
  pitzBalance: 100,
  ownedIngredientIds: ALL,
  missionBest: {},
  inventory: STOCK,
});
const DAB = { x: 40, y: 60, amount: 0.02 };
const ref = getReferencePizza("pizza-salad")!;
const preGroups = ref.pieceGroups.filter((g) => g.ingredientId !== "lettuce");
const lettuce = ref.pieceGroups.find((g) => g.ingredientId === "lettuce")!;

const tab = (storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED })) => new Tab(storage);

function saladSauceStep(base: GameState): GameState {
  const recipe = getRecipe("pizza-salad")!;
  const order = findOrderForRecipe("pizza-salad")!;
  const cookingProfile = getCookingProfile("pizza-salad");
  return {
    ...base,
    recipe,
    order,
    cookingProfile,
    cutState: createCutState(cookingProfile.cutConfig),
    isMissionRound: false,
    roundKind: "GUIDED",
    freeCook: false,
    phase: "PREPARE",
    makingStep: "SAUCE",
    pizza: createEmptyPizza(),
  };
}

/** Tomato ring (the Reference's ideal deposits) in the SAUCE step, optionally the yogurt dab, through COMMIT_SAUCE_DISPENSE. */
function paint(base: GameState, withYogurt: boolean): GameState {
  let s = saladSauceStep(base);
  s = gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "tomato-sauce", deposits: buildIdealSauceFixture() as never });
  if (withYogurt) s = gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "yogurt-sauce", deposits: [DAB] });
  return s;
}

function withPreBakePieces(s: GameState): GameState {
  const pizza: PizzaState = {
    ...s.pizza,
    toppings: preGroups.flatMap((g, gi) => g.positions.map((p, i) => ({ id: `ps-${gi}-${i}`, ingredientId: g.ingredientId, x: p.x, y: p.y }))),
  };
  return gameReducer({ ...s, pizza }, { type: "START_BAKE" });
}

function bakedRound(t: Tab, withYogurt: boolean): void {
  t.setRound(withPreBakePieces(paint(t.state, withYogurt)));
}

describe("pizza-salad, real round: the sauces", () => {
  it("tomato is painted by the Reference's ideal deposits; the yogurt is exactly ONE deposit of 0.02, stamped with its own kind", () => {
    const s = paint(tab().state, true);
    expect(s.pizza.sauceIds).toEqual(["tomato-sauce", "yogurt-sauce"]);
    const yogurt = s.pizza.sauceDeposits.filter((d) => (d as { ingredientId?: string }).ingredientId === "yogurt-sauce");
    expect(yogurt).toHaveLength(1);
    expect(yogurt[0]!.amount).toBe(0.02);
  });

  it("long press / drag (many deposits in one press), a second tap and an oversized dab are all rejected; the state is the very same reference", () => {
    const s = paint(tab().state, true);
    const longPress = Array.from({ length: 12 }, (_, i) => ({ ...DAB, x: 40 + i * 0.5 }));
    expect(gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "yogurt-sauce", deposits: longPress })).toBe(s);
    expect(gameReducer(s, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "yogurt-sauce", deposits: [{ ...DAB, x: 55, y: 45 }] })).toBe(s); // re-tap
    const fresh = paint(tab().state, false);
    expect(gameReducer(fresh, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "yogurt-sauce", deposits: [{ ...DAB, amount: 0.2 }] })).toBe(fresh); // not a ring-sized deposit
    expect(gameReducer(fresh, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "yogurt-sauce", deposits: longPress })).toBe(fresh);
  });

  it("the yogurt dab does not change how the tomato is scored (the sauce metrics are per kind)", () => {
    const a = paint(tab().state, false).pizza.sauceDeposits.filter((d) => (d as { ingredientId?: string }).ingredientId !== "yogurt-sauce");
    const b = paint(tab().state, true).pizza.sauceDeposits.filter((d) => (d as { ingredientId?: string }).ingredientId !== "yogurt-sauce");
    expect(b.map((d) => [d.x, d.y, d.amount])).toEqual(a.map((d) => [d.x, d.y, d.amount]));
  });
});

describe("pizza-salad, real round: bake -> FINISH -> result, save and restore", () => {
  it("a full round registers pizza-salad as a NEW discovery; the journal holds the baked pizza with ONE 0.02 yogurt deposit", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED });
    const t = tab(storage);
    bakedRound(t, true);
    const step = t.bake(70);
    expect(step.status).toBe("committed");
    expect(t.state.phase).toBe("POST_BAKE"); // FINISH is waiting for the lettuce
    const journal = (t.stored().pendingRound as { status: string; recipeId: string; pizza: { sauceIds: string[]; sauceDeposits: Array<{ amount: number; ingredientId?: string }> } });
    expect(journal).toMatchObject({ status: "pending", recipeId: "pizza-salad" });
    expect(journal.pizza.sauceIds).toEqual(["tomato-sauce", "yogurt-sauce"]);
    expect(journal.pizza.sauceDeposits.filter((d) => d.ingredientId === "yogurt-sauce")).toEqual([expect.objectContaining({ amount: 0.02 })]);
  });

  it("a reload right after the bake (FINISH not done) settles the journal ONCE as a baked pizza without its finishing touches (R8 rule): registered, 2 stars, no discovery yet", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED });
    const t = tab(storage);
    bakedRound(t, true);
    t.bake(70);
    const reloaded = new Tab(storage.view());
    expect(reloaded.settled?.status).toBe("settled");
    expect(reloaded.settled?.settled).toMatchObject({ outcome: "REGISTERED", recipeId: "pizza-salad", unfinishedFinish: true, discovered: false });
    const pitz = reloaded.state.pitzBalance;
    const again = new Tab(storage.view()); // a second reload must not settle (or pay) it twice
    expect(again.state.pitzBalance).toBe(pitz);
    expect(again.state.dex.find((e) => e.recipeId === "pizza-salad")?.discovered ?? false).toBe(false);
  });

  it("the whole round: FINISH with the lettuce at the Reference slots completes it -> NEW DISCOVERY of pizza-salad, registered once, and a reload keeps it", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED });
    const t = tab(storage);
    bakedRound(t, true);
    t.bake(70);
    for (const [i, p] of lettuce.positions.entries()) t.apply({ type: "PLACE_TOPPING", ingredientId: "lettuce", x: p.x, y: p.y, id: `lt-${i}` } as never);
    const done = t.postBakeStep();
    expect(done.status).toBe("committed");
    t.apply({ type: "REGISTER_TO_DEX" } as never);
    expect(t.state.dex.find((e) => e.recipeId === "pizza-salad")?.discovered).toBe(true);
    const reloaded = new Tab(storage.view());
    expect(reloaded.state.dex.filter((e) => e.recipeId === "pizza-salad")).toHaveLength(1);
    expect(reloaded.state.dex.find((e) => e.recipeId === "pizza-salad")?.discovered).toBe(true);
  });

  it("a corrupt journal is quarantined: the game starts, the dex and stock are intact, nothing throws", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED });
    const t = tab(storage);
    bakedRound(t, true);
    t.bake(70);
    const saved = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as Record<string, unknown>;
    saved[PENDING_ROUND_KEY] = { ...(saved[PENDING_ROUND_KEY] as object), pizza: "corrupt" };
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(saved));
    expect(() => new Tab(storage.view())).not.toThrow();
    const after = new Tab(storage.view());
    expect(after.state.dex.some((e) => e.recipeId === "fugazza" || e.recipeId === "margherita")).toBe(true);
    expect(after.state.dex.find((e) => e.recipeId === "pizza-salad")?.discovered ?? false).toBe(false); // not registered from a journal that cannot be read
    expect(loadSave(storage.view()).ownedIngredientIds.length).toBeGreaterThan(0);
    expect(readStoredJournal(storage.view()).kind).not.toBe("pending");
  });
});

// a yogurt-less pizza is not the recipe (the required second sauce is missing): it does not register as pizza-salad
describe("pizza-salad, real round: the second sauce is required", () => {
  it("tomato alone (no yogurt dab) at the bake does not register pizza-salad", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED });
    const t = tab(storage);
    bakedRound(t, false);
    t.bake(70);
    const reloaded = new Tab(storage.view());
    expect(reloaded.state.dex.find((e) => e.recipeId === "pizza-salad")?.discovered ?? false).toBe(false);
  });
});

// keep the `lettuce` group referenced: the FINISH garnish is exercised in the generated E2E (e2e/t25i7.spec.ts)
void lettuce;
