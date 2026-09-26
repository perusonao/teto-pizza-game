import { describe, expect, it } from "vitest";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { hintSheetView } from "./discoveryHint";

/**
 * Discovery Hint 2.0 (Issue #229, 229-B): the reducer side of the Free Cooking hint sheet --
 * SHOW_HINT / PURCHASE_DISCOVERY_HINT / CLOSE_HINT and the session-only `hintSession` lifecycle.
 * Discovery Hint Economy 1.0 (Issue #232, HE-2): from Dex 1 on a level is bought once with Pitz
 * (`gameReducer.hintPurchase.test.ts` covers the transaction); "NEXT" below unlocks whatever level
 * the sheet currently offers.
 */

function discover(ids: readonly string[]): DexState {
  let dex = EMPTY_DEX;
  for (const id of ids) {
    dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return dex;
}

/** Dex {margherita, bismarck}, bacon owned -> breakfast-pizza is the one DISCOVERABLE recipe. */
function freeCookDex2(pitz = 500): GameState {
  const owned = [...STARTER_INGREDIENT_IDS, "egg", "bacon"];
  const dex = discover(["margherita", "bismarck"]);
  const initial = createInitialGameState(dex, owned, pitz, { egg: 10, bacon: 10 }, [], ["egg", "bacon"]);
  return gameReducer(initial, { type: "START_FREE_COOK" });
}

/** Dex 0: the initial round is already a Free Cooking ORDER; BEGIN_PREPARE lands at PREPARE. */
function freeCookDex0(): GameState {
  return gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" });
}

/** "NEXT" = the sheet's CTA: unlock the level it offers (or the level after the last one, a no-op). */
const apply = (state: GameState, ...types: ("SHOW_HINT" | "NEXT" | "CLOSE_HINT")[]) =>
  types.reduce((s, type) => {
    if (type !== "NEXT") return gameReducer(s, { type });
    const view = hintSheetView(s);
    const level = view.kind === "TARGET" ? (view.next?.level ?? view.steps.at(-1)!.level + 1) : 1;
    return gameReducer(s, { type: "PURCHASE_DISCOVERY_HINT", level });
  }, state);

describe("SHOW_HINT in Free Cooking PREPARE", () => {
  it("opens the sheet on today's target at H0 and leaves the order-card line alone", () => {
    const before = freeCookDex2();
    expect(before.freeCook).toBe(true);
    expect(before.phase).toBe("PREPARE");
    const after = apply(before, "SHOW_HINT");
    expect(after.hintSheetOpen).toBe(true);
    expect(after.hintSession).toEqual({ targetId: "breakfast-pizza", revealedIndex: 0 });
    expect(after.hint).toBe(before.hint);
  });

  it("does nothing outside PREPARE", () => {
    const order = createInitialGameState(); // Dex 0 free cook at ORDER
    expect(order.freeCook).toBe(true);
    expect(apply(order, "SHOW_HINT")).toBe(order);
  });

  it("a guided (non-Free-Cooking) round keeps the explicit one-line hint, no sheet", () => {
    const guided = gameReducer(
      createInitialGameState(discover(["margherita"]), STARTER_INGREDIENT_IDS),
      { type: "BEGIN_PREPARE" },
    );
    expect(guided.freeCook).toBe(false);
    const after = apply(guided, "SHOW_HINT");
    expect(after.hintSheetOpen).toBe(false);
    expect(after.hintSession).toBeNull();
    expect(after.hint?.textJa).toBeTruthy();
  });
});

describe("PURCHASE_DISCOVERY_HINT (next level) / CLOSE_HINT", () => {
  it("H1 -> H2 -> H3 -> H4, then repeated next at the last step returns the same state", () => {
    let s = apply(freeCookDex2(), "SHOW_HINT");
    const axes: string[][] = [];
    for (let i = 0; i < 4; i += 1) {
      s = apply(s, "NEXT");
      const view = hintSheetView(s);
      axes.push(view.kind === "TARGET" ? view.steps.map((x) => x.axis) : []);
    }
    expect(axes.at(-1)).toEqual(["EXISTENCE", "KEY", "SAUCE", "COUNT_CHEESE", "INGREDIENT"]);
    // Dex >= 1: the progress is the purchase ledger, not the session index.
    expect(s.hintSession?.revealedIndex).toBe(0);
    expect(s.discoveryHintPurchases).toEqual({ "breakfast-pizza": 4 });
    expect(apply(s, "NEXT")).toBe(s);
    expect(apply(s, "NEXT", "NEXT", "NEXT")).toBe(s);
  });

  it("an unlock is ignored while the sheet is closed", () => {
    const s = apply(freeCookDex2(), "SHOW_HINT", "CLOSE_HINT");
    expect(apply(s, "NEXT")).toBe(s);
  });

  it("CLOSE_HINT closes, keeps the progress, and re-opening shows the same step", () => {
    const opened = apply(freeCookDex2(), "SHOW_HINT", "NEXT", "NEXT");
    const closed = apply(opened, "CLOSE_HINT");
    expect(closed.hintSheetOpen).toBe(false);
    expect(closed.hintSession).toEqual(opened.hintSession);
    expect(apply(closed, "CLOSE_HINT")).toBe(closed);
    expect(apply(closed, "SHOW_HINT").hintSession).toEqual(opened.hintSession);
    expect(hintSheetView(apply(closed, "SHOW_HINT"))).toEqual(hintSheetView(opened));
  });
});

describe("hintSession lifecycle (session-only, sticky within one search)", () => {
  it("survives a Free Cooking retry and RESET_PIZZA; a fresh round closes the sheet", () => {
    const revealed = apply(freeCookDex2(), "SHOW_HINT", "NEXT", "NEXT");
    const reset = gameReducer(revealed, { type: "RESET_PIZZA" });
    expect(reset.hintSession).toEqual(revealed.hintSession);
    const retry = gameReducer(revealed, { type: "START_FREE_COOK" });
    expect(retry.hintSheetOpen).toBe(false);
    expect(retry.hintSession).toEqual(revealed.hintSession);
    expect(apply(retry, "SHOW_HINT").hintSession).toEqual(revealed.hintSession);
  });

  it("once the target is discovered, the next SHOW_HINT moves to the new target at H0", () => {
    const revealed = apply(freeCookDex2(), "SHOW_HINT", "NEXT", "NEXT", "CLOSE_HINT");
    const found: GameState = {
      ...gameReducer(revealed, { type: "START_FREE_COOK" }),
      dex: discover(["margherita", "bismarck", "breakfast-pizza"]),
    };
    const next = apply(found, "SHOW_HINT");
    expect(next.hintSession?.targetId).not.toBe("breakfast-pizza");
    expect(next.hintSession?.revealedIndex ?? 0).toBe(0);
  });

  it("no DISCOVERABLE recipe: the sheet opens on an empty state with no session", () => {
    const owned = [...STARTER_INGREDIENT_IDS, "egg"];
    const dex = discover(["margherita"]);
    const start = gameReducer(createInitialGameState(dex, owned, 0, { egg: 0 }, [], ["egg"]), { type: "START_FREE_COOK" });
    const s = apply(start, "SHOW_HINT");
    expect(s.hintSheetOpen).toBe(true);
    expect(s.hintSession).toBeNull();
    expect(hintSheetView(s)).toEqual({ kind: "REFILL" });
  });

  it("the initial state has no session and a closed sheet", () => {
    const s = createInitialGameState();
    expect(s.hintSession).toBeNull();
    expect(s.hintSheetOpen).toBe(false);
  });
});

describe("Dex 0 onboarding through the reducer", () => {
  it("the first SHOW_HINT opens at H0 and three reveals reach count/cheese + mozzarella", () => {
    const s = apply(freeCookDex0(), "SHOW_HINT", "NEXT", "NEXT", "NEXT");
    expect(s.hintSession).toEqual({ targetId: "margherita", revealedIndex: 3 });
    const view = hintSheetView(s);
    expect(view.kind === "TARGET" && view.canRevealMore).toBe(true);
  });

  it("failed tries still escalate the sheet (larger of automatic and manual)", () => {
    const s = apply({ ...freeCookDex0(), preDiscoveryFreeCookAttempts: 3 }, "SHOW_HINT");
    const view = hintSheetView(s);
    expect(view).toMatchObject({ kind: "TARGET", canRevealMore: false });
  });
});

describe("229-D: SHOW_HINT with a Dex pin (App: START_FREE_COOK then SHOW_HINT)", () => {
  it("pins a DISCOVERABLE recipe inside a Free Cooking round; the round itself stays Free Cooking (LK-8)", () => {
    const s = apply(freeCookDex2(), "CLOSE_HINT");
    const pinned = gameReducer(s, { type: "SHOW_HINT", pinnedRecipeId: "breakfast-pizza" });
    expect(pinned.hintSession).toEqual({ targetId: "breakfast-pizza", revealedIndex: 0, fromDex: true });
    expect(pinned.freeCook).toBe(true);
    expect(pinned.recipe.id).toBe(s.recipe.id); // still the free-cook sentinel, never the pinned recipe
    expect(pinned.order).toBe(s.order);
  });

  it("an undiscoverable pin (KBMM / UNKNOWN / stale) never becomes the target", () => {
    for (const bad of ["funghi", "hawaiian", "bismarck", "x"]) {
      expect(gameReducer(freeCookDex2(), { type: "SHOW_HINT", pinnedRecipeId: bad }).hintSession?.targetId).toBe("breakfast-pizza");
    }
  });

  it("outside a Free Cooking PREPARE the pin is ignored like any SHOW_HINT", () => {
    const guided = gameReducer(createInitialGameState(discover(["margherita"]), STARTER_INGREDIENT_IDS), { type: "BEGIN_PREPARE" });
    const after = gameReducer(guided, { type: "SHOW_HINT", pinnedRecipeId: "bismarck" });
    expect(after.hintSheetOpen).toBe(false);
    expect(after.hintSession).toBeNull();
  });
});
