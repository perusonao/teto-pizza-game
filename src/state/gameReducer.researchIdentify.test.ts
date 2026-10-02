import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { buildIdealSauceFixture } from "../data/referencePizza";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { deriveResearchEntries } from "../logic/discovery/researchEntry";
import { researchEntryViews } from "./discoveryHint";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type StorageLike } from "./persistence";
import { discoveredDex } from "./testSupport/guidedRound";

/**
 * Issue #356 Slice 1: the declared-ingredient rule through the real reducer. Production data (ladder step 25 =
 * one entry, pesto-pollo; step 12 = two entries).
 */
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
function save(step: number, extra: readonly string[] = [], stock = 10): GameState {
  const owned = ladderOwned(step);
  const base = createInitialGameState(discoveredDex([...keysBefore(step), ...extra]), owned, 1000);
  return { ...base, inventory: Object.fromEntries(owned.map((id) => [id, stock])) };
}
const single = (stock = 10) => save(25, ["brazilian-calabresa"], stock);
const multi = () => save(12);
const T = "pesto-pollo";
const start = (s: GameState, id: string | undefined = T) => act(s, { type: "START_FREE_COOK", researchTargetId: id });
const isSauce = (id: string) => getIngredient(id)?.category === "sauce";
const spot = (i: number) => ({ x: 30 + (i % 8) * 5, y: 40 + Math.floor(i / 8) * 8 });

function toResult(s: GameState, pizza: PizzaState, value: number): GameState {
  let t: GameState = { ...s, pizza: { ...pizza, bakeResult: value } };
  t = act(t, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value });
  for (let i = 0; i < 6 && t.phase !== "RESULT"; i += 1) t = act(t, { type: "CONFIRM_MAKING_STEP" });
  return t;
}
const register = (s: GameState) => act(s, { type: "REGISTER_TO_DEX" });
const mk = (sauce: string | null, ...tops: string[]): PizzaState => ({
  ...createEmptyPizza(),
  sauceIds: sauce ? [sauce] : [],
  toppings: tops.map((ingredientId, i) => ({ id: `t${i}`, ingredientId, ...spot(i) })),
});
/** An ORIGINAL pizza: pesto + fresh tomato + egg (no recipe). */
const original = (...extra: string[]) => mk("pesto", "fresh-tomato", "egg", ...extra);
const finish = (s: GameState, pizza: PizzaState, v = 68) => register(toResult(s, pizza, v));
const exact = (id: string): PizzaState => {
  const r = RECIPES.find((x) => x.id === id)!;
  return {
    ...mk(
      r.requiredIngredients.find((q) => isSauce(q.ingredientId))?.ingredientId ?? null,
      ...r.requiredIngredients.filter((q) => !isSauce(q.ingredientId)).flatMap((q) => Array.from({ length: Math.max(1, q.minCount) }, () => q.ingredientId)),
    ),
  };
};
const mid = (id: string) => {
  const r = RECIPES.find((x) => x.id === id)!;
  return (r.bakeTarget.start + r.bakeTarget.end) / 2;
};
const declare = (s: GameState, id: string | null) => act(s, { type: "SET_RESEARCH_TEST", ingredientId: id });
const facts = (s: GameState) => s.discoveryHintFacts[T] ?? [];

describe("SET_RESEARCH_TEST (declaration, before the attempt)", () => {
  it("only an explicit valid Research Target round accepts a declaration", () => {
    const s = single();
    expect(declare(s, "egg").researchTest).toBeNull(); // not a round yet
    const targetless = act(s, { type: "START_FREE_COOK" });
    expect(declare(targetless, "egg").researchTest).toBeNull();
    const targeted = declare(start(s), "egg");
    expect(targeted.researchTest).toEqual({ recipeId: T, ingredientId: "egg" });
  });
  it("targetless is never evaluated even with exactly one Research Entry", () => {
    const s = single();
    expect(deriveResearchEntries(s).entries).toHaveLength(1);
    const done = finish(act(s, { type: "START_FREE_COOK" }), original());
    expect(done.lastIngredientTest).toBeNull();
    expect(facts(done)).toEqual([]);
  });
  it("one ingredient at a time; a second declaration replaces it; null clears", () => {
    let s = declare(start(single()), "egg");
    s = declare(s, "pesto");
    expect(s.researchTest?.ingredientId).toBe("pesto");
    expect(declare(s, null).researchTest).toBeNull();
  });
  it("rejects unowned, unknown, stock-0, already known (unlock fact) and hostile ids", () => {
    const base = start(single());
    expect(declare(base, "calabrese-nope").researchTest).toBeNull();
    expect(declare(base, "__proto__").researchTest).toBeNull();
    expect(declare(base, "chicken").researchTest).toBeNull(); // the unlock fact is already known
    const dry = start({ ...single(), inventory: { ...single().inventory, egg: 0 } });
    expect(declare(dry, "egg").researchTest).toBeNull();
    const notOwned = start({ ...single(), ownedIngredientIds: single().ownedIngredientIds.filter((i) => i !== "egg") });
    expect(declare(notOwned, "egg").researchTest).toBeNull();
  });
  it("is PREPARE-only", () => {
    const s = declare(start(single()), "egg");
    const baked = toResult(s, original(), 68);
    expect(declare(baked, "pesto").researchTest).toEqual({ recipeId: T, ingredientId: "egg" });
  });
  it("is not carried: a retry and a new round start undeclared; RESET_PIZZA keeps it", () => {
    let s = declare(start(single()), "egg");
    expect(act(s, { type: "RESET_PIZZA" }).researchTest).toEqual({ recipeId: T, ingredientId: "egg" });
    s = finish(s, original());
    expect(s.researchTest).not.toBeNull(); // not consumed by the RESULT, but the next round is fresh:
    const retry = act(s, { type: "RETRY_SAME_RECIPE" });
    expect(retry.researchTargetId).toBe(T);
    expect(retry.researchTest).toBeNull();
    expect(retry.lastIngredientTest).toBeNull();
  });
  it("a stale declaration for another target is never evaluated", () => {
    const s = { ...declare(start(single()), "egg"), researchTargetId: "pizza-portuguesa" };
    expect(finish(s, original()).lastIngredientTest).toBeNull();
  });
});

describe("REGISTER_TO_DEX: positive / negative / not used", () => {
  it("positive (topping): adds exactly ing:<id> to the target ledger, the verdict is POSITIVE", () => {
    const done = finish(declare(start(single()), "fresh-tomato"), original());
    expect(done.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(done.lastIngredientTest).toEqual({ ingredientId: "fresh-tomato", verdict: "POSITIVE" });
    expect(facts(done)).toEqual(["ing:fresh-tomato"]);
    expect(Object.keys(done.discoveryHintFacts)).toEqual([T]);
    expect(researchEntryViews(done)[0].knownExactIngredientIds).toContain("fresh-tomato");
  });
  it("positive (sauce) uses the same authority", () => {
    const done = finish(declare(start(single()), "pesto"), original());
    expect(done.lastIngredientTest?.verdict).toBe("POSITIVE");
    expect(facts(done)).toEqual(["ing:pesto"]);
  });
  it("negative: NOT_IDENTIFIED, nothing is persisted or recorded", () => {
    const before = single();
    const done = finish(declare(start(before), "egg"), original());
    expect(done.lastIngredientTest).toEqual({ ingredientId: "egg", verdict: "NOT_IDENTIFIED" });
    expect(done.discoveryHintFacts).toBe(before.discoveryHintFacts);
    expect(JSON.stringify(done.discoveryHintFacts)).not.toContain("egg");
  });
  it("ingredient not actually used: NOT_USED, no fact (even though it is in the recipe)", () => {
    const done = finish(declare(start(single()), "mozzarella"), original());
    expect(done.lastIngredientTest).toEqual({ ingredientId: "mozzarella", verdict: "NOT_USED" });
    expect(facts(done)).toEqual([]);
  });
  it("only the declared ingredient is evaluated: other members on the pizza are not learned", () => {
    const done = finish(declare(start(single()), "fresh-tomato"), original("mozzarella"));
    expect(facts(done)).toEqual(["ing:fresh-tomato"]);
  });
  it("no declaration: nothing new at all", () => {
    const before = single();
    const done = finish(start(before), original());
    expect(done.lastIngredientTest).toBeNull();
    expect(done.discoveryHintFacts).toBe(before.discoveryHintFacts);
  });
  it("a missing-ingredient pizza cannot be probed in bulk: a pizza of every owned ingredient still yields one bit", () => {
    const s = single();
    const all = s.ownedIngredientIds.filter((i) => !isSauce(i));
    const done = finish(declare(start(s), "egg"), mk("pesto", ...all.slice(0, 20)));
    expect(facts(done)).toEqual([]);
    expect(done.lastIngredientTest?.ingredientId).toBe("egg");
  });
});

describe("already known and repeated evaluation", () => {
  it("a repeated positive does not duplicate the fact (idempotent ledger)", () => {
    let s = finish(declare(start(single()), "pesto"), original());
    expect(facts(s)).toEqual(["ing:pesto"]);
    // a known ingredient cannot be declared again
    const again = start({ ...s, phase: "ORDER" });
    expect(declare(again, "pesto").researchTest).toBeNull();
    // a stale declaration made before the fact was learned does not duplicate it
    const stale = { ...declare(start(single()), "pesto") };
    const learned = { ...stale, discoveryHintFacts: s.discoveryHintFacts };
    expect(facts(finish(learned, original()))).toEqual(["ing:pesto"]);
  });
  it("RESULT -> REGISTER twice is exactly-once", () => {
    const result = toResult(declare(start(single()), "fresh-tomato"), original(), 68);
    const once = register(result);
    const twice = register(once);
    expect(twice).toBe(once);
    expect(facts(twice)).toEqual(["ing:fresh-tomato"]);
    expect(twice.trialNotebook.display.length).toBe(1);
  });
});

describe("last stock", () => {
  it("an attempt that uses up the last unit still records the positive (registered entry, not cookable)", () => {
    const s = single();
    const owned = s.inventory;
    const one = start({ ...s, inventory: { ...owned, "fresh-tomato": 1, chicken: 1, mozzarella: 1, pesto: 1 } });
    const declared = declare(one, "fresh-tomato");
    expect(declared.researchTest).not.toBeNull();
    const done = finish(declared, mk("pesto", "fresh-tomato", "egg"));
    expect(done.inventory["fresh-tomato"]).toBe(0);
    expect(done.lastIngredientTest?.verdict).toBe("POSITIVE");
    expect(facts(done)).toEqual(["ing:fresh-tomato"]);
  });
});

describe("cross-recipe exact (target A, exact B)", () => {
  it("B is DISCOVERED normally; A gets neither a positive nor a negative", () => {
    const s = multi();
    const [a, b] = deriveResearchEntries(s).entries.map((e) => e.recipeId);
    const aIngs = new Set(RECIPES.find((r) => r.id === a)!.requiredIngredients.map((q) => q.ingredientId));
    const view = researchEntryViews(s).find((v) => v.recipeId === a)!;
    const probe = RECIPES.find((r) => r.id === b)!.requiredIngredients.map((q) => q.ingredientId).find((i) => !aIngs.has(i) && !view.knownExactIngredientIds.includes(i))!;
    const started = start(s, a);
    const declared = declare(started, probe);
    expect(declared.researchTest?.ingredientId).toBe(probe);
    const done = register(toResult(declared, exact(b), mid(b)));
    expect(done.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: b });
    expect(done.lastIngredientTest).toBeNull();
    expect(done.discoveryHintFacts).toBe(declared.discoveryHintFacts);
  });
  it("target A reproduced exactly: A is DISCOVERED, no identification is written", () => {
    const done = register(toResult(declare(start(single()), "fresh-tomato"), exact(T), mid(T)));
    expect(done.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: T });
    expect(done.lastIngredientTest).toBeNull();
    expect(facts(done)).toEqual([]);
  });
});

describe("INCOMPLETE_MATCH gives no positive and looks like a negative", () => {
  it("the exact recipe set with a thin sauce is INCOMPLETE; a member of it is NOT_IDENTIFIED, like a non-member", () => {
    const thin: PizzaState = { ...exact(T), sauceDeposits: buildIdealSauceFixture().slice(0, 1) };
    const member = register(toResult(declare(start(single()), "fresh-tomato"), thin, mid(T)));
    expect(member.lastDiscovery?.kind).toBe("INCOMPLETE_MATCH");
    expect(member.lastIngredientTest).toEqual({ ingredientId: "fresh-tomato", verdict: "NOT_IDENTIFIED" });
    expect(facts(member)).toEqual([]);
    const negative = finish(declare(start(single()), "egg"), original());
    expect(negative.lastIngredientTest?.verdict).toBe(member.lastIngredientTest?.verdict);
  });
});

describe("Notebook, matcher and save are untouched", () => {
  it("the Trial Notebook row is identical with and without a declaration", () => {
    const withTest = finish(declare(start(single()), "fresh-tomato"), original());
    const without = finish(start(single()), original());
    expect(withTest.trialNotebook).toEqual(without.trialNotebook);
    expect(withTest.lastTrialAttempt).toEqual(without.lastTrialAttempt);
    expect(withTest.lastDiscovery).toEqual(without.lastDiscovery);
    expect(withTest.dex).toEqual(without.dex);
    expect(withTest.pitzBalance).toBe(without.pitzBalance);
    expect(withTest.inventory).toEqual(without.inventory);
  });
  it("the declaration never changes what the matcher decides", () => {
    for (const id of [null, "egg", "fresh-tomato"]) {
      const done = register(toResult(declare(start(single()), id), exact(T), mid(T)));
      expect(done.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: T });
    }
  });
});

describe("reload / persistence compatibility", () => {
  const memory = (): StorageLike => {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  };
  it("the positive survives a reload through the existing save; the negative and the declaration do not exist in it", () => {
    const storage = memory();
    const pos = finish(declare(start(single()), "fresh-tomato"), original());
    persistProgress(
      {
        dex: pos.dex,
        pitzBalance: pos.pitzBalance,
        ownedIngredientIds: pos.ownedIngredientIds,
        inventory: pos.inventory,
        starterGrantClaimedRecipeIds: pos.starterGrantClaimedRecipeIds,
        unlockedForShopIngredientIds: pos.unlockedForShopIngredientIds,
        discoveryHintPurchases: pos.discoveryHintPurchases,
        discoveryHintFacts: pos.discoveryHintFacts,
        discoveredTechniqueIds: pos.discoveredTechniqueIds,
      },
      storage,
    );
    const raw = storage.getItem(SAVE_STORAGE_KEY) ?? "";
    const loaded = loadSave(storage);
    expect(loaded.discoveryHintFacts[T]).toEqual(["ing:fresh-tomato"]);
    expect(loaded.schemaVersion).toBe(2);
    expect(raw).not.toContain("researchTest");
    expect(raw).not.toContain("lastIngredientTest");
    const reloaded = start(createInitialGameState(loaded.dex, loaded.ownedIngredientIds, loaded.pitzBalance, loaded.inventory, [], [], {}, loaded.discoveryHintFacts));
    expect(researchEntryViews(reloaded)[0].knownExactIngredientIds).toContain("fresh-tomato");
    expect(reloaded.researchTest).toBeNull();
    expect(declare(reloaded, "fresh-tomato").researchTest).toBeNull(); // known => nothing to declare
  });
});
