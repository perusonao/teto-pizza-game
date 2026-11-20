import { describe, expect, it } from "vitest";
import { BAKE_DURATION_S, BAKE_MAX_FRAME_DT_S } from "../bakeProgress";
import {
  createLabClock,
  labClockEngineNow,
  labClockPositionPct,
  labClockReducer,
  LAB_HOLD_TIMEOUT_MS_PROVISIONAL,
  type LabClockEvent,
  type LabClockState,
} from "./labClock";
import { createMidBakeState, midBakeReducer, type MidBakeEvent, type MidBakePlan, type MidBakeState } from "./midBakeState";

const FRAME = BAKE_MAX_FRAME_DT_S * 1000; // 100 ms, the largest slice one frame may add
const HOLD_AT = 0.65 * 3000;

function frames(state: LabClockState, count: number, dtMs: number = FRAME): LabClockState {
  let next = state;
  for (let i = 0; i < count; i += 1) next = labClockReducer(next, { type: "FRAME", dtMs });
  return next;
}

function toHold(): LabClockState {
  return frames(createLabClock(), 20);
}

describe("Lab clock defaults and validation", () => {
  it("derives the bake length from the shared constant and keeps the hold timeout provisional", () => {
    const clock = createLabClock();
    expect(clock.config.totalBakeMs).toBe(BAKE_DURATION_S * 1000);
    expect(clock.config.window).toEqual({ start: 0.65, end: 0.9 });
    expect(clock.config.holdTimeoutMs).toBe(LAB_HOLD_TIMEOUT_MS_PROVISIONAL);
    expect(LAB_HOLD_TIMEOUT_MS_PROVISIONAL).toBe(6000);
    expect(clock).toMatchObject({ status: "running", elapsedMs: 0, holdUsed: false, released: null });
  });

  it("rejects an invalid total, window or hold timeout", () => {
    expect(() => createLabClock({ totalBakeMs: 0 })).toThrow("Invalid Lab clock total");
    expect(() => createLabClock({ totalBakeMs: Number.NaN })).toThrow("Invalid Lab clock total");
    expect(() => createLabClock({ window: { start: 0.9, end: 0.65 } })).toThrow("Invalid Lab clock window");
    expect(() => createLabClock({ holdTimeoutMs: 0 })).toThrow("Invalid Lab clock hold timeout");
    expect(() => createLabClock({ holdTimeoutMs: Number.POSITIVE_INFINITY })).toThrow("Invalid Lab clock hold timeout");
  });
});

describe("Lab clock running and the frame limit", () => {
  it("advances linearly like the bake and reports the gauge position", () => {
    const clock = frames(createLabClock(), 10);
    expect(clock).toMatchObject({ status: "running", elapsedMs: 1000 });
    expect(labClockPositionPct(clock)).toBeCloseTo(100 / 3, 9);
    expect(labClockEngineNow(clock)).toBe(1000);
  });

  it("limits one frame to the shared cap, so a backgrounded tab cannot jump ahead", () => {
    const clock = labClockReducer(createLabClock(), { type: "FRAME", dtMs: 5000 });
    expect(clock.elapsedMs).toBe(FRAME);
  });

  it("ignores invalid, zero and negative frames without changing the state object", () => {
    const clock = createLabClock();
    for (const dtMs of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -50, 0]) {
      expect(labClockReducer(clock, { type: "FRAME", dtMs })).toBe(clock);
    }
  });
});

describe("Lab clock hold policy", () => {
  it("stops exactly at the window start, once, and drops the rest of that frame", () => {
    const before = frames(createLabClock(), 19);
    expect(before).toMatchObject({ status: "running", elapsedMs: 1900 });
    const held = labClockReducer(before, { type: "FRAME", dtMs: FRAME });
    expect(held).toMatchObject({ status: "holding", elapsedMs: HOLD_AT, holdUsed: true, released: null });
    expect(labClockPositionPct(held)).toBeCloseTo(65, 9);
  });

  it("keeps the bake clock constant while holding and counts the hold time", () => {
    const held = frames(toHold(), 10);
    expect(held).toMatchObject({ status: "holding", elapsedMs: HOLD_AT, holdElapsedMs: 1000 });
    expect(labClockEngineNow(held)).toBe(HOLD_AT);
  });

  it("resumes by itself when the provisional timeout elapses, and never holds twice", () => {
    let clock = frames(toHold(), 59);
    expect(clock.status).toBe("holding");
    clock = labClockReducer(clock, { type: "FRAME", dtMs: FRAME });
    expect(clock).toMatchObject({ status: "running", released: "timeout", elapsedMs: HOLD_AT, holdElapsedMs: 6000 });
    clock = frames(clock, 5);
    expect(clock).toMatchObject({ status: "running", elapsedMs: HOLD_AT + 500, released: "timeout" });
    expect(clock.holdUsed).toBe(true);
  });

  it("honours a custom Lab timeout", () => {
    let clock = frames(createLabClock({ holdTimeoutMs: 300 }), 20);
    clock = frames(clock, 3);
    expect(clock).toMatchObject({ status: "running", released: "timeout" });
  });

  it.each(["complete", "closed"] as const)("releases the hold on RELEASE(%s) and then runs to the end", (reason) => {
    let clock = labClockReducer(toHold(), { type: "RELEASE", reason });
    expect(clock).toMatchObject({ status: "running", released: reason, elapsedMs: HOLD_AT });
    clock = frames(clock, 10);
    expect(clock).toMatchObject({ status: "running", elapsedMs: 2950 });
    clock = frames(clock, 1);
    expect(clock).toMatchObject({ status: "finished", elapsedMs: 3000 });
    expect(labClockPositionPct(clock)).toBe(100);
  });

  it("ignores RELEASE when not holding and every event after the end", () => {
    const running = createLabClock();
    expect(labClockReducer(running, { type: "RELEASE", reason: "closed" })).toBe(running);
    const done = frames(labClockReducer(toHold(), { type: "RELEASE", reason: "closed" }), 40);
    expect(done.status).toBe("finished");
    expect(labClockReducer(done, { type: "FRAME", dtMs: FRAME })).toBe(done);
    expect(labClockReducer(done, { type: "RELEASE", reason: "complete" })).toBe(done);
  });

  it("is a plain bake clock when the hold is disabled (regression baseline)", () => {
    const clock = frames(createLabClock({ holdAtWindowStart: false }), 29);
    expect(clock).toMatchObject({ status: "running", elapsedMs: 2900, holdUsed: false, released: null });
    expect(frames(clock, 1)).toMatchObject({ status: "finished", elapsedMs: 3000 });
  });

  it("is deterministic for the same frame sequence", () => {
    const run = () => frames(labClockReducer(toHold(), { type: "RELEASE", reason: "closed" }), 7);
    expect(run()).toEqual(run());
  });
});

const NATTO: MidBakePlan = {
  recipeId: "natto-pizza",
  totalBakeMs: BAKE_DURATION_S * 1000,
  requirements: [{ ingredientId: "natto", count: 2 }],
};

/** Drives the clock and the MID_BAKE engine together the way the Lab will: the engine only ever sees the bake clock. */
function session(script: readonly (LabClockEvent | { readonly type: "ADD"; readonly input: "direct" | "alternative" })[]) {
  let clock = createLabClock({ totalBakeMs: NATTO.totalBakeMs });
  let engine: MidBakeState = midBakeReducer(createMidBakeState(NATTO), { type: "START", now: labClockEngineNow(clock) });
  const nows: number[] = [];
  for (const step of script) {
    if (step.type === "ADD") {
      const event: MidBakeEvent = { type: "ADD", now: labClockEngineNow(clock), ingredientId: "natto", ingredientState: "ready", input: step.input };
      engine = midBakeReducer(engine, event);
    } else {
      clock = labClockReducer(clock, step);
      engine = midBakeReducer(engine, { type: "TICK", now: labClockEngineNow(clock) });
    }
    nows.push(labClockEngineNow(clock));
  }
  return { clock, engine, nows };
}

const frame = (): LabClockEvent => ({ type: "FRAME", dtMs: FRAME });
const repeat = <T,>(item: T, count: number): T[] => Array.from({ length: count }, () => item);

describe("Lab clock with the MID_BAKE engine", () => {
  it("accepts both additions while holding (now === lastAt) and completes", () => {
    const { clock, engine, nows } = session([
      ...repeat(frame(), 20),
      { type: "ADD", input: "direct" },
      { type: "ADD", input: "alternative" },
      { type: "RELEASE", reason: "complete" },
      ...repeat(frame(), 15),
    ]);
    expect(clock.status).toBe("finished");
    expect(engine).toMatchObject({ status: "finished", completion: "complete", additions: [{ input: "direct" }, { input: "alternative" }] });
    for (let i = 1; i < nows.length; i += 1) expect(nows[i]).toBeGreaterThanOrEqual(nows[i - 1]);
  });

  it("matches the bake window: window-open exactly while holding, rebaking after the window end", () => {
    const held = session(repeat(frame(), 20));
    expect(held.engine).toMatchObject({ status: "baking", stage: "window-open", progress: 0.65 });
    const late = session([...repeat(frame(), 20), { type: "RELEASE", reason: "closed" }, ...repeat(frame(), 8), { type: "ADD", input: "direct" }]);
    expect(late.engine).toMatchObject({ status: "baking", stage: "rebaking", additions: [] });
  });

  it("records a miss as missing-additions when the hold times out untouched (regression of the miss path)", () => {
    const { clock, engine } = session([...repeat(frame(), 20), ...repeat(frame(), 60), ...repeat(frame(), 15)]);
    expect(clock).toMatchObject({ status: "finished", released: "timeout" });
    expect(engine).toMatchObject({ status: "finished", completion: "missing-additions", additions: [] });
  });

  it("records the same miss when the player closes without adding", () => {
    const { engine } = session([...repeat(frame(), 20), { type: "RELEASE", reason: "closed" }, ...repeat(frame(), 15)]);
    expect(engine).toMatchObject({ status: "finished", completion: "missing-additions" });
  });

  it("keeps accepting valid additions after a release while the window is still open (the clock never goes backwards)", () => {
    const { engine } = session([...repeat(frame(), 20), { type: "ADD", input: "direct" }, { type: "RELEASE", reason: "closed" }, ...repeat(frame(), 2), { type: "ADD", input: "direct" }]);
    expect(engine.status === "baking" && engine.additions).toHaveLength(2);
  });
});
