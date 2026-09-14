import { describe, expect, it } from "vitest";
import type { RecipeId } from "../data/recipes";
import {
  DEFAULT_MISSION_CONFIG,
  DEFAULT_MISSION_DURATION_SECONDS,
  INITIAL_MISSION_STATE,
  isMissionExpired,
  missionRunReducer,
  pickMissionOrder,
  remainingMs,
  remainingSeconds,
  startMissionClock,
  type MissionState,
} from "./lunchRush";

describe("MissionConfig", () => {
  it("defaults to the canonical 180 second (3 minute) duration", () => {
    expect(DEFAULT_MISSION_DURATION_SECONDS).toBe(180);
    expect(DEFAULT_MISSION_CONFIG).toEqual({ durationSeconds: 180 });
  });
});

describe("mission clock", () => {
  it("startMissionClock sets endsAt exactly durationSeconds after startedAt", () => {
    const clock = startMissionClock(1_000, { durationSeconds: 30 });
    expect(clock).toEqual({ startedAt: 1_000, endsAt: 31_000 });
  });

  it("uses DEFAULT_MISSION_CONFIG when no config is given", () => {
    const clock = startMissionClock(0);
    expect(clock.endsAt).toBe(DEFAULT_MISSION_DURATION_SECONDS * 1000);
  });

  it("remainingMs/remainingSeconds count down correctly mid-run", () => {
    const clock = startMissionClock(0, { durationSeconds: 60 });
    expect(remainingMs(0, clock)).toBe(60_000);
    expect(remainingMs(25_000, clock)).toBe(35_000);
    expect(remainingSeconds(25_000, clock)).toBe(35);
  });

  it("rounds remainingSeconds up so it never reads 0 while time technically remains", () => {
    const clock = startMissionClock(0, { durationSeconds: 60 });
    // 59_500ms in -> 500ms left -> ceil(0.5) = 1, not 0
    expect(remainingSeconds(59_500, clock)).toBe(1);
  });

  it("never goes negative even when `now` is past endsAt (a throttled/delayed tick)", () => {
    const clock = startMissionClock(0, { durationSeconds: 10 });
    expect(remainingMs(999_999, clock)).toBe(0);
    expect(remainingSeconds(999_999, clock)).toBe(0);
  });

  it("isMissionExpired is false before endsAt, true at and after it", () => {
    const clock = startMissionClock(0, { durationSeconds: 10 });
    expect(isMissionExpired(9_999, clock)).toBe(false);
    expect(isMissionExpired(10_000, clock)).toBe(true);
    expect(isMissionExpired(20_000, clock)).toBe(true);
  });
});

describe("pickMissionOrder", () => {
  it("only ever picks a recipe from the available pool", () => {
    const ids: RecipeId[] = ["margherita", "marinara"];
    for (let i = 0; i < 50; i++) {
      const order = pickMissionOrder(ids);
      expect(ids).toContain(order.recipeId);
    }
  });

  it("avoids repeating the excluded (just-served) recipe when the pool has other options", () => {
    const ids: RecipeId[] = ["margherita", "marinara"];
    for (let i = 0; i < 50; i++) {
      const order = pickMissionOrder(ids, "margherita");
      expect(order.recipeId).toBe("marinara");
    }
  });

  it("falls back to repeating when the available pool has only one recipe (can't avoid it)", () => {
    const ids: RecipeId[] = ["margherita"];
    const order = pickMissionOrder(ids, "margherita");
    expect(order.recipeId).toBe("margherita");
  });

  it("never crashes and falls back to the full recipe pool when availableRecipeIds is empty", () => {
    for (let i = 0; i < 20; i++) {
      const order = pickMissionOrder([]);
      expect(order).toBeDefined();
      expect(typeof order.recipeId).toBe("string");
    }
  });

  it("does not force undiscovered-first ordering (every recipe in the pool is reachable)", () => {
    const ids: RecipeId[] = ["margherita", "marinara", "genovese"];
    const seen = new Set<string>();
    for (let i = 0; i < 200 && seen.size < 3; i++) {
      seen.add(pickMissionOrder(ids).recipeId);
    }
    expect(seen.size).toBe(3);
  });
});

describe("missionRunReducer", () => {
  it("starts at FREE with empty metrics and no clock", () => {
    expect(INITIAL_MISSION_STATE).toEqual({
      mode: "FREE",
      clock: null,
      metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 },
    });
  });

  it("SHOW_INTRO moves FREE -> INTRO", () => {
    const next = missionRunReducer(INITIAL_MISSION_STATE, { type: "SHOW_INTRO" });
    expect(next.mode).toBe("INTRO");
  });

  it("SHOW_INTRO is a no-op outside of FREE", () => {
    const playing: MissionState = { ...INITIAL_MISSION_STATE, mode: "PLAYING" };
    expect(missionRunReducer(playing, { type: "SHOW_INTRO" })).toBe(playing);
  });

  it("START moves to PLAYING with a fresh clock and reset metrics, from any mode", () => {
    for (const mode of ["FREE", "INTRO", "PLAYING", "RESULT"] as const) {
      const from: MissionState = {
        mode,
        clock: startMissionClock(0, { durationSeconds: 10 }),
        metrics: { servedCount: 3, totalQualityScore: 250, bestQualityScore: 90 },
      };
      const next = missionRunReducer(from, {
        type: "START",
        now: 5_000,
        config: { durationSeconds: 45 },
      });
      expect(next.mode).toBe("PLAYING");
      expect(next.clock).toEqual({ startedAt: 5_000, endsAt: 50_000 });
      expect(next.metrics).toEqual({ servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 });
    }
  });

  it("retrying (START again from RESULT) resets mission metrics", () => {
    const finished: MissionState = {
      mode: "RESULT",
      clock: startMissionClock(0, { durationSeconds: 10 }),
      metrics: { servedCount: 5, totalQualityScore: 400, bestQualityScore: 95 },
    };
    const retried = missionRunReducer(finished, { type: "START", now: 100_000 });
    expect(retried.mode).toBe("PLAYING");
    expect(retried.metrics.servedCount).toBe(0);
  });

  it("SERVE accumulates metrics only while PLAYING", () => {
    const playing: MissionState = {
      mode: "PLAYING",
      clock: startMissionClock(0, { durationSeconds: 60 }),
      metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 },
    };
    const afterOne = missionRunReducer(playing, { type: "SERVE", qualityTotal: 80 });
    expect(afterOne.metrics).toEqual({ servedCount: 1, totalQualityScore: 80, bestQualityScore: 80 });
  });

  it("SERVE is a no-op outside of PLAYING (e.g. FREE, INTRO, RESULT)", () => {
    for (const mode of ["FREE", "INTRO", "RESULT"] as const) {
      const state: MissionState = { mode, clock: null, metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 } };
      const next = missionRunReducer(state, { type: "SERVE", qualityTotal: 99 });
      expect(next).toBe(state);
    }
  });

  it("TICK is a no-op while time remains", () => {
    const playing: MissionState = {
      mode: "PLAYING",
      clock: startMissionClock(0, { durationSeconds: 60 }),
      metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 },
    };
    const next = missionRunReducer(playing, { type: "TICK", now: 30_000 });
    expect(next).toBe(playing);
  });

  it("TICK transitions PLAYING -> RESULT exactly once time has expired", () => {
    const playing: MissionState = {
      mode: "PLAYING",
      clock: startMissionClock(0, { durationSeconds: 10 }),
      metrics: { servedCount: 2, totalQualityScore: 150, bestQualityScore: 90 },
    };
    const next = missionRunReducer(playing, { type: "TICK", now: 10_000 });
    expect(next.mode).toBe("RESULT");
    // Metrics survive the transition unchanged -- the Result screen reads the same numbers.
    expect(next.metrics).toEqual(playing.metrics);
  });

  it("TICK expiration is a one-shot transition: further TICKs after expiry are no-ops", () => {
    const playing: MissionState = {
      mode: "PLAYING",
      clock: startMissionClock(0, { durationSeconds: 10 }),
      metrics: { servedCount: 1, totalQualityScore: 70, bestQualityScore: 70 },
    };
    const afterExpiry = missionRunReducer(playing, { type: "TICK", now: 10_000 });
    expect(afterExpiry.mode).toBe("RESULT");

    // Simulates the interval continuing to fire after the mode already flipped to RESULT --
    // must never "double finish" or otherwise change state again.
    const stillResult1 = missionRunReducer(afterExpiry, { type: "TICK", now: 10_250 });
    const stillResult2 = missionRunReducer(stillResult1, { type: "TICK", now: 999_999 });
    expect(stillResult1).toBe(afterExpiry);
    expect(stillResult2).toBe(afterExpiry);
  });

  it("TICK is a no-op outside of PLAYING even before any clock exists (e.g. FREE)", () => {
    const next = missionRunReducer(INITIAL_MISSION_STATE, { type: "TICK", now: 123 });
    expect(next).toBe(INITIAL_MISSION_STATE);
  });

  it("EXIT_TO_FREE resets Mission runtime (mode, clock, metrics) from any mode", () => {
    for (const mode of ["INTRO", "PLAYING", "RESULT"] as const) {
      const state: MissionState = {
        mode,
        clock: startMissionClock(0, { durationSeconds: 10 }),
        metrics: { servedCount: 4, totalQualityScore: 300, bestQualityScore: 92 },
      };
      const next = missionRunReducer(state, { type: "EXIT_TO_FREE" });
      expect(next).toEqual(INITIAL_MISSION_STATE);
    }
  });
});
