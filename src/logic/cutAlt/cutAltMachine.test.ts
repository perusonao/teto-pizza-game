import { describe, expect, it } from "vitest";
import { buildTracedCutLine, TRACE_MIN_LENGTH } from "../cut/trace";
import {
  canCommitCutAlt,
  commitCutAlt,
  createCutAltState,
  CUT_ALT_PHASE_TEXT_JA,
  cutAltLine,
  cutAltPhase,
  cutAltPreview,
  cutAltReduce,
  type CutAltContext,
  type CutAltEvent,
  type CutAltState,
} from "./cutAltMachine";

const CTX: CutAltContext = { linesUsed: 0, limit: 5 };
const point = (x: number, y: number): CutAltEvent => ({ type: "POINT", x, y });
const run = (s: CutAltState, events: readonly CutAltEvent[]) => events.reduce(cutAltReduce, s);
const armed = () => cutAltReduce(createCutAltState(0), { type: "ARM" });
const ready = () => run(armed(), [point(20, 50), point(80, 50)]);

describe("C-A' keeps #418: an unarmed tap does nothing", () => {
  it("POINT while OFF returns the very same state, anywhere, any number of times", () => {
    const s = createCutAltState(0);
    for (const [x, y] of [[50, 50], [20, 50], [80, 50], [0, 0], [50, 99], [Number.NaN, 5]]) {
      expect(cutAltReduce(s, point(x, y))).toBe(s);
    }
    expect(run(s, [point(10, 50), point(90, 50), point(50, 20)])).toBe(s);
    expect(cutAltLine(s)).toBeNull();
    expect(canCommitCutAlt(s, CTX)).toBe(false);
  });
  it("starts OFF with no points", () => {
    expect(createCutAltState(4)).toEqual({ armed: false, a: null, b: null, hint: null, revision: 4 });
    expect(cutAltPhase(createCutAltState(0))).toBe("off");
  });
  it("after DISARM, CANCEL or INVALIDATE the taps are no-ops again", () => {
    for (const e of [{ type: "DISARM" }, { type: "CANCEL" }, { type: "INVALIDATE", revision: 9 }] as CutAltEvent[]) {
      const off = cutAltReduce(ready(), e);
      expect(off.armed).toBe(false);
      expect(cutAltReduce(off, point(30, 30))).toBe(off);
    }
  });
});

describe("C-A' the two taps and the explicit 切る", () => {
  it("ARM, start, end: the preview and phases follow", () => {
    let s = armed();
    expect(cutAltPhase(s)).toBe("need-start");
    s = cutAltReduce(s, point(20, 50));
    expect(s.a).toEqual({ x: 20, y: 50 });
    expect(cutAltPhase(s)).toBe("need-end");
    s = cutAltReduce(s, point(80, 50));
    expect(s.b).toEqual({ x: 80, y: 50 });
    expect(cutAltPhase(s)).toBe("ready");
    expect(cutAltPreview(s)).toEqual({ start: { x: 20, y: 50 }, end: { x: 80, y: 50 }, line: { from: { x: 20, y: 50 }, to: { x: 80, y: 50 } } });
    expect(cutAltPreview(armed())).toEqual({ start: null, end: null, line: null });
  });
  it("no snapping: the points are exactly where the taps landed (also near the rim)", () => {
    const s = run(armed(), [point(3.2, 50.4), point(96.7, 49.9)]);
    expect(s.a).toEqual({ x: 3.2, y: 50.4 });
    expect(s.b).toEqual({ x: 96.7, y: 49.9 });
  });
  it("the second tap never commits by itself; only commitCutAlt returns a line", () => {
    const s = ready();
    expect(s.a).not.toBeNull();
    expect(s.b).not.toBeNull();
    const { line } = commitCutAlt(s, CTX);
    expect(line).not.toBeNull();
  });
  it("the committed line is exactly what a two-point swipe commits (buildTracedCutLine)", () => {
    for (const [a, b] of [[{ x: 20, y: 50 }, { x: 80, y: 50 }], [{ x: 30, y: 25 }, { x: 70, y: 80 }], [{ x: 50, y: 10 }, { x: 52, y: 60 }]]) {
      const s = run(armed(), [point(a.x, a.y), point(b.x, b.y)]);
      const { line } = commitCutAlt(s, CTX);
      expect(line).toEqual(buildTracedCutLine([a, b]));
      expect(cutAltLine(s)).toEqual(line);
    }
  });
  it("after 切る the points clear and armed mode is RETAINED", () => {
    const { state } = commitCutAlt(ready(), CTX);
    expect(state.armed).toBe(true);
    expect(state.a).toBeNull();
    expect(state.b).toBeNull();
    expect(cutAltPhase(state)).toBe("need-start");
    const again = run(state, [point(50, 20), point(50, 80)]);
    expect(commitCutAlt(again, { linesUsed: 1, limit: 5 }).line).not.toBeNull();
  });
  it("reaching the cut limit ends armed mode with that cut", () => {
    const { state, line } = commitCutAlt(ready(), { linesUsed: 4, limit: 5 });
    expect(line).not.toBeNull();
    expect(state.armed).toBe(false);
    expect(cutAltReduce(state, point(30, 30))).toBe(state);
  });
  it("at the limit, 切る commits nothing and the state is unchanged", () => {
    const s = ready();
    const r = commitCutAlt(s, { linesUsed: 5, limit: 5 });
    expect(r.line).toBeNull();
    expect(r.state).toBe(s);
    expect(canCommitCutAlt(s, { linesUsed: 5, limit: 5 })).toBe(false);
  });
  it("切る needs both points and armed mode", () => {
    for (const s of [armed(), cutAltReduce(armed(), point(20, 50)), createCutAltState(0)]) {
      const r = commitCutAlt(s, CTX);
      expect(r.line).toBeNull();
      expect(r.state).toBe(s);
    }
  });
});

describe("C-A' too-short and off-pizza taps", () => {
  it("an end tap closer than the swipe minimum keeps the start, places no end and says so", () => {
    const s = run(armed(), [point(50, 50), point(50 + TRACE_MIN_LENGTH - 1, 50)]);
    expect(s.a).toEqual({ x: 50, y: 50 });
    expect(s.b).toBeNull();
    expect(s.hint).toBe("too-short");
    expect(cutAltPhase(s)).toBe("too-short");
    expect(cutAltReduce(s, point(50 + TRACE_MIN_LENGTH - 1, 51))).toBe(s);
  });
  it("a valid end tap afterwards clears the hint; exactly the minimum length is accepted", () => {
    const s = run(armed(), [point(50, 50), point(52, 50), point(50 + TRACE_MIN_LENGTH, 50)]);
    expect(s.b).not.toBeNull();
    expect(s.hint).toBeNull();
  });
  it("a tap outside the pizza (or not a finite number) is ignored while armed", () => {
    const s = armed();
    expect(cutAltReduce(s, point(2, 2))).toBe(s);
    expect(cutAltReduce(s, point(Number.NaN, 50))).toBe(s);
    expect(cutAltReduce(s, point(50, Number.POSITIVE_INFINITY))).toBe(s);
  });
  it("a third tap replaces only the end; CLEAR_POINTS drops both but stays armed", () => {
    let s = ready();
    s = cutAltReduce(s, point(70, 30));
    expect(s.a).toEqual({ x: 20, y: 50 });
    expect(s.b).toEqual({ x: 70, y: 30 });
    s = cutAltReduce(s, { type: "CLEAR_POINTS" });
    expect(s).toMatchObject({ armed: true, a: null, b: null });
    expect(cutAltReduce(s, { type: "CLEAR_POINTS" })).toBe(s);
  });
});

describe("C-A' ARM / DISARM / CANCEL / INVALIDATE", () => {
  it("ARM is idempotent; DISARM drops the points", () => {
    const a = armed();
    expect(cutAltReduce(a, { type: "ARM" })).toBe(a);
    const d = cutAltReduce(ready(), { type: "DISARM" });
    expect(d).toMatchObject({ armed: false, a: null, b: null });
    expect(cutAltReduce(d, { type: "DISARM" })).toBe(d);
  });
  it("CANCEL (blur / hidden / resize / lost capture) drops the points AND armed mode", () => {
    const c = cutAltReduce(ready(), { type: "CANCEL" });
    expect(c).toMatchObject({ armed: false, a: null, b: null, hint: null });
    expect(cutAltReduce(c, { type: "CANCEL" })).toBe(c);
  });
  it("INVALIDATE with another revision starts over; the same or a bad revision does nothing", () => {
    const s = ready();
    expect(cutAltReduce(s, { type: "INVALIDATE", revision: s.revision })).toBe(s);
    expect(cutAltReduce(s, { type: "INVALIDATE", revision: Number.NaN })).toBe(s);
    expect(cutAltReduce(s, { type: "INVALIDATE", revision: 7 })).toEqual(createCutAltState(7));
  });
  it("an unknown event changes nothing and never throws", () => {
    const s = ready();
    expect(cutAltReduce(s, { type: "NOPE" } as unknown as CutAltEvent)).toBe(s);
  });
});

describe("C-A' purity", () => {
  it("never mutates a frozen state and gives the same result for the same inputs", () => {
    const events: CutAltEvent[] = [{ type: "ARM" }, point(20, 50), point(80, 50), { type: "CLEAR_POINTS" }, point(50, 20), point(50, 80), { type: "CANCEL" }, point(10, 10)];
    const freeze = (s: CutAltState): CutAltState => {
      if (s.a) Object.freeze(s.a);
      if (s.b) Object.freeze(s.b);
      return Object.freeze(s);
    };
    let s = freeze(createCutAltState(0));
    for (const e of events) s = freeze(cutAltReduce(s, e));
    expect(run(createCutAltState(0), events)).toEqual(s);
  });
  it("has words for every phase", () => {
    for (const p of ["off", "need-start", "need-end", "too-short", "ready"] as const) expect(CUT_ALT_PHASE_TEXT_JA[p].length).toBeGreaterThan(0);
  });
});
