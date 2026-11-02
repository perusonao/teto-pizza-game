import { describe, expect, it } from "vitest";
import { SEAR_FULL_MS, SEAR_IDLE, SEAR_MIN_HOLD_MS, searAmountAt, searHoldReducer, searLookOf, type SearHold } from "./searHold";

describe("searAmountAt: the amount follows the held time, nothing else", () => {
  it("0 at the start, linear, 1 at SEAR_FULL_MS and held there after", () => {
    expect(searAmountAt(0)).toBe(0);
    expect(searAmountAt(SEAR_FULL_MS / 2)).toBeCloseTo(0.5, 10);
    expect(searAmountAt(SEAR_FULL_MS)).toBe(1);
    expect(searAmountAt(SEAR_FULL_MS * 5)).toBe(1);
  });
  it("is monotonic over a 1 ms sweep (no best window, no dip)", () => {
    let prev = -1;
    for (let t = 0; t <= SEAR_FULL_MS + 500; t += 1) {
      const a = searAmountAt(t);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });
  it.each([NaN, -5, -Infinity])("%s -> 0", (v) => expect(searAmountAt(v)).toBe(0));
  it("Infinity is not a hold either", () => expect(searAmountAt(Infinity)).toBe(0));
});

describe("searLookOf: words, never a grade", () => {
  it("the four looks cover 0..1 in order", () => {
    expect([0, 0.29, 0.3, 0.61, 0.62, 0.89, 0.9, 1].map(searLookOf)).toEqual(["light", "light", "golden", "golden", "deep", "deep", "charred", "charred"]);
  });
});

describe("searHoldReducer", () => {
  const press = (s: SearHold, now: number) => searHoldReducer(s, { type: "PRESS", now });
  const release = (s: SearHold, now: number) => searHoldReducer(s, { type: "RELEASE", now });

  it("press -> release keeps what the hold reached", () => {
    const s = release(press(SEAR_IDLE, 1000), 1000 + 2000);
    expect(s).toEqual({ status: "released", amount: 0.5, heldMs: 2000 });
  });
  it("an explicit fullMs (the 2 / 3 / 4 s comparison) scales the amount, the minimum hold stays the same", () => {
    expect(searHoldReducer(press(SEAR_IDLE, 0), { type: "RELEASE", now: 1000, fullMs: 2000 })).toEqual({ status: "released", amount: 0.5, heldMs: 1000 });
    expect(searHoldReducer(press(SEAR_IDLE, 0), { type: "RELEASE", now: 1500, fullMs: 3000 })).toEqual({ status: "released", amount: 0.5, heldMs: 1500 });
    expect(searHoldReducer(press(SEAR_IDLE, 0), { type: "RELEASE", now: SEAR_MIN_HOLD_MS - 1, fullMs: 2000 }).status).toBe("idle");
  });
  it("a tap shorter than SEAR_MIN_HOLD_MS keeps nothing", () => {
    expect(release(press(SEAR_IDLE, 10), 10 + SEAR_MIN_HOLD_MS - 1)).toEqual({ status: "idle", tooShort: true });
    expect(release(press(SEAR_IDLE, 10), 10 + SEAR_MIN_HOLD_MS).status).toBe("released");
  });
  it("there is no time-out: a very long hold is simply fully seared, never a failure", () => {
    expect(release(press(SEAR_IDLE, 0), 60_000)).toEqual({ status: "released", amount: 1, heldMs: 60_000 });
  });
  it("a clock that runs backwards, or a non-finite stamp, is a tap", () => {
    expect(release(press(SEAR_IDLE, 5000), 4000).status).toBe("idle");
    expect(release(press(SEAR_IDLE, 5000), NaN).status).toBe("idle");
    expect(press(SEAR_IDLE, NaN)).toBe(SEAR_IDLE);
  });
  it("RELEASE without a PRESS, a second PRESS, and anything after release are ignored (same reference)", () => {
    expect(release(SEAR_IDLE, 100)).toBe(SEAR_IDLE);
    const holding = press(SEAR_IDLE, 100);
    expect(press(holding, 200)).toBe(holding);
    const done = release(holding, 3000);
    expect(press(done, 4000)).toBe(done);
    expect(release(done, 5000)).toBe(done);
  });
  it("CANCEL drops a hold and keeps nothing", () => {
    expect(searHoldReducer(press(SEAR_IDLE, 100), { type: "CANCEL" })).toBe(SEAR_IDLE);
  });
});
