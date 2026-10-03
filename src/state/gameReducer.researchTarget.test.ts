import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { deriveResearchEntries } from "../logic/discovery/researchEntry";
import { selectHintTarget } from "../logic/discovery/hintTarget";
import { hint5Presentation } from "../logic/discovery/hint5Ladder";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { hint5SheetView, isValidResearchTarget, researchEntryViews, researchTargetView } from "./discoveryHint";
import { createEmptyPizza } from "./pizzaState";
import { discoveredDex } from "./testSupport/guidedRound";

/**
 * Discovery 3.0 Research Recipe (#346 S3): the session-only Research Target, its Hint wiring and its
 * independence from the matcher. Production data only (ladder step 12 = 2 entries, step 25 = 1 entry).
 */

const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];

function save(step: number, extraDiscovered: readonly string[] = [], pitz = 1000): GameState {
  const owned = ladderOwned(step);
  const base = createInitialGameState(discoveredDex([...keysBefore(step), ...extraDiscovered]), owned, pitz);
  return { ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])) };
}
/** Step 25 with brazilian-calabresa closed: pesto-pollo is the single entry. */
const single = (pitz?: number) => save(25, ["brazilian-calabresa"], pitz);
/** Step 12: pizza-portuguesa + brazilian-calabresa are both entries. */
const multi = () => save(12);

const entryIds = (s: GameState) => deriveResearchEntries(s).entries.map((e) => e.recipeId);
const startResearch = (s: GameState, recipeId: string) => act(s, { type: "START_FREE_COOK", researchTargetId: recipeId });
const facts = (s: GameState, id: string) => s.discoveryHintFacts[id] ?? [];

/** Buys the next ladder rung of the open sheet. */
function buyNext(s: GameState): GameState {
  const view = hint5SheetView(s);
  expect(view?.next).toBeTruthy();
  return act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: view!.next!.rungIndex });
}

describe("A. single entry: Research Target -> cooking -> Hint target", () => {
  it("the only entry is pesto-pollo, and selecting it makes it the Hint target", () => {
    const s = single();
    expect(entryIds(s)).toEqual(["pesto-pollo"]);
    const started = startResearch(s, "pesto-pollo");
    expect(started.phase).toBe("PREPARE");
    expect(started.freeCook).toBe(true);
    expect(started.researchTargetId).toBe("pesto-pollo");
    const opened = act(started, { type: "SHOW_HINT" });
    expect(opened.hintSession?.targetId).toBe("pesto-pollo");
    expect(hint5SheetView(opened)).not.toBeNull();
  });

  it("selectHintTarget reports the explicit source `research`", () => {
    const s = single();
    expect(selectHintTarget(s, { researchTargetId: "pesto-pollo" })).toEqual({ kind: "TARGET", recipeId: "pesto-pollo", source: "research" });
  });
});

describe("B. multiple entries: only the selected target is the Hint subject", () => {
  it("picks either entry and buys facts only for it", () => {
    const s = multi();
    const ids = entryIds(s);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    for (const picked of ids.slice(0, 2)) {
      const other = ids.find((id) => id !== picked)!;
      const opened = act(startResearch(s, picked), { type: "SHOW_HINT" });
      expect(opened.hintSession?.targetId).toBe(picked);
      const bought = buyNext(opened);
      expect(bought.pitzBalance).toBeLessThan(opened.pitzBalance);
      expect(facts(bought, picked).length).toBeGreaterThan(0);
      expect(facts(bought, other)).toEqual([]);
    }
  });

  it("the cooking context speaks only of the selected anonymous entry", () => {
    const s = multi();
    const [first, second] = entryIds(s);
    expect(researchTargetView(startResearch(s, first))?.label).toBe("？？？ピザ ①");
    expect(researchTargetView(startResearch(s, second))?.label).toBe("？？？ピザ ②");
    const text = JSON.stringify({ ...researchTargetView(startResearch(s, first)), recipeId: undefined });
    for (const r of RECIPES) expect(text).not.toContain(r.nameJa);
  });
});

describe("C. the Research Target is not matcher authority", () => {
  function cookExactly(s: GameState, recipeId: string): GameState {
    const r = RECIPES.find((x) => x.id === recipeId)!;
    const isSauce = (id: string) => getIngredient(id)?.category === "sauce";
    const pizza = {
      ...createEmptyPizza(),
      sauceIds: r.requiredIngredients.filter((q) => isSauce(q.ingredientId)).map((q) => q.ingredientId).slice(0, 1),
      toppings: r.requiredIngredients
        .filter((q) => !isSauce(q.ingredientId))
        .flatMap((q) => Array.from({ length: Math.max(1, q.minCount) }, () => q.ingredientId))
        .map((ingredientId, i) => ({ id: `w${i}`, ingredientId, x: 30 + (i % 8) * 5, y: 40 + Math.floor(i / 8) * 8 })),
      bakeResult: (r.bakeTarget.start + r.bakeTarget.end) / 2,
    };
    let t: GameState = { ...s, pizza };
    t = act(t, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: (r.bakeTarget.start + r.bakeTarget.end) / 2 });
    for (let i = 0; i < 6 && t.phase !== "RESULT"; i += 1) t = act(t, { type: "CONFIRM_MAKING_STEP" });
    return act(t, { type: "REGISTER_TO_DEX" });
  }

  it("researching A and baking B exactly discovers B", () => {
    const s = multi();
    const [a, b] = entryIds(s);
    const started = startResearch(s, a);
    expect(started.researchTargetId).toBe(a);
    const done = cookExactly(started, b);
    expect(done.lastDiscovery).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: b });
    expect(done.dex.find((e) => e.recipeId === b)?.discovered).toBe(true);
    expect(done.dex.find((e) => e.recipeId === a)?.discovered ?? false).toBe(false);
  });

  it("the matcher result is identical with and without a Research Target", () => {
    const s = multi();
    const [a, b] = entryIds(s);
    const withTarget = cookExactly(startResearch(s, a), b);
    const without = cookExactly(act(s, { type: "START_FREE_COOK" }), b);
    expect(withTarget.lastDiscovery).toEqual(without.lastDiscovery);
    expect(withTarget.dex).toEqual(without.dex);
  });
});

describe("D. no Research Target: OPEN_POOL is unchanged", () => {
  it("a pool of 2 still chooses nothing without a target", () => {
    const s = multi();
    expect(selectHintTarget(s)).toEqual({ kind: "OPEN_POOL" });
    const opened = act(act(s, { type: "START_FREE_COOK" }), { type: "SHOW_HINT" });
    expect(opened.researchTargetId).toBeNull();
    expect(opened.hintSession).toBeNull();
  });

  it("a Dex pin still never chooses among several candidates", () => {
    const s = multi();
    const [a] = entryIds(s);
    expect(selectHintTarget(s, { pinnedRecipeId: a })).toEqual({ kind: "OPEN_POOL" });
  });

  it("starting plain Free Cooking clears an earlier target; a retry keeps it", () => {
    const s = multi();
    const [a] = entryIds(s);
    const started = startResearch(s, a);
    expect(act(started, { type: "RETRY_SAME_RECIPE" }).researchTargetId).toBe(a);
    expect(act(started, { type: "START_FREE_COOK" }).researchTargetId).toBeNull();
  });
});

describe("selectHintTarget with a Research Target", () => {
  it("honours it over a pool of 2 and over a pin / sticky, only while DISCOVERABLE", () => {
    const s = multi();
    const [a, b] = entryIds(s);
    expect(selectHintTarget(s, { researchTargetId: b, pinnedRecipeId: a, stickyRecipeId: a })).toEqual({ kind: "TARGET", recipeId: b, source: "research" });
    expect(selectHintTarget({ ...s, inventory: {} }, { researchTargetId: b })).not.toMatchObject({ source: "research" });
  });

  it("ignores an unknown / discovered / null target (OPEN_POOL privacy intact)", () => {
    const s = multi();
    for (const researchTargetId of ["nope", "margherita", null, undefined]) {
      expect(selectHintTarget(s, { researchTargetId })).toEqual({ kind: "OPEN_POOL" });
    }
  });
});

describe("target validity", () => {
  it("rejects an id that is not a registered, cookable entry", () => {
    const s = multi();
    expect(startResearch(s, "margherita").researchTargetId).toBeNull();
    expect(startResearch(s, "not-a-recipe").researchTargetId).toBeNull();
    const [a] = entryIds(s);
    const empty: GameState = { ...s, inventory: {} };
    expect(isValidResearchTarget(empty, a)).toBe(false);
    expect(startResearch(empty, a).researchTargetId).toBeNull();
  });
});

describe("E. Hint knowledge persists in discoveryHintFacts only", () => {
  it("a bought rung is stored in the existing ledger and survives a JSON round trip", () => {
    const s = buyNext(act(startResearch(multi(), entryIds(multi())[0]), { type: "SHOW_HINT" }));
    const target = s.researchTargetId!;
    const reloaded = JSON.parse(JSON.stringify(s.discoveryHintFacts)) as GameState["discoveryHintFacts"];
    expect(reloaded[target]).toEqual(facts(s, target));
    const before = researchEntryViews(s).find((v) => v.recipeId === target)!;
    const after = researchEntryViews({ ...s, discoveryHintFacts: reloaded }).find((v) => v.recipeId === target)!;
    expect(after).toEqual(before);
  });

  it("the Research Target itself is not part of any save field", () => {
    const s = startResearch(multi(), entryIds(multi())[0]);
    expect(s.researchTargetId).not.toBeNull();
    const src = JSON.stringify(Object.keys(s.discoveryHintFacts));
    expect(src).not.toContain("researchTarget");
  });
});

describe("F. unlock exact fact vs Hint (no double charge, no duplicate knowledge)", () => {
  /** Buys the whole ladder; returns the Pitz spent and the final state. */
  function buyAll(s: GameState): { spent: number; state: GameState; zeroCharge: number } {
    const start = s.pitzBalance;
    let t = s;
    let zero = 0;
    for (let i = 0; i < 12 && hint5SheetView(t)?.next; i += 1) {
      const before = t.pitzBalance;
      t = buyNext(t);
      if (t.pitzBalance === before) zero += 1;
    }
    return { spent: start - t.pitzBalance, state: t, zeroCharge: zero };
  }

  it("the unlock ingredient's rung completes for 0 Pitz with a Research Target", () => {
    const s = single();
    const entry = deriveResearchEntries(s).entries[0];
    expect(entry.unlockIngredientId).toBe("chicken");
    const withTarget = buyAll(act(startResearch(s, "pesto-pollo"), { type: "SHOW_HINT" }));
    expect(withTarget.zeroCharge).toBe(1); // the chicken SUB_CLASS rung
    expect(hint5SheetView(withTarget.state)?.next).toBeNull();
    // chicken's own exact name is never written to the ledger (it stays derived)
    expect(facts(withTarget.state, "pesto-pollo")).not.toContain("ing:chicken");
  });

  it("without a Research Target nothing is derived: the same rung is charged", () => {
    const s = single();
    const viaPin = act(act(s, { type: "START_FREE_COOK" }), { type: "SHOW_HINT", pinnedRecipeId: "pesto-pollo" });
    expect(viaPin.hintSession?.targetId).toBe("pesto-pollo");
    const plain = buyAll(viaPin);
    const target = buyAll(act(startResearch(s, "pesto-pollo"), { type: "SHOW_HINT" }));
    expect(plain.zeroCharge).toBe(0);
    expect(plain.spent - target.spent).toBe(5);
  });

  it("the pre-purchase view is the same with and without the derived fact (no free leak)", () => {
    const s = single();
    const plain = hint5Presentation({ recipeId: "pesto-pollo", discoveredCount: 5, storedFactIds: [], legacyPurchases: {}, pitzBalance: 1000 });
    const opened = act(startResearch(s, "pesto-pollo"), { type: "SHOW_HINT" });
    const view = hint5SheetView(opened)!;
    expect({ next: view.next, board: view.board, legacy: view.legacyKnownIngredientIds }).toEqual({
      next: plain!.next,
      board: plain!.board,
      legacy: plain!.legacyKnownIngredientIds,
    });
  });
});

describe("G. STRUCTURE / exact / class facts in the Research view", () => {
  function buyUntil(s: GameState, kind: string): GameState {
    let t = s;
    for (let i = 0; i < 12 && hint5SheetView(t)?.next && hint5SheetView(t)!.next!.kind !== kind; i += 1) t = buyNext(t);
    return buyNext(t); // the rung of `kind` itself
  }
  const opened = () => act(startResearch(single(), "pesto-pollo"), { type: "SHOW_HINT" });
  const view = (s: GameState) => researchEntryViews(s)[0];

  it("shows no total before STRUCTURE and N after, never a slot list or a remaining count", () => {
    const o = opened();
    expect(view(o).totalIngredientCount).toBeNull();
    const after = buyUntil(o, "STRUCTURE");
    expect(view(after).totalIngredientCount).toBe(4);
    expect(JSON.stringify(view(after))).not.toMatch(/remaining|slot|あと|残り/);
  });

  it("exact-name rungs (SAUCE / CHEESE) are exact facts, not classes", () => {
    const s = buyUntil(opened(), "CHEESE");
    expect(view(s).knownExactIngredientIds).toEqual(expect.arrayContaining(["chicken", "pesto", "mozzarella"]));
    expect(view(s).classLinesJa).toEqual([]);
  });

  it("a bought SUB_CLASS shows only the existing family label, never the ingredient", () => {
    const s = buyUntil(opened(), "SUB_CLASS");
    const v = view(s);
    expect(v.classLinesJa).toHaveLength(1);
    expect(v.classLinesJa[0]).toMatch(/^△ /);
    expect(v.classLinesJa[0]).not.toContain(getIngredient("fresh-tomato")!.nameJa);
    expect(v.classLinesJa[0]).not.toContain(getIngredient("chicken")!.nameJa);
  });

  it("a class fact stored without STRUCTURE is not shown (the sheet's own rule)", () => {
    const o = opened();
    const forged = { ...o, discoveryHintFacts: { "pesto-pollo": ["cls:fresh-tomato"] } };
    expect(view(forged).classLinesJa).toEqual([]);
  });

  it("an attempt never adds knowledge: only the unlock fact without any purchase", () => {
    expect(view(opened()).knownExactIngredientIds).toEqual(["chicken"]);
  });
});
