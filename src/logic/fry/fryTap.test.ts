import { describe, expect, it } from "vitest";
import { FRY_TAP_IDLE, FRY_TAP_MIN_MS, fryTapReducer, type FryTap } from "./fryTap";
import { fryResultOf } from "./fryPot";

const run = (actions: Parameters<typeof fryTapReducer>[1][], from: FryTap = FRY_TAP_IDLE) => actions.reduce(fryTapReducer, from);

describe("operation A: two taps", () => {
  it("START then LIFT keeps the result of the time in the oil", () => {
    const s = run([{ type: "START", now: 1000 }, { type: "LIFT", now: 1000 + 4000 }]);
    expect(s).toEqual({ status: "lifted", result: fryResultOf(4000), elapsedMs: 4000 });
    expect(s.status === "lifted" && s.result.look).toBe("crisp");
  });
  it("early lift = raw, long fry = over; there is no time-out and no failure state", () => {
    const early = run([{ type: "START", now: 0 }, { type: "LIFT", now: FRY_TAP_MIN_MS }]);
    expect(early.status === "lifted" && early.result.look).toBe("raw");
    const late = run([{ type: "START", now: 0 }, { type: "LIFT", now: 600000 }]);
    expect(late.status === "lifted" && late.result.look).toBe("over");
  });
  it("a lift sooner than the minimum is a stray tap: back to idle, flagged, nothing kept", () => {
    expect(run([{ type: "START", now: 0 }, { type: "LIFT", now: FRY_TAP_MIN_MS - 1 }])).toEqual({ status: "idle", tooShort: true });
  });
  it("the time scale reaches the result", () => {
    const s = run([{ type: "START", now: 0 }, { type: "LIFT", now: 2700, timeScale: 0.75 }]);
    expect(s.status === "lifted" && s.result.look).toBe("crisp");
    const l = run([{ type: "START", now: 0 }, { type: "LIFT", now: 2700 }]);
    expect(l.status === "lifted" && l.result.look).toBe("raw");
  });
  it("LIFT with nothing in the oil, START twice, and anything after lifted are no-ops (same object)", () => {
    expect(fryTapReducer(FRY_TAP_IDLE, { type: "LIFT", now: 5 })).toBe(FRY_TAP_IDLE);
    const frying = fryTapReducer(FRY_TAP_IDLE, { type: "START", now: 1 });
    expect(fryTapReducer(frying, { type: "START", now: 2 })).toBe(frying);
    const lifted = run([{ type: "START", now: 0 }, { type: "LIFT", now: 3000 }]);
    for (const a of [{ type: "START", now: 9 }, { type: "LIFT", now: 9 }, { type: "INTERRUPT" }] as const) expect(fryTapReducer(lifted, a)).toBe(lifted);
  });
  it("CANCEL clears everything; INTERRUPT drops only a fry in progress (a kept result survives the button going away)", () => {
    expect(run([{ type: "START", now: 0 }, { type: "CANCEL" }])).toEqual(FRY_TAP_IDLE);
    expect(run([{ type: "START", now: 0 }, { type: "LIFT", now: 3000 }, { type: "CANCEL" }])).toEqual(FRY_TAP_IDLE);
    expect(run([{ type: "START", now: 0 }, { type: "INTERRUPT" }])).toEqual(FRY_TAP_IDLE);
  });
  it("non-finite clocks are refused / read as too short", () => {
    expect(fryTapReducer(FRY_TAP_IDLE, { type: "START", now: NaN })).toBe(FRY_TAP_IDLE);
    expect(run([{ type: "START", now: 0 }, { type: "LIFT", now: NaN }])).toEqual({ status: "idle", tooShort: true });
  });
  it("is pure: the input state is not mutated", () => {
    const frying: FryTap = Object.freeze({ status: "frying", startedAt: 0 });
    expect(() => fryTapReducer(frying, { type: "LIFT", now: 5000 })).not.toThrow();
  });
});
