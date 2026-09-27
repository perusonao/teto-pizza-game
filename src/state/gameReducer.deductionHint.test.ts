import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { W1_25_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { INGREDIENT_TOTAL_FACT_ID } from "../logic/discovery/deductionHint";
import { guardedReserveAttributeAnswer, structureAnswer, TOPPING_TOTAL_FACT_ID } from "../logic/discovery/deductionGuard";
import { legacyOwnsIngredientTotal } from "../logic/discovery/deductionHint";
import { ALL_INGREDIENT_IDS, ladderTargets, ownedAt } from "../logic/discovery/testSupport/deductionInversion";
import type { HintCategory } from "../logic/discovery/selectableHint";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { hintSheetView, requestDeductionHintFact, type HintSheetView } from "./discoveryHint";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { createDefaultSave, loadSave, persistProgress, resetSave, SAVE_STORAGE_KEY, type StorageLike } from "./persistence";

/**
 * Discovery Hint 4.0 (Issue #253), DH4-2B: 構成 / 特徴 requests through the real reducer, behind the
 * E3 flag (on in this test run: Vitest is a DEV build). The DH4-2A pure authority decides; the
 * reducer only applies one patch (Pitz + `discoveryHintFacts`) or the transient outcome, or returns
 * `state` unchanged. The flag-off production parity is ./gameReducer.deductionHint.flagOff.test.ts.
 */

function discover(ids: readonly string[]): DexState {
  let dex = EMPTY_DEX;
  for (const id of ids) {
    dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return dex;
}

const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
// A real acquisition order (starters, then ladder order): T1a reads what was owned when a target
// became makeable from it. Catalog order is not a possible acquisition order.
const ALL_IDS = ALL_INGREDIENT_IDS;
const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const TARGETS = ladderTargets(W1_25_DISCOVERY_LADDER).slice(1);

interface Ledgers {
  purchases?: Record<string, number>;
  facts?: Record<string, readonly string[]>;
}

/** Dex {margherita}, every material owned and stocked, the sheet open on `target` (a Dex pin). */
function sheetOn(target: string, pitz: number, ledgers: Ledgers = {}, dexIds: readonly string[] = ["margherita"]): GameState {
  const initial = createInitialGameState(
    discover(dexIds),
    ALL_IDS,
    pitz,
    Object.fromEntries(FINITE.map((id) => [id, 30])),
    [],
    ALL_IDS,
    ledgers.purchases ?? {},
    ledgers.facts ?? {},
  );
  const s = act(initial, { type: "START_FREE_COOK" }, { type: "SHOW_HINT", pinnedRecipeId: target });
  expect(s.hintSession?.targetId).toBe(target);
  return s;
}

function view(s: GameState): Extract<HintSheetView, { kind: "SELECTABLE" }> {
  const v = hintSheetView(s);
  if (v.kind !== "SELECTABLE") throw new Error(`expected SELECTABLE, got ${v.kind}`);
  return v;
}

const deduction = (s: GameState) => view(s).deduction!;
const ask = (s: GameState, family: "structure" | "attribute", expected = deduction(s).paidCount): GameAction => ({
  type: "PURCHASE_SELECTABLE_HINT",
  preference: "sauce",
  expectedPaidCount: expected,
  family,
});
const buyMaterial = (s: GameState, preference: HintCategory = "sauce"): GameState =>
  act(s, { type: "PURCHASE_SELECTABLE_HINT", preference, expectedPaidCount: view(s).presentation.paidCount });
const ctx = { discoveredCount: 1, ownedIngredientIds: ALL_IDS };
const factsOf = (s: GameState, id: string) => s.discoveryHintFacts[id] ?? [];

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(initial));
  return { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) };
}

function saveAndReload(s: GameState, storage = memoryStorage()): GameState {
  persistProgress(
    {
      dex: s.dex,
      pitzBalance: s.pitzBalance,
      ownedIngredientIds: s.ownedIngredientIds,
      inventory: s.inventory,
      starterGrantClaimedRecipeIds: s.starterGrantClaimedRecipeIds,
      unlockedForShopIngredientIds: s.unlockedForShopIngredientIds,
      discoveryHintPurchases: s.discoveryHintPurchases,
      discoveryHintFacts: s.discoveryHintFacts,
    },
    storage,
  );
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
  );
}

const reopen = (s: GameState, target: string) => act(s, { type: "START_FREE_COOK" }, { type: "SHOW_HINT", pinnedRecipeId: target });
const INFORMATIVE = TARGETS.filter((id) => guardedReserveAttributeAnswer(id, ctx)!.level !== "existence");
const EXISTENCE = TARGETS.filter((id) => guardedReserveAttributeAnswer(id, ctx)!.level === "existence");

describe("DH4-2B 構成 (structure): charge, ledger, single-shot", () => {
  it("every target: a fresh request charges exactly the shared rung (5) once and stores the D-prime facts", () => {
    for (const id of TARGETS) {
      const s = sheetOn(id, 100);
      expect(deduction(s)).toMatchObject({ nextPrice: 5, paidCount: 0, affordable: true, structureOwned: false, structureLines: [] });
      const after = act(s, ask(s, "structure"));
      expect(after.pitzBalance, id).toBe(95);
      expect(factsOf(after, id)).toEqual(structureAnswer(id, ctx)!.factIds);
      expect(deduction(after).structureOwned).toBe(true);
      expect(deduction(after).structureLines.length).toBe(structureAnswer(id, ctx)!.factIds.length);
      expect(after.hintOutcome).toBeNull();
    }
  });
  it("a double tap (same expected paid count) is STALE: charged once", () => {
    const s = sheetOn("breakfast-pizza", 100);
    const action = ask(s, "structure");
    const once = act(s, action);
    expect(act(once, action)).toBe(once);
    expect(once.pitzBalance).toBe(95);
  });
  it("asking again with a fresh paid count is free: ALREADY_OWNED or GUIDANCE_ONLY, nothing stored", () => {
    for (const id of TARGETS) {
      const once = act(sheetOn(id, 100), ask(sheetOn(id, 100), "structure"));
      const again = act(once, ask(once, "structure"));
      expect(again.pitzBalance).toBe(once.pitzBalance);
      expect(again.discoveryHintFacts).toBe(once.discoveryHintFacts);
      expect(again.hintOutcome).toBe(structureAnswer(id, ctx)!.factIds.length === 2 ? "STRUCTURE_ALREADY_OWNED" : "STRUCTURE_GUIDANCE_ONLY");
    }
  });
  it("legacy 「材料は全部で○種類」 owner: the total is never resold or stored; the view flags the archive", () => {
    let legacyCases = 0;
    for (const id of TARGETS) {
      const purchases = { [id]: 4 };
      if (!legacyOwnsIngredientTotal(id, purchases)) continue;
      legacyCases += 1;
      const s = sheetOn(id, 100, { purchases });
      expect(deduction(s).legacyStructure).toBe(true);
      expect(deduction(s).structureLines).toEqual([]);
      // A legacy line is not a 4.0 構成 answer: the card stays requestable (the clause may be told).
      expect(deduction(s).structureOwned).toBe(false);
      const after = act(s, ask(s, "structure"));
      expect(factsOf(after, id)).not.toContain(INGREDIENT_TOTAL_FACT_ID);
      if (structureAnswer(id, ctx)!.toppingTotal === null) {
        expect(after.pitzBalance).toBe(s.pitzBalance);
        expect(after.hintOutcome).toBe("STRUCTURE_GUIDANCE_ONLY");
      } else {
        expect(factsOf(after, id)).toEqual([TOPPING_TOTAL_FACT_ID]);
        expect(after.pitzBalance).toBe(s.pitzBalance - deduction(s).nextPrice);
      }
    }
    expect(legacyCases).toBeGreaterThan(0);
  });
});

describe("DH4-2B 特徴 (attribute): informative answers are charged once, existence is free", () => {
  it("informative targets: charged once, one attr: id stored, then ALREADY_OWNED for free", () => {
    expect(INFORMATIVE.length).toBeGreaterThan(0);
    for (const id of INFORMATIVE) {
      const s = sheetOn(id, 100);
      const after = act(s, ask(s, "attribute"));
      expect(after.pitzBalance).toBe(95);
      expect(factsOf(after, id)).toEqual([guardedReserveAttributeAnswer(id, ctx)!.factId]);
      expect(deduction(after)).toMatchObject({ attributeOwned: true, paidCount: 1, nextPrice: 10 });
      expect(deduction(after).attributeLines).toHaveLength(1);
      const again = act(after, ask(after, "attribute"));
      expect(again.pitzBalance).toBe(95);
      expect(again.discoveryHintFacts).toBe(after.discoveryHintFacts);
      expect(again.hintOutcome).toBe("ATTRIBUTE_ALREADY_OWNED");
    }
  });
  it("existence-only targets (OD-DH4-2-4): no charge, nothing stored, the transient outcome only", () => {
    expect(EXISTENCE.length).toBeGreaterThan(0);
    for (const id of EXISTENCE) {
      const s = sheetOn(id, 100);
      const after = act(s, ask(s, "attribute"));
      expect(after.pitzBalance).toBe(100);
      expect(after.discoveryHintFacts).toBe(s.discoveryHintFacts);
      expect(after.hintOutcome).toBe("ATTRIBUTE_EXISTENCE_ONLY");
      expect(deduction(after)).toMatchObject({ attributeOwned: false, paidCount: 0, attributeLines: [] });
      // The same request again changes nothing at all.
      expect(act(after, ask(after, "attribute"))).toBe(after);
    }
  });
});

describe("DH4-2B economy (E3, provisional shared rung)", () => {
  it("the deduction price follows the shared paid count; the 材料 price is unchanged by deduction purchases", () => {
    const s = sheetOn("capricciosa", 200);
    const m1 = buyMaterial(s);
    expect(view(m1).presentation.nextPrice).toBe(10);
    expect(deduction(m1)).toMatchObject({ paidCount: 1, nextPrice: 10 });
    const st = act(m1, ask(m1, "structure"));
    expect(st.pitzBalance).toBe(200 - 5 - 10);
    expect(deduction(st)).toMatchObject({ paidCount: 2, nextPrice: 20 });
    expect(view(st).presentation).toMatchObject({ paidCount: 1, nextPrice: 10 });
  });
  it("insufficient Pitz: unchanged state (no charge, no fact, no outcome); balance == price is enough", () => {
    for (const family of ["structure", "attribute"] as const) {
      const poor = sheetOn(INFORMATIVE[0], 4);
      expect(deduction(poor).affordable).toBe(false);
      expect(act(poor, ask(poor, family))).toBe(poor);
      const exact = sheetOn(INFORMATIVE[0], 5);
      expect(act(exact, ask(exact, family)).pitzBalance).toBe(0);
    }
  });
  it("a stale paid count after another purchase is refused, whatever the family", () => {
    const s = sheetOn("capricciosa", 100);
    const staleStructure = ask(s, "structure");
    const staleAttribute = ask(s, "attribute");
    const m1 = buyMaterial(s);
    expect(act(m1, staleStructure)).toBe(m1);
    expect(act(m1, staleAttribute)).toBe(m1);
  });
  it("every refusal returns the same state object: the reason is never surfaced", () => {
    const s = sheetOn(INFORMATIVE[0], 100);
    const refusals: GameAction[] = [
      ask(s, "structure", 7),
      ask(s, "attribute", Number.NaN),
      { type: "PURCHASE_SELECTABLE_HINT", preference: "sauce", expectedPaidCount: 0, family: "technique" as never },
    ];
    for (const a of refusals) expect(act(s, a)).toBe(s);
    const poor = sheetOn(INFORMATIVE[0], 0);
    expect(act(poor, ask(poor, "attribute"))).toBe(poor);
  });
});

describe("DH4-2B targets and progression", () => {
  it("only the session's DISCOVERABLE target: once it is discovered, a request is a no-op", () => {
    const id = INFORMATIVE[0];
    const s = sheetOn(id, 100);
    const action = ask(s, "attribute");
    const discovered = { ...s, dex: discover(["margherita", id]) };
    expect(act(discovered, action)).toBe(discovered);
  });
  it("a request needs the open sheet in a Free Cooking PREPARE", () => {
    const s = sheetOn("capricciosa", 100);
    const closed = act(s, { type: "CLOSE_HINT" });
    expect(act(closed, ask(s, "structure"))).toBe(closed);
  });
  it("Dex-0 onboarding (Margherita) never takes a deduction request", () => {
    const initial = createInitialGameState(EMPTY_DEX, ALL_IDS, 100, Object.fromEntries(FINITE.map((id) => [id, 30])), [], ALL_IDS, {}, {});
    const s = act(initial, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(s.hintSession?.targetId).toBe("margherita");
    expect(act(s, { type: "PURCHASE_SELECTABLE_HINT", preference: "sauce", expectedPaidCount: 0, family: "structure" })).toBe(s);
  });
  it("Dinner defense in depth: a family request is a no-op while a Dinner run exists", () => {
    const s = sheetOn("capricciosa", 100);
    const dinner = { ...s, dinner: {} as never };
    for (const family of ["structure", "attribute"] as const) expect(act(dinner, ask(s, family))).toBe(dinner);
  });
  it("the outcome is transient: SHOW_HINT and CLOSE_HINT clear it", () => {
    const s = sheetOn(EXISTENCE[0], 100);
    const after = act(s, ask(s, "attribute"));
    expect(after.hintOutcome).toBe("ATTRIBUTE_EXISTENCE_ONLY");
    expect(act(after, { type: "CLOSE_HINT" }).hintOutcome).toBeNull();
    expect(reopen(act(after, { type: "CLOSE_HINT" }), EXISTENCE[0]).hintOutcome).toBeNull();
  });
});

describe("DH4-2B persistence", () => {
  it("save / reload keeps the facts, the balance and the exact deduction view (privacy after persistence)", () => {
    const id = INFORMATIVE[0];
    const s = sheetOn(id, 100);
    const bought = act(s, ask(s, "structure"));
    const both = act(bought, ask(bought, "attribute"));
    const reloaded = reopen(saveAndReload(both), id);
    expect(reloaded.pitzBalance).toBe(both.pitzBalance);
    expect(reloaded.discoveryHintFacts).toEqual(both.discoveryHintFacts);
    expect(deduction(reloaded)).toEqual(deduction(both));
    expect(Object.keys(deduction(reloaded)).sort()).toEqual(
      ["affordable", "attributeLines", "attributeOwned", "legacyStructure", "nextPrice", "paidCount", "structureLines", "structureOwned"].sort(),
    );
    const names = [...INGREDIENTS.map((i) => i.nameJa), ...RECIPES.map((r) => r.nameJa)];
    for (const line of [...deduction(reloaded).structureLines, ...deduction(reloaded).attributeLines]) {
      expect(line).not.toMatch(/[？?]|残り|あと|0種類|family|group|category|existence/);
      for (const n of names) expect(line.includes(n)).toBe(false);
    }
    // Reloaded, the same requests are free and change nothing persistent.
    const again = act(reloaded, ask(reloaded, "attribute"));
    expect(again.pitzBalance).toBe(reloaded.pitzBalance);
    expect(again.discoveryHintFacts).toBe(reloaded.discoveryHintFacts);
  });
  it("unknown / future fact ids in the ledger are kept by a deduction purchase", () => {
    const id = "capricciosa";
    const s = sheetOn(id, 100, { facts: { [id]: ["tech:stretch-thin", "ing:tomato-sauce"] } });
    const after = act(s, ask(s, "structure"));
    expect(factsOf(after, id).slice(0, 2)).toEqual(["tech:stretch-thin", "ing:tomato-sauce"]);
    expect(factsOf(after, id)).toContain(INGREDIENT_TOTAL_FACT_ID);
    expect(saveAndReload(after).discoveryHintFacts[id]).toEqual(factsOf(after, id));
  });
  it("an old save (no discoveryHintFacts key) loads and can buy 構成", () => {
    const { discoveryHintFacts: _omit, ...old } = createDefaultSave();
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify({ ...old, pitzBalance: 50, discoveryHintPurchases: { capricciosa: 2 } }) });
    const save = loadSave(storage);
    const s = sheetOn("capricciosa", save.pitzBalance, { purchases: save.discoveryHintPurchases, facts: save.discoveryHintFacts });
    // Legacy rungs count in the shared paid count (OD-H3-9: never back down the ladder).
    expect(deduction(s)).toMatchObject({ paidCount: 2, nextPrice: 20 });
    expect(act(s, ask(s, "structure")).pitzBalance).toBe(30);
  });
  it("a hostile stored ledger (attr:existence, junk) is not a purchase", () => {
    const id = INFORMATIVE[0];
    const s = sheetOn(id, 100, { facts: { [id]: ["attr:existence", "attr:family:__proto__"] } });
    expect(deduction(s)).toMatchObject({ attributeOwned: false, paidCount: 0, attributeLines: [] });
    expect(act(s, ask(s, "attribute")).pitzBalance).toBe(95);
  });
  it("Full Reset clears the deduction facts with the rest of the ledger", () => {
    const storage = memoryStorage();
    const s = sheetOn("capricciosa", 100);
    saveAndReload(act(s, ask(s, "structure")), storage);
    expect(loadSave(storage).discoveryHintFacts.capricciosa).toContain(INGREDIENT_TOTAL_FACT_ID);
    resetSave(storage);
    expect(loadSave(storage)).toMatchObject({ discoveryHintFacts: {}, discoveryHintPurchases: {} });
  });
});

describe("DH4-2B x T1a (purchase timing) through the real reducer", () => {
  /** Dex {margherita + the ladder up to `step`}, owned = the ladder materials in acquisition order. */
  function ladderSheet(target: string, step: number, owned: readonly string[], pitz = 500): GameState {
    const dexIds = ["margherita", ...TARGETS.slice(0, step - 1)];
    const initial = createInitialGameState(discover(dexIds), owned, pitz, Object.fromEntries(owned.map((id) => [id, 30])), [], ALL_IDS, {}, {});
    const s = act(initial, { type: "START_FREE_COOK" }, { type: "SHOW_HINT", pinnedRecipeId: target });
    expect(s.hintSession?.targetId).toBe(target);
    return s;
  }
  it("pepperoni @6: parmigiano bought through PURCHASE_INGREDIENT after the target was makeable does not sharpen 特徴", () => {
    const owned = ownedAt(6, W1_25_DISCOVERY_LADDER).filter((id) => id !== "parmigiano");
    const before = ladderSheet("pepperoni", 6, owned);
    const bought = act(before, { type: "CLOSE_HINT" }, { type: "PURCHASE_INGREDIENT", ingredientId: "parmigiano" });
    expect(bought.ownedIngredientIds.at(-1)).toBe("parmigiano");
    const after = act(bought, { type: "START_FREE_COOK" }, { type: "SHOW_HINT", pinnedRecipeId: "pepperoni" });
    const answered = act(after, ask(after, "attribute"));
    // existence (free) exactly as before the late purchase -- never attr:category:cheese.
    expect(answered.hintOutcome).toBe("ATTRIBUTE_EXISTENCE_ONLY");
    expect(answered.pitzBalance).toBe(after.pitzBalance);
    expect(factsOf(answered, "pepperoni")).toEqual([]);
  });
  it("the same parmigiano owned BEFORE the key is a real decoy: 特徴 answers category:cheese", () => {
    const s = ladderSheet("pepperoni", 6, ownedAt(6, W1_25_DISCOVERY_LADDER));
    const answered = act(s, ask(s, "attribute"));
    expect(factsOf(answered, "pepperoni")).toEqual(["attr:category:cheese"]);
  });
  it("an order the guard cannot trust (a starter after a purchase) refuses the request: nothing charged or stored", () => {
    const owned = [...ALL_IDS.filter((id) => id !== "basil"), "basil"];
    const s = sheetOn("capricciosa", 100);
    const hostile = { ...s, ownedIngredientIds: owned };
    for (const family of ["structure", "attribute"] as const) expect(act(hostile, ask(s, family))).toBe(hostile);
  });
});

describe("DH4-2B boundaries", () => {
  it("the state helper is inert without the flag (production), whatever the input", () => {
    const s = sheetOn(INFORMATIVE[0], 100);
    for (const family of ["structure", "attribute"] as const) expect(requestDeductionHintFact(s, family, 0, false)).toBeNull();
    expect(hintSheetView(s, false)).toMatchObject({ kind: "SELECTABLE", deduction: null });
  });
  it("near-miss stays independent of the deduction ledger (OD-DH4-2-10)", () => {
    const sources = import.meta.glob<string>("../logic/discovery/nearMiss.ts", { query: "?raw", import: "default", eager: true });
    const text = Object.values(sources)[0];
    expect(text).toBeTruthy();
    expect(text).not.toMatch(/deduction|meta:|attr:|discoveryHintFacts/);
  });
});
