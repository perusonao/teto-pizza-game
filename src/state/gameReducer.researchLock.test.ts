import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { discoveredDex } from "./testSupport/guidedRound";

/**
 * Issue #358 Slice 2 (OD-358-1): the researchTest EDITABLE -> LOCKED lifecycle. The lock is a session-only boolean
 * (`researchTestLocked`), not derived from makingStep: RESET_PIZZA returns to the first step but must keep it.
 */
const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const owned = [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= 25).flatMap((s) => s.ingredientIds),
];
const keys = ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < 25).map((s) => s.keyRecipeId), "brazilian-calabresa"];
const T = "pesto-pollo";
const save = (): GameState => ({
  ...createInitialGameState(discoveredDex(keys), owned, 1000),
  inventory: Object.fromEntries(owned.map((id) => [id, 10])),
});
const started = () => act(save(), { type: "START_FREE_COOK", researchTargetId: T });
const declare = (s: GameState, id: string | null) => act(s, { type: "SET_RESEARCH_TEST", ingredientId: id });
const next = (s: GameState) => act(s, { type: "CONFIRM_MAKING_STEP" });

describe("researchTest lock lifecycle", () => {
  it("attempt start is EDITABLE and selection can change / clear before the first step confirm", () => {
    let s = started();
    expect(s.researchTestLocked).toBe(false);
    s = declare(s, "egg");
    s = declare(s, "pesto");
    expect(s.researchTest?.ingredientId).toBe("pesto");
    expect(declare(s, null).researchTest).toBeNull();
    // placing things in the first step does not lock
    s = act(s, { type: "COMMIT_DOUGH_STRETCH", shape: s.pizza.doughShape });
    expect(s.researchTestLocked).toBe(false);
  });

  it("the first CONFIRM_MAKING_STEP locks; SET_RESEARCH_TEST (set or clear) is then a no-op", () => {
    const s = next(declare(started(), "egg"));
    expect(s.researchTestLocked).toBe(true);
    expect(declare(s, "pesto")).toBe(s);
    expect(declare(s, null)).toBe(s);
    expect(declare(s, "egg")).toBe(s);
    expect(next(s).researchTest?.ingredientId).toBe("egg");
  });

  it("locks even without a selection (the experiment started with no hypothesis)", () => {
    const s = next(started());
    expect(s.researchTestLocked).toBe(true);
    expect(declare(s, "egg").researchTest).toBeNull();
  });

  it("RESET_PIZZA keeps the selection AND the lock although the step returns to the first one", () => {
    let s = next(next(declare(started(), "egg")));
    s = act(s, { type: "RESET_PIZZA" });
    expect(s.makingStep).toBe("DOUGH");
    expect(s.researchTest?.ingredientId).toBe("egg");
    expect(s.researchTestLocked).toBe(true);
    expect(declare(s, "pesto").researchTest?.ingredientId).toBe("egg");
  });

  it("START_BAKE locks too (a profile whose first step is also its last)", () => {
    const s = act(declare(started(), "egg"), { type: "START_BAKE" });
    expect(s.researchTestLocked).toBe(true);
  });

  it("retry and a fresh round clear the selection and the lock", () => {
    let s = act(declare(started(), "egg"), { type: "CONFIRM_MAKING_STEP" });
    const retried = act(s, { type: "RETRY_SAME_RECIPE" });
    expect(retried.researchTest).toBeNull();
    expect(retried.researchTestLocked).toBe(false);
    expect(declare(retried, "egg").researchTest?.ingredientId).toBe("egg");
    s = act(s, { type: "START_FREE_COOK", researchTargetId: T });
    expect(s.researchTest).toBeNull();
    expect(s.researchTestLocked).toBe(false);
    const home = act(next(declare(started(), "egg")), { type: "START_FREE_COOK" });
    expect(home.researchTestLocked).toBe(false);
  });

  it("a reload starts a fresh round: nothing of selection / lock is persisted", () => {
    const fresh = createInitialGameState(discoveredDex(keys), owned, 1000);
    expect(fresh.researchTest).toBeNull();
    expect(fresh.researchTestLocked).toBe(false);
  });
});
