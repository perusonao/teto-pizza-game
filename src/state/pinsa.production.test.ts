import { afterEach, describe, expect, it, vi } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { FREE_COOK_FINISH_PRODUCTION } from "../data/freeCookFinishGate";
import { INGREDIENTS } from "../data/ingredients";
import { LATE_CATALOG_PRODUCTION } from "../data/lateCatalog";
import { pinsaEnabled } from "../data/pinsaGate";
import { RECIPES, countsTowardLadder } from "../data/recipes";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { initialTechniqueLedger } from "../logic/techniques/runtime";
import { discoveredRecipeIds, type DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { buildRecipeChapters, isChapterCleared } from "./recipeChapters";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type StorageLike } from "./persistence";
import { isLateRecipeId } from "../logic/catalog/testSupport/lateIds";

/**
 * Pinsa Romana PRODUCTION-ON (#577, Owner publish approval 2026-10-25): the real modules with the gate as shipped (`true`), nothing mocked, except the one rollback
 * test at the end. Pinned here:
 *  - the two ORIGINAL negative checks of the iPhone HV (a standard dough, and the arugula placed before the bake) through the real Research round;
 *  - existing saves keep everything they had (Dex, Pitz, materials, stock, technique ledger, chapter marks), and a save that holds Pinsa survives the gate being
 *    closed again (rollback safety).
 * The closed state is proven by `npm run test:pinsa-off` (the whole suite with the literal compiled to false).
 */
const PINSA = "pinsa-romana";
const DOUGH = "material-multigrain-long-ferment";
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const STOCK = Object.fromEntries(INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 99]));
const act = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);
const entry = (recipeId: string) => ({ recipeId, discovered: true as const, bestScore: 70, bestStars: 3 as const, timesMade: 1 });
/** A Dex of every ordinary recipe (what a pre-Pinsa save holds), without Pinsa. */
const ORDINARY_IDS = RECIPES.filter((r) => !isLateRecipeId(r.id)).map((r) => r.id as string);
const OLD_DEX: DexState = ORDINARY_IDS.map(entry);
const memory = (): StorageLike & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
};

afterEach(() => {
  vi.doUnmock("../data/pinsaGate");
  vi.resetModules();
});

const piece = (ingredientId: string, n: number) => ({ id: `pp-${ingredientId}-${n}`, ingredientId, x: DOUGH_CENTER - 24 + ((n * 13) % 48), y: DOUGH_CENTER - 20 + ((n * 9) % 40) });
function pizzaOf(opts: { dough?: boolean; arugulaBefore?: boolean }): PizzaState {
  const ids = ["mozzarella", "mozzarella", "prosciutto-crudo", "prosciutto-crudo", "prosciutto-crudo", ...(opts.arugulaBefore ? ["arugula", "arugula"] : [])];
  return { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], toppings: ids.map((id, i) => piece(id, i)), ...(opts.dough ? { dough: DOUGH } : {}) } as PizzaState;
}
/** A Research round on the Pinsa entry (every material owned, Dex = all ordinary recipes): returns the round at the DOUGH step. */
function researchRound(dex: DexState = OLD_DEX): GameState {
  const initial = createInitialGameState(dex, ALL_IDS, 0, STOCK);
  const started = act(initial, { type: "START_FREE_COOK", now: 0, researchTargetId: PINSA }, { type: "BEGIN_PREPARE", now: 0 });
  expect(started.researchTargetId).toBe(PINSA);
  return started;
}
function finishRound(round: GameState, pizza: PizzaState, post: readonly string[]): GameState {
  let s = act({ ...round, pizza }, { type: "START_BAKE", now: 20_000 }, { type: "CONFIRM_BAKE", value: 68, now: 25_000 });
  expect([s.phase, s.makingStep]).toEqual(["POST_BAKE", "FINISH"]);
  post.forEach((ingredientId, i) => {
    s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId, x: DOUGH_CENTER - 20 + i * 14, y: DOUGH_CENTER + 6 });
  });
  s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 40_000 });
  expect(s.phase).toBe("RESULT");
  return gameReducer(s, { type: "REGISTER_TO_DEX" });
}

describe.runIf(pinsaEnabled())("Production switches (gate open)", () => {
  it("Pinsa is the tail of the catalog after ikura, yuzu-shrimp-pizza, eggplant-dengaku-pizza and eggplant-tahini-pizza; E5 stays on; the ladder, Grandma and every other recipe are as before", () => {
    expect(LATE_CATALOG_PRODUCTION).toBe(true);
    expect(FREE_COOK_FINISH_PRODUCTION).toBe(true);
    // New Sauces Phase B U1 (#578): yuzu-shrimp-pizza (late, credited) sits between ikura and Pinsa, so Pinsa stays the tail; the last ladder step is yuzu's late step (still no Pinsa step).
    expect(RECIPES.slice(-8).map((r) => r.id)).toEqual(["ikura-salmon-pizza", "yuzu-shrimp-pizza", "eggplant-dengaku-pizza", "eggplant-tahini-pizza", "bulgogi-pizza", "wasabi-beef-pizza", "mentaiko-cream-pizza", PINSA]); // (New Sauces Phase B U2 / U3: eggplant-dengaku-pizza and eggplant-tahini-pizza follow yuzu, still before Pinsa)
    expect(DISCOVERY_LADDER.steps.at(-1)).toMatchObject({ step: DISCOVERY_LADDER.steps.length, keyRecipeId: "mentaiko-cream-pizza" }); // no Pinsa step (PR-2 late4 ends the ladder)
    expect(countsTowardLadder(PINSA)).toBe(false);
    const grandma = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === "grandma-pizza")!;
    expect(grandma.identityDimensions).toMatchObject({ pan: "tray" });
    expect(grandma.identityDimensions.dough).toBe("standard");
    expect(RECIPE_DISCOVERY_CATALOG.filter((t) => t.identityDimensions.dough !== "standard").map((t) => t.recipeId)).toEqual([PINSA]);
  });
});

describe.runIf(pinsaEnabled())("ORIGINAL negative checks through a real Research round (gate open)", () => {
  it("the dough chip is offered by the technique's own derived affordance only, not before", () => {
    const below = researchRound(OLD_DEX.slice(0, 20));
    expect(gameReducer(below, { type: "SELECT_DOUGH", dough: DOUGH as never })).toBe(below); // closed
    const open = researchRound(OLD_DEX);
    expect(gameReducer(open, { type: "SELECT_DOUGH", dough: DOUGH as never }).pizza.dough).toBe(DOUGH);
  });

  it("positive: the other dough + arugula after the bake discovers Pinsa, records the dough technique and 後乗せ, and leaves jamon alone", () => {
    const round = researchRound();
    const chosen = gameReducer(round, { type: "SELECT_DOUGH", dough: DOUGH as never });
    const out = finishRound(chosen, pizzaOf({ dough: true }), ["arugula", "arugula"]);
    expect(out.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: PINSA });
    expect(discoveredRecipeIds(out.dex)).toContain(PINSA);
    expect(out.discoveredTechniqueIds).toEqual(expect.arrayContaining(["dough-pinsa-romana", "late-addition"]));
    expect(discoveredRecipeIds(out.dex).filter((id) => ORDINARY_IDS.includes(id)).length).toBe(ORDINARY_IDS.length);
  });

  it("negative 1: the standard dough with arugula after the bake is ORIGINAL -- Pinsa is not discovered and the dough technique is not recorded", () => {
    const out = finishRound(researchRound(), pizzaOf({ dough: false }), ["arugula", "arugula"]);
    expect(out.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(discoveredRecipeIds(out.dex)).not.toContain(PINSA);
    expect(out.discoveredTechniqueIds).not.toContain("dough-pinsa-romana");
  });

  it("negative 2: the other dough with the arugula BEFORE the bake is ORIGINAL -- the moment is part of the pizza", () => {
    const round = researchRound();
    const chosen = gameReducer(round, { type: "SELECT_DOUGH", dough: DOUGH as never });
    const out = finishRound(chosen, pizzaOf({ dough: true, arugulaBefore: true }), []);
    expect(out.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(discoveredRecipeIds(out.dex)).not.toContain(PINSA);
  });
});

describe.runIf(pinsaEnabled())("existing saves (gate open)", () => {
  it("a pre-Pinsa save loads unchanged: Dex, Pitz, materials, stock, technique ledger; nothing is quarantined or dropped", () => {
    const storage = memory();
    const old = {
      schemaVersion: 2,
      dex: OLD_DEX,
      pitzBalance: 1234,
      ownedIngredientIds: ALL_IDS,
      missionBest: {},
      inventory: STOCK,
      starterGrantClaimedRecipeIds: [],
      unlockedForShopIngredientIds: ALL_IDS,
      discoveryHintFacts: {},
    };
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(old));
    const save = loadSave(storage);
    expect(discoveredRecipeIds(save.dex)).toEqual(ORDINARY_IDS);
    expect(save.pitzBalance).toBe(1234);
    expect([...save.ownedIngredientIds].sort()).toEqual([...ALL_IDS].sort()); // (the loader lists the Starter Set first)
    expect(save.inventory).toEqual(STOCK);
    expect(storage.map.size).toBe(1); // no quarantine copy was made
    // the technique ledger a load backfills is the one the Dex implies (Pinsa adds nothing: it is not in the Dex)
    expect(initialTechniqueLedger([], save.dex)).toEqual(initialTechniqueLedger([], OLD_DEX));
  });

  it("every chapter a pre-Pinsa save had cleared stays cleared; the Pinsa entry only adds to the chapter total (K2)", () => {
    for (const chapter of buildRecipeChapters()) {
      const ordinary = chapter.recipes.filter((r) => !isLateRecipeId(r.id));
      if (ordinary.length === 0) continue;
      expect(isChapterCleared(chapter, OLD_DEX), `chapter ${chapter.chapter}`).toBe(true);
    }
  });

  it("a Pinsa discovery persists and loads back (Dex plus the technique ledger), with no other field changing", () => {
    const storage = memory();
    const round = researchRound();
    const out = finishRound(gameReducer(round, { type: "SELECT_DOUGH", dough: DOUGH as never }), pizzaOf({ dough: true }), ["arugula", "arugula"]);
    persistProgress({ dex: out.dex, pitzBalance: out.pitzBalance, ownedIngredientIds: out.ownedIngredientIds, inventory: out.inventory, starterGrantClaimedRecipeIds: out.starterGrantClaimedRecipeIds, discoveredTechniqueIds: out.discoveredTechniqueIds }, storage);
    const back = loadSave(storage);
    expect(discoveredRecipeIds(back.dex)).toContain(PINSA);
    expect(back.pitzBalance).toBe(out.pitzBalance);
    expect(back.discoveredTechniqueIds).toEqual(expect.arrayContaining(["dough-pinsa-romana", "late-addition"]));
  });
});

describe("rollback safety: a save that holds Pinsa survives the gate being closed and opened again", () => {
  it("a closed gate does not know pinsa-romana and does not show it, but its write keeps the Dex entry (forward-compatible unknown id); opening the gate again restores it", async () => {
    const stored = { schemaVersion: 2, dex: [...OLD_DEX, entry(PINSA)], pitzBalance: 777, ownedIngredientIds: ALL_IDS, missionBest: {}, inventory: STOCK, starterGrantClaimedRecipeIds: [], unlockedForShopIngredientIds: ALL_IDS, discoveryHintFacts: {}, discoveredTechniqueIds: ["dough-pinsa-romana", "late-addition"] };
    const storage = memory();
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(stored));

    // closed: the build neither knows the recipe nor loses the entry
    vi.resetModules();
    vi.doMock("../data/pinsaGate", () => ({ PINSA_PRODUCTION: false, pinsaEnabled: () => false }));
    const closed = await import("./persistence");
    expect((await import("../data/recipes")).RECIPES.some((r) => (r.id as string) === PINSA)).toBe(false);
    const loaded = closed.loadSave(storage);
    expect(loaded.dex.map((e) => e.recipeId)).not.toContain(PINSA); // not shown to the closed build
    expect(loaded.pitzBalance).toBe(777);
    closed.persistProgress({ dex: loaded.dex, pitzBalance: loaded.pitzBalance, ownedIngredientIds: loaded.ownedIngredientIds, inventory: loaded.inventory, starterGrantClaimedRecipeIds: loaded.starterGrantClaimedRecipeIds, discoveredTechniqueIds: loaded.discoveredTechniqueIds }, storage);
    const raw = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as { dex: { recipeId: string }[]; pitzBalance: number };
    expect(raw.dex.map((e) => e.recipeId)).toContain(PINSA); // the closed build's own write did not erase it
    expect(raw.pitzBalance).toBe(777);

    // open again: the discovery is back
    vi.resetModules();
    vi.doMock("../data/pinsaGate", () => ({ PINSA_PRODUCTION: true, pinsaEnabled: () => true }));
    const open = await import("./persistence");
    const back = open.loadSave(storage);
    expect(back.dex.map((e) => e.recipeId)).toContain(PINSA);
    expect(back.discoveredTechniqueIds).toEqual(expect.arrayContaining(["dough-pinsa-romana", "late-addition"]));
  });
});
