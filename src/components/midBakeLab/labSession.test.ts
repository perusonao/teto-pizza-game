import { describe, expect, it } from "vitest";
import { labCanAdd, labCanClose, labCanTakeOut, labRemainingStock, labSessionReducer, createLabSession, type LabEvent, type LabSession } from "./labSession";

const FRAME: LabEvent = { type: "FRAME", dtMs: 100 };
const tap: LabEvent = { type: "ADD", input: "direct" };

function run(events: readonly LabEvent[], session: LabSession = createLabSession()): LabSession {
  return events.reduce(labSessionReducer, session);
}
const frames = (count: number): LabEvent[] => Array.from({ length: count }, () => FRAME);
/** START and run until the clock holds at the window start (1950 ms). */
const atHold = (config?: Parameters<typeof createLabSession>[0]): LabSession => run([{ type: "START" }, ...frames(20)], createLabSession(config));

describe("Lab session: the round", () => {
  it("starts ready, and START begins a round once", () => {
    const ready = createLabSession();
    expect(ready).toMatchObject({ phase: "ready", result: null, round: 1 });
    expect(labSessionReducer(ready, FRAME)).toBe(ready);
    const baking = labSessionReducer(ready, { type: "START" });
    expect(baking.phase).toBe("baking");
    expect(labSessionReducer(baking, { type: "START" })).toBe(baking);
  });

  it("holds at the window start and shows it to the engine in milliseconds (window-open, not 1/1000 of it)", () => {
    const held = atHold();
    expect(held.clock).toMatchObject({ status: "holding", elapsedMs: 1950 });
    expect(held.engine).toMatchObject({ status: "baking", stage: "window-open", progress: 0.65 });
    expect(held.log.map((entry) => entry.kind)).toEqual(["start", "hold"]);
    expect(labCanAdd(held) && labCanClose(held)).toBe(true);
    expect(labCanTakeOut(held)).toBe(false);
  });

  it("adds one deterministic piece per tap, caps at the required count, and resumes by itself when complete", () => {
    const one = run([tap], atHold());
    expect(one.pieces).toMatchObject([{ id: 1, ingredientId: "natto", input: "direct", at: { x: 40, y: 44 } }]);
    expect(one.clock.status).toBe("holding");
    const two = run([tap], one);
    expect(two.pieces.map((piece) => piece.at)).toEqual([{ x: 40, y: 44 }, { x: 60, y: 57 }]);
    expect(two.clock).toMatchObject({ status: "running", released: "complete" });
    expect(labRemainingStock(two)).toBe(1);
    expect(two.log.at(-1)?.kind).toBe("release");
    expect(labCanAdd(two)).toBe(false);
  });

  it("a direct tap and the alternative control give the same domain result (only the audit input differs)", () => {
    const direct = run([tap, tap], atHold());
    const alternative = run([{ type: "ADD", input: "alternative" }, { type: "ADD", input: "alternative" }], atHold());
    expect(alternative.pieces.map(({ input: _input, ...rest }) => rest)).toEqual(direct.pieces.map(({ input: _input, ...rest }) => rest));
    expect(alternative.clock).toEqual(direct.clock);
    expect(alternative.engine.status === "baking" && alternative.engine.additions.map((a) => a.input)).toEqual(["alternative", "alternative"]);
  });

  it("refuses an addition outside the hold and records it without changing the round", () => {
    const early = run([{ type: "START" }, tap]);
    expect(early.pieces).toHaveLength(0);
    expect(early).toMatchObject({ rejectedAdds: 1, phase: "baking" });
    expect(early.log.at(-1)).toMatchObject({ kind: "rejected" });
    const ready = createLabSession();
    expect(labSessionReducer(ready, tap)).toBe(ready);
  });

  it("refuses an addition when the stand-in stock is gone, and the round ends short of the required count", () => {
    const short = run([tap, tap], atHold({ stock: 1 }));
    expect(short.pieces).toHaveLength(1);
    expect(short).toMatchObject({ rejectedAdds: 1 });
    expect(labCanAdd(short)).toBe(false);
    const done = run([{ type: "CLOSE" }, ...frames(11)], short);
    expect(done.phase).toBe("finished");
    expect(done.result).toMatchObject({ completion: "missing-additions", additions: 1, consumed: 1, takeOutPct: null, bake: "burnt", releasedBy: "closed" });
  });
});

describe("Lab session: closing, timeout and the take-out", () => {
  it("CLOSE resumes without additions and the bake runs to the end as a miss (the miss path)", () => {
    const done = run([{ type: "CLOSE" }, ...frames(11)], atHold());
    expect(done.phase).toBe("finished");
    expect(done.engine).toMatchObject({ status: "finished", completion: "missing-additions" });
    expect(done.result).toMatchObject({ completion: "missing-additions", additions: 0, consumed: 0, releasedBy: "closed" });
    expect(labSessionReducer(done, FRAME)).toBe(done);
  });

  it("the Lab hold timeout resumes by itself (a PROVISIONAL Lab value) and is logged", () => {
    const timedOut = run(frames(3), atHold({ holdTimeoutMs: 300 }));
    expect(timedOut.clock).toMatchObject({ status: "running", released: "timeout" });
    expect(timedOut.log.some((entry) => entry.kind === "release" && entry.text.includes("タイムアウト"))).toBe(true);
    expect(run(frames(2), atHold({ holdTimeoutMs: 300 })).clock.status).toBe("holding");
  });

  it("the take-out is blocked while holding and only counted", () => {
    const held = atHold();
    const blocked = labSessionReducer(held, { type: "TAKE_OUT" });
    expect(blocked).toMatchObject({ phase: "baking", blockedTakeOuts: 1, result: null });
    expect(blocked.log.at(-1)?.kind).toBe("blocked-takeout");
    expect(blocked.clock).toBe(held.clock);
  });

  it("a take-out after both additions ends the round with the gauge position, a plain bake class and the stock spent", () => {
    const done = run([tap, tap, ...frames(2), { type: "TAKE_OUT" }], atHold());
    expect(done.phase).toBe("finished");
    expect(done.result).toMatchObject({ completion: "complete", additions: 2, consumed: 2, bake: "perfect", releasedBy: "complete", holdMs: 0 });
    expect(done.result?.takeOutPct).toBeCloseTo(71.67, 1);
    expect(labRemainingStock(done)).toBe(1);
  });

  it("an early take-out before the window is a miss and not an error", () => {
    const early = run([{ type: "START" }, ...frames(5), { type: "TAKE_OUT" }]);
    expect(early.result).toMatchObject({ completion: "missing-additions", bake: "raw", consumed: 0 });
    expect(early.result?.takeOutPct).toBeCloseTo(16.67, 1);
  });

  it("the timing of an addition earns no score: waiting in the hold before tapping changes neither the clock nor the take-out position (Q11)", () => {
    const quick = run([tap, tap, ...frames(2), { type: "TAKE_OUT" }], atHold());
    const slow = run([...frames(30), tap, ...frames(7), tap, ...frames(2), { type: "TAKE_OUT" }], atHold());
    expect(slow.result?.takeOutPct).toBe(quick.result?.takeOutPct);
    expect(slow.result?.bake).toBe(quick.result?.bake);
    expect(slow.result?.completion).toBe(quick.result?.completion);
    expect(slow.result?.holdMs).toBeGreaterThan(quick.result?.holdMs ?? 0);
  });

  it("RESTART gives a fresh round with the full stock and the same config", () => {
    const finished = run([tap, tap, { type: "RESTART" }], atHold({ stock: 4, holdTimeoutMs: 700 }));
    expect(finished).toMatchObject({ phase: "ready", pieces: [], log: [], result: null, round: 2, rejectedAdds: 0, blockedTakeOuts: 0 });
    expect(finished.config).toEqual({ stock: 4, holdTimeoutMs: 700 });
    expect(labRemainingStock(finished)).toBe(4);
  });

  it("is deterministic for the same events", () => {
    const events: LabEvent[] = [{ type: "START" }, ...frames(20), tap, tap, ...frames(4), { type: "TAKE_OUT" }];
    expect(run(events)).toEqual(run(events));
  });

  it("ignores a frame limit breach: one huge frame advances at most the shared frame cap", () => {
    const jumped = run([{ type: "START" }, { type: "FRAME", dtMs: 60_000 }]);
    expect(jumped.clock.elapsedMs).toBe(100);
  });
});
