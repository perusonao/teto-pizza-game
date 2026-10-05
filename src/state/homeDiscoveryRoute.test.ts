import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { getRecipe, type RecipeId } from "../data/recipes";
import { deriveResearchEntries } from "../logic/discovery/researchEntry";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { homeDiscoveryRoute, researchableEntryIds, researchResultView } from "./discoveryHint";
import { discoveredDex } from "./testSupport/guidedRound";

/**
 * Issue #373 (OD-RB-1 update): HOME 「レシピ発見」 routes by the COOKABLE Research Entries (`researchableEntryIds`, the
 * OD-RX-4 authority), never by the registered total, and never by a remembered pick (#353).
 * Production data only: ladder step 12 = 3 registered entries (portuguesa, calabresa, TQ-1D aussie), step 25 (calabresa and aussie closed) = 1, a fresh save = 0.
 */

const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];

function save(step: number, extraDiscovered: readonly string[] = [], over: Partial<GameState> = {}): GameState {
  const owned = ladderOwned(step);
  const base = createInitialGameState(discoveredDex([...keysBefore(step), ...extraDiscovered]), owned, 1000);
  return { ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])), ...over };
}
const multi = (over: Partial<GameState> = {}) => save(12, [], over);
const single = (over: Partial<GameState> = {}) => save(25, ["brazilian-calabresa", "aussie"], over);
const registered = (s: GameState) => deriveResearchEntries(s).entries.map((e) => e.recipeId);

/** Starts HOME's discovery exactly as App.handleStartDiscovery does with the route. */
function startFromHome(s: GameState): GameState {
  const route = homeDiscoveryRoute(s);
  return gameReducer(s, { type: "START_FREE_COOK", now: 1, researchTargetId: route.kind === "RESEARCH" ? route.recipeId : undefined });
}

describe("homeDiscoveryRoute (#373)", () => {
  it("0 cookable entries -> TARGETLESS: a fresh save, and a registered entry whose material is out of stock", () => {
    const fresh = createInitialGameState();
    expect(registered(fresh)).toHaveLength(0);
    expect(homeDiscoveryRoute(fresh)).toEqual({ kind: "TARGETLESS" });

    const only = single();
    const [id] = registered(only);
    const finite = getRecipe(id as RecipeId)!.requiredIngredients.map((r) => r.ingredientId).filter((i) => !!getIngredient(i)?.unlockCondition);
    const drained = single({ inventory: { ...only.inventory, [finite[0]]: 0 } });
    expect(registered(drained)).toEqual([id]); // still registered (ownership) ...
    expect(researchableEntryIds(drained)).toEqual([]); // ... but not cookable
    expect(homeDiscoveryRoute(drained)).toEqual({ kind: "TARGETLESS" });
  });

  it("1 cookable entry -> RESEARCH that entry, from the same authority as the post-discovery CTA", () => {
    const s = single();
    const ids = researchableEntryIds(s);
    expect(ids).toHaveLength(1);
    expect(homeDiscoveryRoute(s)).toEqual({ kind: "RESEARCH", recipeId: ids[0] });
  });

  it("2+ cookable entries -> CHOOSE: nothing is picked, not even with bought facts or a carried session", () => {
    const s = multi();
    const [a] = registered(s);
    expect(researchableEntryIds(s).length).toBeGreaterThanOrEqual(2);
    for (const over of [{}, { discoveryHintFacts: { [a]: ["ing:tomato-sauce"] } }, { hintSession: { targetId: a, revealedIndex: 2 } }, { researchTargetId: a }]) {
      expect(homeDiscoveryRoute(multi(over))).toEqual({ kind: "CHOOSE" });
    }
  });

  it("the population is the cookable count: 2 registered, 1 cookable -> RESEARCH the cookable one (never the registered total)", () => {
    const s = save(12, ["aussie"]); // portuguesa + calabresa registered (TQ-1D's aussie already found)
    const [a, b] = registered(s);
    const finiteOf = (id: string) =>
      new Set(getRecipe(id as RecipeId)!.requiredIngredients.map((r) => r.ingredientId).filter((i) => !!getIngredient(i)?.unlockCondition));
    const onlyB = [...finiteOf(b)].find((i) => !finiteOf(a).has(i));
    expect(onlyB, "fixture: an entry-B-only material").toBeTruthy();
    const drained = save(12, ["aussie"], { inventory: { ...s.inventory, [onlyB!]: 0 } });
    expect(registered(drained)).toHaveLength(2);
    expect(homeDiscoveryRoute(drained)).toEqual({ kind: "RESEARCH", recipeId: a });
  });
});

describe("HOME start vs Dex start (#373 parity)", () => {
  it("1 entry: HOME and the Dex's 研究する reach the same round state; 0 entries stay targetless", () => {
    const s = single();
    const [id] = registered(s);
    const home = startFromHome(s);
    const dex = gameReducer(s, { type: "START_FREE_COOK", now: 1, researchTargetId: id });
    expect(home.researchTargetId).toBe(id);
    expect(home.researchTargetValidAtStart).toBe(true);
    expect(home).toEqual(dex);
    expect(researchResultView(home)?.label).toBe("？？？ピザ");

    const fresh = startFromHome(createInitialGameState());
    expect(fresh.researchTargetId).toBeNull();
    expect(fresh.researchTargetValidAtStart).toBe(false);
  });

  it("2+ entries: the Dex's explicit pick is the only way a target is set", () => {
    const s = multi();
    const [a, b] = registered(s);
    expect(startFromHome(s).researchTargetId).toBeNull(); // the App never dispatches this for CHOOSE
    expect(gameReducer(s, { type: "START_FREE_COOK", now: 1, researchTargetId: b }).researchTargetId).toBe(b);
    expect(gameReducer(s, { type: "START_FREE_COOK", now: 1, researchTargetId: a }).researchTargetId).toBe(a);
  });
});
