import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { buildHintSteps } from "../logic/discovery/hintSteps";
import { discoverableHintCandidates } from "../logic/discovery/hintTarget";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import {
  autoHintIndex,
  hintSheetView,
  isHintSheetVisible,
  purchaseSelectableHintFact,
  resolveHintSession,
  unlockNextHint,
  type DiscoveryHintState,
  type HintSheetView,
} from "./discoveryHint";
import { buildSelectableHintModel, type HintCategory } from "../logic/discovery/selectableHint";
import { resolveShopEntitlement } from "./materialEntitlement";

const LADDER_ORDER = ["margherita", ...W1_25_DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)];
const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;

function discover(ids: readonly string[]): DexState {
  let dex = EMPTY_DEX;
  for (const id of ids) {
    dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return dex;
}

/** The 25-ladder played in order to `count` discoveries, every entitled material bought. */
function ladder(count: number, newest: "bought" | "not-bought" | "stock-0" = "bought"): DiscoveryHintState {
  const dex = discover(LADDER_ORDER.slice(0, count));
  const steps = W1_25_DISCOVERY_LADDER.steps.filter((s) => s.step <= count);
  const newestIds = new Set(steps.filter((s) => s.step === count).flatMap((s) => s.ingredientIds));
  const materials = steps.flatMap((s) => s.ingredientIds);
  const owned = [...STARTER_INGREDIENT_IDS, ...materials.filter((m) => newest !== "not-bought" || !newestIds.has(m))];
  return {
    dex,
    ownedIngredientIds: owned,
    unlockedForShopIngredientIds: resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds,
    inventory: Object.fromEntries(materials.map((m) => [m, newest === "stock-0" && newestIds.has(m) ? 0 : 10])),
    preDiscoveryFreeCookAttempts: 0,
    hintSession: null,
    pitzBalance: 1000,
    discoveryHintPurchases: {},
    discoveryHintFacts: {},
  };
}

/** Opens the sheet (resolve) and unlocks the offered level `times` more times, as SHOW_HINT +
 *  PURCHASE_DISCOVERY_HINT do (a rejected unlock changes nothing). */
function play(state: DiscoveryHintState, times: number): DiscoveryHintState {
  let s = { ...state, hintSession: resolveHintSession(state) };
  for (let i = 0; i < times; i += 1) s = { ...s, ...unlockNextHint(s, nextLevel(s)) };
  return s;
}

function nextLevel(s: DiscoveryHintState): number {
  const view = hintSheetView(s);
  return view.kind === "TARGET" ? (view.next?.level ?? view.steps.at(-1)!.level + 1) : 1;
}

/** Opens the sheet on today's target (SHOW_HINT's session resolve). */
function open(state: DiscoveryHintState, pinnedRecipeId?: string): DiscoveryHintState {
  return { ...state, hintSession: resolveHintSession(state, pinnedRecipeId) };
}

/** Every recipe discovered, non-credit branching recipes included (the pool is empty). */
function complete(): DiscoveryHintState {
  const base = ladder(25);
  return { ...base, dex: discover(RECIPES.map((r) => r.id)) };
}

function selectable(s: DiscoveryHintState): Extract<HintSheetView, { kind: "SELECTABLE" }> {
  const view = hintSheetView(s);
  if (view.kind !== "SELECTABLE") throw new Error(`expected SELECTABLE, got ${view.kind}`);
  return view;
}

/** One PURCHASE_SELECTABLE_HINT as the sheet sends it (a rejection changes nothing). */
function buy(s: DiscoveryHintState, preference: HintCategory = "sauce"): DiscoveryHintState {
  return { ...s, ...purchaseSelectableHintFact(s, preference, selectable(s).presentation.paidCount) };
}

describe("resolveHintSession", () => {
  it("opens at H0 on today's DISCOVERABLE target", () => {
    expect(resolveHintSession(ladder(3))).toEqual({ targetId: "funghi", revealedIndex: 0 });
  });

  it("keeps a revealed session on the same target", () => {
    const s = play(ladder(3), 2);
    expect(resolveHintSession(s)).toBe(s.hintSession);
  });

  it("a stale target (now DISCOVERED) falls back to the new target at H0", () => {
    const s = { ...ladder(4), hintSession: { targetId: "funghi", revealedIndex: 3 }, discoveryHintPurchases: { funghi: 3 } };
    expect(resolveHintSession(s)).toEqual({ targetId: "melanzane-pizza", revealedIndex: 0 });
  });

  it("an unknown / non-recipe target id falls back too", () => {
    const s = { ...ladder(2), hintSession: { targetId: "no-such-recipe", revealedIndex: 2 }, discoveryHintPurchases: { "no-such-recipe": 2 } };
    expect(resolveHintSession(s)).toEqual({ targetId: "breakfast-pizza", revealedIndex: 0 });
  });

  it("no DISCOVERABLE target -> null (the sheet shows the empty state)", () => {
    expect(resolveHintSession(ladder(5, "not-bought"))).toBeNull();
    expect(resolveHintSession(complete())).toBeNull();
  });
});

describe("purchaseSelectableHintFact / hintSheetView (Hint 3.0, H3-3)", () => {
  it("each purchase adds exactly one fact at 5/10/20/40 (capped), then answers GUIDANCE_ONLY", () => {
    const base = open(ladder(2)); // breakfast-pizza
    const model = buildSelectableHintModel("breakfast-pizza", { discoveredCount: 2 })!;
    let s = base;
    let spent = 0;
    for (let n = 0; n < model.purchasableFacts.length; n += 1) {
      const before = selectable(s);
      expect(before.presentation.paidCount).toBe(n);
      const price = Math.min([5, 10, 20, 40][Math.min(n, 3)], model.priceCap - spent);
      expect(before.presentation.nextPrice).toBe(price);
      s = buy(s);
      spent += price;
      expect(s.pitzBalance).toBe(1000 - spent);
      expect(s.discoveryHintFacts["breakfast-pizza"]).toHaveLength(n + 1);
      expect(s.discoveryHintPurchases).toEqual({});
    }
    expect(spent).toBeLessThanOrEqual(model.priceCap);
    const done = s;
    const patch = purchaseSelectableHintFact(done, "sauce", selectable(done).presentation.paidCount);
    expect(patch).toEqual({ hintOutcome: "GUIDANCE_ONLY" });
    expect(selectable({ ...done, ...patch }).outcome).toBe("GUIDANCE_ONLY");
  });

  it("at Dex >= 1 the full answer is never shown, however often a fact is bought (every ladder step)", () => {
    for (let count = 1; count < 25; count += 1) {
      // The W1 step's recipe is opened explicitly (the Dex card path): with a branching pool the
      // automatic target need not be the ladder recipe, and the contract must hold for each.
      // From Dex 12 the 26th recipe (calabresa) is makeable beside the ladder recipe (pool 2, D-1: no
      // automatic target). The player who found it first has pool 1 again, which is what is opened here.
      const base = ladder(count);
      const settled = count >= 12 ? { ...base, dex: discover([...LADDER_ORDER.slice(0, count), "brazilian-calabresa"]) } : base;
      let s = open(settled, LADDER_ORDER[count]);
      for (let i = 0; i < 12; i += 1) s = buy(s, (["sauce", "cheese", "topping"] as const)[i % 3]);
      const view = selectable(s);
      const named = new Set(view.presentation.rows.flatMap((r) => r.revealed.map((c) => c.ingredientId)));
      const all = new Set(recipe(LADDER_ORDER[count]).requiredIngredients.map((r) => r.ingredientId));
      expect(named.size, `Dex ${count}`).toBe(all.size - 1);
      expect(s.discoveryHintPurchases).toEqual({});
    }
  });

  it("the total spend never exceeds the recipe's Hint 2.0 cost (capricciosa: 75)", () => {
    const base = open(ladder(11));
    expect(base.hintSession?.targetId).toBe("capricciosa");
    let s = base;
    for (let i = 0; i < 12; i += 1) s = buy(s, "topping");
    expect(1000 - s.pitzBalance).toBeLessThanOrEqual(75);
  });

  it("no session -> the view still shows today's target at H0, only the free key revealed", () => {
    const view = hintSheetView(ladder(1));
    if (view.kind !== "SELECTABLE") throw new Error("expected SELECTABLE");
    const model = buildSelectableHintModel(LADDER_ORDER[1], { discoveredCount: 1 })!;
    expect(view.existenceText).toBe(buildHintSteps(recipe(LADDER_ORDER[1]), { discoveredCount: 1 })[0].textJa);
    expect(view.presentation.rows.flatMap((r) => r.revealed.map((c) => c.ingredientId))).toEqual(model.freeFacts.map((f) => f.ingredientId));
    expect(view.presentation.nextPrice).toBe(5);
    expect(view.outcome).toBeNull();
  });

  it("empty states: SHOP_NEW / REFILL / COMPLETE", () => {
    expect(hintSheetView(ladder(6, "not-bought"))).toEqual({ kind: "SHOP_NEW" });
    expect(hintSheetView(ladder(6, "stock-0"))).toEqual({ kind: "REFILL" });
    expect(hintSheetView(complete())).toEqual({ kind: "COMPLETE" });
  });
});

describe("Dex 0 onboarding: manual and automatic escalation, the larger wins", () => {
  it("the automatic step follows the failed-try counter, only while the Dex is empty", () => {
    expect([0, 1, 2, 3, 7].map((a) => autoHintIndex({ dex: EMPTY_DEX, preDiscoveryFreeCookAttempts: a }))).toEqual([0, 2, 3, 4, 4]);
    expect(autoHintIndex({ dex: discover(["margherita"]), preDiscoveryFreeCookAttempts: 3 })).toBe(0);
  });

  it("3 failed tries show every Margherita ingredient at once (the former Lv3 answer)", () => {
    const view = hintSheetView(play({ ...ladder(0), preDiscoveryFreeCookAttempts: 3 }, 0));
    expect(view.kind === "TARGET" && view.steps.flatMap((s) => (s.namedIngredientId ? [s.namedIngredientId] : []))).toEqual([
      "tomato-sauce",
      "mozzarella",
      "basil",
    ]);
  });

  it("manual reveal continues from the larger of the two", () => {
    const s = play({ ...ladder(0), preDiscoveryFreeCookAttempts: 1 }, 1); // auto 2 -> next 3
    expect(s.hintSession?.revealedIndex).toBe(3);
    const manualAhead = play({ ...ladder(0), preDiscoveryFreeCookAttempts: 0 }, 3);
    expect(hintSheetView({ ...manualAhead, preDiscoveryFreeCookAttempts: 1 })).toEqual(hintSheetView(manualAhead));
  });

  it("Dex 0 before any try: manual H1..H3 are available without failing first (F-1)", () => {
    const view = hintSheetView(play(ladder(0), 2));
    expect(view.kind === "TARGET" && view.steps.map((s) => s.axis)).toEqual(["EXISTENCE", "SAUCE", "COUNT_CHEESE"]);
  });
});

describe("isHintSheetVisible", () => {
  it("only during a Free Cooking PREPARE", () => {
    expect(isHintSheetVisible({ hintSheetOpen: true, phase: "PREPARE", freeCook: true })).toBe(true);
    expect(isHintSheetVisible({ hintSheetOpen: true, phase: "BAKE", freeCook: true })).toBe(false);
    expect(isHintSheetVisible({ hintSheetOpen: true, phase: "PREPARE", freeCook: false })).toBe(false);
    expect(isHintSheetVisible({ hintSheetOpen: false, phase: "PREPARE", freeCook: true })).toBe(false);
  });
});

/** Legacy save (15-ladder entitlement union): the first 15 RECIPES discovered, their materials
 *  owned -> several recipes are DISCOVERABLE at once, so a Dex pin can differ from the auto pick. */
function legacy(): DiscoveryHintState {
  const old15 = RECIPES.slice(0, 15);
  const mats = [...new Set(old15.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)))];
  const owned = [...new Set([...STARTER_INGREDIENT_IDS, ...mats])];
  const dex = discover(old15.map((r) => r.id));
  return {
    dex,
    ownedIngredientIds: owned,
    unlockedForShopIngredientIds: resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds,
    inventory: Object.fromEntries(mats.map((m) => [m, 30])),
    preDiscoveryFreeCookAttempts: 0,
    hintSession: null,
    pitzBalance: 1000,
    discoveryHintPurchases: {},
    discoveryHintFacts: {},
  };
}

describe("229-D: Dex-pinned target (PR-4b-A: only a sticky target survives a pool > 1)", () => {
  const base = legacy();
  const candidates = discoverableHintCandidates(base);
  const auto = candidates[0];
  // The second DISCOVERABLE recipe in hint order.
  const pinned = candidates[1];

  it("with several DISCOVERABLE recipes nothing is auto-targeted and a fresh pin picks nothing (D-1)", () => {
    expect(pinned).toBeTruthy();
    expect(resolveHintSession(base)).toBeNull();
    expect(resolveHintSession(base, pinned.id)).toBeNull();
  });

  it("a session the player already pinned (sticky) stays on re-open, at H0 too (D-3)", () => {
    const s = { targetId: pinned.id, revealedIndex: 0, fromDex: true } as const;
    expect(resolveHintSession({ ...base, hintSession: s })).toBe(s);
    expect(resolveHintSession({ ...base, hintSession: s }, pinned.id)).toBe(s);
  });

  it("stale (DISCOVERED) / non-DISCOVERABLE / unknown pins never pick a target at a pool > 1", () => {
    for (const bad of ["margherita", "quattro-formaggi", "no-such-recipe", ""]) {
      expect(resolveHintSession(base, bad), bad).toBeNull();
    }
  });

  it("a sticky target is never moved to a pinned other recipe (paid / revealed hints stay)", () => {
    const progressed = { ...base, hintSession: { targetId: pinned.id, revealedIndex: 3 } };
    expect(resolveHintSession(progressed, pinned.id)).toEqual({ targetId: pinned.id, revealedIndex: 3, fromDex: true });
    const other = { ...base, hintSession: { targetId: auto.id, revealedIndex: 3 } };
    expect(resolveHintSession(other, pinned.id)).toEqual({ targetId: auto.id, revealedIndex: 3 });
  });

  it("a sticky target that is found later lets go on the next open", () => {
    const s = { targetId: pinned.id, revealedIndex: 0, fromDex: true } as const;
    const found = { ...base, dex: discover([...RECIPES.slice(0, 15).map((r) => r.id), pinned.id]), hintSession: s };
    expect(resolveHintSession(found)?.targetId).not.toBe(pinned.id);
  });
});
