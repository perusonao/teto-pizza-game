import { describe, expect, it } from "vitest";
import {
  DRAG_FAST_PX,
  HOLD_START_MS,
  HOLD_TO_DRAG_PX,
  IDLE_PRESS_GESTURE,
  MOVE_SLOP_PX,
  stepPressGesture,
  type PressEvent,
  type PressGestureState,
  type PressStep,
} from "./pressGesture";
import { pressAt, type PressEffect } from "./squareDoughSpread";
import { applyGestureEffects, type GestureEffect } from "./squareDoughDrag";
import { createLumpySquareDough } from "./squareDoughFixtures";
import { createInitialSquareDough, squareDoughCoverage, squareDoughEvenness, type SquareDough } from "./squareDough";

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
  readonly effects: readonly GestureEffect[];
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

const holdsOf = (effects: readonly GestureEffect[]) => effects.filter((e): e is Extract<PressEffect, { kind: "hold" }> => e.kind === "hold");

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

describe("Codex review (#545)", () => {
  it("P2: a release with a non-finite time still ends and commits the gesture, with no non-finite effect and no stuck press", () => {
    for (const at of [NaN, Infinity, -Infinity]) {
      const r = run([down(0), tick(500), up(at)]);
      expect(r.ends, String(at)).toEqual(["commit"]);
      expect(r.state).toEqual(IDLE_PRESS_GESTURE);
      for (const e of r.effects) if (e.kind === "hold") expect(Number.isFinite(e.elapsedMs) && Number.isFinite(e.dtMs)).toBe(true);
      // the hold already accounted for stays; the unknown last stretch adds nothing
      expect(holdsOf(r.effects).reduce((sum, h) => sum + h.dtMs, 0)).toBeCloseTo(500 - HOLD_START_MS, 9);
    }
    // and the next press works
    expect(run([down(0), up(NaN), down(100, 2)]).state.pointerId).toBe(2);
  });

  it("P2: a move that crosses the slop after the hold began but before any tick keeps the hold up to that instant", () => {
    const r = run([down(0), move(500, 100 + 40, 200), tick(520), up(600)]);
    const holds = holdsOf(r.effects);
    expect(holds).toHaveLength(1);
    expect(holds[0]).toMatchObject({ elapsedMs: 500 - HOLD_START_MS, dtMs: 500 - HOLD_START_MS });
    expect(r.ends).toEqual(["commit"]);
    // a move before the hold began still leaves a plain tap
    expect(holdsOf(run([down(0), move(150, 100 + 40, 200), up(600)]).effects)).toHaveLength(0);
  });

  it("P2: a hold released with no tick in between is not shortened -- it ends close to the same hold sampled every 16 ms", () => {
    const lumpy = createLumpySquareDough();
    const keep = (events: readonly PressEvent[]) => {
      let state: PressGestureState = IDLE_PRESS_GESTURE;
      let working = lumpy;
      for (const event of events) {
        const step = stepPressGesture(state, event);
        state = step.state;
        working = applyGestureEffects(working, lumpy, step.effects);
      }
      return working;
    };
    const noTicks = keep([down(0), up(1200)]);
    const ticked = keep([down(0), ...ticks(16, 1200, 16), up(1200)]);
    expect(Math.abs(squareDoughEvenness(noTicks) - squareDoughEvenness(ticked))).toBeLessThan(0.01);
    expect(squareDoughEvenness(noTicks)).toBeGreaterThan(squareDoughEvenness(pressAt(lumpy, CENTER)));
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
      working = applyGestureEffects(working, initial, step.effects);
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

// ---- C (#536): the drag -----------------------------------------------------------------------------------------------------------
describe("DRAG (C, #536)", () => {
  const downP = (at: number): PressEvent => ({ type: "down", pointerId: P, at, clientX: 100, clientY: 200, center: CENTER, dragPrimary: true });
  const downS = (at: number): PressEvent => ({ type: "down", pointerId: P, at, clientX: 100, clientY: 200, center: CENTER });
  const moveTo = (at: number, dx: number, dy: number): PressEvent => ({
    type: "move",
    pointerId: P,
    at,
    clientX: 100 + dx,
    clientY: 200 + dy,
    point: { x: CENTER.x + dx * 0.4, y: CENTER.y + dy * 0.4 },
  });
  const dragsOf = (effects: readonly GestureEffect[]) => effects.filter((e): e is Extract<GestureEffect, { kind: "drag" }> => e.kind === "drag");

  it("STEP 1 (drag is the main operation): movement past the slop is a drag; the speculative tap is reverted first, and the path replays from where the finger went down", () => {
    const r = run([downP(0), moveTo(40, MOVE_SLOP_PX + 2, 0)]);
    expect(r.state.phase).toBe("dragging");
    expect(r.effects.map((e) => e.kind)).toEqual(["press", "revert", "drag"]);
    expect(dragsOf(r.effects)[0].from).toEqual(CENTER);
  });

  it("STEP 1: within the slop it is still a tap", () => {
    const r = run([downP(0), moveTo(40, MOVE_SLOP_PX - 1, 0), up(80)]);
    expect(r.state.phase).toBe("idle");
    expect(r.effects.map((e) => e.kind)).toEqual(["press"]);
    expect(r.ends).toEqual(["commit"]);
  });

  it("every later move of a drag is one more drag segment, continuing from the last point; nothing else is applied", () => {
    const r = run([downP(0), moveTo(20, 12, 0), moveTo(36, 30, 4), moveTo(52, 50, 8)]);
    const drags = dragsOf(r.effects);
    expect(drags).toHaveLength(3);
    expect(drags[1].from).toEqual(drags[0].to);
    expect(drags[2].from).toEqual(drags[1].to);
    expect(r.effects.filter((e) => e.kind === "press" || e.kind === "hold")).toHaveLength(1); // only the tap at pointer-down
  });

  it("a drag ends by commit on release and by discard on cancel, and no tick ever adds a hold during it", () => {
    const committed = run([downP(0), moveTo(20, 20, 0), ...ticks(32, 600, 16), up(620)]);
    expect(committed.ends).toEqual(["commit"]);
    expect(holdsOf(committed.effects)).toHaveLength(0);
    const cancelled = run([downP(0), moveTo(20, 20, 0), cancel(50)]);
    expect(cancelled.ends).toEqual(["discard"]);
    expect(cancelled.state.phase).toBe("idle");
  });

  it("STEP 2 (tap / long press are the main operations): a small wander stays a press that stops (as in B2), below the drag distance", () => {
    const r = run([downS(0), moveTo(60, MOVE_SLOP_PX + 3, 0), moveTo(90, DRAG_FAST_PX - 4, 0)]);
    expect(r.state.phase).toBe("moved");
    expect(dragsOf(r.effects)).toHaveLength(0);
  });

  it("STEP 2: a quick stroke (16 px within the hold delay) is a drag", () => {
    const r = run([downS(0), moveTo(HOLD_START_MS - 50, DRAG_FAST_PX + 1, 0)]);
    expect(r.state.phase).toBe("dragging");
    expect(r.effects.map((e) => e.kind)).toEqual(["press", "revert", "drag"]);
  });

  it("STEP 2: 16 px but slowly (after the hold delay) is not a drag, 24 px is", () => {
    const slow = run([downS(0), moveTo(HOLD_START_MS + 100, DRAG_FAST_PX + 1, 0)]);
    expect(slow.state.phase).toBe("moved");
    const far = run([downS(0), moveTo(HOLD_START_MS + 100, HOLD_TO_DRAG_PX + 1, 0)]);
    expect(far.state.phase).toBe("dragging");
  });

  it("a hold that moves 24 px becomes a drag and KEEPS the spread the hold made (no revert, no double application)", () => {
    const r = run([downS(0), ...ticks(16, 600, 16), moveTo(620, HOLD_TO_DRAG_PX + 2, 0)]);
    expect(r.state.phase).toBe("dragging");
    expect(r.effects.some((e) => e.kind === "revert")).toBe(false);
    expect(holdsOf(r.effects).length).toBeGreaterThan(0);
    expect(dragsOf(r.effects)).toHaveLength(1);
    // and no hold is added after the switch
    const after = run([downS(0), ...ticks(16, 600, 16), moveTo(620, HOLD_TO_DRAG_PX + 2, 0), ...ticks(640, 1000, 16)]);
    expect(holdsOf(after.effects).length).toBe(holdsOf(r.effects).length);
  });

  it("a hold that drifted (10..24 px) stopped spreading; moving on to 24 px then drags, and does not revert what the hold did", () => {
    const r = run([downS(0), ...ticks(16, 600, 16), moveTo(620, MOVE_SLOP_PX + 4, 0), moveTo(660, HOLD_TO_DRAG_PX + 6, 0)]);
    expect(r.state.phase).toBe("dragging");
    expect(r.effects.some((e) => e.kind === "revert")).toBe(false);
  });

  it("a press that had not reached the hold, wandered, and then dragged is reverted once (the tap was speculative)", () => {
    const r = run([downS(0), moveTo(60, MOVE_SLOP_PX + 3, 0), moveTo(90, HOLD_TO_DRAG_PX + 1, 0)]);
    expect(r.effects.map((e) => e.kind)).toEqual(["press", "revert", "drag"]);
  });

  it("without a point a movement past the slop can only stop the press (never drag), and a malformed point is ignored", () => {
    const noPoint = run([downP(0), { type: "move", pointerId: P, at: 40, clientX: 140, clientY: 200 }]);
    expect(noPoint.state.phase).toBe("moved");
    const bad = run([downP(0), { type: "move", pointerId: P, at: 40, clientX: 140, clientY: 200, point: { x: Number.NaN, y: 1 } }]);
    expect(bad.state.phase).toBe("moved");
  });

  it("another finger's movement, a late event after the drag ended, and a non-finite time are ignored", () => {
    const r = run([downP(0), moveTo(20, 20, 0)]);
    const other = stepPressGesture(r.state, { type: "move", pointerId: 99, at: 30, clientX: 300, clientY: 300, point: { x: 1, y: 1 } });
    expect(other.effects).toEqual([]);
    const bad = stepPressGesture(r.state, { type: "move", pointerId: P, at: Number.NaN, clientX: 300, clientY: 300, point: { x: 1, y: 1 } });
    expect(bad.effects).toEqual([]);
    const ended = run([downP(0), moveTo(20, 20, 0), up(40), moveTo(60, 50, 0)]);
    expect(dragsOf(ended.effects)).toHaveLength(1);
  });

  it("the full effect stream applied to a ball equals one drag from where the finger went down (the tap is not applied twice)", () => {
    const events: PressEvent[] = [downP(0), moveTo(20, 12, 0), moveTo(36, 30, 4), moveTo(52, 50, 8), up(70)];
    let state: PressGestureState = IDLE_PRESS_GESTURE;
    let working = createInitialSquareDough();
    const start = working;
    for (const event of events) {
      const step = stepPressGesture(state, event);
      state = step.state;
      working = applyGestureEffects(working, start, step.effects);
    }
    expect(squareDoughCoverage(working)).toBeGreaterThan(squareDoughCoverage(start));
    expect(Math.abs(working.thickness.reduce((a, b) => a + b, 0) - start.thickness.reduce((a, b) => a + b, 0))).toBeLessThan(1e-9);
  });
});
