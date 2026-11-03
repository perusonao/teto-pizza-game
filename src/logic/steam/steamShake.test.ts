import { describe, expect, it } from "vitest";
import {
  STEAM_DECAY_GRACE_MS,
  STEAM_DECAY_PER_S,
  STEAM_PER_STROKE,
  STEAM_PER_TAP,
  STEAM_SHAKE_IDLE,
  STEAM_SHAKE_MIN_MS,
  STEAM_SHAKE_STROKE_MIN,
  steamShakeLevelAt,
  steamShakeReducer,
  type SteamShake,
  type SteamShakeAction,
  type SteamShaking,
} from "./steamShake";
import { STEAM_OVER_MS } from "./steamPot";

const W = 100;
const run = (actions: SteamShakeAction[], from: SteamShake = STEAM_SHAKE_IDLE): SteamShake => actions.reduce(steamShakeReducer, from);
const steaming = (s: SteamShake): SteamShaking => {
  if (s.status !== "steaming") throw new Error(`expected steaming, got ${s.status}`);
  return s;
};
const mv = (now: number, x: number): SteamShakeAction => ({ type: "MOVE", now, x, width: W });
const tap = (now: number): SteamShakeAction => ({ type: "TAP", now });
/** `n` full sweeps, left <-> right across the whole pot, 50 ms apart, from t0. The first MOVE only sets the anchor. */
const sweeps = (n: number, t0 = 0): SteamShakeAction[] => [mv(t0, 0), ...Array.from({ length: n }, (_, i) => mv(t0 + 50 * (i + 1), i % 2 === 0 ? 100 : 0))];
const levelNow = (s: SteamShake, now: number) => steamShakeLevelAt(steaming(s), now);

describe("strokes", () => {
  it("the first move only sets the anchor (no steam yet)", () => {
    const s = steaming(run([mv(0, 50)]));
    expect(s).toMatchObject({ level: 0, dir: 0, anchorX: 50, startedAt: 0 });
  });
  it("a jiggle smaller than the stroke minimum adds nothing", () => {
    const small = STEAM_SHAKE_STROKE_MIN * W - 1;
    const s = run([mv(0, 50), mv(10, 50 + small), mv(20, 50 - small), mv(30, 50 + small)]);
    expect(steaming(s).level).toBe(0);
  });
  it("the first sweep fixes the direction and counts; each reversal of at least the minimum counts one more", () => {
    const s1 = run([mv(0, 50), mv(10, 70)]);
    expect(steaming(s1)).toMatchObject({ level: STEAM_PER_STROKE, dir: 1, anchorX: 70 });
    const s2 = run([mv(20, 90), mv(30, 70)], s1);
    expect(steaming(s2)).toMatchObject({ level: 2 * STEAM_PER_STROKE, dir: -1, anchorX: 70 });
  });
  it("a long move the same way adds nothing, however far", () => {
    const s = run([mv(0, 0), mv(10, 30), mv(20, 60), mv(30, 100)]);
    expect(steaming(s).level).toBe(STEAM_PER_STROKE); // only the first sweep
    expect(steaming(s)).toMatchObject({ dir: 1, anchorX: 100 });
  });
  it("a reversal shorter than the minimum is not a stroke, and does not lose the furthest point", () => {
    const s = run([mv(0, 0), mv(10, 40), mv(20, 40 - (STEAM_SHAKE_STROKE_MIN * W - 1))]);
    expect(steaming(s)).toMatchObject({ level: STEAM_PER_STROKE, dir: 1, anchorX: 40 });
  });
  it("one MOVE is at most one stroke (a skipped frame cannot fill the pot)", () => {
    const s = run([mv(0, 0), mv(10, 100), mv(20, -9_999)]);
    expect(steaming(s).level).toBe(2 * STEAM_PER_STROKE);
  });
  it("n sweeps add n times the stroke steam (the first move sets the anchor, then one per sweep)", () => {
    for (const n of [1, 2, 5, 11]) expect(steaming(run(sweeps(n))).level).toBeCloseTo(n * STEAM_PER_STROKE, 9);
  });
  it("12 sweeps open all five shells, 11 do not", () => {
    const at = (n: number) => levelNow(run(sweeps(n)), 50 * n);
    expect(at(11)).toBeLessThan(0.78);
    expect(at(12)).toBeGreaterThanOrEqual(0.78);
  });
  it("the stroke length scales with the pot's width", () => {
    const wide = (now: number, x: number): SteamShakeAction => ({ type: "MOVE", now, x, width: 400 });
    expect(steaming(run([wide(0, 0), wide(10, 50), wide(20, 0)])).level).toBe(0); // 50 < 0.18 * 400
    expect(steaming(run([wide(0, 0), wide(10, 80), wide(20, 0)])).level).toBeCloseTo(2 * STEAM_PER_STROKE, 9);
  });
});

describe("taps (the required alternative to dragging)", () => {
  it("each tap adds steam, and taps alone can open every shell", () => {
    expect(steaming(run([tap(0)])).level).toBe(STEAM_PER_TAP);
    const eight = run(Array.from({ length: 8 }, (_, i) => tap(i * 100)));
    expect(levelNow(eight, 700)).toBeGreaterThanOrEqual(0.78);
    const seven = run(Array.from({ length: 7 }, (_, i) => tap(i * 100)));
    expect(levelNow(seven, 600)).toBeLessThan(0.78);
  });
  it("taps and moves share one pot", () => {
    const s = run([...sweeps(2), tap(300)]);
    expect(steaming(s).level).toBeCloseTo(2 * STEAM_PER_STROKE + STEAM_PER_TAP, 9);
  });
  it("ten taps of 0.1 are exactly full steam (no floating-point shortfall)", () => {
    expect(steaming(run(Array.from({ length: 10 }, () => tap(0)))).level).toBe(1);
  });
});

describe("fade", () => {
  it("holds for the grace, then fades at the set speed, never below zero", () => {
    const s = run(Array.from({ length: 5 }, () => tap(0))); // 0.5
    expect(levelNow(s, STEAM_DECAY_GRACE_MS)).toBe(0.5);
    expect(levelNow(s, STEAM_DECAY_GRACE_MS + 1000)).toBeCloseTo(0.5 - STEAM_DECAY_PER_S, 9);
    expect(levelNow(s, 60_000)).toBe(0);
  });
  it("is read lazily: the state itself never changes with time", () => {
    const s = run([tap(0), tap(10)]);
    expect(JSON.stringify(s)).toBe(JSON.stringify(run([tap(0), tap(10)])));
  });
  it("a clock before the last input does not invent steam or lose it", () => {
    const s = run([tap(1000)]);
    expect(levelNow(s, 0)).toBe(STEAM_PER_TAP);
    expect(levelNow(s, NaN)).toBe(STEAM_PER_TAP);
  });
  it("shaking again after a pause starts from the faded level", () => {
    const s = run([...Array.from({ length: 5 }, () => tap(0)), tap(STEAM_DECAY_GRACE_MS + 1000)]);
    expect(steaming(s).level).toBeCloseTo(0.5 - STEAM_DECAY_PER_S + STEAM_PER_TAP, 9);
  });
});

describe("OPEN", () => {
  it("before the first input, or when not steaming, OPEN is ignored", () => {
    expect(steamShakeReducer(STEAM_SHAKE_IDLE, { type: "OPEN", now: 5000 })).toBe(STEAM_SHAKE_IDLE);
  });
  it("sooner than the minimum after the first input keeps nothing", () => {
    expect(run([tap(0), { type: "OPEN", now: STEAM_SHAKE_MIN_MS - 1 }])).toEqual({ status: "idle", tooShort: true });
    expect(run([tap(0), { type: "OPEN", now: STEAM_SHAKE_MIN_MS }]).status).toBe("released");
  });
  it("keeps what the shells reached at that moment (the fade is applied)", () => {
    const s = run([...Array.from({ length: 5 }, () => tap(0)), { type: "OPEN", now: STEAM_SHAKE_MIN_MS }]);
    // 800 ms after the taps = 400 ms past the grace: 0.5 - 0.12 * 0.4 = 0.452.
    expect(s).toMatchObject({ status: "released", result: { look: "partial", openCount: 2 }, elapsedMs: STEAM_SHAKE_MIN_MS });
    expect(s.status === "released" && s.result.amount).toBeCloseTo(0.452, 9);
    const faded = run([...Array.from({ length: 5 }, () => tap(0)), { type: "OPEN", now: 4000 }]);
    expect(faded).toMatchObject({ result: { look: "closed", openCount: 0 } }); // 0.5 - 0.12 * 3.6 < 0.3
  });
  it("full steam kept up for STEAM_OVER_MS is over; stopping and letting it fade is not", () => {
    const hold: SteamShakeAction[] = Array.from({ length: 10 }, () => tap(0));
    for (let t = 300; t <= 3000; t += 300) hold.push(tap(t));
    expect(run([...hold, { type: "OPEN", now: 3100 }])).toMatchObject({ result: { look: "over", amount: 1 } });
    expect(run([...hold, { type: "OPEN", now: 3000 + STEAM_DECAY_GRACE_MS - 1 }])).toMatchObject({ result: { look: "over" } });
    expect(STEAM_OVER_MS).toBe(3000);
    // shorter than the over time -> open
    expect(run([...Array.from({ length: 10 }, () => tap(0)), tap(1000), tap(1300), { type: "OPEN", now: 1500 }])).toMatchObject({ result: { look: "open" } });
    // stop shaking and let it fade: not over, even much later
    expect(run([...hold, { type: "OPEN", now: 6000 }])).toMatchObject({ result: { look: expect.not.stringMatching(/^over$/) } });
  });
  it("dropping below full steam forgets the full-steam time", () => {
    const s = run([...Array.from({ length: 10 }, () => tap(0)), tap(2000)]); // faded to ~0.81 at 2000, +0.1 -> 0.91: below 1
    expect(steaming(s).fullSince).toBeNull();
  });
});

describe("bad input", () => {
  it("unreadable numbers are ignored without a throw or any change", () => {
    const base = run([mv(0, 50)]);
    const bad: SteamShakeAction[] = [
      { type: "MOVE", now: NaN, x: 10, width: W },
      { type: "MOVE", now: 5, x: NaN, width: W },
      { type: "MOVE", now: 5, x: Infinity, width: W },
      { type: "MOVE", now: 5, x: 10, width: 0 },
      { type: "MOVE", now: 5, x: 10, width: -3 },
      { type: "MOVE", now: 5, x: 10, width: NaN },
      { type: "TAP", now: NaN },
    ];
    for (const a of bad) expect(steamShakeReducer(base, a)).toBe(base);
    expect(steamShakeReducer(STEAM_SHAKE_IDLE, bad[0])).toBe(STEAM_SHAKE_IDLE);
    expect(steamShakeReducer(STEAM_SHAKE_IDLE, bad[6])).toBe(STEAM_SHAKE_IDLE);
  });
  it("a clock that runs backwards is ignored", () => {
    const base = run([tap(1000)]);
    expect(steamShakeReducer(base, tap(500))).toBe(base);
    expect(steamShakeReducer(base, mv(500, 10))).toBe(base);
  });
  it("OPEN with a clock before the last input is ignored (no result built from input in its future)", () => {
    const eight = run([tap(0), ...Array.from({ length: 8 }, () => tap(2000))]); // the first tap fades away; eight more at 2000 ms
    expect(steaming(eight).level).toBeCloseTo(0.8, 9);
    expect(steamShakeReducer(eight, { type: "OPEN", now: 1000 })).toBe(eight);
    // the same OPEN at or after the last input still keeps the result
    expect(steamShakeReducer(eight, { type: "OPEN", now: 2000 }).status).toBe("released");
  });
  it("OPEN with an unreadable clock is a stray tap", () => {
    expect(run([tap(0), { type: "OPEN", now: NaN }])).toEqual({ status: "idle", tooShort: true });
  });
  it("a kept result is not changed by more input", () => {
    const released = run([tap(0), { type: "OPEN", now: 1000 }]);
    for (const a of [tap(2000), mv(2000, 5), { type: "OPEN", now: 3000 } as SteamShakeAction]) expect(steamShakeReducer(released, a)).toBe(released);
  });
});

describe("CANCEL / INTERRUPT", () => {
  it("CANCEL drops everything; INTERRUPT drops only a pot in progress", () => {
    const steam = run([tap(0)]);
    const released = run([tap(0), { type: "OPEN", now: 1000 }]);
    expect(steamShakeReducer(steam, { type: "CANCEL" })).toEqual(STEAM_SHAKE_IDLE);
    expect(steamShakeReducer(released, { type: "CANCEL" })).toEqual(STEAM_SHAKE_IDLE);
    expect(steamShakeReducer(steam, { type: "INTERRUPT" })).toEqual(STEAM_SHAKE_IDLE);
    expect(steamShakeReducer(released, { type: "INTERRUPT" })).toBe(released);
  });
});

describe("determinism", () => {
  it("the same input sequence always gives the same state, and shifting every clock reading does not change the result", () => {
    const seq = [...sweeps(6), tap(400), { type: "OPEN", now: 1200 } as SteamShakeAction];
    expect(run(seq)).toEqual(run(seq));
    const shifted = seq.map((a) => ("now" in a ? { ...a, now: a.now + 777_000 } : a)) as SteamShakeAction[];
    expect(run(shifted)).toEqual(run(seq));
  });
});
