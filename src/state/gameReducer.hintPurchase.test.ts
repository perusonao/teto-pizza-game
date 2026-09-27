import { describe, expect, it } from "vitest";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { discoverableHintCandidates } from "../logic/discovery/hintTarget";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { hintSheetView } from "./discoveryHint";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { resolveShopEntitlement } from "./materialEntitlement";

/**
 * Discovery Hint Economy 1.0 (Issue #232), HE-2: PURCHASE_DISCOVERY_HINT is the only way a hint
 * level is unlocked. The reducer re-validates everything from state (sheet, phase, target, level,
 * price, balance, Dex-0 exemption) and applies the Pitz debit and the ledger raise in one step.
 *
 * Discovery Hint 3.0 (Issue #238, H3-3): Economy 1.0 levels are no longer sold. PURCHASE_DISCOVERY_HINT
 * now only serves the free Dex-0 Margherita onboarding; every other target is bought through
 * PURCHASE_SELECTABLE_HINT (gameReducer.selectableHint.test.ts). The legacy ledger stays the read
 * authority: what an Economy 1.0 buyer bought is still shown, still sticky, and never re-charged.
 */

function discover(ids: readonly string[]): DexState {
  let dex = EMPTY_DEX;
  for (const id of ids) {
    dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return dex;
}

const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const buy = (level: number): GameAction => ({ type: "PURCHASE_DISCOVERY_HINT", level });
/** The first Selectable purchase of a fresh target, as its sheet would send it. */
const SEL: GameAction = { type: "PURCHASE_SELECTABLE_HINT", preference: "sauce", expectedPaidCount: 0 };
/** One Selectable Hint purchase as the sheet sends it. */
function buyFact(s: GameState, preference: "sauce" | "cheese" | "topping" = "sauce"): GameState {
  const view = hintSheetView(s);
  if (view.kind !== "SELECTABLE") throw new Error(`expected SELECTABLE, got ${view.kind}`);
  return act(s, { type: "PURCHASE_SELECTABLE_HINT", preference, expectedPaidCount: view.presentation.paidCount });
}

/** Dex {margherita, bismarck}, bacon owned -> breakfast-pizza is the one DISCOVERABLE recipe. */
function dex2(pitz: number, purchases: Record<string, number> = {}, stock = 10): GameState {
  const owned = [...STARTER_INGREDIENT_IDS, "egg", "bacon"];
  const initial = createInitialGameState(discover(["margherita", "bismarck"]), owned, pitz, { egg: stock, bacon: stock }, [], ["egg", "bacon"], purchases);
  return act(initial, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
}

/** The ingredients the sheet shows as known (free key + owned facts). */
function known(s: GameState): string[] {
  const view = hintSheetView(s);
  return view.kind === "SELECTABLE" ? view.presentation.rows.flatMap((r) => r.revealed.map((c) => c.ingredientId)).sort() : [];
}

describe("PURCHASE_DISCOVERY_HINT outside the onboarding: Economy 1.0 levels are retired (H3-3)", () => {
  it("no level is sold at Dex >= 1: the sheet is the Selectable one and the legacy action changes nothing", () => {
    const s = dex2(100);
    expect(hintSheetView(s)).toMatchObject({ kind: "SELECTABLE", presentation: { nextPrice: 5, paidCount: 0 } });
    for (const level of [1, 2, 3, 4]) expect(act(s, buy(level))).toBe(s);
    expect(act(s, buy(1), buy(2), buy(3), buy(4)).discoveryHintPurchases).toEqual({});
  });

  it("a Selectable purchase never advances the legacy ledger", () => {
    const after = buyFact(buyFact(dex2(100, { "breakfast-pizza": 1 })));
    expect(after.discoveryHintPurchases).toEqual({ "breakfast-pizza": 1 });
    expect(after.pitzBalance).toBe(100 - 10 - 20);
  });

  it("a double tap / stale event never charges twice", () => {
    const s = dex2(100);
    const view = hintSheetView(s);
    if (view.kind !== "SELECTABLE") throw new Error("expected SELECTABLE");
    const tap: GameAction = { type: "PURCHASE_SELECTABLE_HINT", preference: "sauce", expectedPaidCount: view.presentation.paidCount };
    const once = act(s, tap);
    expect(act(once, tap, tap, buy(1), buy(2))).toBe(once);
    expect(once.pitzBalance).toBe(95);
  });

  it("levels cannot be skipped", () => {
    const s = dex2(100);
    for (const level of [2, 3, 4, 5, 0, -1, 1.5]) expect(act(s, buy(level))).toBe(s);
    const h1 = act(s, buy(1));
    expect(act(h1, buy(3))).toBe(h1);
  });

  it("insufficient Pitz: disabled offer, nothing charged, never negative", () => {
    const s = dex2(4);
    expect(hintSheetView(s)).toMatchObject({ presentation: { nextPrice: 5, affordable: false, pitzBalance: 4 } });
    expect(buyFact(s)).toBe(s);
    expect(act(s, buy(1))).toBe(s);
    const exact = buyFact(dex2(5));
    expect(exact.pitzBalance).toBe(0);
    expect(buyFact(exact)).toBe(exact);
  });

  it("ignored while the sheet is closed, outside PREPARE, or in a guided / Lunch Rush round", () => {
    const closed = act(dex2(100), { type: "CLOSE_HINT" });
    expect(act(closed, SEL)).toBe(closed);

    const baked = act(dex2(100), { type: "START_BAKE" });
    expect(baked.phase).not.toBe("PREPARE");
    expect(act(baked, SEL)).toBe(baked);

    const guided = act(createInitialGameState(discover(["margherita"]), STARTER_INGREDIENT_IDS, 100), { type: "BEGIN_PREPARE" }, { type: "SHOW_HINT" });
    expect(guided.freeCook).toBe(false);
    expect(act(guided, SEL)).toBe(guided);

    const mission = act(dex2(100), { type: "MISSION_RESET_ORDER" }, { type: "BEGIN_PREPARE" }, { type: "SHOW_HINT" });
    expect(mission.isMissionRound).toBe(true);
    expect(act(mission, SEL)).toBe(mission);
    expect(mission.pitzBalance).toBe(100);
  });

  it("re-validates the target: a stale session (discovered, or out of stock) is never charged", () => {
    const s = dex2(100);
    expect(act(s, SEL).pitzBalance).toBe(95); // the same action is accepted on the live session
    const discovered: GameState = { ...s, dex: discover(["margherita", "bismarck", "breakfast-pizza"]) };
    expect(act(discovered, SEL)).toBe(discovered);
    const noStock: GameState = { ...s, inventory: { egg: 0, bacon: 0 } };
    expect(act(noStock, SEL)).toBe(noStock);
    const noSession: GameState = { ...s, hintSession: null };
    expect(act(noSession, SEL)).toBe(noSession);
  });
});

describe("purchased hints persist and re-reading is free", () => {
  it("close / re-open / a new Free Cooking round show the bought facts without charging", () => {
    const bought = buyFact(buyFact(dex2(100)));
    const reopened = act(bought, { type: "CLOSE_HINT" }, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(reopened.pitzBalance).toBe(85);
    expect(hintSheetView(reopened)).toEqual(hintSheetView(bought));
  });

  it("a reload (fresh session, legacy ledger from the save) shows the Economy 1.0 lines at no cost", () => {
    const reloaded = dex2(40, { "breakfast-pizza": 3 });
    expect(reloaded.hintSession).toEqual({ targetId: "breakfast-pizza", revealedIndex: 0 });
    expect(known(reloaded)).toEqual(["bacon", "tomato-sauce"]);
    expect(hintSheetView(reloaded)).toMatchObject({ presentation: { paidCount: 3, nextPrice: 40, affordable: true, pitzBalance: 40 } });
    expect(reloaded.pitzBalance).toBe(40);
  });

  it("a REFILL empty state hides nothing permanently: after the refill the bought lines are back", () => {
    const empty = dex2(100, { "breakfast-pizza": 2 }, 0);
    expect(hintSheetView(empty)).toEqual({ kind: "REFILL" });
    const refilled = act(
      empty,
      { type: "RESTOCK_INGREDIENT", ingredientId: "egg" },
      { type: "RESTOCK_INGREDIENT", ingredientId: "bacon" },
      { type: "START_FREE_COOK" },
      { type: "SHOW_HINT" },
    );
    expect(known(refilled)).toEqual(["bacon", "tomato-sauce"]);
  });

  it("both ledger entries stay after the recipe is discovered", () => {
    const bought = buyFact(dex2(100, { "breakfast-pizza": 1 }));
    const found: GameState = { ...bought, dex: discover(["margherita", "bismarck", "breakfast-pizza"]) };
    const next = act(found, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(next.discoveryHintPurchases).toEqual({ "breakfast-pizza": 1 });
    expect(next.discoveryHintFacts).toEqual({ "breakfast-pizza": ["ing:tomato-sauce"] });
  });
});

describe("Dex 0 Margherita onboarding is free (OD-HE-5)", () => {
  function dex0(pitz = 0): GameState {
    return act(createInitialGameState(undefined, undefined, pitz), { type: "BEGIN_PREPARE" }, { type: "SHOW_HINT" });
  }

  it("H1..H4 cost nothing, write no ledger entry, and never ask for Pitz", () => {
    let s = dex0();
    for (const level of [1, 2, 3, 4]) {
      expect(hintSheetView(s)).toMatchObject({ next: { level, price: 0, free: true, affordable: true } });
      s = act(s, buy(level));
    }
    expect(s.pitzBalance).toBe(0);
    expect(s.discoveryHintPurchases).toEqual({});
    expect(s.hintSession).toMatchObject({ targetId: "margherita", revealedIndex: 4 });
    expect(hintSheetView(s)).toMatchObject({ next: null });
  });

  it("a Pitz balance at Dex 0 is never touched either", () => {
    expect(act(dex0(50), buy(1)).pitzBalance).toBe(50);
  });

  it("skips and repeats are rejected at Dex 0 too", () => {
    const s = dex0();
    expect(act(s, buy(2))).toBe(s);
    const h1 = act(s, buy(1));
    expect(act(h1, buy(1))).toBe(h1);
  });

  it("only Margherita is free at Dex 0: another DISCOVERABLE recipe (migrated save) is paid", () => {
    // Dex 0, but egg is entitled, owned and stocked, so bismarck is DISCOVERABLE next to Margherita.
    const start = (pitz: number) =>
      act(
        createInitialGameState(undefined, [...STARTER_INGREDIENT_IDS, "egg"], pitz, { egg: 10 }, [], ["egg"]),
        { type: "BEGIN_PREPARE" },
        { type: "SHOW_HINT", pinnedRecipeId: "bismarck" },
      );
    const s = start(0);
    expect(s.hintSession?.targetId).toBe("bismarck");
    expect(hintSheetView(s)).toMatchObject({ kind: "SELECTABLE", presentation: { onboarding: false, nextPrice: 5, affordable: false } });
    expect(buyFact(s)).toBe(s);
    expect(act(start(10), buy(1)).pitzBalance).toBe(10);
    const paid = buyFact(start(10));
    expect(paid.pitzBalance).toBe(5);
    expect(paid.discoveryHintFacts).toEqual({ bismarck: ["ing:tomato-sauce"] });
    expect(paid.discoveryHintPurchases).toEqual({});
    // The failed-try escalation is Margherita's alone: it reveals nothing for bismarck.
    const escalated = act({ ...start(0), preDiscoveryFreeCookAttempts: 3 }, { type: "SHOW_HINT", pinnedRecipeId: "bismarck" });
    expect(known(escalated)).toEqual(["egg"]);
  });

  it("from Dex 1 the normal price applies", () => {
    const s = act(createInitialGameState(discover(["margherita"]), [...STARTER_INGREDIENT_IDS, "egg"], 5, { egg: 10 }, [], ["egg"]), { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(hintSheetView(s)).toMatchObject({ kind: "SELECTABLE", presentation: { nextPrice: 5, onboarding: false } });
    expect(buyFact(s).pitzBalance).toBe(0);
  });
});

describe("Dex-pinned target uses the same authority", () => {
  /** 15 recipes discovered, their materials owned: several DISCOVERABLE recipes at once. */
  function legacy(pitz: number): GameState {
    const old15 = RECIPES.slice(0, 15);
    const mats = [...new Set(old15.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)))];
    const owned = [...new Set([...STARTER_INGREDIENT_IDS, ...mats])];
    const dex = discover(old15.map((r) => r.id));
    const entitled = resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds;
    const inventory = Object.fromEntries(mats.filter((m) => !STARTER_INGREDIENT_IDS.includes(m)).map((m) => [m, 30]));
    return act(createInitialGameState(dex, owned, pitz, inventory, [], entitled), { type: "START_FREE_COOK" });
  }

  it("buying on a pinned card charges that recipe's ledger entry only", () => {
    const base = legacy(100);
    const pinned = discoverableHintCandidates(base)[1];
    const s = buyFact(act(base, { type: "SHOW_HINT", pinnedRecipeId: pinned.id }));
    expect(Object.keys(s.discoveryHintFacts)).toEqual([pinned.id]);
    expect(s.discoveryHintPurchases).toEqual({});
    expect(s.pitzBalance).toBe(95);
  });

  it("a recipe with a purchased level stays the target on the next open (sticky)", () => {
    const base = legacy(100);
    const pinned = discoverableHintCandidates(base)[1];
    const bought = act(buyFact(act(base, { type: "SHOW_HINT", pinnedRecipeId: pinned.id })), { type: "CLOSE_HINT" });
    const reopened = act({ ...bought, hintSession: { targetId: pinned.id, revealedIndex: 0 } }, { type: "SHOW_HINT" });
    expect(reopened.hintSession?.targetId).toBe(pinned.id);
  });

  it("HE-UI-4: after a reload (no session) a purchased, still-DISCOVERABLE recipe is the target again", () => {
    const base = legacy(100);
    const [auto, second] = discoverableHintCandidates(base);
    const bought = act(buyFact(buyFact(act(base, { type: "SHOW_HINT", pinnedRecipeId: second.id }))), { type: "CLOSE_HINT" });
    // A reload: the ledger comes back from the save, the session does not.
    const reloaded = act({ ...bought, hintSession: null }, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(reloaded.hintSession?.targetId).toBe(second.id);
    expect(reloaded.hintSession?.targetId).not.toBe(auto.id);
    const view = hintSheetView(reloaded);
    expect(view).toMatchObject({ kind: "SELECTABLE", presentation: { paidCount: 2, nextPrice: 20 } });
    expect(reloaded.pitzBalance).toBe(85);
  });

  it("HE-UI-4: a Dex pin still wins over the purchased preference", () => {
    const base = legacy(100);
    const [auto, second] = discoverableHintCandidates(base);
    const bought = act(buyFact(act(base, { type: "SHOW_HINT", pinnedRecipeId: second.id })), { type: "CLOSE_HINT" });
    const pinnedAuto = act({ ...bought, hintSession: null }, { type: "SHOW_HINT", pinnedRecipeId: auto.id });
    expect(pinnedAuto.hintSession?.targetId).toBe(auto.id);
  });

  it("HE-UI-4 fallback: once the purchased recipe is not DISCOVERABLE, the deterministic order decides", () => {
    const base = legacy(100);
    const [auto, second] = discoverableHintCandidates(base);
    const bought = act(buyFact(act(base, { type: "SHOW_HINT", pinnedRecipeId: second.id })), { type: "CLOSE_HINT" });
    const found: GameState = { ...bought, hintSession: null, dex: registerScoreToDex(bought.dex, second.id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex };
    const reopened = act(found, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(reopened.hintSession?.targetId).toBe(auto.id);
    // The purchase record itself stays in the ledger.
    expect(Object.keys(reopened.discoveryHintFacts)).toEqual([second.id]);
  });
});
