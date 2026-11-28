import { describe, expect, it } from "vitest";
import {
  STEAM_V2_BATCHES, STEAM_V2_IDLE, steamV2Advance, steamV2Reducer, steamV2Snapshot,
  type SteamV2Action, type SteamV2Cooking, type SteamV2State,
} from "./steamGameV2";

const T = 10_000;
const run = (actions: SteamV2Action[]): SteamV2State => actions.reduce(steamV2Reducer, STEAM_V2_IDLE as SteamV2State);
const high = (): SteamV2State => run([{ type: "START", now: T, batch: "clam" }, { type: "SET_HEAT", heat: "high", now: T }]);
const low = (): SteamV2State => run([{ type: "START", now: T, batch: "clam" }]);
const pick = (index: number, afterMs: number): SteamV2Action => ({ type: "PICK", index, now: T + afterMs });

describe("Steam Gameplay V2: five independent shells", () => {
  it("starts in low heat, no storage and no real clock; idle cannot be picked", () => {
    const state = low();
    expect(state).toMatchObject({ status: "cooking", heat: "low", batch: "clam", progress: 0 });
    expect(steamV2Reducer(STEAM_V2_IDLE, pick(0, 10))).toBe(STEAM_V2_IDLE);
  });

  it("an early shell opens while the others remain closed, and a ready shell can be rescued", () => {
    const state = run([{ type: "START", now: T, batch: "clam" }, { type: "SET_HEAT", heat: "high", now: T }, pick(0, 1350)]);
    expect(steamV2Snapshot(state, T + 1350).shells).toEqual(["rescued", "closed", "closed", "closed", "closed"]);
    expect(steamV2Snapshot(state, T + 3800).shells[0]).toBe("rescued");
  });

  it("tapping an unopened shell does not rescue it; tap is retryable later", () => {
    const first = steamV2Reducer(high(), pick(4, 1500));
    expect(steamV2Snapshot(first, T + 1500).shells[4]).toBe("closed");
    const later = steamV2Reducer(first, pick(4, 3900));
    expect(steamV2Snapshot(later, T + 3900).shells[4]).toBe("rescued");
  });

  it("high-only and low-only passive waiting cannot earn a perfect result", () => {
    const h = run([{ type: "START", now: T, batch: "clam" }, { type: "SET_HEAT", heat: "high", now: T }, { type: "OPEN", now: T + 4200 }]);
    const l = run([{ type: "START", now: T, batch: "clam" }, { type: "OPEN", now: T + 7500 }]);
    expect(h).toMatchObject({ status: "released", result: { verdict: "missed", rescuedCount: 0 } });
    expect(l).toMatchObject({ status: "released", result: { verdict: "missed", rescuedCount: 0 } });
    const hot = steamV2Snapshot(high(), T + 4200);
    const warm = steamV2Snapshot(low(), T + 7500);
    expect(hot.overCount).toBeGreaterThan(0);
    expect(warm.overCount).toBeGreaterThan(0);
  });

  it("quick rescue on high fire is possible but requires watching all five shells", () => {
    const state = run([
      { type: "START", now: T, batch: "clam" }, { type: "SET_HEAT", heat: "high", now: T },
      pick(0, 1350), pick(1, 1900), pick(2, 2500), pick(3, 3100), pick(4, 3850),
      { type: "OPEN", now: T + 3900 },
    ]);
    expect(state).toMatchObject({ status: "released", result: { verdict: "perfect", rescuedCount: 5 } });
    expect(steamV2Snapshot(state, T + 9000).shells).toEqual(Array(5).fill("rescued"));
  });

  it("high-to-low transition provides a much more forgiving rescue cadence", () => {
    const state = run([
      { type: "START", now: T, batch: "clam" }, { type: "SET_HEAT", heat: "high", now: T },
      { type: "SET_HEAT", heat: "low", now: T + 2000 },
      pick(0, 2100), pick(1, 2300), pick(2, 3100), pick(3, 4200), pick(4, 5300),
      { type: "OPEN", now: T + 5400 },
    ]);
    expect(state).toMatchObject({ status: "released", result: { verdict: "perfect", rescuedCount: 5 } });
  });

  it("slow steady play can also succeed when player actively rescues shells", () => {
    const state = run([
      { type: "START", now: T, batch: "clam" },
      pick(0, 2400), pick(1, 3400), pick(2, 4500), pick(3, 5700), pick(4, 6900),
      { type: "OPEN", now: T + 7000 },
    ]);
    expect(state).toMatchObject({ status: "released", result: { verdict: "perfect", rescuedCount: 5 } });
  });

  it("a visually disclosed large mussel batch needs different timing", () => {
    const clam = run([{ type: "START", now: T, batch: "clam" }, { type: "SET_HEAT", heat: "high", now: T }]);
    const mussel = run([{ type: "START", now: T, batch: "mussel" }, { type: "SET_HEAT", heat: "high", now: T }]);
    expect(STEAM_V2_BATCHES.mussel.label).toContain("大粒");
    expect(steamV2Snapshot(clam, T + 3900).shells[4]).not.toBe("closed");
    expect(steamV2Snapshot(mussel, T + 3900).shells[4]).toBe("closed");
  });

  it("overcooked shell is permanently lost; no rescue after it shrinks", () => {
    const state = steamV2Reducer(high(), pick(0, 3600));
    const snapshot = steamV2Snapshot(state, T + 3600);
    expect(snapshot.shells[0]).toBe("over");
    expect(snapshot.rescuedCount).toBe(0);
  });

  it("rescued shell stops accumulating exposure, while the other shells keep cooking", () => {
    const state = run([{ type: "START", now: T, batch: "clam" }, { type: "SET_HEAT", heat: "high", now: T }, pick(0, 1350)]) as SteamV2Cooking;
    const later = steamV2Advance(state, T + 6000);
    expect(later.exposure[0]).toBe(state.exposure[0]);
    expect(later.exposure[1]).toBeGreaterThan(state.exposure[1]);
  });

  it("opening the lid grades only rescued shells and locks the result", () => {
    const finished = run([{ type: "START", now: T, batch: "clam" }, { type: "SET_HEAT", heat: "high", now: T }, pick(0, 1400), { type: "OPEN", now: T + 2500 }]);
    expect(finished).toMatchObject({ status: "released", result: { verdict: "partial", rescuedCount: 1 } });
    expect(steamV2Reducer(finished, pick(1, 3000))).toBe(finished);
    expect(steamV2Reducer(finished, { type: "OPEN", now: T + 8000 })).toBe(finished);
  });

  it("invalid indexes, backward or nonfinite time never grant a rescue", () => {
    const state = high();
    expect(steamV2Reducer(state, { type: "PICK", index: -1, now: T + 1000 })).toBe(state);
    expect(steamV2Reducer(state, { type: "PICK", index: 100, now: T + 1000 })).toBe(state);
    expect(steamV2Reducer(state, { type: "PICK", index: 0.5, now: T + 1000 })).toBe(state);
    expect(steamV2Reducer(state, { type: "PICK", index: 0, now: T - 1 })).toBe(state);
    expect(steamV2Reducer(state, { type: "OPEN", now: Infinity })).toBe(state);
    expect(steamV2Reducer(state, { type: "SET_HEAT", heat: "high", now: Number.NaN })).toBe(state);
    expect(steamV2Reducer(STEAM_V2_IDLE, { type: "START", now: Infinity, batch: "clam" })).toBe(STEAM_V2_IDLE);
  });

  it("snapshot is pure and a time change does not mutate the pending cooking state", () => {
    const state = high() as SteamV2Cooking;
    const old = state.progress;
    const a = steamV2Snapshot(state, T + 3000);
    expect(steamV2Snapshot(state, T + 3000)).toEqual(a);
    expect(state.progress).toBe(old);
    expect(steamV2Advance(state, T - 100)).toBe(state);
  });

  it("INTERRUPT and RESET discard an unfinished cook, but keep a finished result until reset", () => {
    expect(steamV2Reducer(low(), { type: "INTERRUPT" })).toBe(STEAM_V2_IDLE);
    const finished = steamV2Reducer(low(), { type: "OPEN", now: T + 3000 });
    expect(steamV2Reducer(finished, { type: "INTERRUPT" })).toBe(finished);
    expect(steamV2Reducer(finished, { type: "RESET" })).toBe(STEAM_V2_IDLE);
  });

  it("deterministic for identical input schedule and independent of absolute clock origin", () => {
    const actions: SteamV2Action[] = [
      { type: "START", now: T, batch: "mussel" },
      { type: "SET_HEAT", heat: "high", now: T + 1000 },
      pick(0, 3000),
      { type: "SET_HEAT", heat: "low", now: T + 4000 },
      { type: "OPEN", now: T + 7000 },
    ];
    const a = run(actions);
    expect(run(actions)).toEqual(a);
    const shift = actions.map((x) => "now" in x ? { ...x, now: x.now + 100_000 } : x) as SteamV2Action[];
    const b = run(shift);
    if (a.status !== "released" || b.status !== "released") throw Error("missing released");
    expect(a.result).toEqual(b.result);
  });
});
