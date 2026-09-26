import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { buildHintSteps } from "../logic/discovery/hintSteps";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import {
  autoHintIndex,
  hintSheetView,
  isHintSheetVisible,
  resolveHintSession,
  revealNextHint,
  type DiscoveryHintState,
} from "./discoveryHint";
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
  };
}

/** Opens the sheet (resolve) and reveals `times` more steps, as SHOW_HINT + REVEAL_NEXT_HINT do. */
function play(state: DiscoveryHintState, times: number): DiscoveryHintState {
  let s = { ...state, hintSession: resolveHintSession(state) };
  for (let i = 0; i < times; i += 1) s = { ...s, hintSession: revealNextHint(s) };
  return s;
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
    const s = { ...ladder(4), hintSession: { targetId: "funghi", revealedIndex: 3 } };
    expect(resolveHintSession(s)).toEqual({ targetId: "melanzane-pizza", revealedIndex: 0 });
  });

  it("an unknown / non-recipe target id falls back too", () => {
    const s = { ...ladder(2), hintSession: { targetId: "no-such-recipe", revealedIndex: 2 } };
    expect(resolveHintSession(s)).toEqual({ targetId: "breakfast-pizza", revealedIndex: 0 });
  });

  it("no DISCOVERABLE target -> null (the sheet shows the empty state)", () => {
    expect(resolveHintSession(ladder(5, "not-bought"))).toBeNull();
    expect(resolveHintSession(ladder(25))).toBeNull();
  });
});

describe("revealNextHint / hintSheetView (H1 -> H4)", () => {
  it("each reveal adds exactly one step, in order, then stops at the last one", () => {
    const base = ladder(2); // breakfast-pizza
    const all = buildHintSteps(recipe("breakfast-pizza"), { discoveredCount: 2 });
    for (let n = 0; n < all.length; n += 1) {
      const view = hintSheetView(play(base, n));
      expect(view).toEqual({ kind: "TARGET", steps: all.slice(0, n + 1), canRevealMore: n < all.length - 1 });
    }
    const atMax = play(base, all.length - 1);
    expect(revealNextHint(atMax)).toBe(atMax.hintSession);
    expect(hintSheetView(play(base, all.length + 5))).toEqual(hintSheetView(atMax));
  });

  it("at Dex >= 1 the full answer is never shown, however often next is pressed (every ladder step)", () => {
    for (let count = 1; count < 25; count += 1) {
      const view = hintSheetView(play(ladder(count), 20));
      if (view.kind !== "TARGET") throw new Error(`Dex ${count}: expected a target`);
      const named = new Set(view.steps.flatMap((s) => (s.namedIngredientId ? [s.namedIngredientId] : [])));
      const all = new Set(recipe(LADDER_ORDER[count]).requiredIngredients.map((r) => r.ingredientId));
      expect(named.size, `Dex ${count}`).toBe(all.size - 1);
      expect(view.canRevealMore).toBe(false);
    }
  });

  it("no session -> the view still shows today's target at H0", () => {
    const view = hintSheetView(ladder(1));
    expect(view).toMatchObject({ kind: "TARGET", canRevealMore: true });
    expect(view.kind === "TARGET" && view.steps.map((s) => s.axis)).toEqual(["EXISTENCE"]);
  });

  it("empty states: SHOP_NEW / REFILL / COMPLETE", () => {
    expect(hintSheetView(ladder(6, "not-bought"))).toEqual({ kind: "SHOP_NEW" });
    expect(hintSheetView(ladder(6, "stock-0"))).toEqual({ kind: "REFILL" });
    expect(hintSheetView(ladder(25))).toEqual({ kind: "COMPLETE" });
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
