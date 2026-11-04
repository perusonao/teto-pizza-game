import { describe, expect, it } from "vitest";
import { FRY_DRAG_IDLE, FRY_DRAG_MIN_MS, FRY_LIFT_DEPTH, FRY_OIL_SURFACE_DEPTH, fryDragReducer, type FryDrag, type FryDragAction } from "./fryDrag";
import { fryResultOf } from "./fryPot";

const run = (actions: FryDragAction[], from: FryDrag = FRY_DRAG_IDLE) => actions.reduce(fryDragReducer, from);
/** Grab the piece on the dish, carry it into the oil at t=1000, let go. */
const SUNK: FryDragAction[] = [
  { type: "GRAB", now: 900, depth: 0.05 },
  { type: "MOVE", now: 950, depth: 0.3 },
  { type: "MOVE", now: 1000, depth: FRY_OIL_SURFACE_DEPTH + 0.1 },
  { type: "RELEASE", now: 1100 },
];

describe("operation B: drag in, wait, drag out", () => {
  it("the geometry leaves a gap between going in and coming out", () => {
    expect(FRY_LIFT_DEPTH).toBeLessThan(FRY_OIL_SURFACE_DEPTH);
  });
  it("carrying down does not start the oil until the surface is crossed; the clock starts at the crossing", () => {
    const carrying = run([{ type: "GRAB", now: 0, depth: 0 }, { type: "MOVE", now: 10, depth: FRY_OIL_SURFACE_DEPTH - 0.01 }]);
    expect(carrying.status).toBe("carrying");
    const sunk = fryDragReducer(carrying, { type: "MOVE", now: 20, depth: FRY_OIL_SURFACE_DEPTH });
    expect(sunk).toMatchObject({ status: "frying", startedAt: 20, grabbed: true });
  });
  it("letting go below the surface leaves the piece IN the oil (the finger no longer hides the bubbles)", () => {
    expect(run(SUNK)).toMatchObject({ status: "frying", startedAt: 1000, grabbed: false });
  });
  it("letting go above the surface puts nothing in", () => {
    expect(run([{ type: "GRAB", now: 0, depth: 0 }, { type: "MOVE", now: 10, depth: 0.3 }, { type: "RELEASE", now: 20 }])).toEqual(FRY_DRAG_IDLE);
  });
  it("grabbing it again and pulling above the lift line takes it out and keeps the result", () => {
    const s = run([...SUNK, { type: "GRAB", now: 5000, depth: 0.9 }, { type: "MOVE", now: 5200, depth: 0.6 }, { type: "MOVE", now: 5400, depth: FRY_LIFT_DEPTH }]);
    expect(s).toEqual({ status: "lifted", result: fryResultOf(5400 - 1000), elapsedMs: 4400 });
  });
  it("a wobble between the two lines does not lift it", () => {
    const s = run([...SUNK, { type: "GRAB", now: 5000, depth: 0.9 }, { type: "MOVE", now: 5100, depth: 0.5 }, { type: "MOVE", now: 5200, depth: FRY_LIFT_DEPTH + 0.01 }]);
    expect(s.status).toBe("frying");
  });
  it("moving without a grab does nothing to a piece in the oil", () => {
    const sunk = run(SUNK);
    expect(fryDragReducer(sunk, { type: "MOVE", now: 3000, depth: 0 })).toBe(sunk);
  });
  it("pulling out too soon is a stray drag: idle, flagged, nothing kept", () => {
    const s = run([
      { type: "GRAB", now: 0, depth: 0 },
      { type: "MOVE", now: 10, depth: 0.8 },
      { type: "MOVE", now: 10 + FRY_DRAG_MIN_MS - 1, depth: 0.1 },
    ]);
    expect(s).toEqual({ status: "idle", tooShort: true });
  });
  it("a long wait is fine: over is a look, never a failure", () => {
    const s = run([...SUNK, { type: "GRAB", now: 600000, depth: 0.9 }, { type: "MOVE", now: 600100, depth: 0 }]);
    expect(s.status === "lifted" && s.result.look).toBe("over");
  });
  it("the time scale reaches the result", () => {
    const s = run([...SUNK, { type: "GRAB", now: 3800, depth: 0.9 }, { type: "MOVE", now: 3900, depth: 0, timeScale: 0.75 }]);
    expect(s.status === "lifted" && s.result.look).toBe("crisp"); // 2900 ms / 0.75 = 3866 >= 3500
  });
});

describe("the required alternative: TAP_DOWN / TAP_UP (buttons, arrow keys)", () => {
  it("gives the same result as the drag for the same time in the oil", () => {
    const tap = run([{ type: "TAP_DOWN", now: 1000 }, { type: "TAP_UP", now: 5400 }]);
    const drag = run([...SUNK, { type: "GRAB", now: 5300, depth: 0.9 }, { type: "MOVE", now: 5400, depth: 0 }]);
    expect(tap.status === "lifted" && drag.status === "lifted" && tap.result).toEqual(drag.status === "lifted" ? drag.result : null);
  });
  it("TAP_UP too soon is a stray tap; TAP_UP with nothing in the oil and TAP_DOWN twice are no-ops", () => {
    expect(run([{ type: "TAP_DOWN", now: 0 }, { type: "TAP_UP", now: FRY_DRAG_MIN_MS - 1 }])).toEqual({ status: "idle", tooShort: true });
    expect(fryDragReducer(FRY_DRAG_IDLE, { type: "TAP_UP", now: 9 })).toBe(FRY_DRAG_IDLE);
    const frying = fryDragReducer(FRY_DRAG_IDLE, { type: "TAP_DOWN", now: 1 });
    expect(fryDragReducer(frying, { type: "TAP_DOWN", now: 2 })).toBe(frying);
  });
  it("a tap-in can be lifted by dragging too (the two inputs mix freely)", () => {
    const s = run([{ type: "TAP_DOWN", now: 0 }, { type: "GRAB", now: 4000, depth: 0.9 }, { type: "MOVE", now: 4100, depth: 0.1 }]);
    expect(s.status).toBe("lifted");
  });
});

describe("cancel / interrupt / junk", () => {
  it("POINTER_CANCEL: carrying drops, a grabbed piece in the oil stays in", () => {
    expect(run([{ type: "GRAB", now: 0, depth: 0 }, { type: "POINTER_CANCEL" }])).toEqual(FRY_DRAG_IDLE);
    expect(run([...SUNK, { type: "GRAB", now: 2000, depth: 0.9 }, { type: "POINTER_CANCEL" }])).toMatchObject({ status: "frying", grabbed: false, startedAt: 1000 });
  });
  it("INTERRUPT drops a fry in progress but keeps a result; CANCEL clears everything", () => {
    expect(run([...SUNK, { type: "INTERRUPT" }])).toEqual(FRY_DRAG_IDLE);
    const lifted = run([{ type: "TAP_DOWN", now: 0 }, { type: "TAP_UP", now: 4000 }]);
    expect(fryDragReducer(lifted, { type: "INTERRUPT" })).toBe(lifted);
    expect(fryDragReducer(lifted, { type: "CANCEL" })).toEqual(FRY_DRAG_IDLE);
  });
  it("non-finite input and a clock that runs backwards change nothing", () => {
    const carrying = run([{ type: "GRAB", now: 100, depth: 0.1 }]);
    expect(fryDragReducer(carrying, { type: "MOVE", now: NaN, depth: 0.9 })).toBe(carrying);
    expect(fryDragReducer(carrying, { type: "MOVE", now: 50, depth: 0.9 })).toBe(carrying);
    expect(fryDragReducer(FRY_DRAG_IDLE, { type: "GRAB", now: 0, depth: NaN })).toBe(FRY_DRAG_IDLE);
    const sunk = run(SUNK);
    expect(fryDragReducer(sunk, { type: "TAP_UP", now: 500 })).toBe(sunk); // before the last input
  });
  it("RELEASE obeys the same clock checks and records its time (a later input from a backwards clock is refused)", () => {
    const grabbed = run([...SUNK, { type: "GRAB", now: 4000, depth: 0.9 }]);
    expect(fryDragReducer(grabbed, { type: "RELEASE", now: NaN })).toBe(grabbed); // junk time: still grabbed
    expect(fryDragReducer(grabbed, { type: "RELEASE", now: 3000 })).toBe(grabbed); // before the grab: refused
    const carrying = run([{ type: "GRAB", now: 100, depth: 0.1 }]);
    expect(fryDragReducer(carrying, { type: "RELEASE", now: NaN })).toBe(carrying);
    expect(fryDragReducer(carrying, { type: "RELEASE", now: 50 })).toBe(carrying);
    // the reported path: in at 1000, released at 5000, then a clock that ran back to 2000 must not lift it with 1000 ms
    const released = run([{ type: "TAP_DOWN", now: 1000 }, { type: "GRAB", now: 4000, depth: 0.9 }, { type: "RELEASE", now: 5000 }]);
    expect(released).toMatchObject({ status: "frying", grabbed: false, lastAt: 5000 });
    expect(fryDragReducer(released, { type: "TAP_UP", now: 2000 })).toBe(released);
    expect(fryDragReducer(released, { type: "GRAB", now: 2000, depth: 0.9 })).toBe(released);
    expect(fryDragReducer(released, { type: "TAP_UP", now: 6000 }).status).toBe("lifted");
  });
  it("depth is clamped to 0..1", () => {
    expect(fryDragReducer(FRY_DRAG_IDLE, { type: "GRAB", now: 0, depth: -4 })).toMatchObject({ depth: 0 });
    expect(run([{ type: "GRAB", now: 0, depth: 0 }, { type: "MOVE", now: 1, depth: 9 }])).toMatchObject({ status: "frying", depth: 1 });
  });
  it("nothing moves a lifted result except CANCEL", () => {
    const lifted = run([{ type: "TAP_DOWN", now: 0 }, { type: "TAP_UP", now: 4000 }]);
    for (const a of [{ type: "GRAB", now: 9, depth: 0 }, { type: "MOVE", now: 9, depth: 1 }, { type: "RELEASE", now: 9 }, { type: "TAP_DOWN", now: 9 }, { type: "TAP_UP", now: 9 }, { type: "POINTER_CANCEL" }] as FryDragAction[])
      expect(fryDragReducer(lifted, a)).toBe(lifted);
  });
});
