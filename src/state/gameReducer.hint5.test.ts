import { describe, expect, it, vi } from "vitest";
import { openHintSheetOn } from "./testSupport/hintSheetOpen";

/**
 * Discovery Hint 5.0 (Issue #292), H5-2: the ladder through the real reducer with the flag ON (mocked
 * here; it is off in every build). The H5-1 pure authority decides. The reducer applies one patch
 * (Pitz + `discoveryHintFacts`) or returns `state` unchanged. The flag-off parity is
 * ./gameReducer.hint5.flagOff.test.ts.
 */
vi.mock("../logic/discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: true }));

const { INGREDIENTS, STARTER_INGREDIENT_IDS } = await import("../data/ingredients");
const { RECIPES } = await import("../data/recipes");
const { EMPTY_DEX, registerScoreToDex } = await import("./dex");
const { hint5SheetView, hintSheetView } = await import("./discoveryHint");
const { createInitialGameState, gameReducer } = await import("./gameReducer");
const { loadSave, persistProgress, resetSave } = await import("./persistence");
const { ALL_INGREDIENT_IDS: ALL_IDS } = await import("../logic/discovery/testSupport/deductionInversion");
const { HINT5_RUNG_PRICE, buildHint5Ladder, hint5EmptyFixedRungs } = await import("../logic/discovery/hint5Ladder");
const { INGREDIENT_TOTAL_FACT_ID } = await import("../logic/discovery/deductionHint");

type GameState = ReturnType<typeof createInitialGameState>;
type GameAction = Parameters<typeof gameReducer>[1];
type StorageLike = Parameters<typeof loadSave>[0] & object;

const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);

function discover(ids: readonly string[]) {
  let dex = EMPTY_DEX;
  for (const id of ids) dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  return dex;
}

/** Dex {margherita}, every material owned and stocked, the sheet open on `target` (a Dex pin). */
function sheetOn(target: string, pitz: number, facts: Record<string, readonly string[]> = {}, purchases: Record<string, number> = {}): GameState {
  const initial = createInitialGameState(discover(["margherita"]), ALL_IDS, pitz, Object.fromEntries(FINITE.map((id) => [id, 30])), [], ALL_IDS, purchases, facts);
  const s = openHintSheetOn(initial, target);
  expect(s.hintSession?.targetId).toBe(target);
  return s;
}

const next = (s: GameState) => hint5SheetView(s)!.next;
const buy = (s: GameState): GameState => act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: next(s)!.rungIndex });
const facts = (s: GameState, id: string) => s.discoveryHintFacts[id] ?? [];

function memoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } as StorageLike;
}

function persist(s: GameState, storage: StorageLike) {
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
}

function reload(storage: StorageLike): GameState {
  const save = loadSave(storage);
  return createInitialGameState(save.dex, save.ownedIngredientIds, save.pitzBalance, save.inventory, save.starterGrantClaimedRecipeIds, save.unlockedForShopIngredientIds, save.discoveryHintPurchases, save.discoveryHintFacts);
}

/** OD-H5-M2 = all 25 (round 6): every paid target, the 「なし」 targets included. */
const TARGETS = RECIPES.filter((r) => r.id !== "margherita").map((r) => r.id);
const NONE_TARGETS = TARGETS.filter((id) => hint5EmptyFixedRungs(id)!.length > 0);

describe("flag ON: the ladder through the reducer", () => {
  it("hawaiian: rung by rung at the P-C price, appending ing: / meta: / cls: facts, then complete", () => {
    let s = sheetOn("hawaiian", 100);
    expect(next(s)).toMatchObject({ rungIndex: 1, kind: "SAUCE", labelJa: "ヒント1: ソース", price: 10, affordable: true });
    const balances: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      s = buy(s);
      balances.push(s.pitzBalance);
    }
    expect(balances).toEqual([90, 80, 70, 65, 60]);
    expect(facts(s, "hawaiian")).toEqual([
      "ing:tomato-sauce",
      "h5:sauce",
      "ing:mozzarella",
      "h5:cheese",
      "ing:pineapple",
      "h5:key",
      INGREDIENT_TOTAL_FACT_ID,
      "h5:structure",
      "cls:ham",
    ]);
    const view = hint5SheetView(s)!;
    expect(view.next).toBeNull();
    expect(view.board[4]).toMatchObject({ kind: "SUB_CLASS", ordinal: 1, classView: { family: "meat", lineJa: "\u{1F969} 肉系" } });
    // Complete: asking again changes nothing.
    expect(act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: 6 })).toBe(s);
  });

  it("every target (all 24 paid, 「なし」 rungs included): the full ladder charges exactly the P-C total, and the balance never goes negative", () => {
    for (const id of TARGETS) {
      let s = sheetOn(id, 1000);
      let guard = 0;
      while (next(s) && guard++ < 20) {
        const before = s;
        s = buy(s);
        expect(s, id).not.toBe(before);
        expect(s.pitzBalance, id).toBeGreaterThanOrEqual(0);
      }
      const total = buildHint5Ladder(id)!.rungs.reduce((sum, r) => sum + HINT5_RUNG_PRICE[r.kind], 0);
      expect(1000 - s.pitzBalance, id).toBe(total);
    }
  });

  it("only the next rung is purchasable: any other index is refused with no change", () => {
    const s = sheetOn("capricciosa", 100);
    for (const expectedRungIndex of [0, 2, 3, 5, 7, 99, -1, Number.NaN]) expect(act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex })).toBe(s);
  });

  it("a double tap / stale sheet charges once", () => {
    const s = sheetOn("capricciosa", 100);
    const action: GameAction = { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: 1 };
    const once = act(s, action);
    expect(once.pitzBalance).toBe(90);
    expect(act(once, action)).toBe(once);
  });

  it("insufficient Pitz is refused with no change, uniformly for every target", () => {
    for (const id of TARGETS) {
      const s = sheetOn(id, 9);
      expect(act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: 1 }), id).toBe(s);
    }
    let s = sheetOn("hawaiian", 30);
    s = buy(buy(buy(s))); // 30 -> 0
    expect(s.pitzBalance).toBe(0);
    expect(act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: 4 })).toBe(s);
  });

  it("round 6 (OD-H5-P4-CHEESE / P4b): an empty CHEESE / KEY rung is bought like any other: 10 Pitz, its completion record only, then 「なし」 on the board", () => {
    expect(NONE_TARGETS.sort()).toEqual(["fugazza", "marinara", "pesto-tonno", "pizza-bianca", "puttanesca-pizza", "quattro-formaggi"]);
    for (const [id, emptyIndex, marker] of [["marinara", 2, "h5:cheese"], ["fugazza", 2, "h5:cheese"], ["pizza-bianca", 2, "h5:cheese"], ["pesto-tonno", 2, "h5:cheese"], ["puttanesca-pizza", 2, "h5:cheese"], ["quattro-formaggi", 3, "h5:key"]] as const) {
      let s = sheetOn(id, 100);
      for (let i = 1; i < emptyIndex; i += 1) s = buy(s);
      const before = hint5SheetView(s)!;
      expect(before.next, id).toMatchObject({ rungIndex: emptyIndex, price: 10, affordable: true });
      expect(before.board.some((e) => "none" in e && e.none), id).toBe(false);
      const ledger = facts(s, id);
      const after = buy(s);
      expect(after.pitzBalance, id).toBe(s.pitzBalance - 10);
      expect(after.hintOutcome, id).toBeNull();
      expect(facts(after, id), id).toEqual([...ledger, marker]);
      expect(hint5SheetView(after)!.board.at(-1), id).toMatchObject({ rungIndex: emptyIndex, ingredientIds: [], none: true });
      // Repeating the same request charges nothing.
      expect(act(after, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: emptyIndex }), id).toBe(after);
    }
  });

  it("M3 + P4-CHEESE: a legacy Economy 1.0 count line 「チーズは使わないみたい」 completes marinara's cheese rung for 0 Pitz after the request", () => {
    let s = sheetOn("marinara", 100, {}, { marinara: 4 });
    s = buy(s); // sauce (named by the legacy line) -> 0
    expect(s.pitzBalance).toBe(100);
    expect(next(s)).toMatchObject({ rungIndex: 2, kind: "CHEESE", price: 10 });
    s = buy(s);
    expect(s.pitzBalance).toBe(100);
    expect(s.hintOutcome).toBe("HINT5_ALREADY_KNOWN");
    expect(facts(s, "marinara")).toEqual(["h5:sauce", "h5:cheese"]);
  });

  it("the 材料 / 構成 / 特徴 purchases are refused while the ladder is on (sub-topping names are never sold, OD-H5-C3)", () => {
    const s = sheetOn("capricciosa", 100);
    for (const family of [undefined, "material", "structure", "attribute"] as const) {
      expect(act(s, { type: "PURCHASE_SELECTABLE_HINT", preference: "topping", expectedPaidCount: 0, ...(family ? { family } : {}) })).toBe(s);
    }
    // The existing sheet view is unchanged (the UI is H5-3's).
    expect(hintSheetView(s).kind).toBe("SELECTABLE");
  });

  it("Dex-0 Margherita keeps the free onboarding reveal; the ladder never charges it", () => {
    const initial = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 50, Object.fromEntries(FINITE.map((id) => [id, 30])), [], ALL_IDS, {}, {}); // a fresh Dex-0 save: Margherita is the only DISCOVERABLE recipe (D-1)
    const s = act(initial, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(s.hintSession?.targetId).toBe("margherita");
    expect(hint5SheetView(s)).toBeNull();
    expect(act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: 1 })).toBe(s);
    const revealed = act(s, { type: "PURCHASE_DISCOVERY_HINT", level: 1 });
    expect(revealed.pitzBalance).toBe(50);
    expect(revealed.discoveryHintFacts).toEqual(s.discoveryHintFacts);
  });

  it("outside a Free Cooking PREPARE with the sheet open, the action is ignored", () => {
    const s = sheetOn("hawaiian", 100);
    expect(act(s, { type: "CLOSE_HINT" }, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: 1 }).pitzBalance).toBe(100);
    const guided = act(createInitialGameState(discover(["margherita"]), ALL_IDS, 100, {}, [], ALL_IDS, {}, {}), { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: 1 });
    expect(guided.pitzBalance).toBe(100);
  });
});

describe("flag ON: existing facts, unknown ids, persistence, Full Reset", () => {
  it("existing and unknown / future facts are kept verbatim; only new ids are appended; other recipes' ledgers are untouched", () => {
    const hawaiian = ["attr:group:protein", "tech:no-sauce", "shape:round:x", "ing:tomato-sauce", "meta:topping-total"];
    const other = ["ing:mushroom", "attr:family:vegetable"];
    const future = ["cls:future-truffle"];
    const s = sheetOn("hawaiian", 100, { hawaiian, capricciosa: other, "future-pizza": future });
    // M3: the stored sauce name does not complete rung 1 before a request (same view as a fresh save).
    expect(next(s)).toMatchObject({ rungIndex: 1, price: 10 });
    const known = buy(s);
    expect(known.pitzBalance).toBe(100);
    expect(known.hintOutcome).toBe("HINT5_ALREADY_KNOWN");
    expect(facts(known, "hawaiian")).toEqual([...hawaiian, "h5:sauce"]);
    const after = buy(known);
    expect(facts(after, "hawaiian")).toEqual([...hawaiian, "h5:sauce", "ing:mozzarella", "h5:cheese"]);
    expect(after.hintOutcome).toBeNull();
    expect(after.discoveryHintFacts.capricciosa).toBe(s.discoveryHintFacts.capricciosa);
    expect(after.discoveryHintFacts["future-pizza"]).toEqual(future);
    expect(after.pitzBalance).toBe(90);
  });

  it("M3 legacy facts: the same pre-purchase view as a fresh save; ALL known -> 0 Pitz after the request; PARTIAL / NONE -> the normal price", () => {
    const stored = ["ing:tomato-sauce", "ing:mozzarella", "ing:pineapple", INGREDIENT_TOTAL_FACT_ID, "ing:ham"];
    let s = sheetOn("hawaiian", 100, { hawaiian: stored });
    const fresh = sheetOn("hawaiian", 100);
    expect({ ...hint5SheetView(s)!, legacyKnownIngredientIds: [] }).toEqual({ ...hint5SheetView(fresh)!, legacyKnownIngredientIds: [] });
    for (let i = 0; i < 5; i += 1) {
      expect(next(s)!.price).toBeGreaterThan(0); // never 0 before the request
      s = buy(s);
      expect(s.pitzBalance).toBe(100);
      expect(s.hintOutcome).toBe("HINT5_ALREADY_KNOWN");
    }
    expect(next(s)).toBeNull();
    expect(facts(s, "hawaiian")).toEqual([...stored, "h5:sauce", "h5:cheese", "h5:key", "h5:structure", "cls:ham"]);
    // PARTIAL: parmigiana with mozzarella known -> the cheese rung costs 10 and discloses parmigiano.
    let p = sheetOn("parmigiana-pizza", 100, { "parmigiana-pizza": ["ing:mozzarella"] });
    p = buy(p); // sauce: not known -> 10
    expect(p.pitzBalance).toBe(90);
    p = buy(p); // cheese: partial -> 10
    expect(p.pitzBalance).toBe(80);
    expect(p.hintOutcome).toBeNull();
    expect(facts(p, "parmigiana-pizza")).toEqual(["ing:mozzarella", "ing:tomato-sauce", "h5:sauce", "ing:parmigiano", "h5:cheese"]);
    // Economy 1.0 legacy ledger (level 3: the sauce + key names and the count line).
    let legacy = sheetOn("hawaiian", 100, {}, { hawaiian: 3 });
    expect(next(legacy)).toMatchObject({ rungIndex: 1, kind: "SAUCE", price: 10 });
    const balances: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      legacy = buy(legacy);
      balances.push(legacy.pitzBalance);
    }
    expect(balances).toEqual([100, 90, 90, 90, 85]);
  });

  it("purchases survive a save / reload with no recharge, and the echoed old index is stale after reload", () => {
    const storage = memoryStorage();
    let s = sheetOn("meat-lovers", 100);
    for (let i = 0; i < 6; i += 1) s = buy(s);
    expect(s.pitzBalance).toBe(100 - 45);
    expect(facts(s, "meat-lovers").filter((id) => id.startsWith("cls:"))).toEqual(["cls:bacon", "cls:pepperoni"]);
    persist(s, storage);
    const reloaded = act(reload(storage), { type: "START_FREE_COOK" }, { type: "SHOW_HINT", pinnedRecipeId: "meat-lovers" });
    expect(reloaded.pitzBalance).toBe(55);
    expect(facts(reloaded, "meat-lovers")).toEqual(facts(s, "meat-lovers"));
    expect(next(reloaded)).toMatchObject({ rungIndex: 7, kind: "SUB_CLASS" });
    expect(act(reloaded, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: 6 })).toBe(reloaded);
    const last = buy(reloaded);
    expect(last.pitzBalance).toBe(50);
    expect(facts(last, "meat-lovers").at(-1)).toBe("cls:sausage");
  });

  it("unknown fact kinds and cls: ids survive the save round trip", () => {
    const storage = memoryStorage();
    const s = sheetOn("hawaiian", 100, { hawaiian: ["tech:no-sauce", "cls:ham", "attr:group:protein"] });
    persist(s, storage);
    expect(reload(storage).discoveryHintFacts.hawaiian).toEqual(["tech:no-sauce", "cls:ham", "attr:group:protein"]);
  });

  it("round 6: a bought 「なし」 survives save / reload with no recharge (quattro-formaggi key, marinara cheese)", () => {
    for (const [id, rungs] of [["quattro-formaggi", 3], ["marinara", 2]] as const) {
      const storage = memoryStorage();
      let s = sheetOn(id, 100);
      for (let i = 0; i < rungs; i += 1) s = buy(s);
      persist(s, storage);
      const reloaded = act(reload(storage), { type: "START_FREE_COOK" }, { type: "SHOW_HINT", pinnedRecipeId: id });
      expect(reloaded.pitzBalance, id).toBe(s.pitzBalance);
      expect(facts(reloaded, id), id).toEqual(facts(s, id));
      expect(hint5SheetView(reloaded)!.board.find((e) => "none" in e && e.none), id).toMatchObject({ rungIndex: rungs, none: true });
      expect(next(reloaded)!.rungIndex, id).toBe(rungs + 1);
      expect(act(reloaded, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: rungs }), id).toBe(reloaded);
      // Full Reset: the 「なし」 is gone and the ladder starts again.
      expect(resetSave(storage)).toBe(true);
      expect(reload(storage).discoveryHintFacts).toEqual({});
    }
  });

  it("Full Reset clears every Hint 5.0 fact: the ladder starts again at rung 1", () => {
    const storage = memoryStorage();
    let s = sheetOn("hawaiian", 100);
    s = buy(buy(s));
    persist(s, storage);
    expect(reload(storage).discoveryHintFacts.hawaiian).toEqual(["ing:tomato-sauce", "h5:sauce", "ing:mozzarella", "h5:cheese"]);
    expect(resetSave(storage)).toBe(true);
    const fresh = reload(storage);
    expect(fresh.discoveryHintFacts).toEqual({});
    expect(fresh.pitzBalance).toBe(0);
  });
});
