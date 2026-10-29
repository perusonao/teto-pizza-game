import { describe, expect, it } from "vitest";
import {
  BEST_END_MS,
  BEST_START_MS,
  ONSET_LEAD_MS,
  PAN_ARM_MS,
  PAN_IDLE,
  PAN_TOTAL_MS,
  SMOKE_LEAD_MS,
  gradeAt,
  panReducer,
  panResultCopy,
  panStageAt,
  panStageEdges,
  progressAt,
  sanitizeElapsed,
  type PanEvent,
  type PanState,
} from "./panDoneness";

const run = (events: PanEvent[], from: PanState = PAN_IDLE) => events.reduce(panReducer, from);

describe("the owner-decided numbers", () => {
  it("are 2100 / 4200 / 6000 / 300", () => {
    expect([BEST_START_MS, BEST_END_MS, PAN_TOTAL_MS, PAN_ARM_MS]).toEqual([2100, 4200, 6000, 300]);
  });
});

describe("gradeAt: half-open boundaries", () => {
  it.each([
    [0, "early"],
    [299, "early"],
    [2099, "early"],
    [2099.9, "early"],
    [2100, "best"],
    [3000, "best"],
    [4199, "best"],
    [4199.9, "best"],
    [4200, "overdone"], // exactly 4200 is overdone
    [4201, "overdone"],
    [5999, "overdone"],
    [6000, "overdone"],
    [6001, "overdone"],
    [1e9, "overdone"],
  ] as const)("t=%s -> %s", (t, grade) => {
    expect(gradeAt(t)).toBe(grade);
  });

  it("treats NaN, -Infinity, negatives as early and +Infinity as overdone (no crash)", () => {
    expect(gradeAt(Number.NaN)).toBe("early");
    expect(gradeAt(-1)).toBe("early");
    expect(gradeAt(-Infinity)).toBe("early");
    expect(gradeAt(Infinity)).toBe("early"); // not finite -> 0 (a broken clock never grants a grade)
  });

  it("sweeps every millisecond: grades are monotone early -> best -> overdone with exactly two edges", () => {
    const order = { early: 0, best: 1, overdone: 2 } as const;
    let last = 0;
    let edges = 0;
    for (let t = 0; t <= PAN_TOTAL_MS + 100; t += 1) {
      const g = order[gradeAt(t)];
      expect(g).toBeGreaterThanOrEqual(last);
      if (g !== last) edges += 1;
      last = g;
    }
    expect(edges).toBe(2);
  });
});

describe("progressAt / sanitizeElapsed", () => {
  it("is 0..1 and clamps", () => {
    expect(progressAt(0)).toBe(0);
    expect(progressAt(3000)).toBe(0.5);
    expect(progressAt(PAN_TOTAL_MS)).toBe(1);
    expect(progressAt(99999)).toBe(1);
    expect(progressAt(Number.NaN)).toBe(0);
    expect(progressAt(-5)).toBe(0);
    expect(sanitizeElapsed(Number.NaN)).toBe(0);
  });
});

describe("panStageAt: stages come from the constants", () => {
  it("has its edges at BEST_START-ONSET, BEST_START, BEST_END-SMOKE, BEST_END", () => {
    expect(panStageEdges()).toEqual([BEST_START_MS - ONSET_LEAD_MS, BEST_START_MS, BEST_END_MS - SMOKE_LEAD_MS, BEST_END_MS]);
  });

  it("steps 0 -> 1 -> 2 -> 3 -> 4 across each edge (the value just before and at it)", () => {
    const edges = panStageEdges();
    edges.forEach((edge, i) => {
      expect(panStageAt(edge - 1)).toBe(i);
      expect(panStageAt(edge)).toBe(i + 1);
    });
    expect(panStageAt(0)).toBe(0);
    expect(panStageAt(PAN_TOTAL_MS)).toBe(4);
  });

  it("stage 3 (about to burn) is still a BEST grade; stage 4 is overdone", () => {
    for (let t = 0; t <= PAN_TOTAL_MS; t += 1) {
      if (panStageAt(t) === 3) expect(gradeAt(t)).toBe("best");
      if (panStageAt(t) === 4) expect(gradeAt(t)).toBe("overdone");
      if (panStageAt(t) === 2) expect(gradeAt(t)).toBe("best");
      if (panStageAt(t) <= 1) expect(gradeAt(t)).toBe("early");
    }
  });

  it("never goes backwards and survives NaN / negative", () => {
    let last = 0;
    for (let t = 0; t <= PAN_TOTAL_MS; t += 5) {
      const s = panStageAt(t);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
    expect(panStageAt(Number.NaN)).toBe(0);
    expect(panStageAt(-10)).toBe(0);
  });
});

describe("panReducer", () => {
  it("START opens it once; a second START is refused (same state)", () => {
    const running = run([{ type: "START", now: 1000 }]);
    expect(running).toEqual({ status: "running", startedAt: 1000 });
    expect(panReducer(running, { type: "START", now: 2000 })).toBe(running);
  });

  it("TAKE before PAN_ARM_MS is ignored and returns the same state; at PAN_ARM_MS it counts (as early)", () => {
    const running = run([{ type: "START", now: 1000 }]);
    expect(panReducer(running, { type: "TAKE", now: 1000 })).toBe(running);
    expect(panReducer(running, { type: "TAKE", now: 1000 + PAN_ARM_MS - 1 })).toBe(running);
    const taken = panReducer(running, { type: "TAKE", now: 1000 + PAN_ARM_MS });
    expect(taken).toMatchObject({ status: "finished", grade: "early", by: "take", elapsedMs: PAN_ARM_MS });
  });

  it.each([
    [2099, "early"],
    [2100, "best"],
    [4199, "best"],
    [4200, "overdone"],
    [5999, "overdone"],
  ] as const)("TAKE at +%sms -> %s (progress = t / total)", (t, grade) => {
    const done = run([{ type: "START", now: 500 }, { type: "TAKE", now: 500 + t }]);
    expect(done).toMatchObject({ status: "finished", grade, by: "take", elapsedMs: t });
    expect((done as { progress: number }).progress).toBeCloseTo(t / PAN_TOTAL_MS, 10);
  });

  it("time-out wins a tie: a TAKE stamped at or after the total is the time-out, not a take", () => {
    const done = run([{ type: "START", now: 0 }, { type: "TAKE", now: PAN_TOTAL_MS }]);
    expect(done).toEqual({ status: "finished", grade: "overdone", progress: 1, elapsedMs: PAN_TOTAL_MS, by: "timeout" });
    expect(run([{ type: "START", now: 0 }, { type: "TAKE", now: PAN_TOTAL_MS + 50 }])).toEqual(done);
  });

  it("TICK finishes it at the total (and only then)", () => {
    const running = run([{ type: "START", now: 0 }]);
    expect(panReducer(running, { type: "TICK", now: PAN_TOTAL_MS - 1 })).toBe(running);
    expect(panReducer(running, { type: "TICK", now: PAN_TOTAL_MS })).toMatchObject({ status: "finished", by: "timeout", grade: "overdone" });
  });

  it("a finished pan ignores TAKE / TICK / START (same state); only CANCEL leaves it", () => {
    const done = run([{ type: "START", now: 0 }, { type: "TAKE", now: 3000 }]);
    for (const e of [{ type: "TAKE", now: 3100 }, { type: "TICK", now: 9000 }, { type: "START", now: 4000 }] as PanEvent[]) {
      expect(panReducer(done, e)).toBe(done);
    }
    expect(panReducer(done, { type: "CANCEL" })).toBe(PAN_IDLE);
  });

  it("an idle pan ignores TAKE / TICK; CANCEL on idle is the same state", () => {
    expect(panReducer(PAN_IDLE, { type: "TAKE", now: 5000 })).toBe(PAN_IDLE);
    expect(panReducer(PAN_IDLE, { type: "TICK", now: 5000 })).toBe(PAN_IDLE);
    expect(panReducer(PAN_IDLE, { type: "CANCEL" })).toBe(PAN_IDLE);
  });

  it("retry: CANCEL then START begins a fresh run", () => {
    const again = run([{ type: "START", now: 0 }, { type: "TAKE", now: 1000 }, { type: "CANCEL" }, { type: "START", now: 9000 }]);
    expect(again).toEqual({ status: "running", startedAt: 9000 });
  });

  it("a clock that goes backwards or is not finite counts as elapsed 0: no crash, no grade", () => {
    const running = run([{ type: "START", now: 5000 }]);
    expect(panReducer(running, { type: "TAKE", now: 1000 })).toBe(running);
    expect(panReducer(running, { type: "TAKE", now: Number.NaN })).toBe(running);
    expect(panReducer(running, { type: "TICK", now: -Infinity })).toBe(running);
    expect(run([{ type: "START", now: Number.NaN }])).toEqual({ status: "running", startedAt: 0 });
  });
});

describe("panResultCopy", () => {
  it("has a line for each outcome and never names a recipe or target", () => {
    const lines = [panResultCopy("early", "take"), panResultCopy("best", "take"), panResultCopy("overdone", "take"), panResultCopy("overdone", "timeout")].map((c) => c.label);
    expect(new Set(lines).size).toBe(4);
    for (const l of lines) expect(l).not.toMatch(/ルンダン|わさび|レシピ|ピザ/);
  });
});
