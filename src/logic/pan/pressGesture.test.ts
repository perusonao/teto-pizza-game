import { describe, expect, it } from "vitest";
import {
  HOLD_START_MS,
  IDLE_PRESS_GESTURE,
  MOVE_SLOP_PX,
  stepPressGesture,
  type PressEvent,
  type PressGestureState,
  type PressStep,
} from "./pressGesture";
import { applyPressEffects, pressAt, type PressEffect } from "./squareDoughSpread";
import { createLumpySquareDough } from "./squareDoughFixtures";
import { squareDoughEvenness, type SquareDough } from "./squareDough";

const CENTER = { x: 58, y: 48 };
const P = 1; // the pointer id used unless a test says otherwise

const down = (at: number, pointerId = P, clientX = 100, clientY = 200): PressEvent => ({ type: "down", pointerId, at, clientX, clientY, center: CENTER });
const move = (at: number, clientX: number, clientY: number, pointerId = P): PressEvent => ({ type: "move", pointerId, at, clientX, clientY });
const tick = (at: number): PressEvent => ({ type: "tick", at });
const up = (at: number, pointerId = P): PressEvent => ({ type: "up", pointerId, at });
const cancel = (at: number, pointerId?: number): PressEvent => ({ type: "cancel", at, ...(pointerId === undefined ? {} : { pointerId }) });

interface Run {
  readonly state: PressGestureState;
  readonly steps: readonly PressStep[];
  readonly effects: readonly PressEffect[];
  readonly ends: readonly ("commit" | "discard")[];
}

function run(events: readonly PressEvent[], from: PressGestureState = IDLE_PRESS_GESTURE): Run {
  let state = from;
  const steps: PressStep[] = [];
  for (const event of events) {
    const step = stepPressGesture(state, event);
    steps.push(step);
    state = step.state;
  }
  return {
    state,
    steps,
    effects: steps.flatMap((s) => s.effects),
    ends: steps.flatMap((s) => (s.end === null ? [] : [s.end])),
  };
}

/** Ticks every `everyMs` from `from` up to and including `to`. */
function ticks(from: number, to: number, everyMs: number): PressEvent[] {
  const out: PressEvent[] = [];
  for (let at = from; at <= to; at += everyMs) out.push(tick(at));
  return out;
}

const holdsOf = (effects: readonly PressEffect[]) => effects.filter((e): e is Extract<PressEffect, { kind: "hold" }> => e.kind === "hold");

describe("TAP", () => {
  it("applies the push-in the instant the finger goes down, before anything else happens", () => {
    const r = run([down(1000)]);
    expect(r.effects).toEqual([{ kind: "press", center: CENTER }]);
    expect(r.state.phase).toBe("pressing");
    expect(r.ends).toEqual([]);
  });

  it("a quick tap is one push-in and a commit: nothing is held, nothing waits", () => {
    const r = run([down(1000), ...ticks(1016, 1100, 16), up(1120)]);
    expect(r.effects).toEqual([{ kind: "press", center: CENTER }]);
    expect(r.ends).toEqual(["commit"]);
    expect(r.state).toEqual(IDLE_PRESS_GESTURE);
  });

  it("a press that ends just before the hold begins is still a tap (HOLD_START_MS is the line)", () => {
    expect(holdsOf(run([down(0), tick(HOLD_START_MS - 1), up(HOLD_START_MS - 1)]).effects)).toHaveLength(0);
    expect(holdsOf(run([down(0), tick(HOLD_START_MS), up(HOLD_START_MS)]).effects)).toHaveLength(0); // zero hold time so far
    expect(holdsOf(run([down(0), tick(HOLD_START_MS + 1), up(HOLD_START_MS + 1)]).effects)).toHaveLength(1);
  });
});

describe("HOLD", () => {
  it("starts after HOLD_START_MS of a still finger, and its elapsed time counts from there", () => {
    const r = run([down(0), ...ticks(16, 1000, 16)]);
    const holds = holdsOf(r.effects);
    expect(holds.length).toBeGreaterThan(0);
    expect(r.steps.slice(1).filter((s) => s.effects.length > 0)[0].effects[0]).toMatchObject({ kind: "hold", elapsedMs: 208 - HOLD_START_MS });
    expect(holds.every((h) => h.center === CENTER)).toBe(true);
    // elapsed grows with the ticks
    for (let i = 1; i < holds.length; i++) expect(holds[i].elapsedMs).toBeGreaterThan(holds[i - 1].elapsedMs);
    expect(r.state.phase).toBe("holding");
  });

  it("accounts for exactly the time held: the dts add up to (up - HOLD_START_MS), at any tick rate, and the last bit before pointer-up counts", () => {
    const releaseAt = 1337;
    for (const every of [4, 8, 16, 33, 50, 100]) {
      const r = run([down(0), ...ticks(every, releaseAt, every), up(releaseAt)]);
      const total = holdsOf(r.effects).reduce((sum, h) => sum + h.dtMs, 0);
      expect(total, `tick every ${every} ms`).toBeCloseTo(releaseAt - HOLD_START_MS, 9);
    }
    // no ticks at all between down and up: the whole hold is one effect at the release
    const r = run([down(0), up(releaseAt)]);
    expect(holdsOf(r.effects)).toEqual([{ kind: "hold", center: CENTER, elapsedMs: releaseAt - HOLD_START_MS, dtMs: releaseAt - HOLD_START_MS }]);
    expect(r.ends).toEqual(["commit"]);
  });

  it("a tick that goes backwards in time, or repeats a time, adds nothing", () => {
    const r = run([down(0), tick(500), tick(500), tick(400), tick(450)]);
    expect(holdsOf(r.effects)).toHaveLength(1);
  });

  it("small jitter inside MOVE_SLOP_PX does not stop the hold", () => {
    const r = run([down(0), tick(300), move(310, 100 + 4, 200 - 5), tick(330), move(340, 100 - 6, 200 + 7), tick(400), up(420)]);
    expect(r.state.phase).toBe("idle");
    expect(holdsOf(r.effects).length).toBeGreaterThanOrEqual(3);
    expect(r.steps.some((s) => s.state.phase === "moved")).toBe(false);
  });
});

describe("a finger that wanders is dragging, not spreading", () => {
  it("MOVE_SLOP_PX is the line: exactly that far is still a press, anything farther ends the spread", () => {
    expect(run([down(0), move(10, 100 + MOVE_SLOP_PX, 200)]).state.phase).toBe("pressing");
    expect(run([down(0), move(10, 100 + MOVE_SLOP_PX + 0.001, 200)]).state.phase).toBe("moved");
    expect(run([down(0), move(10, 100 + 6, 200 + 8)]).state.phase).toBe("pressing"); // 3-4-5: exactly 10
    expect(run([down(0), move(10, 100 + 7, 200 + 8)]).state.phase).toBe("moved"); // farther than 10
    expect(MOVE_SLOP_PX).toBe(10);
  });

  it("after the finger has moved away nothing more is applied, but what was done stays and the release commits it", () => {
    const r = run([down(0), tick(300), move(320, 100 + 40, 200), tick(340), tick(500), up(600)]);
    const afterMove = r.steps.slice(3); // from the tick right after the move
    expect(afterMove.every((s) => s.effects.length === 0)).toBe(true);
    expect(r.ends).toEqual(["commit"]);
    expect(r.state).toEqual(IDLE_PRESS_GESTURE);
  });

  it("the hold up to the instant of the move is accounted for, once", () => {
    const r = run([down(0), tick(300), move(320, 100 + 40, 200)]);
    const holds = holdsOf(r.effects);
    expect(holds.reduce((sum, h) => sum + h.dtMs, 0)).toBeCloseTo(320 - HOLD_START_MS, 9);
  });

  it("a move before the hold has begun just ends the press as a tap", () => {
    const r = run([down(0), move(50, 100 + 30, 200), tick(400), up(500)]);
    expect(r.effects).toEqual([{ kind: "press", center: CENTER }]);
    expect(r.ends).toEqual(["commit"]);
  });
});

describe("cancel, and the things that must never leave a half-made dough behind", () => {
  it("pointer cancel discards the whole gesture and returns to idle", () => {
    const r = run([down(0), tick(300), cancel(350, P)]);
    expect(r.ends).toEqual(["discard"]);
    expect(r.state).toEqual(IDLE_PRESS_GESTURE);
    expect(r.steps[2].effects).toEqual([]);
  });

  it("a cancel with no pointer id (window blur, the tab hidden, a step change) discards any gesture", () => {
    expect(run([down(0), cancel(10)]).ends).toEqual(["discard"]);
    expect(run([down(0), tick(500), move(510, 400, 400), cancel(520)]).ends).toEqual(["discard"]);
  });

  it("a cancel for some other pointer is ignored", () => {
    const r = run([down(0), cancel(10, 99)]);
    expect(r.ends).toEqual([]);
    expect(r.state.phase).toBe("pressing");
  });

  it("cancel / up / tick / move when no gesture is live change nothing", () => {
    for (const event of [cancel(5), cancel(5, P), up(5), tick(5), move(5, 1, 1)]) {
      const step = stepPressGesture(IDLE_PRESS_GESTURE, event);
      expect(step.state).toBe(IDLE_PRESS_GESTURE);
      expect(step.effects).toEqual([]);
      expect(step.end).toBeNull();
    }
  });

  it("a gesture after a cancel starts clean", () => {
    const r = run([down(0), tick(400), cancel(450), down(1000, 2), up(1050, 2)]);
    expect(r.ends).toEqual(["discard", "commit"]);
    expect(r.effects.filter((e) => e.kind === "press")).toHaveLength(2);
  });
});

describe("one finger at a time", () => {
  it("a second finger going down while one is down is ignored, with its moves and its up", () => {
    const r = run([down(0), down(50, 2, 300, 300), move(60, 900, 900, 2), tick(300), up(310, 2)]);
    expect(r.state.pointerId).toBe(P);
    expect(r.state.phase).toBe("holding");
    expect(r.effects.filter((e) => e.kind === "press")).toHaveLength(1);
    expect(r.ends).toEqual([]);
    expect(run([down(0), up(100), down(200, 2)]).state.pointerId).toBe(2); // once free, the next finger can press
  });

  it("an up from another pointer does not end the gesture", () => {
    const r = run([down(0), up(40, 7)]);
    expect(r.ends).toEqual([]);
    expect(r.state.phase).toBe("pressing");
  });
});

describe("bad input", () => {
  it("non-finite times, positions and centres are ignored, never turned into an effect", () => {
    expect(run([{ ...(down(0) as Extract<PressEvent, { type: "down" }>), at: NaN }]).state).toEqual(IDLE_PRESS_GESTURE);
    expect(run([{ ...(down(0) as Extract<PressEvent, { type: "down" }>), clientX: Infinity }]).state).toEqual(IDLE_PRESS_GESTURE);
    expect(run([{ ...(down(0) as Extract<PressEvent, { type: "down" }>), center: { x: NaN, y: 1 } }]).effects).toEqual([]);
    const live = run([down(0)]).state;
    expect(run([tick(NaN)], live).effects).toEqual([]);
    expect(run([move(NaN, 1, 1)], live).state.phase).toBe("pressing");
    expect(run([move(10, NaN, 1)], live).state.phase).toBe("pressing");
  });
});

describe("through the dough: what a finger really does to the thickness", () => {
  /** Replays a gesture over a working copy and returns the dough to keep (the committed one) or the original (discarded). */
  function replay(initial: SquareDough, events: readonly PressEvent[]): SquareDough {
    let state: PressGestureState = IDLE_PRESS_GESTURE;
    let working = initial;
    for (const event of events) {
      const step = stepPressGesture(state, event);
      state = step.state;
      working = applyPressEffects(working, step.effects);
      if (step.end === "discard") return initial;
    }
    return working;
  }

  it("a tap changes the dough only locally and keeps it after the finger lifts; a hold spreads farther and levels more", () => {
    const lumpy = createLumpySquareDough();
    const tapped = replay(lumpy, [down(0), up(80)]);
    expect(tapped).toEqual(pressAt(lumpy, CENTER));
    expect(squareDoughEvenness(tapped)).toBeGreaterThan(squareDoughEvenness(lumpy));

    const held = replay(lumpy, [down(0), ...ticks(16, 1200, 16), up(1200)]);
    // the hold goes on from the tap's push-in: it spreads farther and levels more, and the result is kept
    expect(held).not.toEqual(tapped);
    expect(squareDoughEvenness(held)).toBeGreaterThan(squareDoughEvenness(tapped));
    const reached = (d: SquareDough) => d.thickness.filter((t, i) => t !== lumpy.thickness[i]).length;
    expect(reached(held)).toBeGreaterThan(reached(tapped));
  });

  it("a cancelled press leaves the dough exactly as it was", () => {
    const lumpy = createLumpySquareDough();
    expect(replay(lumpy, [down(0), ...ticks(16, 600, 16), cancel(620)])).toBe(lumpy);
  });

  it("a hold that drifts keeps what it did before it drifted, and nothing after", () => {
    const lumpy = createLumpySquareDough();
    const drifted = replay(lumpy, [down(0), ...ticks(16, 400, 16), move(410, 100 + 50, 200), ...ticks(420, 1000, 16), up(1000)]);
    const heldThenReleased = replay(lumpy, [down(0), ...ticks(16, 400, 16), up(410)]);
    expect(drifted).toEqual(heldThenReleased);
  });

  it("the result does not depend on the tick rate (60 vs 30 vs 120 per second end close together)", () => {
    const lumpy = createLumpySquareDough();
    const at = (every: number) => squareDoughEvenness(replay(lumpy, [down(0), ...ticks(every, 1000, every), up(1000)]));
    const values = [at(1000 / 120), at(1000 / 60), at(1000 / 30)];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThan(0.01);
  });
});
