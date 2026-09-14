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

  // Phase 3C-6: Mission reuses the exact same availableRecipeIds() filter as free play (see
  // this file's top comment) -- no fugazza special-case lives here, so this is really
  // exercising src/state/progression.ts's availableRecipeIds() through Mission's own call site.
  it("never picks fugazza when it isn't in the available pool (before purchase)", () => {
    const starterIds: RecipeId[] = [
      "margherita",
      "marinara",
      "quattro-formaggi",
      "genovese",
      "bismarck",
      "funghi",
    ];
    for (let i = 0; i < 50; i++) {
      const order = pickMissionOrder(starterIds);
      expect(order.recipeId).not.toBe("fugazza");
    }
  });

  it("can pick fugazza once it's included in the available pool (after purchase)", () => {
    const ids: RecipeId[] = ["fugazza"];
    const order = pickMissionOrder(ids);
    expect(order.recipeId).toBe("fugazza");
  });
});

describe("missionRunReducer", () => {
  it("starts at FREE with empty metrics and no clock", () => {
    expect(INITIAL_MISSION_STATE).toEqual({
      mode: "FREE",
      clock: null,
      metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 },
      runId: 0,
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
        runId: 2,
      };
      const next = missionRunReducer(from, {
        type: "START",
        now: 5_000,
        config: { durationSeconds: 45 },
      });
      expect(next.mode).toBe("PLAYING");
      expect(next.clock).toEqual({ startedAt: 5_000, endsAt: 50_000 });
      expect(next.metrics).toEqual({ servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 });
      // Phase 3C-5: every START (including a retry from RESULT) gets its own fresh run id.
      expect(next.runId).toBe(3);
    }
  });

  it("retrying (START again from RESULT) resets mission metrics and assigns a fresh runId", () => {
    const finished: MissionState = {
      mode: "RESULT",
      clock: startMissionClock(0, { durationSeconds: 10 }),
      metrics: { servedCount: 5, totalQualityScore: 400, bestQualityScore: 95 },
      runId: 7,
    };
    const retried = missionRunReducer(finished, { type: "START", now: 100_000 });
    expect(retried.mode).toBe("PLAYING");
    expect(retried.metrics.servedCount).toBe(0);
    // A retry's runId must differ from the run it's retrying, so a Pitz reward grant keyed on
    // the previous run's id (src/state/gameReducer.ts's CLAIM_MISSION_REWARD) never applies to
    // this new run, and this new run's own grant never collides with the previous one.
    expect(retried.runId).toBe(8);
    expect(retried.runId).not.toBe(finished.runId);
  });

  describe("runId (Phase 3C-5)", () => {
    it("each successive START increments runId by exactly one", () => {
      let state = INITIAL_MISSION_STATE;
      const seen: number[] = [];
      for (let i = 0; i < 5; i++) {
        state = missionRunReducer(state, { type: "START", now: i * 1000 });
        seen.push(state.runId);
        // End the run (as a real expiry would) before starting the next one.
        state = missionRunReducer(state, { type: "TICK", now: (i + 1) * 1000 + 1_000_000 });
      }
      expect(seen).toEqual([1, 2, 3, 4, 5]);
    });

    it("SERVE and TICK never change runId", () => {
      const started = missionRunReducer(INITIAL_MISSION_STATE, { type: "START", now: 0 });
      const served = missionRunReducer(started, { type: "SERVE", qualityTotal: 80, now: 1 });
      expect(served.runId).toBe(started.runId);
      const ticked = missionRunReducer(served, { type: "TICK", now: 2 });
      expect(ticked.runId).toBe(started.runId);
    });

    it("EXIT_TO_FREE preserves runId instead of resetting it to 0", () => {
      const started = missionRunReducer(INITIAL_MISSION_STATE, { type: "START", now: 0 });
      const exited = missionRunReducer(started, { type: "EXIT_TO_FREE" });
      expect(exited.runId).toBe(started.runId);
      expect(exited.runId).not.toBe(0);
    });
  });

  it("SERVE accumulates metrics only while PLAYING", () => {
    const playing: MissionState = {
      mode: "PLAYING",
      clock: startMissionClock(0, { durationSeconds: 60 }),
      metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 },
      runId: 0,
    };
    const afterOne = missionRunReducer(playing, { type: "SERVE", qualityTotal: 80, now: 1_000 });
    expect(afterOne.metrics).toEqual({ servedCount: 1, totalQualityScore: 80, bestQualityScore: 80 });
    expect(afterOne.mode).toBe("PLAYING");
  });

  it("SERVE is a no-op outside of PLAYING (e.g. FREE, INTRO, RESULT)", () => {
    for (const mode of ["FREE", "INTRO", "RESULT"] as const) {
      const state: MissionState = {
        mode,
        clock: null,
        metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 },
        runId: 0,
      };
      const next = missionRunReducer(state, { type: "SERVE", qualityTotal: 99, now: 1_000 });
      expect(next).toBe(state);
    }
  });

  // Codex review (PR #18, P2-1): a serve landing at or after the deadline must never count,
  // no matter how late the next TICK would arrive -- SERVE checks the deadline itself.
  describe("SERVE deadline enforcement (Codex review P2-1)", () => {
    function playingAt(durationSeconds: number): MissionState {
      return {
        mode: "PLAYING",
        clock: startMissionClock(0, { durationSeconds }),
        metrics: { servedCount: 2, totalQualityScore: 150, bestQualityScore: 90 },
        runId: 0,
      };
    }

    it("accepts a serve 1ms before the deadline", () => {
      const playing = playingAt(10); // endsAt = 10_000
      const next = missionRunReducer(playing, { type: "SERVE", qualityTotal: 70, now: 9_999 });
      expect(next.mode).toBe("PLAYING");
      expect(next.metrics).toEqual({ servedCount: 3, totalQualityScore: 220, bestQualityScore: 90 });
    });

    it("rejects a serve at exactly the deadline and ends the run", () => {
      const playing = playingAt(10); // endsAt = 10_000
      const next = missionRunReducer(playing, { type: "SERVE", qualityTotal: 99, now: 10_000 });
      expect(next.mode).toBe("RESULT");
      // Metrics are untouched by the rejected serve -- the expired pizza's quality never
      // enters servedCount/totalQualityScore/bestQualityScore (and therefore never affects
      // missionScore or any persisted Mission BEST derived from them).
      expect(next.metrics).toEqual(playing.metrics);
    });

    it("rejects a serve well after the deadline and ends the run", () => {
      const playing = playingAt(10); // endsAt = 10_000
      const next = missionRunReducer(playing, { type: "SERVE", qualityTotal: 100, now: 60_000 });
      expect(next.mode).toBe("RESULT");
      expect(next.metrics).toEqual(playing.metrics);
    });

    it("an expired serve never increments servedCount", () => {
      const playing = playingAt(10);
      const next = missionRunReducer(playing, { type: "SERVE", qualityTotal: 100, now: 10_000 });
      expect(next.metrics.servedCount).toBe(playing.metrics.servedCount);
    });

    it("an expired serve never increases totalQualityScore", () => {
      const playing = playingAt(10);
      const next = missionRunReducer(playing, { type: "SERVE", qualityTotal: 100, now: 10_000 });
      expect(next.metrics.totalQualityScore).toBe(playing.metrics.totalQualityScore);
    });

    it("an expired serve can never produce a higher Mission Score than the run already had", () => {
      const playing = playingAt(10);
      const scoreBefore = playing.metrics.servedCount * 100 + playing.metrics.totalQualityScore;
      const next = missionRunReducer(playing, { type: "SERVE", qualityTotal: 100, now: 10_000 });
      const scoreAfter = next.metrics.servedCount * 100 + next.metrics.totalQualityScore;
      expect(scoreAfter).toBe(scoreBefore);
    });

    it("a delayed/throttled TICK does not let an already-expired SERVE slip through first", () => {
      // Simulates the exact race the review flagged: real time has passed `endsAt`, but no
      // TICK has run yet (mode is still "PLAYING" going into this dispatch).
      const playing = playingAt(10); // endsAt = 10_000
      expect(playing.mode).toBe("PLAYING"); // TICK hasn't fired -- this is the race window
      const afterLateServe = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 100,
        now: 45_000, // well past endsAt, as if TICK had been throttled for 35s
      });
      expect(afterLateServe.mode).toBe("RESULT");
      expect(afterLateServe.metrics).toEqual(playing.metrics);

      // The (finally delayed) TICK arriving after that must be a pure no-op (one-shot
      // finish, same guarantee as the ordinary TICK-driven expiry path).
      const afterLateTick = missionRunReducer(afterLateServe, { type: "TICK", now: 45_100 });
      expect(afterLateTick).toBe(afterLateServe);
    });

    it("SERVE ending the run this way is itself one-shot: a second SERVE after is also rejected and does not change state again", () => {
      const playing = playingAt(10);
      const afterFirst = missionRunReducer(playing, { type: "SERVE", qualityTotal: 100, now: 10_000 });
      expect(afterFirst.mode).toBe("RESULT");
      const afterSecond = missionRunReducer(afterFirst, { type: "SERVE", qualityTotal: 100, now: 20_000 });
      expect(afterSecond).toBe(afterFirst);
    });
  });

  it("TICK is a no-op while time remains", () => {
    const playing: MissionState = {
      mode: "PLAYING",
      clock: startMissionClock(0, { durationSeconds: 60 }),
      metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 },
      runId: 0,
    };
    const next = missionRunReducer(playing, { type: "TICK", now: 30_000 });
    expect(next).toBe(playing);
  });

  it("TICK transitions PLAYING -> RESULT exactly once time has expired", () => {
    const playing: MissionState = {
      mode: "PLAYING",
      clock: startMissionClock(0, { durationSeconds: 10 }),
      metrics: { servedCount: 2, totalQualityScore: 150, bestQualityScore: 90 },
      runId: 0,
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
      runId: 0,
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

  it("EXIT_TO_FREE resets Mission runtime (mode, clock, metrics) from any mode, preserving runId", () => {
    for (const mode of ["INTRO", "PLAYING", "RESULT"] as const) {
      const state: MissionState = {
        mode,
        clock: startMissionClock(0, { durationSeconds: 10 }),
        metrics: { servedCount: 4, totalQualityScore: 300, bestQualityScore: 92 },
        runId: 3,
      };
      const next = missionRunReducer(state, { type: "EXIT_TO_FREE" });
      expect(next).toEqual({ ...INITIAL_MISSION_STATE, runId: 3 });
    }
  });
});
