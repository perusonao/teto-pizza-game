import { describe, expect, it } from "vitest";
import {
  applyStretchPoint,
  createIdealDoughShape,
  createInitialDoughShape,
  DOUGH_SHAPE_MIN_RADIUS,
  DOUGH_SHAPE_TECHNICAL_MAX_RADIUS,
  isDoughShapeComplete,
  isValidDoughShape,
  type DoughShape,
} from "../doughShape";
import {
  createDoughAltState,
  DOUGH_ALT_DIRECTION_LABEL_JA,
  DOUGH_ALT_STEP,
  doughAltReduce,
  doughAltStatus,
  doughAltVisual,
  isDoughAltComplete,
  stepDoughShape,
  type DoughAltEvent,
  type DoughAltState,
} from "./doughAltMachine";

const STEP_UP: DoughAltEvent = { type: "STEP", delta: 1 };
const STEP_DOWN: DoughAltEvent = { type: "STEP", delta: -1 };
const NEXT: DoughAltEvent = { type: "DIR_NEXT" };

function run(state: DoughAltState, events: readonly DoughAltEvent[]): DoughAltState {
  return events.reduce(doughAltReduce, state);
}
function deepFreeze<T extends DoughShape>(shape: T): T {
  Object.freeze(shape.radii);
  return Object.freeze(shape);
}

describe("D-A' initial state", () => {
  it("starts at direction 0 on the initial dough, nothing pressed, not complete", () => {
    const s = createDoughAltState(3);
    expect(s.dir).toBe(0);
    expect(s.steps).toBe(0);
    expect(s.revision).toBe(3);
    expect(s.shape).toEqual(createInitialDoughShape());
    expect(isDoughAltComplete(s)).toBe(false);
  });
  it("falls back to the initial dough for an invalid starting shape", () => {
    expect(createDoughAltState(0, { radii: [1, 2, 3] }).shape).toEqual(createInitialDoughShape());
  });
  it("the step size is the Owner-provisional 8", () => {
    expect(DOUGH_ALT_STEP).toBe(8);
  });
});

describe("D-A' a press is exactly one applyStretchPoint on the chosen direction (C2: same function as the gesture)", () => {
  it("+ at every direction equals applyStretchPoint at (radius + 8) along that direction", () => {
    for (let dir = 0; dir < 8; dir += 1) {
      const start = createDoughAltState(0);
      const s = run(start, Array.from({ length: dir }, () => NEXT));
      expect(s.dir).toBe(dir);
      const angle = (dir / 8) * Math.PI * 2;
      const r = s.shape.radii[dir] + DOUGH_ALT_STEP;
      expect(doughAltReduce(s, STEP_UP).shape).toEqual(applyStretchPoint(s.shape, 50 + Math.cos(angle) * r, 50 + Math.sin(angle) * r));
    }
  });
  it("stepDoughShape returns the same object when the press changes nothing (at a limit)", () => {
    const maxed: DoughShape = { radii: new Array(8).fill(DOUGH_SHAPE_TECHNICAL_MAX_RADIUS) };
    expect(stepDoughShape(maxed, 0, 1)).toBe(maxed);
  });
  it("+ grows the chosen point; - shrinks it, never below the floor", () => {
    const s0 = createDoughAltState(0);
    const up = doughAltReduce(s0, STEP_UP);
    expect(up.shape.radii[0]).toBeGreaterThan(s0.shape.radii[0]);
    expect(up.steps).toBe(1);
    const down = doughAltReduce(s0, STEP_DOWN);
    expect(down.shape.radii[0]).toBeLessThan(s0.shape.radii[0]);
    expect(down.shape.radii[0]).toBeGreaterThanOrEqual(DOUGH_SHAPE_MIN_RADIUS);
    let s = s0;
    for (let i = 0; i < 20; i += 1) s = doughAltReduce(s, STEP_DOWN);
    expect(isValidDoughShape(s.shape)).toBe(true);
    expect(Math.min(...s.shape.radii)).toBeGreaterThanOrEqual(DOUGH_SHAPE_MIN_RADIUS);
  });
  it("is not an isotropic button: one direction pressed leaves a far side untouched", () => {
    const s = doughAltReduce(createDoughAltState(0), STEP_UP);
    expect(s.shape.radii[4]).toBe(createInitialDoughShape().radii[4]);
  });
});

describe("D-A' directions", () => {
  it("DIR_NEXT / DIR_PREV wrap around the 8 points and do not touch the shape", () => {
    const s0 = createDoughAltState(0);
    expect(doughAltReduce(s0, { type: "DIR_PREV" }).dir).toBe(7);
    expect(run(s0, Array.from({ length: 8 }, () => NEXT)).dir).toBe(0);
    expect(doughAltReduce(s0, NEXT).shape).toBe(s0.shape);
  });
  it("has a Japanese label for each of the 8 directions (east first, clockwise)", () => {
    expect(DOUGH_ALT_DIRECTION_LABEL_JA).toEqual(["右", "右下", "下", "左下", "左", "左上", "上", "右上"]);
  });
});

describe("D-A' completion (derived, Owner: further inputs are no-ops)", () => {
  /** + then next direction, around the ring: the Delta=8 table in the design doc. */
  function cycle(): { state: DoughAltState; presses: number } {
    let s = createDoughAltState(0);
    let presses = 0;
    for (let i = 0; i < 40 && !isDoughAltComplete(s); i += 1) {
      s = doughAltReduce(s, STEP_UP);
      presses += 1;
      s = doughAltReduce(s, NEXT);
    }
    return { state: s, presses };
  }
  it("cycling the 8 directions once each completes the dough in 10 presses (Delta = 8)", () => {
    const { state, presses } = cycle();
    expect(isDoughAltComplete(state)).toBe(true);
    expect(isDoughShapeComplete(state.shape)).toBe(true);
    expect(presses).toBe(10);
    expect(state.steps).toBe(10);
  });
  it("after completion STEP (+ and -), DIR_NEXT and DIR_PREV return the very same state", () => {
    const { state } = cycle();
    for (const e of [STEP_UP, STEP_DOWN, NEXT, { type: "DIR_PREV" } as DoughAltEvent]) {
      expect(doughAltReduce(state, e)).toBe(state);
    }
  });
  it("a natural gesture that shrinks the dough (SYNC) re-enables the buttons; one that keeps it complete does not", () => {
    const { state } = cycle();
    const small = deepFreeze({ radii: new Array(8).fill(20) });
    const reopened = doughAltReduce(state, { type: "SYNC", shape: small });
    expect(isDoughAltComplete(reopened)).toBe(false);
    expect(doughAltReduce(reopened, STEP_UP).steps).toBe(reopened.steps + 1);
    const stillComplete = doughAltReduce(state, { type: "SYNC", shape: createIdealDoughShape() });
    expect(isDoughAltComplete(stillComplete)).toBe(true);
    expect(doughAltReduce(stillComplete, STEP_UP)).toBe(stillComplete);
  });
});

describe("D-A' SYNC / CANCEL / INVALIDATE / invalid input", () => {
  it("SYNC adopts a valid shape and keeps the direction and step count", () => {
    const s = run(createDoughAltState(0), [NEXT, NEXT, STEP_UP]);
    const shape = deepFreeze({ radii: new Array(8).fill(25) });
    const synced = doughAltReduce(s, { type: "SYNC", shape });
    expect(synced.shape).toBe(shape);
    expect(synced.dir).toBe(2);
    expect(synced.steps).toBe(1);
  });
  it("SYNC with an invalid shape or the same object is ignored", () => {
    const s = createDoughAltState(0);
    expect(doughAltReduce(s, { type: "SYNC", shape: { radii: [1, 2] } })).toBe(s);
    expect(doughAltReduce(s, { type: "SYNC", shape: { radii: new Array(8).fill(Number.NaN) } })).toBe(s);
    expect(doughAltReduce(s, { type: "SYNC", shape: s.shape })).toBe(s);
  });
  it("CANCEL changes nothing (the buttons are discrete)", () => {
    const s = doughAltReduce(createDoughAltState(0), STEP_UP);
    expect(doughAltReduce(s, { type: "CANCEL" })).toBe(s);
  });
  it("INVALIDATE with another revision starts over; with the same revision does nothing", () => {
    const s = run(createDoughAltState(1), [NEXT, STEP_UP]);
    expect(doughAltReduce(s, { type: "INVALIDATE", revision: 1 })).toBe(s);
    const fresh = doughAltReduce(s, { type: "INVALIDATE", revision: 2 });
    expect(fresh).toEqual(createDoughAltState(2));
    expect(doughAltReduce(s, { type: "INVALIDATE", revision: Number.NaN })).toBe(s);
  });
  it("a bad delta or an unknown event leaves the state alone and never throws", () => {
    const s = createDoughAltState(0);
    for (const delta of [0, 2, -2, Number.NaN, 1.5]) {
      expect(doughAltReduce(s, { type: "STEP", delta } as unknown as DoughAltEvent)).toBe(s);
    }
    expect(doughAltReduce(s, { type: "NOPE" } as unknown as DoughAltEvent)).toBe(s);
  });
});

describe("D-A' invariants over a long mixed press sequence", () => {
  it("the shape stays valid, steps only count real changes, input state is never mutated, same inputs give the same result", () => {
    const events: DoughAltEvent[] = [];
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 400; i += 1) {
      const r = rnd();
      events.push(r < 0.3 ? NEXT : r < 0.45 ? { type: "DIR_PREV" } : r < 0.8 ? STEP_UP : STEP_DOWN);
    }
    let s = deepFreeze(createInitialDoughShape()) && createDoughAltState(0, deepFreeze(createInitialDoughShape()));
    let changes = 0;
    for (const e of events) {
      const before = s;
      s = doughAltReduce(s, e);
      if (s.shape !== before.shape) changes += 1;
      deepFreeze(s.shape);
      expect(isValidDoughShape(s.shape)).toBe(true);
      expect(Math.max(...s.shape.radii)).toBeLessThanOrEqual(DOUGH_SHAPE_TECHNICAL_MAX_RADIUS);
      expect(Math.min(...s.shape.radii)).toBeGreaterThanOrEqual(DOUGH_SHAPE_MIN_RADIUS);
    }
    expect(s.steps).toBe(changes);
    expect(run(createDoughAltState(0), events)).toEqual(run(createDoughAltState(0), events));
  });
});

describe("D-A' status (read aloud in 25% steps, never the raw number) and visual", () => {
  it("percent is 0..75 until complete and 100 only when complete; it never decreases while pressing +", () => {
    let s = createDoughAltState(0);
    let last = -1;
    for (let i = 0; i < 30 && !isDoughAltComplete(s); i += 1) {
      const st = doughAltStatus(s);
      expect([0, 25, 50, 75]).toContain(st.percent);
      expect(st.complete).toBe(false);
      expect(st.percent).toBeGreaterThanOrEqual(last);
      last = st.percent;
      s = doughAltReduce(doughAltReduce(s, STEP_UP), NEXT);
    }
    expect(doughAltStatus(s)).toMatchObject({ percent: 100, complete: true });
  });
  it("names the current direction and exposes the focus for drawing", () => {
    const s = run(createDoughAltState(0), [NEXT, NEXT]);
    expect(doughAltStatus(s).dirLabelJa).toBe("下");
    expect(doughAltVisual(s)).toMatchObject({ focusDir: 2, focusAngle: Math.PI / 2 });
  });
});
