import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { notebookView } from "../logic/discovery/trialNotebook";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { discoveredDex } from "./testSupport/guidedRound";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type StorageLike } from "./persistence";
import { hint5SheetView } from "./discoveryHint";

/**
 * Research 2.0 Phase 2 S3 (INV-B1 / B2 / B5 / B9): the ledger writer through the real reducer. Production data: ladder
 * step 25 = one Research Entry, pesto-pollo (pesto, mozzarella, fresh-tomato, chicken; the unlock fact is chicken).
 * What is written is exactly the NEGATIVE rows of the RESULT -- same rows as `lastResearchRows` and the Notebook line.
 */
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
function single(stock = 10): GameState {
  const owned = ladderOwned(25);
  const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa", "aussie"]), owned, 1000);
  return { ...base, inventory: Object.fromEntries(owned.map((id) => [id, stock])) };
}
const T = "pesto-pollo";
const start = (s: GameState, id: string | undefined = T) => act(s, { type: "START_FREE_COOK", researchTargetId: id });
const spot = (i: number) => ({ x: 30 + (i % 8) * 5, y: 40 + Math.floor(i / 8) * 8 });
function toResult(s: GameState, pizza: PizzaState, value: number): GameState {
  let t: GameState = { ...s, pizza: { ...pizza, bakeResult: value } };
  t = act(t, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value });
  for (let i = 0; i < 6 && t.phase !== "RESULT"; i += 1) t = act(t, { type: "CONFIRM_MAKING_STEP" });
  return t;
}
const mk = (sauce: string | null, ...tops: string[]): PizzaState => ({
  ...createEmptyPizza(),
  sauceIds: sauce ? [sauce] : [],
  toppings: tops.map((ingredientId, i) => ({ id: `t${i}`, ingredientId, ...spot(i) })),
});
const finish = (s: GameState, pizza: PizzaState, v = 68) => act(toResult(s, pizza, v), { type: "REGISTER_TO_DEX" });
const excl = (s: GameState) => s.researchExclusions[T] ?? [];
const negatives = (s: GameState) => (s.lastResearchRows?.rows ?? []).filter((r) => r.verdict === "NEGATIVE").map((r) => r.ingredientId);

function fakeStorage(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

describe("INV-B1: the ledger holds exactly the NEGATIVE rows the RESULT disclosed", () => {
  it("a fresh state has an empty ledger", () => {
    expect(single().researchExclusions).toEqual({});
  });
  it("pesto + fresh-tomato + egg: egg (NEGATIVE) is stored as a bare id, the positives are not", () => {
    const done = finish(start(single()), mk("pesto", "fresh-tomato", "egg"));
    expect(done.phase).toBe("DISCOVERED");
    expect(negatives(done)).toEqual(["egg"]);
    expect(excl(done)).toEqual(negatives(done));
    expect(done.researchExclusions).toEqual({ [T]: ["egg"] });
  });
  it("a wrong sauce is an ordinary NEGATIVE row and is stored like any other", () => {
    const done = finish(start(single()), mk("tomato-sauce", "fresh-tomato"));
    expect(negatives(done)).toEqual(["tomato-sauce"]);
    expect(excl(done)).toEqual(["tomato-sauce"]);
  });
  it("persisted order is the player's placement order, and later attempts union (no duplicates)", () => {
    const first = finish(start(single()), mk("pesto", "egg", "onion"));
    expect(excl(first)).toEqual(["egg", "onion"]);
    const again = finish(act(first, { type: "RETRY_SAME_RECIPE" }), mk("pesto", "onion", "bacon"));
    expect(excl(again)).toEqual(["egg", "onion", "bacon"]);
  });
  it("RESULT, ledger and Notebook line carry the same excluded ingredients", () => {
    const done = finish(start(single()), mk("pesto", "fresh-tomato", "egg", "onion"));
    const shown = negatives(done);
    expect(excl(done)).toEqual(shown);
    const line = notebookView(done.trialNotebook).map((e) => e.feedback?.textJa ?? "").join("");
    for (const id of shown) expect(line).toContain(`${getIngredient(id)!.nameJa}×`);
  });
});

describe("INV-B2: nothing undisclosed is written", () => {
  it("a known ingredient (unlock fact, stored ✓) is never written", () => {
    const withStored = { ...start(single()), discoveryHintFacts: { [T]: ["ing:pesto"] } };
    const done = finish(withStored, mk("pesto", "chicken", "egg"));
    expect(excl(done)).toEqual(["egg"]);
  });
  it("4+ unknown toppings (over the K = 3 cap) disclose no individual row, so nothing is written", () => {
    const done = finish(start(single()), mk("pesto", "egg", "onion", "bacon", "mushroom"));
    expect(done.lastResearchRows?.toppingOverCap).toBe(true);
    expect(done.researchExclusions).toEqual({});
  });
  it("an ingredient the player did not use is never written", () => {
    const done = finish(start(single()), mk("pesto", "egg"));
    expect(excl(done)).toEqual(["egg"]);
    expect(excl(done)).not.toContain("onion");
  });
  it("an attempt with no explicit target, or a stale target, writes nothing", () => {
    const noTarget = finish(act(single(), { type: "START_FREE_COOK" }), mk("pesto", "egg"));
    expect(noTarget.researchExclusions).toEqual({});
  });
  it("a FAILED bake stays parked on RESULT through REGISTER_TO_DEX and never writes a second time", () => {
    const parked = toResult(start(single()), mk("pesto", "egg"), 1);
    expect(parked.phase).toBe("RESULT");
    expect(act(parked, { type: "REGISTER_TO_DEX" })).toBe(parked);
  });
  it("REGISTER_TO_DEX is exactly-once: a repeated dispatch does not write twice", () => {
    const done = finish(start(single()), mk("pesto", "egg"));
    const twice = act(done, { type: "REGISTER_TO_DEX" });
    expect(twice).toBe(done);
    expect(twice.researchExclusions).toBe(done.researchExclusions);
  });
});

describe("INV-B5 / B9: Hint and the Hint ledger do not know the ledger", () => {
  it("the exclusion never enters discoveryHintFacts", () => {
    const done = finish(start(single()), mk("pesto", "fresh-tomato", "egg"));
    expect(JSON.stringify(done.discoveryHintFacts)).not.toContain("egg");
    expect(done.discoveryHintFacts[T]).toEqual(["ing:pesto", "ing:fresh-tomato"]);
  });
  it("the Hint sheet's next rung (kind, price, ownership) is identical with and without exclusions", () => {
    const plain = act(start(single()), { type: "SHOW_HINT" });
    const withEx = act({ ...start(single()), researchExclusions: { [T]: ["egg", "onion"] } }, { type: "SHOW_HINT" });
    expect(hint5SheetView(withEx)).toEqual(hint5SheetView(plain));
  });
  it("a Hint purchase does not change the ledger", () => {
    const sheet = act({ ...start(single()), researchExclusions: { [T]: ["egg"] } }, { type: "SHOW_HINT" });
    const next = hint5SheetView(sheet)!.next!;
    const bought = act(sheet, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: next.rungIndex });
    expect(bought.researchExclusions).toEqual({ [T]: ["egg"] });
  });
});

describe("the ledger survives round transitions and is saved additively by persistProgress", () => {
  it("carried across RETRY / PLAY_AGAIN", () => {
    const done = finish(start(single()), mk("pesto", "egg"));
    expect(act(done, { type: "RETRY_SAME_RECIPE" }).researchExclusions).toEqual({ [T]: ["egg"] });
    expect(act(done, { type: "PLAY_AGAIN" }).researchExclusions).toEqual({ [T]: ["egg"] });
  });
  it("saving the state's ledger and reloading it into a new state round-trips", () => {
    const done = finish(start(single()), mk("pesto", "egg", "onion"));
    const storage = fakeStorage();
    persistProgress({ dex: done.dex, pitzBalance: done.pitzBalance, ownedIngredientIds: done.ownedIngredientIds, inventory: done.inventory, starterGrantClaimedRecipeIds: done.starterGrantClaimedRecipeIds, discoveryHintFacts: done.discoveryHintFacts, researchExclusions: done.researchExclusions }, storage);
    const save = loadSave(storage);
    expect(save.researchExclusions).toEqual({ [T]: ["egg", "onion"] });
    expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!).schemaVersion).toBe(2);
    const reloaded = createInitialGameState(save.dex, save.ownedIngredientIds, save.pitzBalance, save.inventory, save.starterGrantClaimedRecipeIds, [], save.discoveryHintPurchases, save.discoveryHintFacts, undefined, undefined, save.researchExclusions);
    expect(reloaded.researchExclusions).toEqual({ [T]: ["egg", "onion"] });
  });
});
