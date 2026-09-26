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

/** Dex {margherita, bismarck}, bacon owned -> breakfast-pizza is the one DISCOVERABLE recipe. */
function dex2(pitz: number, purchases: Record<string, number> = {}, stock = 10): GameState {
  const owned = [...STARTER_INGREDIENT_IDS, "egg", "bacon"];
  const initial = createInitialGameState(discover(["margherita", "bismarck"]), owned, pitz, { egg: stock, bacon: stock }, [], ["egg", "bacon"], purchases);
  return act(initial, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
}

function stepCount(s: GameState): number {
  const view = hintSheetView(s);
  return view.kind === "TARGET" ? view.steps.length : 0;
}

describe("PURCHASE_DISCOVERY_HINT: the transaction", () => {
  it("buys H1 for 5 Pitz: balance and ledger change together, one more step is shown", () => {
    const s = dex2(100);
    expect(hintSheetView(s)).toMatchObject({ kind: "TARGET", next: { level: 1, price: 5, free: false, affordable: true }, pitzBalance: 100 });
    const after = act(s, buy(1));
    expect(after.pitzBalance).toBe(95);
    expect(after.discoveryHintPurchases).toEqual({ "breakfast-pizza": 1 });
    expect(stepCount(after)).toBe(2);
    expect(hintSheetView(after)).toMatchObject({ next: { level: 2, price: 10 } });
  });

  it("H1 -> H4 costs exactly 75", () => {
    const after = act(dex2(100), buy(1), buy(2), buy(3), buy(4));
    expect(after.pitzBalance).toBe(25);
    expect(after.discoveryHintPurchases).toEqual({ "breakfast-pizza": 4 });
    expect(hintSheetView(after)).toMatchObject({ canRevealMore: false, next: null });
  });

  it("a double tap / stale event for a level already bought never charges twice", () => {
    const once = act(dex2(100), buy(1));
    expect(act(once, buy(1))).toBe(once);
    expect(act(once, buy(1), buy(1), buy(1))).toBe(once);
    const twice = act(once, buy(2));
    expect(act(twice, buy(2), buy(1))).toBe(twice);
    expect(twice.pitzBalance).toBe(85);
  });

  it("levels cannot be skipped", () => {
    const s = dex2(100);
    for (const level of [2, 3, 4, 5, 0, -1, 1.5]) expect(act(s, buy(level))).toBe(s);
    const h1 = act(s, buy(1));
    expect(act(h1, buy(3))).toBe(h1);
  });

  it("insufficient Pitz: disabled offer, nothing charged, never negative", () => {
    const s = dex2(4);
    expect(hintSheetView(s)).toMatchObject({ next: { level: 1, price: 5, affordable: false }, pitzBalance: 4 });
    expect(act(s, buy(1))).toBe(s);
    const exact = act(dex2(5), buy(1));
    expect(exact.pitzBalance).toBe(0);
    expect(act(exact, buy(2))).toBe(exact);
    expect(hintSheetView(exact)).toMatchObject({ next: { level: 2, price: 10, affordable: false } });
  });

  it("ignored while the sheet is closed, outside PREPARE, or in a guided / Lunch Rush round", () => {
    const closed = act(dex2(100), { type: "CLOSE_HINT" });
    expect(act(closed, buy(1))).toBe(closed);

    const baked = act(dex2(100), { type: "START_BAKE" });
    expect(baked.phase).not.toBe("PREPARE");
    expect(act(baked, buy(1))).toBe(baked);

    const guided = act(createInitialGameState(discover(["margherita"]), STARTER_INGREDIENT_IDS, 100), { type: "BEGIN_PREPARE" }, { type: "SHOW_HINT" });
    expect(guided.freeCook).toBe(false);
    expect(act(guided, buy(1))).toBe(guided);

    const mission = act(dex2(100), { type: "MISSION_RESET_ORDER" }, { type: "BEGIN_PREPARE" }, { type: "SHOW_HINT" });
    expect(mission.isMissionRound).toBe(true);
    expect(act(mission, buy(1))).toBe(mission);
    expect(mission.pitzBalance).toBe(100);
  });

  it("re-validates the target: a stale session (discovered, or out of stock) is never charged", () => {
    const s = dex2(100);
    const discovered: GameState = { ...s, dex: discover(["margherita", "bismarck", "breakfast-pizza"]) };
    expect(act(discovered, buy(1))).toBe(discovered);
    const noStock: GameState = { ...s, inventory: { egg: 0, bacon: 0 } };
    expect(act(noStock, buy(1))).toBe(noStock);
    const noSession: GameState = { ...s, hintSession: null };
    expect(act(noSession, buy(1))).toBe(noSession);
  });
});

describe("purchased hints persist and re-reading is free", () => {
  it("close / re-open / a new Free Cooking round show the bought levels without charging", () => {
    const bought = act(dex2(100), buy(1), buy(2));
    const reopened = act(bought, { type: "CLOSE_HINT" }, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(reopened.pitzBalance).toBe(85);
    expect(hintSheetView(reopened)).toEqual(hintSheetView(bought));
  });

  it("a reload (fresh session, ledger from the save) shows the bought levels at no cost", () => {
    const reloaded = dex2(40, { "breakfast-pizza": 3 });
    expect(reloaded.hintSession).toEqual({ targetId: "breakfast-pizza", revealedIndex: 0 });
    expect(stepCount(reloaded)).toBe(4);
    expect(hintSheetView(reloaded)).toMatchObject({ next: { level: 4, price: 40, affordable: true }, pitzBalance: 40 });
  });

  it("a REFILL empty state hides nothing permanently: after the refill the bought levels are back", () => {
    const empty = dex2(100, { "breakfast-pizza": 2 }, 0);
    expect(hintSheetView(empty)).toEqual({ kind: "REFILL" });
    const refilled = act(
      empty,
      { type: "RESTOCK_INGREDIENT", ingredientId: "egg" },
      { type: "RESTOCK_INGREDIENT", ingredientId: "bacon" },
      { type: "START_FREE_COOK" },
      { type: "SHOW_HINT" },
    );
    expect(stepCount(refilled)).toBe(3);
  });

  it("the ledger entry stays after the recipe is discovered", () => {
    const bought = act(dex2(100), buy(1));
    const found: GameState = { ...bought, dex: discover(["margherita", "bismarck", "breakfast-pizza"]) };
    const next = act(found, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(next.discoveryHintPurchases).toEqual({ "breakfast-pizza": 1 });
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
    expect(hintSheetView(s)).toMatchObject({ next: { level: 1, price: 5, free: false, affordable: false } });
    expect(act(s, buy(1))).toBe(s);
    const paid = act(start(10), buy(1));
    expect(paid.pitzBalance).toBe(5);
    expect(paid.discoveryHintPurchases).toEqual({ bismarck: 1 });
    // The failed-try escalation is Margherita's alone: it reveals nothing for bismarck.
    const escalated = act({ ...start(0), preDiscoveryFreeCookAttempts: 3 }, { type: "SHOW_HINT", pinnedRecipeId: "bismarck" });
    expect(hintSheetView(escalated)).toMatchObject({ kind: "TARGET", next: { level: 1 } });
  });

  it("from Dex 1 the normal price applies", () => {
    const s = act(createInitialGameState(discover(["margherita"]), [...STARTER_INGREDIENT_IDS, "egg"], 5, { egg: 10 }, [], ["egg"]), { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(hintSheetView(s)).toMatchObject({ next: { level: 1, price: 5, free: false } });
    expect(act(s, buy(1)).pitzBalance).toBe(0);
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
    const s = act(base, { type: "SHOW_HINT", pinnedRecipeId: pinned.id }, buy(1));
    expect(s.discoveryHintPurchases).toEqual({ [pinned.id]: 1 });
    expect(s.pitzBalance).toBe(95);
  });

  it("a recipe with a purchased level stays the target on the next open (sticky)", () => {
    const base = legacy(100);
    const pinned = discoverableHintCandidates(base)[1];
    const bought = act(base, { type: "SHOW_HINT", pinnedRecipeId: pinned.id }, buy(1), { type: "CLOSE_HINT" });
    const reopened = act({ ...bought, hintSession: { targetId: pinned.id, revealedIndex: 0 } }, { type: "SHOW_HINT" });
    expect(reopened.hintSession?.targetId).toBe(pinned.id);
  });

  it("HE-UI-4: after a reload (no session) a purchased, still-DISCOVERABLE recipe is the target again", () => {
    const base = legacy(100);
    const [auto, second] = discoverableHintCandidates(base);
    const bought = act(base, { type: "SHOW_HINT", pinnedRecipeId: second.id }, buy(1), buy(2), { type: "CLOSE_HINT" });
    // A reload: the ledger comes back from the save, the session does not.
    const reloaded = act({ ...bought, hintSession: null }, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(reloaded.hintSession?.targetId).toBe(second.id);
    expect(reloaded.hintSession?.targetId).not.toBe(auto.id);
    const view = hintSheetView(reloaded);
    expect(view).toMatchObject({ kind: "TARGET", next: { level: 3, price: 20 } });
    expect(reloaded.pitzBalance).toBe(85);
  });

  it("HE-UI-4: a Dex pin still wins over the purchased preference", () => {
    const base = legacy(100);
    const [auto, second] = discoverableHintCandidates(base);
    const bought = act(base, { type: "SHOW_HINT", pinnedRecipeId: second.id }, buy(1), { type: "CLOSE_HINT" });
    const pinnedAuto = act({ ...bought, hintSession: null }, { type: "SHOW_HINT", pinnedRecipeId: auto.id });
    expect(pinnedAuto.hintSession?.targetId).toBe(auto.id);
  });

  it("HE-UI-4 fallback: once the purchased recipe is not DISCOVERABLE, the deterministic order decides", () => {
    const base = legacy(100);
    const [auto, second] = discoverableHintCandidates(base);
    const bought = act(base, { type: "SHOW_HINT", pinnedRecipeId: second.id }, buy(1), { type: "CLOSE_HINT" });
    const found: GameState = { ...bought, hintSession: null, dex: registerScoreToDex(bought.dex, second.id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex };
    const reopened = act(found, { type: "START_FREE_COOK" }, { type: "SHOW_HINT" });
    expect(reopened.hintSession?.targetId).toBe(auto.id);
    // The purchase record itself stays in the ledger.
    expect(reopened.discoveryHintPurchases).toEqual({ [second.id]: 1 });
  });
});
