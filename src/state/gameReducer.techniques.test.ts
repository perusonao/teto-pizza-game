import { afterEach, describe, expect, it, vi } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { findOrderForRecipe } from "../data/orders";
import { buildIdealSauceFixture, getReferencePizza } from "../data/referencePizza";
import { getRecipe, RECIPES, type RecipeId } from "../data/recipes";
import { getCookingProfile } from "../data/cookingProfiles";
import { createCutState } from "../logic/cut/state";
import { initialTechniqueLedger, type TechniqueCatalogEntry, type TechniqueRuntimeContext } from "../logic/techniques/runtime";
import { EMPTY_DEX, type DexEntry, type DexState } from "./dex";
import { discoveryRevealOrder } from "./discoveryReveal";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { ingredientUnlockStep } from "./materialEntitlement";
import { loadSave, persistProgress, resetSave, SAVE_STORAGE_KEY, type ProgressionSnapshot, type StorageLike } from "./persistence";
import { createEmptyPizza, type PizzaState, type PlacedTopping } from "./pizzaState";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";
import { noSauceRecipeIds } from "../data/recipeSauceProfiles";

/**
 * Cooking Techniques 1.0 TQ-1C (Issue #287): the technique step at the REGISTER_TO_DEX integration
 * layer (tests T1-T10, T16 of docs/design/TETO_COOKING-TECHNIQUES_1.0_TQ-1C_PRE-IMPLEMENTATION-GATE.md
 * §8). The reducer is real; only the technique context (catalog + ladder) is swapped for a synthetic
 * one where a test needs the loop to be live. With the production context (INV-TQ-4) nothing is
 * ever recorded.
 */

const technique = vi.hoisted(() => ({ context: null as TechniqueRuntimeContext | null }));
vi.mock("../logic/techniques/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../logic/techniques/runtime")>();
  return { ...actual, productionTechniqueContext: () => technique.context ?? actual.productionTechniqueContext() };
});

/** Forces the free-cook resolution for one test (AMBIGUOUS / INCOMPLETE_MATCH cannot happen for a
 *  no-sauce pizza with the production catalog the matcher uses). */
const freeCook = vi.hoisted(() => ({ outcome: null as null | { kind: "AMBIGUOUS" } | { kind: "INCOMPLETE_MATCH"; recipeId: string; targetId: string } }));
vi.mock("../logic/discovery/freeCook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../logic/discovery/freeCook")>();
  return {
    ...actual,
    resolveFreeCookPizza: (...args: Parameters<typeof actual.resolveFreeCookPizza>) => {
      const real = actual.resolveFreeCookPizza(...args);
      return freeCook.outcome && real.kind === "ORIGINAL" ? { kind: "ORIGINAL", outcome: freeCook.outcome } : real;
    },
  };
});

afterEach(() => {
  technique.context = null;
  freeCook.outcome = null;
});

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const OWNED = [...STARTER_INGREDIENT_IDS, "egg", "bacon", "mushroom", "onion"];
const BAKE = 65;

/** A synthetic no-sauce target made of starters only: the NO_SAUCE affordance opens at step 0. */
const SYN_NO_SAUCE: TechniqueCatalogEntry = { recipeId: "syn-aussie", items: ["basil", "mozzarella"], sauceBase: [] };

/** A context where `requiring` recipes require NO_SAUCE (technique view only -- the matcher keeps the
 *  production catalog), plus optional extra targets and a material-step override. */
function context({
  requiring = [] as string[],
  extra = [] as TechniqueCatalogEntry[],
  materialStep = (id: string) => ingredientUnlockStep(id),
} = {}): TechniqueRuntimeContext {
  return {
    catalog: [
      ...RECIPE_DISCOVERY_CATALOG.map((t) => (requiring.includes(t.recipeId) ? { ...t, sauceBase: [] } : t)),
      ...extra,
    ],
    materialStep,
  };
}
const OPEN = () => context({ extra: [SYN_NO_SAUCE] });
const CLOSED = () => context({ extra: [SYN_NO_SAUCE], materialStep: () => 99 });

function dexOf(ids: readonly string[]): DexState {
  return ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
}

function referencePieces(recipeId: RecipeId): PlacedTopping[] {
  return getReferencePizza(recipeId)!.pieceGroups.flatMap((group, gi) =>
    group.positions.map((p, i) => ({ id: `${recipeId}-${gi}-${i}`, ingredientId: group.ingredientId, ...p })),
  );
}

function idealPizzaFor(recipeId: RecipeId, bakeResult = BAKE): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ((sauce) => (sauce ? [sauce.ingredientId] : []))(getReferencePizza(recipeId)!.sauce),
    sauceDeposits: buildIdealSauceFixture(),
    toppings: referencePieces(recipeId),
    bakeResult,
  };
}

/** A finished pizza with pieces but no sauce: Margherita's pieces without its tomato. */
function noSaucePizza(bakeResult = BAKE): PizzaState {
  return { ...idealPizzaFor("margherita", bakeResult), sauceIds: [], sauceDeposits: [] };
}

function freeCookToResult(pizza: PizzaState, base: GameState = createInitialGameState(EMPTY_DEX, OWNED, 0, {}, [])): GameState {
  let state = gameReducer(base, { type: "START_FREE_COOK" });
  state = { ...state, pizza };
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: pizza.bakeResult ?? BAKE });
  return walkPostBakeToResult(state);
}

function guidedToResult(recipeId: RecipeId, pizza: PizzaState, dex: DexState, isMissionRound = false): GameState {
  const recipe = getRecipe(recipeId)!;
  const cookingProfile = getCookingProfile(recipeId);
  let state = createInitialGameState(dex, OWNED, 0, {}, []);
  state = {
    ...state,
    recipe,
    order: findOrderForRecipe(recipeId)!,
    pizza,
    cookingProfile,
    cutState: createCutState(cookingProfile.cutConfig),
    isMissionRound,
    roundKind: isMissionRound ? "LUNCH_RUSH" : state.roundKind,
    freeCook: false,
  };
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: pizza.bakeResult ?? BAKE });
  return walkPostBakeToResult(state);
}

const register = (state: GameState) => gameReducer(state, { type: "REGISTER_TO_DEX" });

describe("T1-T3: the usage path (Free Cooking, ORIGINAL pizza)", () => {
  it("T1: the first no-sauce original pizza with the affordance open discovers NO_SAUCE -- no Dex, ★ or Pitz change", () => {
    technique.context = OPEN();
    const result = freeCookToResult(noSaucePizza());
    expect(result.completion?.status).toBe("PASS");
    const after = register(result);
    expect(after.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(after.phase).toBe("DISCOVERED");
    expect(after.discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect(after.lastTechniqueDiscovery).toEqual(["no-sauce"]);
    expect(after.dex).toBe(result.dex);
    expect(after.pitzBalance).toBe(result.pitzBalance);
    expect(discoveryRevealOrder(after)).toEqual(["TECHNIQUE"]);
  });

  it("T2: the next round starts with no reveal, and repeating the pizza never rediscovers it", () => {
    technique.context = OPEN();
    const first = register(freeCookToResult(noSaucePizza()));
    const next = gameReducer(first, { type: "PLAY_AGAIN" });
    expect(next.lastTechniqueDiscovery).toBeNull();
    expect(next.discoveredTechniqueIds).toEqual(["no-sauce"]);
    const again = register(freeCookToResult(noSaucePizza(), next));
    expect(again.discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect(again.lastTechniqueDiscovery).toEqual([]);
    expect(discoveryRevealOrder(again)).toEqual([]);
    // Nothing new: the ledger keeps its identity (App's persistence effect is not re-triggered).
    expect(again.discoveredTechniqueIds).toBe(next.discoveredTechniqueIds);
  });

  it("T3: a duplicate REGISTER_TO_DEX changes nothing (the existing RESULT guard)", () => {
    technique.context = OPEN();
    const once = register(freeCookToResult(noSaucePizza()));
    expect(register(once)).toBe(once);
  });

  it("T6: with the affordance closed an original pizza records nothing (INV-TQ-6)", () => {
    technique.context = CLOSED();
    const after = register(freeCookToResult(noSaucePizza()));
    expect(after.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(after.discoveredTechniqueIds).toEqual([]);
    expect(after.lastTechniqueDiscovery).toEqual([]);
  });
});

describe("T4 / T5: the recipe path and the reveal order", () => {
  it("T4: a recipe that requires NO_SAUCE records it in the same transition, even with the affordance closed (INV-TQ-1)", () => {
    technique.context = context({ requiring: ["margherita"], materialStep: () => null });
    const result = freeCookToResult(idealPizzaFor("margherita", 70));
    const after = register(result);
    expect(after.lastDiscovery?.kind).toBe("NEW_DISCOVERY");
    expect(after.justDiscovered).toBe(true);
    expect(after.discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect(after.lastTechniqueDiscovery).toEqual(["no-sauce"]);
    expect(discoveryRevealOrder(after)).toEqual(["TECHNIQUE", "RECIPE"]);
    // The recipe side is exactly what the production context produces (techniques never touch it).
    technique.context = null;
    const baseline = register(result);
    expect({ ...after, discoveredTechniqueIds: [], lastTechniqueDiscovery: [] }).toEqual(baseline);
  });

  it("T4: an already-known technique is not revealed again when its recipe is discovered", () => {
    technique.context = context({ requiring: ["margherita"] });
    const base = createInitialGameState(EMPTY_DEX, OWNED, 0, {}, [], [], {}, {}, undefined, ["no-sauce"]);
    const after = register(freeCookToResult(idealPizzaFor("margherita", 70), base));
    expect(after.discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect(after.lastTechniqueDiscovery).toEqual([]);
    expect(discoveryRevealOrder(after)).toEqual(["RECIPE"]);
  });
});

describe("T7: only a finished pizza counts", () => {
  it("a raw or burnt no-sauce pizza (Completion Gate FAILED) records nothing", () => {
    technique.context = OPEN();
    for (const bake of [2, 99]) {
      const result = freeCookToResult(noSaucePizza(bake));
      expect(result.completion?.status, `bake ${bake}`).toBe("FAILED");
      const after = register(result);
      expect(after.discoveredTechniqueIds).toEqual([]);
      expect(after.lastTechniqueDiscovery ?? []).toEqual([]);
    }
  });

  it("a failed bake of a technique recipe records nothing either", () => {
    technique.context = context({ requiring: ["margherita"] });
    const result = freeCookToResult(idealPizzaFor("margherita", 2));
    expect(result.completion?.status).toBe("FAILED");
    expect(register(result).discoveredTechniqueIds).toEqual([]);
  });

  it("an empty pizza, and a round whose completion is missing, record nothing", () => {
    technique.context = OPEN();
    const empty = register(freeCookToResult({ ...createEmptyPizza(), bakeResult: BAKE }));
    expect(empty.discoveredTechniqueIds).toEqual([]);
    const result = freeCookToResult(noSaucePizza());
    const noCompletion = register({ ...result, completion: null });
    expect(noCompletion.discoveredTechniqueIds).toEqual([]);
    // The matched path too: a scored round without a Completion Gate PASS never runs the usage path.
    const matched = freeCookToResult(idealPizzaFor("margherita", 70));
    const unverified = register({ ...matched, completion: null, pizza: { ...matched.pizza, sauceIds: [], sauceDeposits: [] } });
    expect(unverified.phase).toBe("DISCOVERED");
    expect(unverified.discoveredTechniqueIds).toEqual([]);
  });
});

describe("T7: an ambiguous or incomplete match discovers nothing (Codex review on #289)", () => {
  it("AMBIGUOUS and INCOMPLETE_MATCH are shown as original pizzas but record no technique, affordance open or not", () => {
    technique.context = OPEN();
    for (const outcome of [{ kind: "AMBIGUOUS" as const }, { kind: "INCOMPLETE_MATCH" as const, recipeId: "syn-aussie", targetId: "syn" }]) {
      freeCook.outcome = outcome;
      const after = register(freeCookToResult(noSaucePizza()));
      expect(after.phase, outcome.kind).toBe("DISCOVERED");
      expect(after.lastDiscovery, outcome.kind).toEqual(outcome);
      expect(after.discoveredTechniqueIds, outcome.kind).toEqual([]);
      expect(after.lastTechniqueDiscovery, outcome.kind).toEqual([]);
    }
    // Control: the same pizza as a plain ORIGINAL does record it.
    freeCook.outcome = null;
    expect(register(freeCookToResult(noSaucePizza())).discoveredTechniqueIds).toEqual(["no-sauce"]);
  });
});

describe("T8 / T10: round kinds", () => {
  it("T8: a Lunch Rush round records nothing on either path", () => {
    technique.context = context({ requiring: ["margherita"], extra: [SYN_NO_SAUCE] });
    const result = guidedToResult("margherita", idealPizzaFor("margherita", 70), dexOf(["margherita"]), true);
    const after = register(result);
    expect(after.discoveredTechniqueIds).toEqual([]);
    const next = gameReducer(result, { type: "MISSION_NEXT_ORDER" });
    expect(next.discoveredTechniqueIds).toEqual([]);
    expect(next.lastTechniqueDiscovery ?? []).toEqual([]);
  });

  it("T10: a guided FREE round that discovers another recipe records that recipe's technique (recipe path)", () => {
    technique.context = context({ requiring: ["breakfast-pizza"], extra: [SYN_NO_SAUCE] });
    const pizza = idealPizzaFor("bismarck");
    const breakfastOnBismarck = {
      ...pizza,
      toppings: [...pizza.toppings, ...[0, 1, 2].map((i) => ({ id: `b${i}`, ingredientId: "bacon", x: 40 + i * 5, y: 62 }))],
    };
    const after = register(guidedToResult("bismarck", breakfastOnBismarck, dexOf(["bismarck"])));
    expect(after.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: "breakfast-pizza" });
    expect(after.discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect(discoveryRevealOrder(after)).toEqual(["TECHNIQUE", "RECIPE"]);
  });

  it("T10: a guided round of an already-discovered recipe adds nothing", () => {
    technique.context = context({ extra: [SYN_NO_SAUCE] });
    const after = register(guidedToResult("margherita", idealPizzaFor("margherita", 70), dexOf(["margherita"])));
    expect(after.discoveredTechniqueIds).toEqual([]);
    expect(after.lastTechniqueDiscovery).toEqual([]);
  });
});

describe("T9: Dinner never discovers a technique", () => {
  const DM_A_IDS = ["margherita", "bismarck", "breakfast-pizza", "funghi"];
  const FINITE_IDS = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
  const T0 = 1_000_000;

  function started(): GameState {
    const base = createInitialGameState(dexOf([...DM_A_IDS, "marinara"]), ALL_IDS, 500, { egg: 20, bacon: 30, mushroom: 30 }, [], FINITE_IDS);
    const state = gameReducer(base, { type: "DINNER_START", missionId: "dm-a", now: T0, durationMs: 600_000, minimumStars: 1 });
    if (state.dinner === null) throw new Error("Dinner did not start");
    return state;
  }

  function bake(state: GameState, pizza: PizzaState, value: number, now: number): GameState {
    let next = gameReducer({ ...state, pizza }, { type: "START_BAKE", now });
    next = gameReducer(next, { type: "CONFIRM_BAKE", value, now });
    for (let guard = 0; guard < 4 && next.phase === "POST_BAKE"; guard += 1) {
      const confirmed = gameReducer(next, { type: "CONFIRM_MAKING_STEP", now });
      if (confirmed === next) break;
      next = confirmed;
    }
    return next;
  }

  it("a no-sauce pizza and a technique recipe in a Dinner run leave the ledger untouched, and REGISTER_TO_DEX is refused", () => {
    technique.context = context({ requiring: DM_A_IDS, extra: [SYN_NO_SAUCE] });
    let state = started();
    state = bake(state, noSaucePizza(), BAKE, T0 + 1000);
    expect(state.discoveredTechniqueIds).toEqual([]);
    expect(register(state)).toBe(state);
    state = gameReducer(state, { type: "DINNER_NEXT_PIZZA", now: T0 + 2000 });
    state = bake(state, idealPizzaFor("margherita", 70), 70, T0 + 3000);
    expect(register(state)).toBe(state);
    expect(state.discoveredTechniqueIds).toEqual([]);
    expect(state.lastTechniqueDiscovery ?? []).toEqual([]);
    const exited = gameReducer(state, { type: "DINNER_EXIT" });
    expect(exited.discoveredTechniqueIds).toEqual([]);
  });

  it("even a Dinner round that somehow carried a score and a PASS is refused by REGISTER_TO_DEX", () => {
    technique.context = context({ requiring: DM_A_IDS, extra: [SYN_NO_SAUCE] });
    const guided = freeCookToResult(idealPizzaFor("margherita", 70));
    let state = bake(started(), noSaucePizza(), BAKE, T0 + 1000);
    state = { ...state, score: guided.score, completion: { status: "PASS" } };
    const after = register(state);
    expect(after).toBe(state);
    expect(after.discoveredTechniqueIds).toEqual([]);
  });
});

describe("T16: INV-TQ-4 (TQ-1D) -- with the production context only the NO_SAUCE recipes record a technique", () => {
  it("every production recipe's ideal pizza (Free Cooking) leaves the ledger empty except the NO_SAUCE recipes' (derived from the sauce-profile authority), and a no-sauce original before the affordance opens records nothing", () => {
    for (const recipe of RECIPES) {
      const result = freeCookToResult(idealPizzaFor(recipe.id, Math.round((recipe.bakeTarget.start + recipe.bakeTarget.end) / 2)));
      const base = { ...createInitialGameState(EMPTY_DEX, ALL_IDS, 0, {}, []) };
      const after = register(freeCookToResult(result.pizza, base));
      // The recipe path (INV-TQ-1): discovering a NO_SAUCE recipe records `no-sauce`, revealed in that same round.
      const expected = (noSauceRecipeIds() as readonly string[]).includes(recipe.id) ? ["no-sauce"] : [];
      expect(after.discoveredTechniqueIds, recipe.id).toEqual(expected);
      expect(after.lastTechniqueDiscovery ?? [], recipe.id).toEqual(expected);
    }
    const original = register(freeCookToResult(noSaucePizza()));
    expect(original.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(original.discoveredTechniqueIds).toEqual([]);
    expect(original.lastTechniqueDiscovery).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// T11-T14: persistence through App's one write (the same snapshot App's effect builds)
// ---------------------------------------------------------------------------------------------

function fakeStorage(initial?: unknown): StorageLike & { raw(): Record<string, unknown> | undefined; writes: number } {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(SAVE_STORAGE_KEY, JSON.stringify(initial));
  const s = {
    writes: 0,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      s.writes += 1;
      store.set(key, value);
    },
    removeItem: (key: string) => void store.delete(key),
    raw: () => {
      const v = store.get(SAVE_STORAGE_KEY);
      return v === undefined ? undefined : (JSON.parse(v) as Record<string, unknown>);
    },
  };
  return s;
}

/** Exactly the snapshot App's persistence effect builds (src/App.tsx; checked below). */
function appSnapshot(state: GameState): ProgressionSnapshot {
  return {
    dex: state.dex,
    pitzBalance: state.pitzBalance,
    ownedIngredientIds: state.ownedIngredientIds,
    inventory: state.inventory,
    starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
    unlockedForShopIngredientIds: state.unlockedForShopIngredientIds,
    discoveryHintPurchases: state.discoveryHintPurchases,
    discoveryHintFacts: state.discoveryHintFacts,
    discoveredTechniqueIds: state.discoveredTechniqueIds,
    dinnerMissionRecordUpdates: state.dinnerMissionRecordsState.records,
    requireDinnerRecords: true,
  };
}

/** Hydrates a GameState the way App's lazy initializer does. */
function hydrate(storage: StorageLike): GameState {
  const save = loadSave(storage);
  return createInitialGameState(
    save.dex,
    save.ownedIngredientIds,
    save.pitzBalance,
    save.inventory,
    save.starterGrantClaimedRecipeIds,
    save.unlockedForShopIngredientIds,
    save.discoveryHintPurchases,
    save.discoveryHintFacts,
    save.dinnerMissionRecordsState,
    initialTechniqueLedger(save.discoveredTechniqueIds, save.dex),
  );
}

function seedSave(extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    dex: [],
    pitzBalance: 100,
    ownedIngredientIds: OWNED,
    missionBest: {},
    inventory: { egg: 5, bacon: 5, mushroom: 5, onion: 5 },
    starterGrantClaimedRecipeIds: [],
    ...extra,
  };
}

describe("T11-T14: the technique ledger in the save", () => {
  it("T11: a discovery is saved in the round's one write; after a reload it is kept, not replayed, and never rediscovered", () => {
    technique.context = OPEN();
    const storage = fakeStorage(seedSave());
    const discovered = register(freeCookToResult(noSaucePizza(), hydrate(storage)));
    const before = storage.writes;
    persistProgress(appSnapshot(discovered), storage);
    expect(storage.writes - before).toBe(1);
    expect(storage.raw()!.discoveredTechniqueIds).toEqual(["no-sauce"]);

    const reloaded = hydrate(storage);
    expect(reloaded.discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect(reloaded.lastTechniqueDiscovery).toBeNull();
    const again = register(freeCookToResult(noSaucePizza(), reloaded));
    expect(again.lastTechniqueDiscovery).toEqual([]);
    // Re-persisting the same progress writes nothing new for the ledger.
    persistProgress(appSnapshot(again), storage);
    expect(storage.raw()!.discoveredTechniqueIds).toEqual(["no-sauce"]);
  });

  it("T12: Full Reset clears the ledger", () => {
    const storage = fakeStorage(seedSave({ discoveredTechniqueIds: ["no-sauce"] }));
    expect(hydrate(storage).discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect(resetSave(storage)).toBe(true);
    expect(hydrate(storage).discoveredTechniqueIds).toEqual([]);
  });

  it("T13: unknown / future ids are kept in storage while gameplay reads known ids only", () => {
    technique.context = OPEN();
    const storage = fakeStorage(seedSave({ discoveredTechniqueIds: ["future-x"] }));
    const state = hydrate(storage);
    expect(state.discoveredTechniqueIds).toEqual([]);
    const discovered = register(freeCookToResult(noSaucePizza(), state));
    persistProgress(appSnapshot(discovered), storage);
    expect(storage.raw()!.discoveredTechniqueIds).toEqual(["no-sauce", "future-x"]);
    expect(hydrate(storage).discoveredTechniqueIds).toEqual(["no-sauce"]);
  });

  it("T14 (DM-4-3): a refused Dinner record stores nothing -- the new technique included -- and the retry stores it with the Dex", () => {
    technique.context = context({ requiring: ["margherita"] });
    const storage = fakeStorage(seedSave());
    const discovered = register(freeCookToResult(idealPizzaFor("margherita", 70), hydrate(storage)));
    expect(discovered.discoveredTechniqueIds).toEqual(["no-sauce"]);
    // A stale in-memory Dinner record for a mission another tab has since broken in storage.
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(seedSave({ dinnerMissionRecords: { "dm-a": { broken: true } } })));
    const stale: GameState = {
      ...discovered,
      dinnerMissionRecordsState: {
        ...discovered.dinnerMissionRecordsState,
        records: { "dm-a": { revision: 1, clears: 1, bestClearMs: 80_000, bestTier: "GOLD", firstClearRewarded: true } },
      },
    };
    const snapshotBefore = JSON.stringify(storage.raw());
    const writes = storage.writes;
    expect(persistProgress(appSnapshot(stale), storage)).toEqual({ refusedDinnerMissionIds: ["dm-a"] });
    expect(storage.writes).toBe(writes);
    expect(JSON.stringify(storage.raw())).toBe(snapshotBefore);
    expect(storage.raw()).not.toHaveProperty("discoveredTechniqueIds");
    // App reconciles, and the next write stores the ledger and the Dex together.
    const reconciled = gameReducer(stale, { type: "DINNER_RECORDS_REFUSED", missionIds: ["dm-a"] });
    expect(persistProgress(appSnapshot(reconciled), storage)).toEqual({ refusedDinnerMissionIds: [] });
    expect(storage.raw()!.discoveredTechniqueIds).toEqual(["no-sauce"]);
    expect((storage.raw()!.dex as { recipeId: string }[]).map((e) => e.recipeId)).toEqual(["margherita"]);
    expect((storage.raw()!.dinnerMissionRecords as Record<string, unknown>)["dm-a"]).toEqual({ broken: true });
  });
});

describe("App wiring (the one persistence effect)", () => {
  const app = Object.values(import.meta.glob<string>("../App.tsx", { query: "?raw", import: "default", eager: true }))[0];
  const effect = app.slice(app.indexOf("persistProgress({"), app.indexOf("]);", app.indexOf("persistProgress({")) + 3);

  it("saves the ledger in the same snapshot as the Dex and re-runs when it changes", () => {
    const deps = effect.slice(effect.indexOf("}, ["));
    expect(effect).toContain("discoveredTechniqueIds: state.discoveredTechniqueIds,");
    expect(effect).toContain("requireDinnerRecords: true");
    expect(deps).toContain("state.discoveredTechniqueIds,");
    expect(deps).toContain("state.dex,");
  });

  it("hydrates the ledger from the save through the INV-TQ-1 load-time repair", () => {
    expect(app).toContain("initialTechniqueLedger(save.discoveredTechniqueIds, save.dex)");
  });
});
