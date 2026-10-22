import { describe, expect, it, vi } from "vitest";
import { getCookingProfile, postBakeSteps, type CookingProfile } from "../data/cookingProfiles";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES, type RecipeId } from "../data/recipes";
import { consumePizzaInventory } from "./inventory";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX } from "./dex";
import type { InventoryState } from "./inventory";
import { atBake, bakeValueFor, referencePizzaFor } from "./testSupport/confirmBakeMatrix";
import { memoryStorage } from "./testSupport/memoryStorage";
import { SAVE_STORAGE_KEY } from "./persistence";
import { Tab } from "./testSupport/r8Harness";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";
import { createCutState } from "../logic/cut/state";

/**
 * Save R8 (Issue #617) acceptance matrix: {Guided plain, Guided + CUT, Guided + FINISH (+ CUT), Free + FINISH (opt-in), Research}
 * x {right after the bake, in the middle of the post-BAKE steps, just before the last confirmation, just after it}.
 * After a reload the stock is consumed AND the pizza registered, or neither -- never "consumed only".
 */
const gate = vi.hoisted(() => ({ open: true }));
vi.mock("../data/freeCookFinishGate", () => ({
  FREE_COOK_FINISH_PRODUCTION: false,
  freeCookFinishEnabled: () => gate.open,
}));

/** Only finite ingredients keep a stock in the save (Starter ones are unlimited and never stored). */
const FINITE_KEYS = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);

const FULL_STOCK = Object.fromEntries(FINITE_KEYS.map((key) => [key, 99]));
/** True when baking this recipe's Reference pizza takes something out of the stock. */
const usesStock = (id: RecipeId) => {
  const after = consumePizzaInventory(referencePizzaFor(id), FULL_STOCK);
  return FINITE_KEYS.some((key) => (after[key] ?? 99) < 99);
};
const hasCut = (id: RecipeId) => postBakeSteps(getCookingProfile(id)).length > 0;

interface Scenario {
  name: string;
  /** The round at BAKE. */
  start: () => GameState;
  bakeValue: (state: GameState) => number;
  /** Anything the player does in the post-BAKE steps before confirming (FINISH placements). */
  act?: (state: GameState) => GameState;
  /** Expected to appear in the Dex once registered (the Free round's recipe is decided by the matcher). */
  registeredId: string;
}

const NO_CUT_RECIPE = RECIPES.find((r) => !hasCut(r.id) && usesStock(r.id));
const CUT_RECIPES = RECIPES.filter((r) => hasCut(r.id) && usesStock(r.id));
const CUT_A = CUT_RECIPES.find((r) => r.id === "fugazza") ?? CUT_RECIPES[0]!;
const CUT_B = CUT_RECIPES.find((r) => r.id !== CUT_A.id)!;
const FREE_RECIPE = RECIPES.find((r) => usesStock(r.id) && !hasCut(r.id))!;

function placeParsley(state: GameState, n: number): GameState {
  let next = state;
  for (let i = 0; i < n; i += 1) {
    next = gameReducer(next, { type: "PLACE_TOPPING", ingredientId: "parsley", x: DOUGH_CENTER - 30 + i * 18, y: DOUGH_CENTER - 10 + (i % 2) * 30 });
  }
  return next;
}

/** A Guided round of a shipped recipe whose profile also runs FINISH (then optionally CUT): FINISH here has no late requirement, so
 *  what the player places in it is a garnish -- consumed at the FINISH confirmation, and part of the registered pizza. */
function guidedFinish(withCut: boolean): GameState {
  const base = atBake("guided", CUT_A.id);
  const profile: CookingProfile = {
    steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH", ...(withCut ? (["CUT"] as const) : [])],
    ...(withCut ? { cutConfig: getCookingProfile(CUT_A.id).cutConfig } : {}),
  };
  return { ...base, cookingProfile: profile, cutState: createCutState(profile.cutConfig) };
}

const SCENARIOS: Scenario[] = [
  ...(NO_CUT_RECIPE
    ? [{ name: `Guided, no CUT (${NO_CUT_RECIPE.id})`, start: () => atBake("guided", NO_CUT_RECIPE.id), bakeValue: (s: GameState) => bakeValueFor("guided", s, "good"), registeredId: NO_CUT_RECIPE.id }]
    : []),
  { name: `Guided + CUT (${CUT_A.id})`, start: () => atBake("guided", CUT_A.id), bakeValue: (s) => bakeValueFor("guided", s, "good"), registeredId: CUT_A.id },
  { name: `Guided + CUT (${CUT_B.id})`, start: () => atBake("guided", CUT_B.id), bakeValue: (s) => bakeValueFor("guided", s, "good"), registeredId: CUT_B.id },
  {
    name: "Guided + FINISH",
    start: () => guidedFinish(false),
    bakeValue: (s) => bakeValueFor("guided", s, "good"),
    act: (s) => placeParsley(s, 2),
    registeredId: CUT_A.id,
  },
  {
    name: "Guided + FINISH + CUT",
    start: () => guidedFinish(true),
    bakeValue: (s) => bakeValueFor("guided", s, "good"),
    act: (s) => placeParsley(s, 2),
    registeredId: CUT_A.id,
  },
  { name: `Free + FINISH (opt-in, ${FREE_RECIPE.id})`, start: () => atBake("free", FREE_RECIPE.id), bakeValue: (s) => bakeValueFor("free", s, "good"), registeredId: FREE_RECIPE.id },
  {
    name: `Research (Free + FINISH, target ${FREE_RECIPE.id})`,
    start: () => {
      gate.open = true;
      const base = atBake("free", FREE_RECIPE.id);
      const started = gameReducer(createInitialGameState(EMPTY_DEX, base.ownedIngredientIds, 0, base.inventory), { type: "START_FREE_COOK", researchTargetId: FREE_RECIPE.id });
      return gameReducer({ ...gameReducer(started, { type: "BEGIN_PREPARE" }), pizza: base.pizza }, { type: "START_BAKE" });
    },
    bakeValue: (s) => bakeValueFor("free", s, "good"),
    registeredId: FREE_RECIPE.id,
  },
];

function isConsumed(inventory: InventoryState, before: InventoryState): boolean {
  return FINITE_KEYS.some((key) => (inventory[key] ?? 0) < (before[key] ?? 0));
}

describe.each(SCENARIOS)("$name", (scenario) => {
  gate.open = true;

  function fresh() {
    gate.open = true;
    const storage = memoryStorage();
    const tab = new Tab(storage);
    const round = scenario.start();
    tab.setRound(round);
    return { storage, tab, before: round.inventory, round };
  }

  /** Reload (on a copy of the save: opening it completes the journal, which would make the original tab stale) and check the invariant. */
  function reloadAndCheck(storage: ReturnType<typeof memoryStorage>, before: InventoryState, expectRegistered: boolean | "either") {
    const reloaded = new Tab(memoryStorage({ [SAVE_STORAGE_KEY]: storage.getItem(SAVE_STORAGE_KEY) ?? "" }));
    const consumed = isConsumed(reloaded.state.inventory, before);
    const registered = (reloaded.state.dex.find((e) => e.recipeId === scenario.registeredId)?.timesMade ?? 0) > 0;
    expect(consumed, "stock consumed <=> pizza registered (never consumed only)").toBe(registered);
    if (expectRegistered !== "either") expect(registered).toBe(expectRegistered);
    if (registered) expect(reloaded.state.dex.find((e) => e.recipeId === scenario.registeredId)?.timesMade).toBe(1);
    return reloaded;
  }

  it("before the bake a reload costs nothing", () => {
    const { storage, before } = fresh();
    const reloaded = reloadAndCheck(storage, before, false);
    expect(reloaded.settled).toBeNull();
  });

  it("every moment from the bake to the last confirmation ends consumed + registered, once", () => {
    const { storage, tab, before, round } = fresh();
    const bake = tab.bake(scenario.bakeValue(round), 30_000, "round-m");
    expect(bake.status).toBe("committed");

    let guard = 0;
    while (tab.state.phase === "POST_BAKE" && guard++ < 6) {
      // right after the bake / in the middle of the steps / just before the confirmation
      reloadAndCheck(storage, before, true);
      if (scenario.act && tab.state.makingStep === "FINISH") {
        tab.state = scenario.act(tab.state); // placements are session-only until FINISH is confirmed
        reloadAndCheck(storage, before, true);
      }
      const step = tab.state.makingStep === "CUT" ? tab.cutAndConfirm() : tab.postBakeStep(40_000 + guard);
      expect(step.status).toBe("committed");
    }
    // just after the last confirmation: registered, the journal gone, nothing to announce
    expect(tab.state.phase).toBe("DISCOVERED");
    expect(tab.stored().pendingRound).toBeUndefined();
    const after = reloadAndCheck(storage, before, true);
    expect(after.settled).toBeNull();
  });

  it("leaving for HOME mid-round and a reload of the same moment end identically", () => {
    const home = fresh();
    home.tab.bake(scenario.bakeValue(home.round), 30_000, "round-h");
    const restart = fresh();
    restart.tab.bake(scenario.bakeValue(restart.round), 30_000, "round-h");
    if (!home.tab.hasJournalToSettle()) {
      // a bake with nothing after it registered at once (one write): nothing is pending, so HOME has nothing to complete
      expect(home.tab.state.phase).toBe("DISCOVERED");
      return;
    }
    expect(home.tab.goHome().status).toBe("settled");
    const reloaded = new Tab(restart.storage.view());

    expect(home.tab.state.dex).toEqual(reloaded.state.dex);
    expect(home.tab.state.pitzBalance).toBe(reloaded.state.pitzBalance);
    expect(home.tab.state.inventory).toEqual(reloaded.state.inventory);
    expect(home.tab.settled?.settled).toEqual(reloaded.settled?.settled);
    expect((home.tab.state.dex.find((e) => e.recipeId === scenario.registeredId)?.timesMade ?? 0) > 0).toBe(true);
  });
});

describe("Guided FINISH -> CUT: the journal follows the round", () => {
  function atFinish() {
    gate.open = true;
    const storage = memoryStorage();
    const tab = new Tab(storage);
    const round = guidedFinish(true);
    tab.setRound(round);
    tab.bake(bakeValueFor("guided", round, "good"), 30_000, "round-fc");
    expect(tab.state.makingStep).toBe("FINISH");
    return { storage, tab, round };
  }
  const copyOf = (storage: ReturnType<typeof memoryStorage>) => memoryStorage({ [SAVE_STORAGE_KEY]: storage.getItem(SAVE_STORAGE_KEY) ?? "" });

  it("until FINISH is confirmed the journal is the pizza as baked: a reload registers it without the garnish, and the garnish stock is untouched", () => {
    const { storage, tab, round } = atFinish();
    tab.state = placeParsley(tab.state, 2);
    const journal = tab.stored().pendingRound as { finished?: boolean; pizza: { toppings: { ingredientId: string }[] } };
    expect(journal.finished).toBeUndefined();
    expect(journal.pizza.toppings.some((t) => t.ingredientId === "parsley")).toBe(false);
    const reloaded = new Tab(copyOf(storage));
    expect(reloaded.state.inventory.parsley ?? 0).toBe(round.inventory.parsley ?? 0);
    expect((reloaded.state.dex.find((e) => e.recipeId === CUT_A.id)?.timesMade ?? 0)).toBe(1);
  });

  it("confirming FINISH consumes the garnish and rewrites the journal in ONE write; a reload in CUT registers the finished pizza", () => {
    const { storage, tab, round } = atFinish();
    tab.state = placeParsley(tab.state, 2);
    const writes: Record<string, unknown>[] = [];
    const original = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      writes.push(JSON.parse(value) as Record<string, unknown>);
      original(key, value);
    };
    expect(tab.postBakeStep(40_000).status).toBe("committed");
    expect(tab.state.makingStep).toBe("CUT");
    expect(writes).toHaveLength(1);
    const saved = writes[0] as { inventory: Record<string, number>; pendingRound: { finished?: boolean; pizza: { toppings: { ingredientId: string; stage?: string }[] } } };
    expect(saved.pendingRound.finished).toBe(true);
    expect(saved.pendingRound.pizza.toppings.filter((t) => t.ingredientId === "parsley" && t.stage === "post")).toHaveLength(2);
    expect(saved.inventory.parsley).toBe((round.inventory.parsley ?? 0) - 2);

    // finishing by hand from the same moment gives the same registration as completing it from the save
    const byHand = gameReducer(walk(tab.state), { type: "REGISTER_TO_DEX" });
    const reloaded = new Tab(copyOf(storage));
    expect(reloaded.state.dex).toEqual(byHand.dex);
    expect(reloaded.state.pitzBalance).toBe(byHand.pitzBalance);
    expect(reloaded.state.inventory.parsley).toBe(byHand.inventory.parsley);
  });

  const walk = (state: GameState): GameState => walkPostBakeToResult(state, 50_000);
});

describe("Guided FINISH interrupted: the notice says the pizza is unfinished (Owner condition 1)", () => {
  function bakeAtFinish() {
    gate.open = true;
    const storage = memoryStorage();
    const tab = new Tab(storage);
    const round = guidedFinish(true);
    tab.setRound(round);
    tab.bake(bakeValueFor("guided", round, "good"), 30_000, "round-uf");
    return { storage, tab };
  }
  const copyOf = (storage: ReturnType<typeof memoryStorage>) => memoryStorage({ [SAVE_STORAGE_KEY]: storage.getItem(SAVE_STORAGE_KEY) ?? "" });

  it("a reload (and HOME) before FINISH is confirmed registers the pizza as baked and flags it unfinished", () => {
    const { storage, tab } = bakeAtFinish();
    expect(tab.stored().pendingRound).toMatchObject({ finishPending: true });
    const reloaded = new Tab(copyOf(storage));
    expect(reloaded.settled?.settled?.outcome).toBe("REGISTERED");
    expect(reloaded.settled?.settled?.unfinishedFinish).toBe(true);
    expect(tab.goHome().status).toBe("settled");
    expect(tab.settled?.settled?.unfinishedFinish).toBe(true);
  });

  it("once FINISH is confirmed (CUT remains) the flag is gone: that pizza is finished", () => {
    const { storage, tab } = bakeAtFinish();
    tab.postBakeStep(40_000);
    expect(tab.state.makingStep).toBe("CUT");
    expect(tab.stored().pendingRound).not.toHaveProperty("finishPending");
    const reloaded = new Tab(copyOf(storage));
    expect(reloaded.settled?.settled?.outcome).toBe("REGISTERED");
    expect(reloaded.settled?.settled?.unfinishedFinish).toBeUndefined();
  });

  it("a round with no FINISH step is never flagged", () => {
    gate.open = true;
    const storage = memoryStorage();
    const tab = new Tab(storage);
    const round = atBake("guided", CUT_A.id);
    tab.setRound(round);
    tab.bake(bakeValueFor("guided", round, "good"), 30_000, "round-nf");
    expect(new Tab(copyOf(storage)).settled?.settled?.unfinishedFinish).toBeUndefined();
  });
});
