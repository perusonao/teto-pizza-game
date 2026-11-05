import { describe, expect, it } from "vitest";
import {
  STEAM_GAME_FULL_LEVEL,
  STEAM_GAME_HEAT_PER_SECOND,
  STEAM_GAME_IDLE,
  STEAM_GAME_OVER_LIMIT,
  steamGameAdvance,
  steamGameOutcome,
  steamGameReducer,
  steamGameSnapshot,
  type SteamGameAction,
  type SteamGameCooking,
  type SteamGameState,
} from "./steamGamePilot";

const T = 10_000;
const run = (actions: SteamGameAction[]): SteamGameState => actions.reduce(steamGameReducer, STEAM_GAME_IDLE as SteamGameState);
const start = (): SteamGameState => run([{ type: "START", now: T }]);
const withHigh = (): SteamGameState => run([{ type: "START", now: T }, { type: "SET_HEAT", heat: "high", now: T }]);
const liftAt = (elapsedMs: number, heat: "low" | "high" = "high") =>
  run([{ type: "START", now: T }, { type: "SET_HEAT", heat, now: T }, { type: "OPEN", now: T + elapsedMs }]);

describe("Steam Gameplay Pilot #755 (no production wiring)", () => {
  it("starts with low fire; opening before starting does nothing", () => {
    expect(start()).toEqual({ status: "cooking", startedAt: T, lastAt: T, heat: "low", level: 0, over: 0 });
    expect(steamGameReducer(STEAM_GAME_IDLE, { type: "OPEN", now: T })).toBe(STEAM_GAME_IDLE);
  });

  it("high fire opens all shells faster than low fire", () => {
    expect(liftAt(4000, "high")).toMatchObject({ status: "released", result: { outcome: "justRight", openCount: 5 } });
    expect(liftAt(4000, "low")).toMatchObject({ status: "released", result: { outcome: "tooEarly", openCount: 2 } });
    expect(STEAM_GAME_HEAT_PER_SECOND.high).toBeGreaterThan(STEAM_GAME_HEAT_PER_SECOND.low);
  });

  it("early / well timed / overcooked have visibly distinct results", () => {
    expect(liftAt(2500)).toMatchObject({ result: { outcome: "tooEarly", openCount: 2 } });
    expect(liftAt(4000)).toMatchObject({ result: { outcome: "justRight", openCount: 5 } });
    expect(liftAt(6000)).toMatchObject({ result: { outcome: "overcooked", openCount: 5 } });
  });

  it("switching down to low fire gives a more forgiving fully-open window", () => {
    const switched = run([
      { type: "START", now: T },
      { type: "SET_HEAT", heat: "high", now: T },
      { type: "SET_HEAT", heat: "low", now: T + 3500 },
      { type: "OPEN", now: T + 5500 },
    ]);
    expect(switched).toMatchObject({ status: "released", result: { outcome: "justRight", openCount: 5 } });
    expect(liftAt(6000)).toMatchObject({ result: { outcome: "overcooked" } });
  });

  it("low fire eventually opens every shell but never makes a quicker result", () => {
    expect(liftAt(8000, "low")).toMatchObject({ result: { outcome: "justRight", openCount: 5 } });
    expect(liftAt(4000, "low")).toMatchObject({ result: { outcome: "tooEarly" } });
  });

  it("the overcook exposure begins only after the final shell opens", () => {
    const state = withHigh() as SteamGameCooking;
    const before = steamGameAdvance(state, T + 3000);
    const crossing = steamGameAdvance(state, T + (STEAM_GAME_FULL_LEVEL / 0.2) * 1000);
    expect(before.over).toBe(0);
    expect(crossing.over).toBeCloseTo(0, 7);
    expect(crossing.level).toBeCloseTo(STEAM_GAME_FULL_LEVEL, 7);
    expect(steamGameOutcome(0.99, STEAM_GAME_OVER_LIMIT)).toBe("overcooked");
  });

  it("a snapshot is read-only and does not change the eventual result", () => {
    const state = withHigh();
    const snapshot1 = steamGameSnapshot(state, T + 4000);
    const snapshot2 = steamGameSnapshot(state, T + 4000);
    expect(snapshot1).toEqual(snapshot2);
    expect(snapshot1).toMatchObject({ openCount: 5, overcooked: false, outcome: null, heat: "high" });
    expect(steamGameReducer(state, { type: "OPEN", now: T + 4000 })).toEqual(liftAt(4000));
  });

  it("time updates settle under the PREVIOUS fire before switching", () => {
    const before = withHigh() as SteamGameCooking;
    const switched = steamGameReducer(before, { type: "SET_HEAT", heat: "low", now: T + 2000 });
    expect(switched).toMatchObject({ status: "cooking", level: 0.4, heat: "low", lastAt: T + 2000 });
  });

  it("changing fire frequently cannot add extra heat or bonus on its own", () => {
    const actions: SteamGameAction[] = [
      { type: "START", now: T },
      { type: "SET_HEAT", heat: "high", now: T },
      { type: "SET_HEAT", heat: "low", now: T + 1000 },
      { type: "SET_HEAT", heat: "high", now: T + 1000 },
      { type: "SET_HEAT", heat: "low", now: T + 1000 },
      { type: "SET_HEAT", heat: "high", now: T + 1000 },
      { type: "OPEN", now: T + 4000 },
    ];
    // Same outcome; the float accumulation order differs, so compare `over` with a tolerance.
    const a = run(actions) as Extract<SteamGameState, { status: "released" }>;
    const b = liftAt(4000) as Extract<SteamGameState, { status: "released" }>;
    expect(a.result).toMatchObject({ outcome: b.result.outcome, openCount: b.result.openCount, elapsedMs: b.result.elapsedMs });
    expect(a.result.level).toBeCloseTo(b.result.level, 9);
    expect(a.result.over).toBeCloseTo(b.result.over, 9);
  });

  it("invalid or backwards timestamps are ignored (same state reference)", () => {
    const state = withHigh();
    expect(steamGameReducer(state, { type: "OPEN", now: Number.NaN })).toBe(state);
    expect(steamGameReducer(state, { type: "SET_HEAT", heat: "low", now: T - 1 })).toBe(state);
    expect(steamGameReducer(STEAM_GAME_IDLE, { type: "START", now: Infinity })).toBe(STEAM_GAME_IDLE);
    expect(steamGameSnapshot(state, Number.NaN)).toMatchObject({ level: 0, heat: "high" });
  });

  it("interruption discards in-flight cooking; retry clears any result", () => {
    expect(steamGameReducer(start(), { type: "INTERRUPT" })).toBe(STEAM_GAME_IDLE);
    const finished = liftAt(4000);
    expect(steamGameReducer(finished, { type: "INTERRUPT" })).toBe(finished);
    expect(steamGameReducer(finished, { type: "RETRY" })).toBe(STEAM_GAME_IDLE);
  });

  it("a result can be emitted only once and cannot be changed by later input", () => {
    const state = liftAt(4000);
    expect(steamGameReducer(state, { type: "OPEN", now: T + 8000 })).toBe(state);
    expect(steamGameReducer(state, { type: "START", now: T + 9000 })).toBe(state);
  });

  it("same timestamped gestures always produce the same result", () => {
    const actions: SteamGameAction[] = [
      { type: "START", now: T },
      { type: "SET_HEAT", heat: "high", now: T + 1000 },
      { type: "SET_HEAT", heat: "low", now: T + 4000 },
      { type: "OPEN", now: T + 6500 },
    ];
    expect(run(actions)).toEqual(run(actions));
    const shift = actions.map((a) => ("now" in a ? { ...a, now: a.now + 100_000 } : a)) as SteamGameAction[];
    const a = run(actions);
    const b = run(shift);
    if (a.status !== "released" || b.status !== "released") throw new Error("expected finished states");
    expect(a.result).toEqual(b.result);
  });

  it("snapshot displays idle and released states without mutating them", () => {
    expect(steamGameSnapshot(STEAM_GAME_IDLE, T)).toMatchObject({ status: "idle", openCount: 0 });
    expect(steamGameSnapshot(liftAt(6000), T + 9999)).toMatchObject({
      status: "released", openCount: 5, overcooked: true, outcome: "overcooked",
    });
  });
});
