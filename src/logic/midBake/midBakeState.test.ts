import { describe, expect, it } from "vitest";
import { createMidBakeState, midBakeReducer, type MidBakeEvent, type MidBakePlan, type MidBakeState } from "./midBakeState";

const PLAN: MidBakePlan = {
  recipeId: "natto-pizza",
  totalBakeMs: 10000,
  requirements: [{ ingredientId: "natto", count: 2 }],
};

function reduce(events: readonly MidBakeEvent[], plan: MidBakePlan = PLAN): MidBakeState {
  return events.reduce(midBakeReducer, createMidBakeState(plan));
}

describe("MID_BAKE state transitions", () => {
  it("runs before-window -> window-open -> rebaking -> complete", () => {
    let state = reduce([{ type: "START", now: 1000 }, { type: "TICK", now: 7500 }]);
    expect(state).toMatchObject({ status: "baking", stage: "window-open", progress: 0.65 });
    state = midBakeReducer(state, { type: "ADD", now: 7600, ingredientId: "natto", ingredientState: "ready", input: "direct" });
    state = midBakeReducer(state, { type: "ADD", now: 7700, ingredientId: "natto", ingredientState: "ready", input: "alternative" });
    expect(state).toMatchObject({ status: "baking", additions: [{ input: "direct" }, { input: "alternative" }] });
    state = midBakeReducer(state, { type: "TICK", now: 10000 });
    expect(state).toMatchObject({ status: "baking", stage: "rebaking", progress: 0.9 });
    state = midBakeReducer(state, { type: "FINISH", now: 11000 });
    expect(state).toMatchObject({ status: "finished", completion: "complete", progress: 1 });
  });

  it("refuses additions before and after the window, unknown ingredients, and excess count", () => {
    let state = reduce([{ type: "START", now: 0 }]);
    state = midBakeReducer(state, { type: "ADD", now: 6400, ingredientId: "natto", ingredientState: "ready", input: "direct" });
    state = midBakeReducer(state, { type: "ADD", now: 6600, ingredientId: "okra", ingredientState: "ready", input: "direct" });
    for (const now of [6700, 6800, 6900]) state = midBakeReducer(state, { type: "ADD", now, ingredientId: "natto", ingredientState: "ready", input: "direct" });
    state = midBakeReducer(state, { type: "ADD", now: 9100, ingredientId: "natto", ingredientState: "ready", input: "direct" });
    expect(state.status === "baking" && state.additions).toHaveLength(2);
  });

  it("finishes with missing-additions when the window was missed", () => {
    expect(reduce([{ type: "START", now: 0 }, { type: "TICK", now: 10000 }])).toMatchObject({ status: "finished", completion: "missing-additions" });
  });

  it("requires FRY output for lomo-saltado without importing or changing FRY", () => {
    const lomo: MidBakePlan = {
      recipeId: "pizza-de-lomo-saltado",
      totalBakeMs: 10000,
      requirements: [{ ingredientId: "french-fries", count: 1, requiredState: "fried" }],
    };
    let state = reduce([{ type: "START", now: 0 }], lomo);
    state = midBakeReducer(state, { type: "ADD", now: 7000, ingredientId: "french-fries", ingredientState: "ready", input: "direct" });
    expect(state.status === "baking" && state.additions).toHaveLength(0);
    state = midBakeReducer(state, { type: "ADD", now: 7100, ingredientId: "french-fries", ingredientState: "fried", input: "direct" });
    expect(state.status === "baking" && state.additions).toHaveLength(1);
  });

  it("normalizes direct and alternative input to identical domain results", () => {
    const events = (input: "direct" | "alternative"): MidBakeEvent[] => [
      { type: "START", now: 0 },
      { type: "ADD", now: 7000, ingredientId: "natto", ingredientState: "ready", input },
    ];
    const direct = reduce(events("direct"));
    const alternative = reduce(events("alternative"));
    if (direct.status !== "baking" || alternative.status !== "baking") throw new Error("expected baking");
    expect({ ...direct.additions[0], input: undefined }).toEqual({ ...alternative.additions[0], input: undefined });
  });

  it("ignores stale clocks, repeated starts and all events after completion", () => {
    let state = reduce([{ type: "START", now: 100 }, { type: "TICK", now: 7000 }]);
    const stale = midBakeReducer(state, { type: "TICK", now: 6999 });
    expect(stale).toBe(state);
    expect(midBakeReducer(state, { type: "START", now: 8000 })).toBe(state);
    state = midBakeReducer(state, { type: "TICK", now: 10100 });
    expect(midBakeReducer(state, { type: "TICK", now: 20000 })).toBe(state);
  });

  it("cancels back to the same plan and validates plans at construction", () => {
    const running = reduce([{ type: "START", now: 0 }]);
    expect(midBakeReducer(running, { type: "CANCEL" })).toEqual({ status: "idle", plan: PLAN });
    expect(() => createMidBakeState({ ...PLAN, requirements: [] })).toThrow("at least one");
    expect(() => createMidBakeState({ ...PLAN, totalBakeMs: 0 })).toThrow("Invalid MID_BAKE plan");
  });

  describe("rejects ADD with a stale or non-finite clock", () => {
    const openWindow = () => reduce([{ type: "START", now: 0 }, { type: "TICK", now: 7000 }]);

    it.each(["direct", "alternative"] as const)("keeps state untouched for %s input", (input) => {
      for (const now of [6999, NaN, Infinity, -Infinity]) {
        const state = openWindow();
        expect(state).toMatchObject({ status: "baking", stage: "window-open", lastAt: 7000 });
        const next = midBakeReducer(state, { type: "ADD", now, ingredientId: "natto", ingredientState: "ready", input });
        expect(next, `ADD(${now})`).toBe(state);
      }
    });

    it.each(["direct", "alternative"] as const)("still accepts a valid ADD afterwards for %s input", (input) => {
      let state = openWindow();
      state = midBakeReducer(state, { type: "ADD", now: NaN, ingredientId: "natto", ingredientState: "ready", input });
      state = midBakeReducer(state, { type: "ADD", now: 7000, ingredientId: "natto", ingredientState: "ready", input });
      expect(state.status === "baking" && state.additions).toHaveLength(1);
    });
  });
});
