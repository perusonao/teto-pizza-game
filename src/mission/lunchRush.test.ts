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
  it("uses only the discovered ∩ available pool", () => {
    const available: RecipeId[] = ["margherita", "funghi"];
    const discovered: RecipeId[] = ["margherita"];
    for (let i = 0; i < 50; i++) {
      expect(pickMissionOrder(available, discovered)?.recipeId).toBe("margherita");
    }
  });

  it("avoids repeating the excluded recipe when two discovered+available recipes exist", () => {
    const ids: RecipeId[] = ["margherita", "marinara"];
    const order = pickMissionOrder(ids, ids, "margherita");
    expect(order?.recipeId).toBe("marinara");
  });

  it("allows repeating when the discovered+available pool has only one recipe", () => {
    const ids: RecipeId[] = ["margherita"];
    expect(pickMissionOrder(ids, ids, "margherita")?.recipeId).toBe("margherita");
  });

  it("excludes a discovered recipe that is not currently available", () => {
    const available: RecipeId[] = ["margherita"];
    const discovered: RecipeId[] = ["margherita", "funghi"];
    expect(pickMissionOrder(available, discovered)?.recipeId).toBe("margherita");
  });

  it("excludes an available recipe that is still undiscovered", () => {
    const available: RecipeId[] = ["margherita", "funghi"];
    const discovered: RecipeId[] = ["margherita"];
    expect(pickMissionOrder(available, discovered)?.recipeId).not.toBe("funghi");
  });

  it("returns null when no discovered recipe is available instead of falling back to all orders", () => {
    expect(pickMissionOrder(["margherita", "funghi"], [])).toBeNull();
    expect(pickMissionOrder([], ["margherita"])).toBeNull();
  });

  it("keeps every recipe reachable when every available recipe is discovered", () => {
    const ids: RecipeId[] = ["margherita", "marinara", "genovese"];
    const seen = new Set<string>();
    for (let i = 0; i < 200 && seen.size < 3; i++) {
      const order = pickMissionOrder(ids, ids);
      if (order) seen.add(order.recipeId);
    }
    expect(seen.size).toBe(3);
  });

  it("can pick fugazza only once it is both discovered and available", () => {
    expect(pickMissionOrder(["fugazza"], [])).toBeNull();
    expect(pickMissionOrder(["fugazza"], ["fugazza"])?.recipeId).toBe("fugazza");
  });
});

describe("missionRunReducer", () => {
  it("starts at FREE with empty metrics, no clock, and an empty serves log", () => {
    expect(INITIAL_MISSION_STATE).toEqual({
      mode: "FREE",
      clock: null,
      metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 },
      runId: 0,
      serves: [],
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

  it("START moves to PLAYING with a fresh clock, reset metrics, and a reset serves log, from any mode", () => {
    for (const mode of ["FREE", "INTRO", "PLAYING", "RESULT"] as const) {
      const from: MissionState = {
        mode,
        clock: startMissionClock(0, { durationSeconds: 10 }),
        metrics: { servedCount: 3, totalQualityScore: 250, bestQualityScore: 90 },
        runId: 2,
        serves: [{ recipeId: "margherita", qualityTotal: 80, completionStatus: "PASS" }],
      };
      const next = missionRunReducer(from, {
        type: "START",
        now: 5_000,
        config: { durationSeconds: 45 },
      });
      expect(next.mode).toBe("PLAYING");
      expect(next.clock).toEqual({ startedAt: 5_000, endsAt: 50_000 });
      expect(next.metrics).toEqual({ servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 });
      expect(next.serves).toEqual([]);
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
      serves: [{ recipeId: "margherita", qualityTotal: 80, completionStatus: "PASS" }],
    };
    const retried = missionRunReducer(finished, { type: "START", now: 100_000 });
    expect(retried.mode).toBe("PLAYING");
    expect(retried.metrics.servedCount).toBe(0);
    expect(retried.serves).toEqual([]);
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
      const served = missionRunReducer(started, {
        type: "SERVE",
        qualityTotal: 80,
        recipeId: "margherita",
        now: 1,
      });
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
      serves: [],
    };
    const afterOne = missionRunReducer(playing, {
      type: "SERVE",
      qualityTotal: 80,
      recipeId: "margherita",
      now: 1_000,
    });
    expect(afterOne.metrics).toEqual({ servedCount: 1, totalQualityScore: 80, bestQualityScore: 80 });
    expect(afterOne.mode).toBe("PLAYING");
  });

  // Firebase Ranking 1.0 Phase 1B (Issue #87): `serves` is the log the eventual score
  // submission is built from (../shared/lunchRushScoring.ts). It must accumulate in exact
  // lockstep with `metrics` -- appended in the same branch, reset at the same points -- so a
  // submission can never disagree with what the player already saw.
  describe("serves log (Firebase Ranking 1.0 Phase 1B)", () => {
    const playing: MissionState = {
      mode: "PLAYING",
      clock: startMissionClock(0, { durationSeconds: 60 }),
      metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 },
      runId: 0,
      serves: [],
    };

    it("a PASS serve appends a PASS record with the served recipeId/qualityTotal", () => {
      const next = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 80,
        recipeId: "margherita",
        now: 1_000,
      });
      expect(next.serves).toEqual([
        { recipeId: "margherita", qualityTotal: 80, completionStatus: "PASS" },
      ]);
    });

    it("a FAILED serve still appends a FAILED record (qualityTotal forced to 0), unlike metrics", () => {
      const next = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 95,
        recipeId: "marinara",
        completionFailed: true,
        now: 1_000,
      });
      expect(next.metrics).toEqual({ servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 });
      expect(next.serves).toEqual([{ recipeId: "marinara", qualityTotal: 0, completionStatus: "FAILED" }]);
    });

    it("accumulates multiple serves, PASS and FAILED alike, in order", () => {
      const afterFirst = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 80,
        recipeId: "margherita",
        now: 1_000,
      });
      const afterSecond = missionRunReducer(afterFirst, {
        type: "SERVE",
        qualityTotal: 0,
        recipeId: "marinara",
        completionFailed: true,
        now: 2_000,
      });
      const afterThird = missionRunReducer(afterSecond, {
        type: "SERVE",
        qualityTotal: 60,
        recipeId: "genovese",
        now: 3_000,
      });
      expect(afterThird.serves).toEqual([
        { recipeId: "margherita", qualityTotal: 80, completionStatus: "PASS" },
        { recipeId: "marinara", qualityTotal: 0, completionStatus: "FAILED" },
        { recipeId: "genovese", qualityTotal: 60, completionStatus: "PASS" },
      ]);
    });

    it("a deadline-rejected SERVE (Codex review P2-1) does not append to serves either", () => {
      const nearEnd: MissionState = {
        mode: "PLAYING",
        clock: startMissionClock(0, { durationSeconds: 10 }),
        metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 },
        runId: 0,
        serves: [],
      };
      const next = missionRunReducer(nearEnd, {
        type: "SERVE",
        qualityTotal: 100,
        recipeId: "margherita",
        now: 10_000, // at/after endsAt -- rejected
      });
      expect(next.mode).toBe("RESULT");
      expect(next.serves).toEqual([]);
    });

    it("EXIT_TO_FREE resets serves to an empty array", () => {
      const withServes: MissionState = {
        ...playing,
        serves: [{ recipeId: "margherita", qualityTotal: 80, completionStatus: "PASS" }],
      };
      const next = missionRunReducer(withServes, { type: "EXIT_TO_FREE" });
      expect(next.serves).toEqual([]);
    });
  });

  // Lunch Rush Completion Gate 1A: `completionFailed` (App.tsx's read of `state.completion`,
  // ../logic/completionGate.ts) must leave metrics completely untouched -- a FAILED order
  // never becomes a counted serve, no matter what `qualityTotal` it was dispatched with (App.tsx
  // always forces it to 0, but the reducer itself does not trust the caller for this -- see
  // this case's own comment in lunchRush.ts).
  describe("SERVE with completionFailed", () => {
    const playing: MissionState = {
      mode: "PLAYING",
      clock: startMissionClock(0, { durationSeconds: 60 }),
      metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 },
      runId: 0,
      serves: [],
    };

    it("leaves metrics untouched (servedCount/totalQualityScore/bestQualityScore all stay 0)", () => {
      const next = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 0,
        recipeId: "margherita",
        completionFailed: true,
        now: 1_000,
      });
      expect(next.metrics).toEqual({ servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 });
      expect(next.mode).toBe("PLAYING");
    });

    it("stays untouched even if a non-zero qualityTotal were passed alongside it", () => {
      const next = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 95,
        recipeId: "margherita",
        completionFailed: true,
        now: 1_000,
      });
      expect(next.metrics).toEqual({ servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 });
    });

    it("a FAILED serve does not reset metrics a PASS serve already accumulated", () => {
      const afterPass = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 60,
        recipeId: "margherita",
        now: 1_000,
      });
      const afterFailed = missionRunReducer(afterPass, {
        type: "SERVE",
        qualityTotal: 0,
        recipeId: "marinara",
        completionFailed: true,
        now: 2_000,
      });
      expect(afterFailed.metrics).toEqual({ servedCount: 1, totalQualityScore: 60, bestQualityScore: 60 });
    });

    it("still ends the run one-shot if the deadline has already passed, same as a normal SERVE", () => {
      const next = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 0,
        recipeId: "margherita",
        completionFailed: true,
        now: 60_000,
      });
      expect(next.mode).toBe("RESULT");
      expect(next.metrics).toEqual({ servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 });
    });
  });

  it("SERVE is a no-op outside of PLAYING (e.g. FREE, INTRO, RESULT)", () => {
    for (const mode of ["FREE", "INTRO", "RESULT"] as const) {
      const state: MissionState = {
        mode,
        clock: null,
        metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 },
        runId: 0,
        serves: [],
      };
      const next = missionRunReducer(state, {
        type: "SERVE",
        qualityTotal: 99,
        recipeId: "margherita",
        now: 1_000,
      });
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
        serves: [],
      };
    }

    it("accepts a serve 1ms before the deadline", () => {
      const playing = playingAt(10); // endsAt = 10_000
      const next = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 70,
        recipeId: "margherita",
        now: 9_999,
      });
      expect(next.mode).toBe("PLAYING");
      expect(next.metrics).toEqual({ servedCount: 3, totalQualityScore: 220, bestQualityScore: 90 });
    });

    it("rejects a serve at exactly the deadline and ends the run", () => {
      const playing = playingAt(10); // endsAt = 10_000
      const next = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 99,
        recipeId: "margherita",
        now: 10_000,
      });
      expect(next.mode).toBe("RESULT");
      // Metrics are untouched by the rejected serve -- the expired pizza's quality never
      // enters servedCount/totalQualityScore/bestQualityScore (and therefore never affects
      // missionScore or any persisted Mission BEST derived from them).
      expect(next.metrics).toEqual(playing.metrics);
    });

    it("rejects a serve well after the deadline and ends the run", () => {
      const playing = playingAt(10); // endsAt = 10_000
      const next = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 100,
        recipeId: "margherita",
        now: 60_000,
      });
      expect(next.mode).toBe("RESULT");
      expect(next.metrics).toEqual(playing.metrics);
    });

    it("an expired serve never increments servedCount", () => {
      const playing = playingAt(10);
      const next = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 100,
        recipeId: "margherita",
        now: 10_000,
      });
      expect(next.metrics.servedCount).toBe(playing.metrics.servedCount);
    });

    it("an expired serve never increases totalQualityScore", () => {
      const playing = playingAt(10);
      const next = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 100,
        recipeId: "margherita",
        now: 10_000,
      });
      expect(next.metrics.totalQualityScore).toBe(playing.metrics.totalQualityScore);
    });

    it("an expired serve can never produce a higher Mission Score than the run already had", () => {
      const playing = playingAt(10);
      const scoreBefore = playing.metrics.servedCount * 100 + playing.metrics.totalQualityScore;
      const next = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 100,
        recipeId: "margherita",
        now: 10_000,
      });
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
        recipeId: "margherita",
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
      const afterFirst = missionRunReducer(playing, {
        type: "SERVE",
        qualityTotal: 100,
        recipeId: "margherita",
        now: 10_000,
      });
      expect(afterFirst.mode).toBe("RESULT");
      const afterSecond = missionRunReducer(afterFirst, {
        type: "SERVE",
        qualityTotal: 100,
        recipeId: "margherita",
        now: 20_000,
      });
      expect(afterSecond).toBe(afterFirst);
    });
  });

  it("TICK is a no-op while time remains", () => {
    const playing: MissionState = {
      mode: "PLAYING",
      clock: startMissionClock(0, { durationSeconds: 60 }),
      metrics: { servedCount: 0, totalQualityScore: 0, bestQualityScore: 0 },
      runId: 0,
      serves: [],
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
      serves: [],
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
      serves: [],
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

  it("EXIT_TO_FREE resets Mission runtime (mode, clock, metrics, serves) from any mode, preserving runId", () => {
    for (const mode of ["INTRO", "PLAYING", "RESULT"] as const) {
      const state: MissionState = {
        mode,
        clock: startMissionClock(0, { durationSeconds: 10 }),
        metrics: { servedCount: 4, totalQualityScore: 300, bestQualityScore: 92 },
        runId: 3,
        serves: [{ recipeId: "margherita", qualityTotal: 80, completionStatus: "PASS" }],
      };
      const next = missionRunReducer(state, { type: "EXIT_TO_FREE" });
      expect(next).toEqual({ ...INITIAL_MISSION_STATE, runId: 3 });
    }
  });
});

describe("missionRunReducer -- END_EARLY (Issue #212, OD-2: nothing cookable left)", () => {
  function playing(): MissionState {
    let s = missionRunReducer(INITIAL_MISSION_STATE, { type: "START", now: 1_000, config: { durationSeconds: 60 } });
    s = missionRunReducer(s, { type: "SERVE", now: 2_000, qualityTotal: 80, recipeId: "margherita" });
    return s;
  }

  it("ends a PLAYING run into RESULT before the deadline, keeping metrics/serves/clock/runId", () => {
    const before = playing();
    const after = missionRunReducer(before, { type: "END_EARLY" });
    expect(after.mode).toBe("RESULT");
    expect(after.endedEarly).toBe(true);
    expect(after.metrics).toBe(before.metrics);
    expect(after.serves).toBe(before.serves);
    expect(after.clock).toBe(before.clock);
    expect(after.runId).toBe(before.runId);
  });

  it("is one-shot and never touches a non-PLAYING run", () => {
    const ended = missionRunReducer(playing(), { type: "END_EARLY" });
    expect(missionRunReducer(ended, { type: "END_EARLY" })).toBe(ended);
    expect(missionRunReducer(ended, { type: "TICK", now: 999_999 })).toBe(ended);
    expect(missionRunReducer(INITIAL_MISSION_STATE, { type: "END_EARLY" })).toBe(INITIAL_MISSION_STATE);
    const intro = missionRunReducer(INITIAL_MISSION_STATE, { type: "SHOW_INTRO" });
    expect(missionRunReducer(intro, { type: "END_EARLY" })).toBe(intro);
  });

  it("a time-up run is never marked as ended early, and a retry clears the flag", () => {
    const timedOut = missionRunReducer(playing(), { type: "TICK", now: 61_000 });
    expect(timedOut.mode).toBe("RESULT");
    expect(timedOut.endedEarly).toBeUndefined();
    const ended = missionRunReducer(playing(), { type: "END_EARLY" });
    expect(missionRunReducer(ended, { type: "START", now: 5 }).endedEarly).toBeUndefined();
    expect(missionRunReducer(ended, { type: "EXIT_TO_FREE" }).endedEarly).toBeUndefined();
  });
});
