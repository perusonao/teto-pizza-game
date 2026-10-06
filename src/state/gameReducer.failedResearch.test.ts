import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { notebookView } from "../logic/discovery/trialNotebook";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { discoveredDex } from "./testSupport/guidedRound";
import { loadSave, persistProgress, SAVE_STORAGE_KEY, type StorageLike } from "./persistence";

/**
 * Research 2.0 Phase 4 (OD-R3-1..3, INV-B6): a bake-FAILED Research trial with at least one ingredient discloses the same
 * ○× as an ORIGINAL, is recorded in the Notebook and writes the ledgers; inventory is consumed as before; no Dex /
 * Technique / Pitz. An empty pizza discloses and writes nothing. Production data: step 25, pesto-pollo.
 */
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const owned = [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= 25).flatMap((s) => s.ingredientIds),
];
const keysBefore = ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < 25).map((s) => s.keyRecipeId)];
function single(): GameState {
  const base = createInitialGameState(discoveredDex([...keysBefore, "brazilian-calabresa", "aussie"]), owned, 1000);
  return { ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])) };
}
const T = "pesto-pollo";
const start = (s: GameState) => act(s, { type: "START_FREE_COOK", researchTargetId: T });
const spot = (i: number) => ({ x: 30 + (i % 8) * 5, y: 40 + Math.floor(i / 8) * 8 });
const mk = (sauce: string | null, ...tops: string[]): PizzaState => ({
  ...createEmptyPizza(),
  sauceIds: sauce ? [sauce] : [],
  toppings: tops.map((ingredientId, i) => ({ id: `t${i}`, ingredientId, ...spot(i) })),
});
function toResult(s: GameState, pizza: PizzaState, value: number): GameState {
  let t: GameState = { ...s, pizza: { ...pizza, bakeResult: value } };
  t = act(t, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value });
  for (let i = 0; i < 6 && t.phase !== "RESULT"; i += 1) t = act(t, { type: "CONFIRM_MAKING_STEP" });
  return t;
}
const FAIL = 1; // raw bake
const OK = 68;
const finish = (s: GameState, pizza: PizzaState, v: number) => act(toResult(s, pizza, v), { type: "REGISTER_TO_DEX" });
const rows = (s: GameState) => (s.lastResearchRows?.rows ?? []).map((r) => `${r.ingredientId}:${r.verdict}`);

function fakeStorage(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

describe("FAILED Research with ingredients", () => {
  const failed = finish(start(single()), mk("pesto", "fresh-tomato", "egg"), FAIL);

  it("is FAILED, parked on RESULT, and discloses the ○× rows", () => {
    expect(failed.completion?.status).toBe("FAILED");
    expect(failed.phase).toBe("RESULT");
    expect(rows(failed)).toEqual(["pesto:POSITIVE", "fresh-tomato:POSITIVE", "egg:NEGATIVE"]);
  });

  it("the rows are byte-identical to the same pizza baked well (INV-B6)", () => {
    const ok = finish(start(single()), mk("pesto", "fresh-tomato", "egg"), OK);
    expect(failed.lastResearchRows).toEqual(ok.lastResearchRows);
  });

  it("writes the exclusion ledger and the hint ledger exactly like ORIGINAL", () => {
    expect(failed.researchExclusions).toEqual({ [T]: ["egg"] });
    expect(failed.discoveryHintFacts[T]).toEqual(["ing:pesto", "ing:fresh-tomato"]);
  });

  it("records the attempt in the Trial Notebook with the shown line", () => {
    expect(failed.lastTrialAttempt).toEqual({ kind: "NEW", number: 1 });
    expect(notebookView(failed.trialNotebook)).toHaveLength(1);
  });

  it("consumes inventory as usual", () => {
    const base = start(single());
    expect(failed.inventory.egg).toBe((base.inventory.egg ?? 0) - 1);
    expect(failed.inventory.pesto).toBeLessThan(base.inventory.pesto ?? 0);
  });

  it("grants no discovery, Technique or Pitz", () => {
    const base = start(single());
    expect(failed.dex).toEqual(base.dex);
    expect(failed.discoveredTechniqueIds).toEqual(base.discoveredTechniqueIds);
    expect(failed.lastTechniqueDiscovery ?? []).toEqual([]);
    expect(failed.lastDiscovery).toBeNull();
    expect(failed.lastPitzCredit).toBeNull();
    expect(failed.pitzBalance).toBe(base.pitzBalance);
  });

  it("is exactly-once: a repeated REGISTER_TO_DEX / CONFIRM_BAKE changes nothing", () => {
    expect(act(failed, { type: "REGISTER_TO_DEX" })).toBe(failed);
    expect(act(failed, { type: "CONFIRM_BAKE", value: FAIL })).toBe(failed);
  });

  it("an identical retry is recorded as a duplicate (#n), not a second entry", () => {
    const again = finish(act(failed, { type: "RETRY_SAME_RECIPE" }), mk("pesto", "fresh-tomato", "egg"), FAIL);
    expect(again.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    expect(again.researchExclusions).toEqual({ [T]: ["egg"] });
  });

  it("the ledger survives save and load", () => {
    const storage = fakeStorage();
    persistProgress(failed, storage);
    expect(storage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();
    expect(loadSave(storage)?.researchExclusions).toEqual({ [T]: ["egg"] });
  });

  it("leaks nothing about the hidden recipe", () => {
    const text = JSON.stringify([failed.lastResearchRows, notebookView(failed.trialNotebook)]);
    expect(text).not.toContain("pesto-pollo");
    expect(text).not.toMatch(/No\.|hash|cohort/i);
  });
});

describe("FAILED Research without ingredients", () => {
  const empty = finish(start(single()), mk(null), FAIL);
  it("discloses nothing and writes no ledger or Notebook entry, but is still FAILED", () => {
    const base = start(single());
    expect(empty.completion?.status).toBe("FAILED");
    expect(empty.lastResearchRows).toBeNull();
    expect(empty.lastTrialAttempt).toBeNull();
    expect(empty.researchExclusions).toEqual(base.researchExclusions);
    expect(empty.discoveryHintFacts).toEqual(base.discoveryHintFacts);
    expect(empty.trialNotebook).toEqual(base.trialNotebook);
  });
});

describe("FAILED without a Research target", () => {
  it("is unchanged: no rows, no record", () => {
    const s = finish(act(single(), { type: "START_FREE_COOK" }), mk("pesto", "egg"), FAIL);
    expect(s.lastResearchRows).toBeNull();
    expect(s.lastTrialAttempt).toBeNull();
    expect(s.researchExclusions).toEqual({});
  });
});
