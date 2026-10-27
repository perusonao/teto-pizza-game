import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { createEmptyPizza, type PizzaState } from "./pizzaState";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { hintSheetView, isHintSheetVisible } from "./discoveryHint";
import { discoveredDex } from "./testSupport/guidedRound";

/**
 * Issue #676 AC-P1 / AC-B1 (C1): the FAILED card's 「💡 ヒントを見る」 is the existing `handleRetryWithHint`, i.e. exactly
 * RETRY_SAME_RECIPE then SHOW_HINT (App.tsx). The sheet it opens must not depend on how the round that was just
 * finished ended: a bake-FAILED round and an ORIGINAL round of the SAME pizza open the same sheet. Compared for a
 * targetless Free Cook (a fresh save, the state a production player reaches) and for a Research round.
 */
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const owned = [...STARTER_INGREDIENT_IDS, ...DISCOVERY_LADDER.steps.filter((s) => s.step <= 25).flatMap((s) => s.ingredientIds)];
const keysBefore = ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < 25).map((s) => s.keyRecipeId)];
const researchSave = (): GameState => {
  const base = createInitialGameState(discoveredDex([...keysBefore, "brazilian-calabresa", "aussie", "grandma-pizza"]), owned, 1000);
  return { ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])) };
};
const freshSave = (): GameState => {
  const base = createInitialGameState(discoveredDex([]), [...STARTER_INGREDIENT_IDS], 0);
  return { ...base, inventory: Object.fromEntries(STARTER_INGREDIENT_IDS.map((id) => [id, 10])) };
};
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
const FAIL = 1;
const OK = 68;
/** What App.tsx's `handleRetryWithHint` dispatches, in order. */
const retryWithHint = (s: GameState) => act(s, { type: "RETRY_SAME_RECIPE", now: 1 }, { type: "SHOW_HINT" });
const sheet = (s: GameState) => ({ visible: isHintSheetVisible(s), view: hintSheetView(s), session: s.hintSession, open: s.hintSheetOpen, step: s.makingStep, phase: s.phase });

describe.each([
  ["targetless Free Cook (fresh save)", () => act(freshSave(), { type: "START_FREE_COOK" }), () => mk("tomato-sauce", "basil")],
  ["Research round", () => act(researchSave(), { type: "START_FREE_COOK", researchTargetId: "pesto-pollo" }), () => mk("tomato-sauce", "eggplant")],
])("%s", (_name, start, pizza) => {
  const original = toResult(start(), pizza(), OK);
  const failed = toResult(start(), pizza(), FAIL);

  it("the two rounds really are an ORIGINAL (no completion failure) and a bake-FAILED one", () => {
    expect(original.phase).toBe("RESULT");
    expect(original.completion?.status).not.toBe("FAILED");
    expect(failed.phase).toBe("RESULT");
    expect(failed.completion?.status).toBe("FAILED");
  });

  it("AC-P1: retry-with-hint from FAILED opens the very same sheet as from ORIGINAL (view, session, step, flags)", () => {
    const o = sheet(retryWithHint(original));
    const f = sheet(retryWithHint(failed));
    expect(f.visible).toBe(true);
    expect(f.phase).toBe("PREPARE");
    expect(f).toEqual(o);
  });

  it("AC-B1: it is a Free Cook retry (the Research target, if any, carries over) and spends nothing by itself", () => {
    const f = retryWithHint(failed);
    expect(f.freeCook).toBe(true);
    expect(f.researchTargetId).toBe(failed.researchTargetId);
    expect(f.pitzBalance).toBe(failed.pitzBalance);
    expect(f.dex).toEqual(failed.dex);
  });
});
