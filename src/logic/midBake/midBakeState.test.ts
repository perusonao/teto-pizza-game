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

  describe("ADD with a stale or non-finite clock is a complete no-op", () => {
    const add = (now: number, input: "direct" | "alternative"): MidBakeEvent => ({ type: "ADD", now, ingredientId: "natto", ingredientState: "ready", input });
    const windowOpen = (): MidBakeState => reduce([{ type: "START", now: 0 }, { type: "TICK", now: 7000 }]);

    for (const input of ["direct", "alternative"] as const) {
      it(`START(0) -> TICK(7000) -> ADD(6999) returns the same state (${input})`, () => {
        const state = windowOpen();
        expect(midBakeReducer(state, add(6999, input))).toBe(state);
      });

      for (const now of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        it(`ADD(${now}) returns the same state (${input})`, () => {
          const state = windowOpen();
          const next = midBakeReducer(state, add(now, input));
          expect(next).toBe(state);
          expect(next).toMatchObject({ status: "baking", lastAt: 7000, progress: 0.7, stage: "window-open", additions: [] });
        });
      }
    }

    it("keeps valid timing: equal-to-lastAt ADD works, window start is inclusive, end is exclusive, misses still finish", () => {
      const equal = midBakeReducer(windowOpen(), add(7000, "direct"));
      expect(equal.status === "baking" && equal.additions).toHaveLength(1);
      const start = midBakeReducer(reduce([{ type: "START", now: 0 }]), add(6500, "alternative"));
      expect(start.status === "baking" && start.additions).toHaveLength(1);
      const end = midBakeReducer(reduce([{ type: "START", now: 0 }]), add(9000, "direct"));
      expect(end.status === "baking" && end.additions).toHaveLength(0);
      expect(reduce([{ type: "START", now: 0 }, { type: "TICK", now: 10000 }])).toMatchObject({ status: "finished", completion: "missing-additions" });
    });
  });

  it("cancels back to the same plan and validates plans at construction", () => {
    const running = reduce([{ type: "START", now: 0 }]);
    expect(midBakeReducer(running, { type: "CANCEL" })).toEqual({ status: "idle", plan: PLAN });
    expect(() => createMidBakeState({ ...PLAN, requirements: [] })).toThrow("at least one");
    expect(() => createMidBakeState({ ...PLAN, totalBakeMs: 0 })).toThrow("Invalid MID_BAKE plan");
  });
});
