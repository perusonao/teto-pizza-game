import { describe, expect, it } from "vitest";
import { STEAM_LID_FULL_MS, STEAM_LID_IDLE, STEAM_LID_MIN_MS, steamLidLevelAt, steamLidReducer, type SteamLid, type SteamLidAction } from "./steamLid";
import { STEAM_OVER_MS } from "./steamPot";

const run = (actions: SteamLidAction[], from: SteamLid = STEAM_LID_IDLE): SteamLid => actions.reduce(steamLidReducer, from);
const T = 10_000;

describe("steamLidLevelAt", () => {
  it("linear from 0 to 1 over the full time, then flat", () => {
    expect(steamLidLevelAt(0)).toBe(0);
    expect(steamLidLevelAt(STEAM_LID_FULL_MS / 2)).toBe(0.5);
    expect(steamLidLevelAt(STEAM_LID_FULL_MS)).toBe(1);
    expect(steamLidLevelAt(STEAM_LID_FULL_MS * 10)).toBe(1);
  });
  it("unreadable input is 0; an unusable full time falls back to the default", () => {
    for (const bad of [NaN, -1, -Infinity, undefined as never]) expect(steamLidLevelAt(bad)).toBe(0);
    for (const bad of [0, -5, NaN, Infinity]) expect(steamLidLevelAt(STEAM_LID_FULL_MS / 2, bad)).toBe(0.5);
    expect(steamLidLevelAt(1500, 3000)).toBe(0.5);
  });
});

describe("steamLidReducer", () => {
  it("CLOSE starts, a second CLOSE is ignored, OPEN before CLOSE is ignored", () => {
    const s = run([{ type: "CLOSE", now: T }]);
    expect(s).toEqual({ status: "steaming", startedAt: T });
    expect(steamLidReducer(s, { type: "CLOSE", now: T + 5 })).toBe(s);
    expect(steamLidReducer(STEAM_LID_IDLE, { type: "OPEN", now: T })).toBe(STEAM_LID_IDLE);
  });
  it("a lift sooner than the minimum is a stray tap and keeps nothing", () => {
    expect(run([{ type: "CLOSE", now: T }, { type: "OPEN", now: T + STEAM_LID_MIN_MS - 1 }])).toEqual({ status: "idle", tooShort: true });
    const kept = run([{ type: "CLOSE", now: T }, { type: "OPEN", now: T + STEAM_LID_MIN_MS }]);
    expect(kept.status).toBe("released");
  });
  it("keeps what the shells reached: early is closed, half is partial, full is open", () => {
    const at = (ms: number) => run([{ type: "CLOSE", now: T }, { type: "OPEN", now: T + ms }]);
    expect(at(STEAM_LID_MIN_MS)).toMatchObject({ status: "released", result: { look: "closed", openCount: 0 }, elapsedMs: STEAM_LID_MIN_MS });
    expect(at(STEAM_LID_FULL_MS / 2)).toMatchObject({ result: { look: "partial", openCount: 2, amount: 0.5 } });
    expect(at(STEAM_LID_FULL_MS)).toMatchObject({ result: { look: "open", openCount: 5 } });
  });
  it("stays open until full steam has been held for STEAM_OVER_MS, then over", () => {
    const at = (ms: number) => run([{ type: "CLOSE", now: T }, { type: "OPEN", now: T + ms }]);
    expect(at(STEAM_LID_FULL_MS + STEAM_OVER_MS - 1)).toMatchObject({ result: { look: "open" } });
    expect(at(STEAM_LID_FULL_MS + STEAM_OVER_MS)).toMatchObject({ result: { look: "over", amount: 1 } });
    expect(at(60_000)).toMatchObject({ result: { look: "over" } }); // no time-out and no failure
  });
  it("a comparison full time moves the whole curve (the same hold means different shells)", () => {
    const open = (fullMs: number) => run([{ type: "CLOSE", now: T }, { type: "OPEN", now: T + 3000, fullMs }]);
    expect(open(3000)).toMatchObject({ result: { look: "open" } });
    expect(open(6000)).toMatchObject({ result: { look: "partial", openCount: 2 } }); // level 0.5 -> the shells at 0.3 and 0.42 (not 0.54)
  });
  it("an invalid comparison full time falls back to the default", () => {
    const a = run([{ type: "CLOSE", now: T }, { type: "OPEN", now: T + 2000, fullMs: NaN }]);
    const b = run([{ type: "CLOSE", now: T }, { type: "OPEN", now: T + 2000 }]);
    expect(a).toEqual(b);
  });
  it("CLOSE with an unreadable clock is ignored; a clock that runs backwards is a tap", () => {
    expect(steamLidReducer(STEAM_LID_IDLE, { type: "CLOSE", now: NaN })).toBe(STEAM_LID_IDLE);
    expect(run([{ type: "CLOSE", now: T }, { type: "OPEN", now: T - 500 }])).toEqual({ status: "idle", tooShort: true });
    expect(run([{ type: "CLOSE", now: T }, { type: "OPEN", now: NaN }])).toEqual({ status: "idle", tooShort: true });
  });
  it("CANCEL drops everything (also a kept result); INTERRUPT drops only a steam in progress", () => {
    const released = run([{ type: "CLOSE", now: T }, { type: "OPEN", now: T + 2000 }]);
    expect(steamLidReducer(released, { type: "CANCEL" })).toEqual(STEAM_LID_IDLE);
    expect(steamLidReducer({ status: "steaming", startedAt: T }, { type: "CANCEL" })).toEqual(STEAM_LID_IDLE);
    expect(steamLidReducer({ status: "steaming", startedAt: T }, { type: "INTERRUPT" })).toEqual(STEAM_LID_IDLE);
    expect(steamLidReducer(released, { type: "INTERRUPT" })).toBe(released);
    const tooShort: SteamLid = { status: "idle", tooShort: true };
    expect(steamLidReducer(tooShort, { type: "INTERRUPT" })).toBe(tooShort);
  });
  it("a kept result cannot be changed by another CLOSE / OPEN (one result per pot)", () => {
    const released = run([{ type: "CLOSE", now: T }, { type: "OPEN", now: T + 2000 }]);
    expect(steamLidReducer(released, { type: "CLOSE", now: T + 3000 })).toBe(released);
    expect(steamLidReducer(released, { type: "OPEN", now: T + 9000 })).toBe(released);
  });
  it("is deterministic and never reads the real clock", () => {
    const actions: SteamLidAction[] = [{ type: "CLOSE", now: 5 }, { type: "OPEN", now: 4000 }];
    expect(run(actions)).toEqual(run(actions));
    expect(run(actions)).toEqual(run(actions.map((a) => ("now" in a ? { ...a, now: a.now + 1_000_000 } : a))));
  });
});
