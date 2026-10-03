import { afterEach, describe, expect, it, vi } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { buildIdealSauceFixture } from "../data/referencePizza";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { deriveResearchEntries } from "../logic/discovery/researchEntry";
import { RESEARCH_IDENTIFY_ENABLED } from "../logic/discovery/researchIdentifyFlag";
import { notebookView } from "../logic/discovery/trialNotebook";
import { hint5SheetView, researchEntryViews } from "./discoveryHint";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { discoveredDex } from "./testSupport/guidedRound";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type StorageLike } from "./persistence";

/**
 * Contract 2.1 S4: RESULT-based membership through the real reducer (REGISTER_TO_DEX, free-cook ORIGINAL /
 * AMBIGUOUS / INCOMPLETE_MATCH branch). Production data: ladder step 25 = one Research Entry, pesto-pollo
 * (pesto, mozzarella, fresh-tomato, chicken; the unlock fact is chicken); step 12 = two entries.
 */
const forced = vi.hoisted(() => ({ ambiguous: false }));
vi.mock("../logic/discovery/freeCook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../logic/discovery/freeCook")>();
  return {
    ...actual,
    resolveFreeCookPizza: (...args: Parameters<typeof actual.resolveFreeCookPizza>) => {
      const real = actual.resolveFreeCookPizza(...args);
      return forced.ambiguous && real.kind === "ORIGINAL" ? { kind: "ORIGINAL", outcome: { kind: "AMBIGUOUS" } } : real;
    },
  };
});
afterEach(() => {
  forced.ambiguous = false;
});

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
const LABEL = "？？？ピザ（チキン）";
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
/** Pesto + fresh tomato + egg: an ORIGINAL (no recipe). */
const original = (...extra: string[]) => mk("pesto", "fresh-tomato", "egg", ...extra);
const finish = (s: GameState, pizza: PizzaState, v = 68) => register(toResult(s, pizza, v));
const exact = (id: string): PizzaState => {
  const r = RECIPES.find((x) => x.id === id)!;
  return mk(
    r.requiredIngredients.find((q) => isSauce(q.ingredientId))?.ingredientId ?? null,
    ...r.requiredIngredients.filter((q) => !isSauce(q.ingredientId)).flatMap((q) => Array.from({ length: Math.max(1, q.minCount) }, () => q.ingredientId)),
  );
};
const mid = (id: string) => {
  const r = RECIPES.find((x) => x.id === id)!;
  return (r.bakeTarget.start + r.bakeTarget.end) / 2;
};
const facts = (s: GameState) => s.discoveryHintFacts[T] ?? [];
const view = (s: GameState) => (s.lastResearchRows?.rows ?? []).map((r) => `${r.category}:${r.ingredientId}:${r.verdict}`);
const feedbackOf = (s: GameState) => notebookView(s.trialNotebook)[0]?.feedback ?? null;
const jaName = (id: string) => getIngredient(id)!.nameJa;

describe("Contract 2.1 flag and old-model removal", () => {
  it("the Production flag default is OFF and dev / test builds are ON (this suite runs ON)", async () => {
    expect(RESEARCH_IDENTIFY_ENABLED).toBe(true);
    const src = await import("../logic/discovery/researchIdentifyFlag?raw").then((m) => m.default as string);
    expect(src).toMatch(/RESEARCH_IDENTIFY_PRODUCTION_DEFAULT = false/);
  });
  it("the old declaration state is gone from a fresh state and the action is not accepted", () => {
    const s = start(single());
    expect("researchTest" in s).toBe(false);
    expect("lastIngredientTest" in s).toBe(false);
    expect(s.lastResearchRows).toBeNull();
    expect(gameReducer(s, { type: "SET_RESEARCH_TEST", ingredientId: "egg" } as never)).toBe(s);
  });
});

describe("rows, persistence and Notebook (flag ON, explicit registered target)", () => {
  it("a valid target attempt yields S1 rows; positives persist as ing:, negatives never; the label is fixed", () => {
    const before = single();
    const done = finish(start(before), original());
    expect(done.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(view(done)).toEqual(["sauce:pesto:POSITIVE", "topping:fresh-tomato:POSITIVE", "topping:egg:NEGATIVE"]);
    expect(done.lastResearchRows).toEqual({ labelJa: LABEL, rows: done.lastResearchRows!.rows, toppingOverCap: false, knownIngredientIds: ["chicken"] });
    expect(facts(done)).toEqual(["ing:pesto", "ing:fresh-tomato"]);
    expect(JSON.stringify(done.discoveryHintFacts)).not.toContain("egg");
    expect(Object.keys(done.discoveryHintFacts)).toEqual([T]);
    expect(researchEntryViews(done)[0].knownExactIngredientIds).toEqual(expect.arrayContaining(["chicken", "pesto", "fresh-tomato"]));
  });
  it("the Notebook records the same disclosed rows with the same fixed label (RESULT state = Notebook)", () => {
    const done = finish(start(single()), original());
    expect(feedbackOf(done)).toEqual({
      kind: "RESEARCH_ROWS",
      textJa: `${done.lastResearchRows!.labelJa} ソース: ${jaName("pesto")}○ トッピング: ${jaName("fresh-tomato")}○ ${jaName("egg")}×`,
    });
    expect(feedbackOf(done)!.textJa.startsWith(LABEL)).toBe(true);
  });
  it("the unlock fact and a stored ing: fact are known, so they are neither rows nor re-persisted", () => {
    const withStored = { ...start(single()), discoveryHintFacts: { [T]: ["ing:pesto"] } };
    const done = finish(withStored, mk("pesto", "chicken", "fresh-tomato", "egg"));
    expect(view(done)).toEqual(["topping:fresh-tomato:POSITIVE", "topping:egg:NEGATIVE"]);
    expect(facts(done)).toEqual(["ing:pesto", "ing:fresh-tomato"]);
    const body = feedbackOf(done)!.textJa.slice(done.lastResearchRows!.labelJa.length);
    expect(body).not.toContain(jaName("chicken"));
    expect(body).not.toContain(jaName("pesto"));
  });
  it("an ingredient made known by a Hint purchase during PREPARE is excluded from this attempt's judgment", () => {
    const sheet = act(start(single()), { type: "SHOW_HINT" });
    const next = hint5SheetView(sheet)!.next!;
    expect(next.kind).toBe("SAUCE");
    const bought = act(sheet, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: next.rungIndex });
    expect(facts(bought)).toContain("ing:pesto");
    const done = finish({ ...bought, hintSheetOpen: false }, original());
    expect(view(done)).toEqual(["topping:fresh-tomato:POSITIVE", "topping:egg:NEGATIVE"]);
    expect(facts(done).filter((f) => f === "ing:pesto")).toHaveLength(1);
  });
  it("positive facts are deduplicated across attempts", () => {
    const first = finish(start(single()), original());
    const again = finish(act(first, { type: "RETRY_SAME_RECIPE" }), original());
    expect(facts(again).filter((f) => f === "ing:fresh-tomato")).toHaveLength(1);
  });
});

describe("topping cap (K = 3)", () => {
  it("3 unknown toppings are all judged", () => {
    const done = finish(start(single()), mk("pesto", "fresh-tomato", "egg", "onion"));
    expect(view(done)).toEqual(["sauce:pesto:POSITIVE", "topping:fresh-tomato:POSITIVE", "topping:egg:NEGATIVE", "topping:onion:NEGATIVE"]);
    expect(done.lastResearchRows!.toppingOverCap).toBe(false);
  });
  it("4 unknown toppings: no individual topping row, sauce / cheese rows remain, only they persist and are noted", () => {
    const done = finish(start(single()), mk("pesto", "mozzarella", "fresh-tomato", "egg", "onion", "bacon"));
    expect(done.lastResearchRows!.toppingOverCap).toBe(true);
    expect(view(done)).toEqual(["sauce:pesto:POSITIVE", "cheese:mozzarella:POSITIVE"]);
    expect(facts(done)).toEqual(["ing:pesto", "ing:mozzarella"]);
    expect(feedbackOf(done)!.textJa).toBe(`${LABEL} ソース: ${jaName("pesto")}○ チーズ: ${jaName("mozzarella")}○`);
  });
  it("over-cap with no other row: lastResearchRows keeps the state for the UI, the Notebook feedback is null, nothing persists", () => {
    const before = single();
    const done = finish(start(before), mk(null, "fresh-tomato", "egg", "onion", "bacon"));
    expect(done.lastResearchRows).toEqual({ labelJa: LABEL, rows: [], toppingOverCap: true, knownIngredientIds: ["chicken"] });
    expect(feedbackOf(done)).toBeNull();
    expect(done.discoveryHintFacts).toBe(before.discoveryHintFacts);
  });
  it("nothing to disclose (all known / nothing placed): no rows, the known snapshot is kept, the feedback is null", () => {
    const done = finish(start(single()), mk(null, "chicken"));
    expect(done.lastResearchRows).toEqual({ labelJa: LABEL, rows: [], toppingOverCap: false, knownIngredientIds: ["chicken"] });
    expect(feedbackOf(done)).toBeNull();
  });
});

describe("matcher / cooking-quality independence (INV-D6)", () => {
  const snapshot = (s: GameState) => ({ rows: s.lastResearchRows, facts: s.discoveryHintFacts, feedback: feedbackOf(s) });
  it("ORIGINAL, AMBIGUOUS and INCOMPLETE_MATCH give the same rows, facts and Notebook line", () => {
    const original1 = finish(start(single()), exact(T) && original());
    expect(original1.lastDiscovery?.kind).toBe("ORIGINAL");
    forced.ambiguous = true;
    const ambiguous = finish(start(single()), original());
    forced.ambiguous = false;
    expect(ambiguous.lastDiscovery?.kind).toBe("AMBIGUOUS");
    const thin: PizzaState = { ...exact(T), sauceDeposits: buildIdealSauceFixture().slice(0, 1) };
    const incomplete = register(toResult(start(single()), thin, mid(T)));
    expect(incomplete.lastDiscovery?.kind).toBe("INCOMPLETE_MATCH");
    expect(snapshot(ambiguous)).toEqual(snapshot(original1));
    // INCOMPLETE is a different pizza (the whole recipe); its rows are the same S1 judgment of its own ingredients
    expect(view(incomplete)).toEqual(["sauce:pesto:POSITIVE", "cheese:mozzarella:POSITIVE", "topping:fresh-tomato:POSITIVE"]);
    expect(facts(incomplete)).toEqual(["ing:pesto", "ing:mozzarella", "ing:fresh-tomato"]);
  });
  it("the bake value does not change membership", () => {
    const a = finish(start(single()), original(), 55);
    const b = finish(start(single()), original(), 70);
    expect(snapshot(a)).toEqual(snapshot(b));
  });
});

describe("attempt-start Research Target authority", () => {
  it("targetless free cook: no rows, no facts, no Notebook line, even with exactly one Research Entry", () => {
    const s = single();
    expect(deriveResearchEntries(s).entries).toHaveLength(1);
    const done = finish(act(s, { type: "START_FREE_COOK" }), original());
    expect(done.lastResearchRows).toBeNull();
    expect(done.discoveryHintFacts).toBe(s.discoveryHintFacts);
    expect(feedbackOf(done)).toBeNull();
  });
  it("an unregistered / stale target gives no result", () => {
    const done = finish({ ...start(single()), researchTargetId: "pizza-portuguesa" }, original());
    expect(done.lastResearchRows).toBeNull();
    expect(feedbackOf(done)).toBeNull();
  });
  const lastStock = () => {
    const s = single();
    return start({ ...s, inventory: { ...s.inventory, "fresh-tomato": 1, chicken: 1, mozzarella: 1, pesto: 1 } });
  };
  it("last stock, first attempt: started valid, it still yields the rows, fact and Notebook line after using the stock up", () => {
    const one = lastStock();
    expect(one.researchTargetValidAtStart).toBe(true);
    const done = finish(one, original());
    expect(done.inventory["fresh-tomato"]).toBe(0);
    expect(done.researchTargetValidAtStart).toBe(true); // a start snapshot: the result does not re-derive validity
    expect(view(done)).toContain("topping:fresh-tomato:POSITIVE");
    expect(facts(done)).toContain("ing:fresh-tomato");
    expect(feedbackOf(done)).not.toBeNull();
  });
  it("last stock, the following retry: the target and context carry on, but the new attempt is not valid at start -> no result", () => {
    const first = finish(lastStock(), original());
    const retry = act(first, { type: "RETRY_SAME_RECIPE" });
    expect(retry.researchTargetId).toBe(T); // #362 context continuity
    expect(retry.researchTargetValidAtStart).toBe(false);
    const factsBefore = retry.discoveryHintFacts;
    const second = finish(retry, mk("pesto", "chicken", "egg"));
    expect(second.researchTargetId).toBe(T);
    expect(second.lastResearchRows).toBeNull();
    expect(second.discoveryHintFacts).toBe(factsBefore); // no new ing: fact
    expect(feedbackOf(second)?.textJa ?? "").not.toContain("RESEARCH_ROWS");
    expect(notebookView(second.trialNotebook).find((e) => e.number === 2)?.feedback ?? null).toBeNull();
  });
  it("a normal retry (the target is still valid) evaluates again", () => {
    const first = finish(start(single()), original());
    const retry = act(first, { type: "RETRY_SAME_RECIPE" });
    expect(retry.researchTargetValidAtStart).toBe(true);
    const second = finish(retry, mk("pesto", "chicken", "egg", "onion"));
    expect(view(second)).toEqual(expect.arrayContaining(["topping:egg:NEGATIVE", "topping:onion:NEGATIVE"]));
  });
  it("START_FREE_COOK fixes the snapshot: valid target true, targetless / invalid target false", () => {
    const s = single();
    expect(start(s).researchTargetValidAtStart).toBe(true);
    expect(act(s, { type: "START_FREE_COOK" }).researchTargetValidAtStart).toBe(false);
    expect(start(s, "pizza-portuguesa").researchTargetValidAtStart).toBe(false);
    const dry = start({ ...s, inventory: { ...s.inventory, chicken: 0 } });
    expect(dry.researchTargetId).toBeNull(); // an invalid start drops the target (existing rule)
    expect(dry.researchTargetValidAtStart).toBe(false);
  });
  it("the snapshot is kept through RESET_PIZZA of the same attempt and never persisted", () => {
    const one = lastStock();
    expect(act(one, { type: "RESET_PIZZA" }).researchTargetValidAtStart).toBe(true);
  });
  it("register is exactly-once", () => {
    const result = toResult(start(single()), original(), 68);
    const once = register(result);
    expect(register(once)).toBe(once);
    expect(once.trialNotebook.display).toHaveLength(1);
  });
});

describe("cross-recipe exact (target A, exact B / the target itself)", () => {
  it("B is DISCOVERED normally; A gets no rows, no fact and no Notebook line", () => {
    const s = multi();
    const [a, b] = deriveResearchEntries(s).entries.map((e) => e.recipeId);
    const started = start(s, a);
    const done = register(toResult(started, exact(b), mid(b)));
    expect(done.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: b });
    expect(done.lastResearchRows).toBeNull();
    expect(done.discoveryHintFacts).toBe(started.discoveryHintFacts);
    expect(feedbackOf(done)).toBeNull();
  });
  it("the target itself reproduced exactly is DISCOVERED with no membership result", () => {
    const done = register(toResult(start(single()), exact(T), mid(T)));
    expect(done.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: T });
    expect(done.lastResearchRows).toBeNull();
    expect(facts(done)).toEqual([]);
  });
});

describe("transient result, Notebook replacement and reset", () => {
  it("retry / new attempt clears the stale rows; RESEARCH_ROWS -> null replaces the Notebook line of the same combination", () => {
    const combo = () => mk("pesto", "fresh-tomato");
    const first = finish(start(single()), combo());
    expect(first.lastResearchRows).not.toBeNull();
    expect(feedbackOf(first)?.kind).toBe("RESEARCH_ROWS");
    const retry = act(first, { type: "RETRY_SAME_RECIPE" });
    expect(retry.lastResearchRows).toBeNull();
    // the same combination again: everything is known now -> nothing disclosed -> feedback null replaces the old line
    const second = finish(retry, combo());
    expect(second.lastResearchRows?.rows).toEqual([]);
    // the retry's snapshot is its own: what the first attempt made known is prior knowledge now
    expect(second.lastResearchRows?.knownIngredientIds).toEqual(expect.arrayContaining(["chicken", "pesto", "fresh-tomato"]));
    expect(first.lastResearchRows?.knownIngredientIds).toEqual(["chicken"]);
    expect(notebookView(second.trialNotebook)).toHaveLength(1);
    expect(feedbackOf(second)).toBeNull();
  });
  it("RESEARCH_ROWS -> RESEARCH_ROWS: the same combination for another target keeps only the latest label", () => {
    const s = multi();
    const [a, b] = deriveResearchEntries(s).entries.map((e) => e.recipeId);
    const pizza = mk(null, "egg");
    const one = finish(start(s, a), pizza);
    const two = finish(act({ ...one, phase: "ORDER" } as GameState, { type: "START_FREE_COOK", researchTargetId: b }), pizza);
    expect(notebookView(two.trialNotebook)).toHaveLength(1);
    expect(feedbackOf(two)?.textJa.startsWith(two.lastResearchRows!.labelJa)).toBe(true);
    expect(feedbackOf(two)?.textJa).not.toBe(feedbackOf(one)?.textJa);
  });
  it("changing the target (a new free cook) clears the stale result", () => {
    const first = finish(start(single()), original());
    const next = act(first, { type: "START_FREE_COOK" });
    expect(next.lastResearchRows).toBeNull();
  });
});

describe("privacy of the result state", () => {
  it("has only labelJa / rows / toppingOverCap, no hidden identity, count, distance or similarity", () => {
    const done = finish(start(single()), original());
    const state = done.lastResearchRows!;
    expect(Object.keys(state).sort()).toEqual(["knownIngredientIds", "labelJa", "rows", "toppingOverCap"]);
    for (const row of state.rows) expect(Object.keys(row).sort()).toEqual(["category", "ingredientId", "verdict"]);
    const json = JSON.stringify(state);
    for (const hidden of [T, "pesto-pollo", "ペスト・ポッロ", ...RECIPES.map((r) => r.nameJa)]) expect(json).not.toContain(hidden);
    expect(json).not.toMatch(/count|distance|similar|missing|remaining|candidate/i);
  });
});

describe("save compatibility: the transient result is not persisted", () => {
  const memory = (): StorageLike => {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  };
  it("only the existing ing: facts reach the save; no result state, no negative, schema unchanged", () => {
    const storage = memory();
    const done = finish(start(single()), original());
    persistProgress(
      {
        dex: done.dex,
        pitzBalance: done.pitzBalance,
        ownedIngredientIds: done.ownedIngredientIds,
        inventory: done.inventory,
        starterGrantClaimedRecipeIds: done.starterGrantClaimedRecipeIds,
        unlockedForShopIngredientIds: done.unlockedForShopIngredientIds,
        discoveryHintPurchases: done.discoveryHintPurchases,
        discoveryHintFacts: done.discoveryHintFacts,
        discoveredTechniqueIds: done.discoveredTechniqueIds,
      },
      storage,
    );
    const raw = storage.getItem(SAVE_STORAGE_KEY) ?? "";
    expect(loadSave(storage).discoveryHintFacts[T]).toEqual(["ing:pesto", "ing:fresh-tomato"]);
    expect(loadSave(storage).schemaVersion).toBe(2);
    for (const word of ["lastResearchRows", "RESEARCH_ROWS", "toppingOverCap", "researchTest", "lastIngredientTest", "researchTargetValidAtStart"]) expect(raw).not.toContain(word);
    expect(JSON.stringify(JSON.parse(raw).discoveryHintFacts)).not.toContain("egg"); // the negative is never saved
  });
});

describe("feature flag OFF keeps the existing Production behavior", () => {
  it("no fact, no rows, no Notebook line: the state equals a targetless round's result", async () => {
    vi.resetModules();
    vi.doMock("../logic/discovery/researchIdentifyFlag", () => ({ RESEARCH_IDENTIFY_ENABLED: false }));
    const mod = await import("./gameReducer");
    const s0 = mod.createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa"]), ladderOwned(25), 1000);
    const base = { ...s0, inventory: Object.fromEntries(ladderOwned(25).map((id) => [id, 10])) };
    const run = (a: GameAction) => {
      let t = mod.gameReducer(base, a);
      t = { ...t, pizza: { ...original(), bakeResult: 68 } };
      t = [{ type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: 68 }].reduce((x, y) => mod.gameReducer(x, y as GameAction), t);
      for (let i = 0; i < 6 && t.phase !== "RESULT"; i += 1) t = mod.gameReducer(t, { type: "CONFIRM_MAKING_STEP" });
      return mod.gameReducer(t, { type: "REGISTER_TO_DEX" });
    };
    const targeted = run({ type: "START_FREE_COOK", researchTargetId: T });
    expect(targeted.lastResearchRows).toBeNull();
    expect(targeted.discoveryHintFacts).toBe(base.discoveryHintFacts);
    expect(notebookView(targeted.trialNotebook)[0].feedback).toBeNull();
    const targetless = run({ type: "START_FREE_COOK" });
    expect(targeted.trialNotebook).toEqual(targetless.trialNotebook);
    expect(targeted.discoveryHintFacts).toEqual(targetless.discoveryHintFacts);
    vi.doUnmock("../logic/discovery/researchIdentifyFlag");
    vi.resetModules();
  });
});
