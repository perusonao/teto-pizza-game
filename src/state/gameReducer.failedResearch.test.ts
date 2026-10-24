import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { buildCompletionFailureMessage } from "../data/completionMessages";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
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
  const base = createInitialGameState(discoveredDex([...keysBefore, "brazilian-calabresa", "aussie", "grandma-pizza"]), owned, 1000);
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

/**
 * Issue #472: the FAILED reason line of a Research trial is built from the recipe-free Free Cook gate (empty
 * `requiredIngredients`), so it can only ever be one of three fixed sentences and never carries an ingredient id,
 * the hidden recipe's name / id or a Research identifier (Contract 2.1, INV-B3 / B6 / B7).
 */
describe("FAILED Research reason line leaks nothing", () => {
  const BURNT = 99;
  const FIXED_REASONS = ["材料が入っていません", "生焼けで提供できません", "焦げすぎて提供できません"];
  const hidden = getRecipe(T)!;
  const cases: { name: string; pizza: PizzaState; value: number; expected: string }[] = [
    { name: "ingredients, raw", pizza: mk("pesto", "fresh-tomato", "egg"), value: FAIL, expected: "生焼けで提供できません" },
    { name: "ingredients, burnt", pizza: mk("pesto", "egg"), value: BURNT, expected: "焦げすぎて提供できません" },
    { name: "empty pizza, raw", pizza: mk(null), value: FAIL, expected: "材料が入っていません" },
    { name: "empty pizza, burnt", pizza: mk(null), value: BURNT, expected: "材料が入っていません" },
  ];

  for (const c of cases) {
    it(`${c.name}: one fixed sentence, no ingredient id, no recipe identity`, () => {
      const s = finish(start(single()), c.pizza, c.value);
      expect(s.completion?.status).toBe("FAILED");
      if (s.completion?.status !== "FAILED") return;
      const line = buildCompletionFailureMessage(s.completion);
      expect(line).toBe(c.expected);
      expect(FIXED_REASONS).toContain(line);
      // Free Cook never reports a per-ingredient failure: no `ingredientId` on any failure detail.
      for (const f of s.completion.failures) expect("ingredientId" in f && f.ingredientId !== undefined).toBe(false);
      expect(JSON.stringify(s.completion)).not.toMatch(/ingredientId/);
      for (const needle of [hidden.id, hidden.nameJa, "チキン", "pesto-pollo", "？？？"]) expect(line).not.toContain(needle);
    });
  }

  it("the reason line is the same for a Research trial and a targetless Free Cook of the same pizza", () => {
    const research = finish(start(single()), mk("pesto", "egg"), FAIL);
    const plain = finish(act(single(), { type: "START_FREE_COOK" }), mk("pesto", "egg"), FAIL);
    if (research.completion?.status !== "FAILED" || plain.completion?.status !== "FAILED") throw new Error("expected FAILED");
    expect(buildCompletionFailureMessage(research.completion)).toBe(buildCompletionFailureMessage(plain.completion));
    expect(research.completion).toEqual(plain.completion);
  });
});

/**
 * Issue #482 (OD-B3, Contract 2.1 INV-D3 / INV-D6 / INV-B6): Free Cooking's Completion Gate window is now exactly the
 * generic window (58-78). The pizzas that used to be ORIGINAL in the old 10-point margin band (48-57.99 / 78.01-88) are
 * FAILED, and they must disclose, record and persist byte-identically to the same pizza baked inside the window.
 */
describe("the generic window edge never changes what is disclosed (#482 / OD-B3)", () => {
  const pizza = () => mk("pesto", "fresh-tomato", "egg");
  /** The save JSON without `discoveredTechniqueIds`: an in-window ORIGINAL may pay a Technique (the usage path), a
   *  FAILED never does (OD-R3) -- a reward the FAILED pizza loses, not a disclosure; it has its own test below. */
  const saved = (s: GameState) => {
    const storage = fakeStorage();
    persistProgress(s, storage);
    const { discoveredTechniqueIds: _techniques, ...rest } = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!);
    return rest;
  };
  const disclosed = (s: GameState) => ({
    rows: s.lastResearchRows,
    facts: s.discoveryHintFacts,
    exclusions: s.researchExclusions,
    notebook: notebookView(s.trialNotebook),
    attempt: s.lastTrialAttempt,
    inventory: s.inventory,
    save: saved(s),
  });
  const reference = finish(start(single()), pizza(), OK);

  it("inside the window (both edges) is a finished ORIGINAL pizza", () => {
    for (const v of [58, 68, 78]) {
      const r = finish(start(single()), pizza(), v);
      expect(r.completion?.status, String(v)).toBe("PASS");
      expect(disclosed(r), String(v)).toEqual(disclosed(reference));
    }
  });

  it.each([48, 50, 55, 57.99, 78.01, 80, 85, 88])(
    "bake %s (FAILED: the old margin band and just outside the window) discloses, records and saves exactly like the in-window pizza",
    (v) => {
      const r = finish(start(single()), pizza(), v);
      expect(r.completion?.status).toBe("FAILED");
      expect(disclosed(r)).toEqual(disclosed(reference));
    },
  );

  it("the one difference is a reward, not a disclosure: the in-window ORIGINAL may pay a Technique the FAILED never does", () => {
    const failed = finish(start(single()), pizza(), 55);
    expect(failed.discoveredTechniqueIds).toEqual(start(single()).discoveredTechniqueIds);
    expect(reference.discoveredTechniqueIds.length).toBeGreaterThanOrEqual(failed.discoveredTechniqueIds.length);
  });

  it("FAILED grants nothing the ORIGINAL did not show: no discovery, Technique, Dex entry, Pitz or star credit", () => {
    const base = start(single());
    for (const v of [55, 85]) {
      const r = finish(base, pizza(), v);
      expect(r.dex).toEqual(base.dex);
      expect(r.discoveredTechniqueIds).toEqual(base.discoveredTechniqueIds);
      expect(r.lastDiscovery).toBeNull();
      expect(r.lastPitzCredit).toBeNull();
      expect(r.pitzBalance).toBe(base.pitzBalance);
    }
  });

  it("the failure line reads the same fixed sentence at the old margin band and far away (no new information in the reason)", () => {
    const near = finish(start(single()), pizza(), 55).completion;
    const far = finish(start(single()), pizza(), FAIL).completion;
    expect(near?.status === "FAILED" && buildCompletionFailureMessage(near)).toBe(far?.status === "FAILED" && buildCompletionFailureMessage(far));
  });
});
