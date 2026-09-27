import { describe, expect, it } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { buildHintSteps } from "../logic/discovery/hintSteps";
import { discoverableHintCandidates } from "../logic/discovery/hintTarget";
import {
  buildSelectableHintModel,
  HINT_CATEGORIES,
  hintFactId,
  purchaseSelectableHint,
  selectableHintPresentation,
  type HintCategory,
} from "../logic/discovery/selectableHint";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { hintSheetView, type HintSheetView } from "./discoveryHint";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { createDefaultSave, loadSave, persistProgress, resetSave, SAVE_STORAGE_KEY, type StorageLike } from "./persistence";

/**
 * Discovery Hint 3.0 (Issue #238), H3-3: PURCHASE_SELECTABLE_HINT through the real reducer.
 * H3-1's `purchaseSelectableHint` is the authority, fed from both ledgers by H3-2's
 * `selectableHintSavedState`; the reducer only applies the patch (Pitz + `discoveryHintFacts`) or
 * returns `state` unchanged. The numbered cases follow the H3-3 test matrix (Result Report §15).
 */

function discover(ids: readonly string[]): DexState {
  let dex = EMPTY_DEX;
  for (const id of ids) {
    dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return dex;
}

const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);

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

const paid = (s: GameState) => view(s).presentation.paidCount;
const buy = (s: GameState, preference: HintCategory = "sauce", expected = paid(s)): GameAction => ({
  type: "PURCHASE_SELECTABLE_HINT",
  preference,
  expectedPaidCount: expected,
});
const buyOnce = (s: GameState, preference: HintCategory = "sauce") => act(s, buy(s, preference));
const chips = (s: GameState) => view(s).presentation.rows.flatMap((r) => r.revealed.map((c) => c.ingredientId));
const model = (id: string) => buildSelectableHintModel(id, { discoveredCount: 1 })!;

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { json(): Record<string, unknown> } {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    json: () => JSON.parse(store.get(SAVE_STORAGE_KEY) ?? "{}") as Record<string, unknown>,
  };
}

/** What App.tsx's progression effect saves, then what its load path hydrates. */
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

describe("PURCHASE_SELECTABLE_HINT: the transaction (matrix 1-9)", () => {
  it("1 a fresh user sees H0, only the free key, price 5, nothing bought", () => {
    const s = sheetOn("breakfast-pizza", 100);
    const v = view(s);
    expect(v.existenceText).toBe(buildHintSteps(RECIPES.find((r) => r.id === "breakfast-pizza")!, { discoveredCount: 1 })[0].textJa);
    expect(chips(s)).toEqual(["bacon"]);
    expect(v.presentation).toMatchObject({ nextPrice: 5, paidCount: 0, pitzBalance: 100, affordable: true });
    expect(v.grandfatheredSteps).toEqual([]);
    expect(v.outcome).toBeNull();
    expect(s.discoveryHintFacts).toEqual({});
  });

  it("2 + 3 the first purchase adds exactly one fact and debits exactly 5, once", () => {
    const s = sheetOn("breakfast-pizza", 100);
    const after = buyOnce(s, "sauce");
    expect(after.pitzBalance).toBe(95);
    expect(after.discoveryHintFacts).toEqual({ "breakfast-pizza": ["ing:tomato-sauce"] });
    expect(after.discoveryHintPurchases).toEqual({});
    expect(chips(after).sort()).toEqual(["bacon", "tomato-sauce"]);
    expect(after.phase).toBe("PREPARE");
    expect(after.hintSheetOpen).toBe(true);
  });

  it("4 a reload keeps the fact, never resells it, and keeps the next price", () => {
    const bought = buyOnce(sheetOn("breakfast-pizza", 100), "sauce");
    const reloaded = reopen(saveAndReload(bought), "breakfast-pizza");
    expect(reloaded.discoveryHintFacts).toEqual({ "breakfast-pizza": ["ing:tomato-sauce"] });
    expect(reloaded.pitzBalance).toBe(95);
    expect(chips(reloaded).sort()).toEqual(["bacon", "tomato-sauce"]);
    expect(view(reloaded).presentation).toMatchObject({ paidCount: 1, nextPrice: 10 });
    // Asking for the sauce again sells the next fact (the cheese), never the tomato sauce twice.
    const again = buyOnce(reloaded, "sauce");
    expect(again.discoveryHintFacts["breakfast-pizza"]).toEqual(["ing:tomato-sauce", "ing:mozzarella"]);
    expect(again.pitzBalance).toBe(85);
  });

  it("4b without a session a reload re-targets the recipe the player bought facts for (sticky)", () => {
    const bought = buyOnce(sheetOn("capricciosa", 100), "topping");
    const reloaded = act(saveAndReload(bought), { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(discoverableHintCandidates(reloaded)[0].id).not.toBe("capricciosa");
    expect(reloaded.hintSession?.targetId).toBe("capricciosa");
  });

  it("5 no fact is ever sold twice: buying past the end answers GUIDANCE_ONLY", () => {
    let s = sheetOn("capricciosa", 1000);
    for (let i = 0; i < 10; i += 1) s = buyOnce(s, HINT_CATEGORIES[i % 3]);
    const ledger = s.discoveryHintFacts.capricciosa;
    expect(new Set(ledger).size).toBe(ledger.length);
    expect([...ledger].sort()).toEqual(model("capricciosa").purchasableFacts.map((f) => f.id).sort());
    expect(view(s).outcome).toBe("GUIDANCE_ONLY");
    expect(s.pitzBalance).toBe(1000 - 75);
  });

  it("6 the second purchase costs the next rung (10), the third 20, capped by the recipe", () => {
    let s = sheetOn("capricciosa", 1000);
    const spent: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const before = s.pitzBalance;
      expect(view(s).presentation.nextPrice).toBe([5, 10, 20, 40][i]);
      s = buyOnce(s, "topping");
      spent.push(before - s.pitzBalance);
    }
    expect(spent).toEqual([5, 10, 20, 40]);
  });

  it("7 insufficient Pitz: disabled offer, nothing changes", () => {
    const s = sheetOn("breakfast-pizza", 4);
    expect(view(s).presentation).toMatchObject({ nextPrice: 5, affordable: false });
    expect(act(s, buy(s))).toBe(s);
    const exact = buyOnce(sheetOn("breakfast-pizza", 5));
    expect(exact.pitzBalance).toBe(0);
    expect(act(exact, buy(exact))).toBe(exact);
    expect(view(exact).presentation).toMatchObject({ nextPrice: 10, affordable: false });
  });

  it("8 a double tap (the same paid count twice) is charged once", () => {
    const s = sheetOn("breakfast-pizza", 100);
    const tap = buy(s);
    const once = act(s, tap);
    expect(act(once, tap)).toBe(once);
    expect(act(once, tap, tap, tap)).toBe(once);
    expect(once.pitzBalance).toBe(95);
  });

  it("9 a stale / concurrent request (another paid count) changes nothing", () => {
    const s = sheetOn("breakfast-pizza", 100);
    for (const expected of [1, 2, -1, 99]) expect(act(s, buy(s, "sauce", expected))).toBe(s);
    const once = buyOnce(s);
    expect(act(once, buy(once, "cheese", 0))).toBe(once);
    // A request built for the previous target after the session moved on is stale too.
    const moved = act(once, { type: "SHOW_HINT", pinnedRecipeId: "capricciosa" });
    expect(act(moved, buy(moved, "cheese", 1))).toBe(moved);
  });
});

describe("category preference (OD-H3-14, matrix 10-11)", () => {
  it("10 a category with a fact left is served first", () => {
    const s = sheetOn("capricciosa", 100);
    expect(buyOnce(s, "topping").discoveryHintFacts.capricciosa).toEqual(["ing:mushroom"]);
    expect(buyOnce(s, "cheese").discoveryHintFacts.capricciosa).toEqual(["ing:mozzarella"]);
    expect(buyOnce(s, "sauce").discoveryHintFacts.capricciosa).toEqual(["ing:tomato-sauce"]);
  });

  it("11 otherwise the fallback is sauce -> cheese -> topping, still one fact at the normal price", () => {
    // fugazza sells one topping only (onion).
    const s = sheetOn("fugazza", 100);
    for (const preference of HINT_CATEGORIES) {
      const after = buyOnce(s, preference);
      expect(after.discoveryHintFacts.fugazza).toEqual(["ing:onion"]);
      expect(after.pitzBalance).toBe(95);
    }
    // capricciosa, sauce and cheese bought: a sauce request falls back to the first topping.
    let c = sheetOn("capricciosa", 100);
    c = buyOnce(buyOnce(c, "sauce"), "cheese");
    expect(buyOnce(c, "sauce").discoveryHintFacts.capricciosa).toEqual(["ing:tomato-sauce", "ing:mozzarella", "ing:mushroom"]);
  });
});

describe("zero-fact GUIDANCE_ONLY (OD-H3-17, matrix 12-14)", () => {
  it("12 + 13 pizza-bianca: price 0, nothing but the session flag changes, nothing to persist", () => {
    const s = sheetOn("pizza-bianca", 100, { purchases: { funghi: 2 }, facts: { funghi: ["ing:x"] } });
    const after = act(s, buy(s, "sauce"));
    expect(after.pitzBalance).toBe(100);
    expect(after.discoveryHintFacts).toBe(s.discoveryHintFacts);
    expect(after.discoveryHintPurchases).toBe(s.discoveryHintPurchases);
    expect(after.hintOutcome).toBe("GUIDANCE_ONLY");
    expect(view(after).outcome).toBe("GUIDANCE_ONLY");
    // A repeat is a no-op; closing and re-opening clears the line.
    expect(act(after, buy(after, "topping"))).toBe(after);
    expect(act(after, { type: "CLOSE_HINT" }).hintOutcome).toBeNull();
    expect(reopen(after, "pizza-bianca").hintOutcome).toBeNull();
    // What would be saved is identical before and after.
    const a = memoryStorage();
    const b = memoryStorage();
    saveAndReload(s, a);
    saveAndReload(after, b);
    expect(b.json()).toEqual(a.json());
  });

  it("13b before the request the pizza-bianca sheet looks like any other (price 5, no leak)", () => {
    const v = view(sheetOn("pizza-bianca", 100));
    const w = view(sheetOn("funghi", 100));
    expect(v.presentation.nextPrice).toBe(w.presentation.nextPrice);
    expect(v.presentation.preferences).toEqual(w.presentation.preferences);
    expect(v.presentation.rows.map((r) => r.category)).toEqual(w.presentation.rows.map((r) => r.category));
    expect(v.outcome).toBeNull();
  });

  it("14 no recipe special case: any exhausted target and a synthetic zero-fact recipe answer the same way", () => {
    let s = sheetOn("funghi", 100);
    s = buyOnce(s);
    const exhausted = act(s, buy(s, "cheese"));
    expect(exhausted.hintOutcome).toBe("GUIDANCE_ONLY");
    expect(exhausted.pitzBalance).toBe(s.pitzBalance);
    const synthetic = [{ ...RECIPES.find((r) => r.id === "pizza-bianca")!, id: "future-bianca" as never }];
    const m = buildSelectableHintModel("future-bianca", { discoveredCount: 3 }, synthetic)!;
    expect(purchaseSelectableHint({ model: m, purchasedFactIds: [], preferences: ["cheese"], expectedPaidCount: 0, pitzBalance: 100 })).toMatchObject({
      success: false,
      reason: "GUIDANCE_ONLY",
      price: 0,
    });
  });
});

describe("legacy Economy 1.0 progress (OD-H3-9, matrix 15-21)", () => {
  it("15 legacy H1 -> next price 10, the key still free, the legacy field never moves", () => {
    const s = sheetOn("breakfast-pizza", 100, { purchases: { "breakfast-pizza": 1 } });
    expect(view(s).presentation).toMatchObject({ paidCount: 1, nextPrice: 10 });
    const after = buyOnce(s);
    expect(after.pitzBalance).toBe(90);
    expect(after.discoveryHintPurchases).toEqual({ "breakfast-pizza": 1 });
    expect(after.discoveryHintFacts).toEqual({ "breakfast-pizza": ["ing:tomato-sauce"] });
  });

  it("16 legacy H2 -> its sauce fact owned (shown, never resold), next price 20", () => {
    const s = sheetOn("breakfast-pizza", 100, { purchases: { "breakfast-pizza": 2 } });
    expect(chips(s).sort()).toEqual(["bacon", "tomato-sauce"]);
    expect(view(s).presentation).toMatchObject({ paidCount: 2, nextPrice: 20 });
    const after = buyOnce(s, "sauce");
    expect(after.discoveryHintFacts["breakfast-pizza"]).toEqual(["ing:mozzarella"]);
    expect(after.pitzBalance).toBe(80);
    expect(after.discoveryHintPurchases).toEqual({ "breakfast-pizza": 2 });
  });

  it("17 legacy H3 -> next price 40 (the rung continues, the count line is not a fact)", () => {
    const s = sheetOn("breakfast-pizza", 100, { purchases: { "breakfast-pizza": 3 } });
    expect(view(s).presentation).toMatchObject({ paidCount: 3, nextPrice: 40 });
    const after = buyOnce(s, "cheese");
    expect(after.pitzBalance).toBe(60);
    expect(after.discoveryHintFacts["breakfast-pizza"]).toEqual(["ing:mozzarella"]);
  });

  it("18 legacy H4 (paid out) -> everything owned, never charged again", () => {
    const s = sheetOn("breakfast-pizza", 100, { purchases: { "breakfast-pizza": 4 } });
    expect(chips(s).sort()).toEqual(["bacon", "mozzarella", "tomato-sauce"]);
    const after = act(s, buy(s, "topping"));
    expect(after.pitzBalance).toBe(100);
    expect(after.hintOutcome).toBe("GUIDANCE_ONLY");
    expect(after.discoveryHintFacts).toEqual({});
    // capricciosa H4 on a 4-rung ladder: same, whatever the preference.
    const c = sheetOn("capricciosa", 7, { purchases: { capricciosa: 4 } });
    for (const preference of HINT_CATEGORIES) expect(act(c, buy(c, preference)).pitzBalance).toBe(7);
  });

  it("19 grandfatheredSteps reach the view model: the player's own H3 count line is kept", () => {
    const s = sheetOn("breakfast-pizza", 100, { purchases: { "breakfast-pizza": 3 } });
    const line = buildHintSteps(RECIPES.find((r) => r.id === "breakfast-pizza")!, { discoveredCount: 1 }).find((x) => x.level === 3)!;
    expect(view(s).grandfatheredSteps).toEqual([line]);
    const bianca = sheetOn("pizza-bianca", 100, { purchases: { "pizza-bianca": 3 } });
    expect(view(bianca).grandfatheredSteps.map((x) => x.textJa)).toEqual(["ソースはトマトじゃないみたい", "材料は全部で2種類。チーズは使わないみたい"]);
    // Kept after a purchase and a reload.
    const reloaded = reopen(saveAndReload(buyOnce(s)), "breakfast-pizza");
    expect(view(reloaded).grandfatheredSteps).toEqual([line]);
  });

  it("20 grandfatheredSteps are not priced, not sold, not a fact, not a category", () => {
    const withLine = sheetOn("breakfast-pizza", 100, { purchases: { "breakfast-pizza": 3 } });
    // paidCount is the 3 paid rungs -- not 3 + the grandfathered line.
    expect(view(withLine).presentation.paidCount).toBe(3);
    const after = buyOnce(withLine);
    expect(after.discoveryHintFacts["breakfast-pizza"].every((id) => id.startsWith("ing:"))).toBe(true);
    expect(chips(after)).not.toContain(undefined);
    // pizza-bianca H3: two grandfathered lines, still nothing for sale and nothing charged.
    const bianca = sheetOn("pizza-bianca", 100, { purchases: { "pizza-bianca": 3 } });
    expect(act(bianca, buy(bianca)).pitzBalance).toBe(100);
  });

  it("21 unknown / future / reserved ids are kept in the ledger but never priced or shown", () => {
    const stored = ["ing:no-such-thing", "ing:egg", "future:v9"];
    const s = sheetOn("breakfast-pizza", 100, { facts: { "breakfast-pizza": stored } });
    expect(view(s).presentation).toMatchObject({ paidCount: 0, nextPrice: 5 });
    expect(chips(s)).toEqual(["bacon"]);
    const after = buyOnce(s);
    expect(after.pitzBalance).toBe(95);
    expect(after.discoveryHintFacts["breakfast-pizza"]).toEqual([...stored, "ing:tomato-sauce"]);
    expect(chips(after)).not.toContain("egg");
  });
});

describe("hostile input and rejected actions (matrix 22, 37, 38)", () => {
  it("22 a hostile preference / paid count changes nothing", () => {
    const s = sheetOn("breakfast-pizza", 100);
    const hostile: unknown[] = ["SAUCE", "__proto__", "constructor", "", null, undefined, 3, ["sauce"], "dough"];
    for (const preference of hostile) {
      expect(act(s, { type: "PURCHASE_SELECTABLE_HINT", preference: preference as HintCategory, expectedPaidCount: 0 })).toBe(s);
    }
    for (const expected of [Number.NaN, Infinity, 0.5, "0" as unknown as number, null as unknown as number]) {
      expect(act(s, buy(s, "sauce", expected))).toBe(s);
    }
  });

  it("22b a hostile save ledger (prototype keys, junk values) neither crashes nor counts", () => {
    const facts = JSON.parse('{"__proto__":["ing:tomato-sauce"],"breakfast-pizza":[1,null,"ing:egg",{"a":1}]}') as Record<string, string[]>;
    const s = sheetOn("breakfast-pizza", 100, { facts });
    expect(view(s).presentation.paidCount).toBe(0);
    const after = buyOnce(s);
    expect(after.pitzBalance).toBe(95);
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, "breakfast-pizza")).toBe(false);
  });

  it("37 Pitz never goes negative, whatever is pressed", () => {
    for (const pitz of [0, 4, 5, 14, 15, 34, 35, 74]) {
      let s = sheetOn("capricciosa", pitz);
      for (let i = 0; i < 8; i += 1) s = buyOnce(s, HINT_CATEGORIES[i % 3]);
      expect(s.pitzBalance).toBeGreaterThanOrEqual(0);
    }
  });

  it("38 ignored with the sheet closed, outside PREPARE, in a guided / Lunch Rush round, or on a stale session", () => {
    const s = sheetOn("breakfast-pizza", 100);
    const closed = act(s, { type: "CLOSE_HINT" });
    expect(act(closed, buy(s))).toBe(closed);
    const baked = act(s, { type: "START_BAKE" });
    expect(act(baked, buy(s))).toBe(baked);
    const guided = act(createInitialGameState(discover(["margherita"]), STARTER_INGREDIENT_IDS, 100), { type: "BEGIN_PREPARE" }, { type: "SHOW_HINT" });
    expect(act(guided, { type: "PURCHASE_SELECTABLE_HINT", preference: "sauce", expectedPaidCount: 0 })).toBe(guided);
    const mission = act(s, { type: "MISSION_RESET_ORDER" }, { type: "BEGIN_PREPARE" }, { type: "SHOW_HINT" });
    expect(act(mission, buy(s))).toBe(mission);
    const discovered: GameState = { ...s, dex: discover(["margherita", "breakfast-pizza"]) };
    expect(act(discovered, buy(s))).toBe(discovered);
    const noSession: GameState = { ...s, hintSession: null };
    expect(act(noSession, buy(s))).toBe(noSession);
    const noStock: GameState = { ...s, inventory: { ...s.inventory, bacon: 0, egg: 0 } };
    expect(act(noStock, buy(s))).toBe(noStock);
  });

  it("38b the legacy PURCHASE_DISCOVERY_HINT no longer sells Economy 1.0 levels outside the onboarding", () => {
    const s = sheetOn("breakfast-pizza", 100);
    for (const level of [1, 2, 3, 4]) expect(act(s, { type: "PURCHASE_DISCOVERY_HINT", level })).toBe(s);
    const legacy = sheetOn("breakfast-pizza", 100, { purchases: { "breakfast-pizza": 1 } });
    expect(act(legacy, { type: "PURCHASE_DISCOVERY_HINT", level: 2 })).toBe(legacy);
  });
});

describe("Dex 0 (matrix 23-24)", () => {
  it("23 the Dex-0 Margherita onboarding keeps its free Hint 2.0 sheet; the Selectable action is refused there", () => {
    const s = act(createInitialGameState(undefined, undefined, 50), { type: "BEGIN_PREPARE" }, { type: "SHOW_HINT" });
    expect(hintSheetView(s)).toMatchObject({ kind: "TARGET", next: { level: 1, price: 0, free: true } });
    for (const preference of HINT_CATEGORIES) expect(act(s, { type: "PURCHASE_SELECTABLE_HINT", preference, expectedPaidCount: 0 })).toBe(s);
    const revealed = act(s, { type: "PURCHASE_DISCOVERY_HINT", level: 1 });
    expect(revealed.pitzBalance).toBe(50);
    expect(revealed.discoveryHintFacts).toEqual({});
    expect(revealed.discoveryHintPurchases).toEqual({});
  });

  it("24 Dex 0 but another DISCOVERABLE recipe (migrated save): the Selectable sheet, paid", () => {
    const start = (pitz: number) =>
      act(
        createInitialGameState(undefined, [...STARTER_INGREDIENT_IDS, "egg"], pitz, { egg: 10 }, [], ["egg"]),
        { type: "BEGIN_PREPARE" },
        { type: "SHOW_HINT", pinnedRecipeId: "bismarck" },
      );
    const s = start(0);
    expect(view(s).presentation).toMatchObject({ onboarding: false, nextPrice: 5, affordable: false });
    expect(act(s, buy(s))).toBe(s);
    const bought = buyOnce(start(10));
    expect(bought.pitzBalance).toBe(5);
    expect(bought.discoveryHintFacts).toEqual({ bismarck: ["ing:tomato-sauce"] });
    // The onboarding refuses the legacy action for bismarck too.
    expect(act(start(10), { type: "PURCHASE_DISCOVERY_HINT", level: 1 }).pitzBalance).toBe(10);
  });
});

describe("save / load (matrix 29-32, 40)", () => {
  it("29 Full Reset clears both ledgers", () => {
    const storage = memoryStorage();
    saveAndReload(buyOnce(sheetOn("breakfast-pizza", 100, { purchases: { funghi: 2 } })), storage);
    expect(loadSave(storage).discoveryHintFacts).toEqual({ "breakfast-pizza": ["ing:tomato-sauce"] });
    resetSave(storage);
    expect(loadSave(storage)).toMatchObject({ discoveryHintFacts: {}, discoveryHintPurchases: {} });
  });

  it("30 an old save (Economy 1.0, no discoveryHintFacts key) loads into the migrated state", () => {
    const { discoveryHintFacts: _omit, ...old } = createDefaultSave();
    const storage = memoryStorage({
      [SAVE_STORAGE_KEY]: JSON.stringify({ ...old, pitzBalance: 100, discoveryHintPurchases: { "breakfast-pizza": 3 } }),
    });
    const save = loadSave(storage);
    const s = sheetOn("breakfast-pizza", save.pitzBalance, { purchases: save.discoveryHintPurchases, facts: save.discoveryHintFacts });
    expect(chips(s).sort()).toEqual(["bacon", "tomato-sauce"]);
    expect(view(s).presentation).toMatchObject({ paidCount: 3, nextPrice: 40 });
    expect(view(s).grandfatheredSteps).toHaveLength(1);
  });

  it("31 a new save (with facts) loads back the same sheet", () => {
    const bought = buyOnce(buyOnce(sheetOn("capricciosa", 100), "topping"), "topping");
    const reloaded = reopen(saveAndReload(bought), "capricciosa");
    expect(view(reloaded).presentation).toEqual(view(bought).presentation);
  });

  it("32 legacy + new coexist: the legacy rung and the new facts add up, neither ledger overwritten", () => {
    const s = sheetOn("capricciosa", 100, { purchases: { capricciosa: 2 }, facts: { capricciosa: ["ing:mushroom"] } });
    expect(chips(s).sort()).toEqual(["mushroom", "oregano", "tomato-sauce"]);
    expect(view(s).presentation).toMatchObject({ paidCount: 3, nextPrice: 40 });
    const after = buyOnce(s, "cheese");
    expect(after.discoveryHintPurchases).toEqual({ capricciosa: 2 });
    expect(after.discoveryHintFacts).toEqual({ capricciosa: ["ing:mushroom", "ing:mozzarella"] });
    expect(after.pitzBalance).toBe(60);
  });

  it("40 the save stays schemaVersion 2 and only gains the fact ledger entry", () => {
    const storage = memoryStorage();
    const s = sheetOn("breakfast-pizza", 100);
    saveAndReload(s, storage);
    const before = storage.json();
    saveAndReload(buyOnce(s), storage);
    const after = storage.json();
    expect(after.schemaVersion).toBe(2);
    expect(after).toEqual({ ...before, pitzBalance: 95, discoveryHintFacts: { "breakfast-pizza": ["ing:tomato-sauce"] } });
  });
});

describe("privacy (matrix 33-35)", () => {
  const candidates = RECIPES.filter((r) => r.id !== "margherita").map((r) => r.id);

  it("33 no negative fact: the selectable view of a fresh target carries no 'not used' line", () => {
    for (const id of candidates) {
      expect(JSON.stringify(view(sheetOn(id, 100))), id).not.toMatch(/じゃない|使わない/);
    }
  });

  it("34 no category availability / remaining count: every target shows the same shape at the same paid count", () => {
    const shape = (s: GameState) => {
      const v = view(s);
      return {
        keys: Object.keys(v.presentation).sort(),
        rows: v.presentation.rows.map((r) => r.category),
        preferences: v.presentation.preferences,
        nextPrice: v.presentation.nextPrice,
        affordable: v.presentation.affordable,
        viewKeys: Object.keys(v).sort(),
      };
    };
    const reference = shape(sheetOn("funghi", 100));
    for (const id of candidates) expect(shape(sheetOn(id, 100)), id).toEqual(reference);
    const json = JSON.stringify(view(sheetOn("capricciosa", 100)));
    expect(json).not.toMatch(/remaining|reserved|purchasable|capricciosa/);
  });

  it("35 Rule W: the reserved ingredient is never revealed, however much is bought", () => {
    for (const id of candidates) {
      let s = sheetOn(id, 1000);
      for (let i = 0; i < 8; i += 1) s = buyOnce(s, HINT_CATEGORIES[i % 3]);
      const reserved = model(id).reservedIngredientId!;
      expect(chips(s), id).not.toContain(reserved);
      expect(s.discoveryHintFacts[id] ?? [], id).not.toContain(hintFactId(reserved));
    }
  });

  it("the runtime view equals H3-1's presentation fed from both ledgers (no second pricing path)", () => {
    const s = sheetOn("capricciosa", 100, { purchases: { capricciosa: 1 }, facts: { capricciosa: ["ing:ham"] } });
    const m = model("capricciosa");
    expect(view(s).presentation).toEqual(
      selectableHintPresentation(m, ["ing:ham"], 100, { paidRungs: 1, grantedFactIds: ["ing:oregano"] }),
    );
  });
});

describe("Dinner defense in depth", () => {
  it("PURCHASE_SELECTABLE_HINT is a no-op while a Dinner run exists", () => {
    const s = sheetOn("breakfast-pizza", 100);
    const dinner = { ...s, dinner: {} as never };
    expect(act(dinner, buy(s))).toBe(dinner);
  });
});
