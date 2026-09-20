import { beforeEach, describe, expect, it } from "vitest";
import {
  handleSubmitLunchRushScore,
  SubmitLunchRushScoreError,
  type FirestoreLike,
  type RunDocInput,
  type SubmitLunchRushScoreDeps,
} from "./submitLunchRushScore";

interface LeaderboardEntry {
  score: number;
  achievedAt: unknown;
  sourceRunId: string;
}

interface UpsertCall {
  periodId: string;
  uid: string;
  score: number;
}

/** In-memory Firestore fake -- no emulator, no Java dependency. Implements exactly the
 *  `FirestoreLike` port (see submitLunchRushScore.ts's own comment on why that port is narrow
 *  rather than a generic Firestore shim). */
class FakeFirestore implements FirestoreLike {
  readonly runs: RunDocInput[] = [];
  readonly leaderboards = new Map<string, Map<string, LeaderboardEntry>>();
  readonly upsertCalls: UpsertCall[] = [];
  private nextRunId = 1;

  async createRun(input: RunDocInput): Promise<string> {
    this.runs.push(input);
    return `run-${this.nextRunId++}`;
  }

  async upsertLeaderboardEntryIfHigher(
    periodId: string,
    uid: string,
    score: number,
    sourceRunId: string,
    achievedAt: unknown,
  ): Promise<boolean> {
    this.upsertCalls.push({ periodId, uid, score });
    let period = this.leaderboards.get(periodId);
    if (!period) {
      period = new Map();
      this.leaderboards.set(periodId, period);
    }
    const existing = period.get(uid);
    if (existing && existing.score >= score) return false;
    period.set(uid, { score, achievedAt, sourceRunId });
    return true;
  }
}

function makeDeps(firestore: FirestoreLike, nowEpochMs = Date.UTC(2026, 8, 20, 3)): SubmitLunchRushScoreDeps {
  let serverTimestampCallCount = 0;
  return {
    firestore,
    now: () => nowEpochMs,
    serverTimestamp: () => `server-timestamp-${++serverTimestampCallCount}`,
  };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    rulesetVersion: "lunch-rush-v1",
    missionId: "lunch-rush",
    clientDurationMs: 180_000,
    serves: [{ recipeId: "margherita", qualityTotal: 80, completionStatus: "PASS" }],
    ...overrides,
  };
}

describe("handleSubmitLunchRushScore", () => {
  let firestore: FakeFirestore;

  beforeEach(() => {
    firestore = new FakeFirestore();
  });

  // A. unauthenticated -> reject
  it("A: rejects when auth is null", async () => {
    await expect(handleSubmitLunchRushScore(validPayload(), null, makeDeps(firestore))).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(firestore.runs).toHaveLength(0);
  });

  it("A: rejects when auth.uid is empty", async () => {
    await expect(
      handleSubmitLunchRushScore(validPayload(), { uid: "" }, makeDeps(firestore)),
    ).rejects.toBeInstanceOf(SubmitLunchRushScoreError);
  });

  // B. malformed payload -> reject
  it("B: rejects a null payload", async () => {
    await expect(handleSubmitLunchRushScore(null, { uid: "u1" }, makeDeps(firestore))).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("B: rejects a wrong rulesetVersion", async () => {
    await expect(
      handleSubmitLunchRushScore(validPayload({ rulesetVersion: "lunch-rush-v0" }), { uid: "u1" }, makeDeps(firestore)),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("B: rejects a wrong missionId", async () => {
    await expect(
      handleSubmitLunchRushScore(validPayload({ missionId: "dinner-dash" }), { uid: "u1" }, makeDeps(firestore)),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("B: rejects when serves is not an array", async () => {
    await expect(
      handleSubmitLunchRushScore(validPayload({ serves: "not-an-array" }), { uid: "u1" }, makeDeps(firestore)),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("B: rejects an oversized serves array (defense-in-depth payload guard)", async () => {
    const serves = Array.from({ length: 500 }, () => ({
      recipeId: "margherita",
      qualityTotal: 50,
      completionStatus: "PASS",
    }));
    await expect(
      handleSubmitLunchRushScore(validPayload({ serves }), { uid: "u1" }, makeDeps(firestore)),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  // C. negative values -> reject
  it("C: rejects a negative clientDurationMs", async () => {
    await expect(
      handleSubmitLunchRushScore(validPayload({ clientDurationMs: -1 }), { uid: "u1" }, makeDeps(firestore)),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("C: rejects a negative serve qualityTotal", async () => {
    await expect(
      handleSubmitLunchRushScore(
        validPayload({ serves: [{ recipeId: "margherita", qualityTotal: -5, completionStatus: "PASS" }] }),
        { uid: "u1" },
        makeDeps(firestore),
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  // D. impossible quality -> reject
  it("D: rejects a serve qualityTotal above 100", async () => {
    await expect(
      handleSubmitLunchRushScore(
        validPayload({ serves: [{ recipeId: "margherita", qualityTotal: 999, completionStatus: "PASS" }] }),
        { uid: "u1" },
        makeDeps(firestore),
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("D: rejects servedCount exceeding what the ruleset duration allows", async () => {
    const serves = Array.from({ length: 150 }, () => ({
      recipeId: "margherita",
      qualityTotal: 50,
      completionStatus: "PASS" as const,
    }));
    await expect(
      handleSubmitLunchRushScore(validPayload({ serves }), { uid: "u1" }, makeDeps(firestore)),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  // E. client uid spoof impossible
  it("E: uid is taken only from the auth context, never a payload field", async () => {
    await handleSubmitLunchRushScore(
      validPayload({ uid: "attacker-controlled-uid" }),
      { uid: "real-auth-uid" },
      makeDeps(firestore),
    );
    expect(firestore.runs[0].uid).toBe("real-auth-uid");
    expect(firestore.runs[0].uid).not.toBe("attacker-controlled-uid");
    for (const call of firestore.upsertCalls) {
      expect(call.uid).toBe("real-auth-uid");
    }
  });

  // F. client score tampering ignored/rejected
  it("F: a client-supplied score/servedCount field is ignored -- the server's own recomputation wins", async () => {
    const result = await handleSubmitLunchRushScore(
      validPayload({ score: 999_999, servedCount: 999, totalQualityScore: 999 }),
      { uid: "u1" },
      makeDeps(firestore),
    );
    expect(result.score).toBe(180); // 1 * 100 + 80, not 999999
    expect(result.servedCount).toBe(1);
    expect(firestore.runs[0].score).toBe(180);
  });

  // G. server score correct
  it("G: recomputes the score correctly from serves[], including a FAILED entry excluded", async () => {
    const result = await handleSubmitLunchRushScore(
      validPayload({
        serves: [
          { recipeId: "margherita", qualityTotal: 80, completionStatus: "PASS" },
          { recipeId: "marinara", qualityTotal: 0, completionStatus: "FAILED" },
          { recipeId: "genovese", qualityTotal: 60, completionStatus: "PASS" },
        ],
      }),
      { uid: "u1" },
      makeDeps(firestore),
    );
    expect(result).toMatchObject({
      servedCount: 2,
      totalQualityScore: 140,
      bestQualityScore: 80,
      score: 340, // 2*100 + 140
    });
  });

  // H. first best creates
  it("H: the first submission for a uid creates a new best in all three periods", async () => {
    const result = await handleSubmitLunchRushScore(validPayload(), { uid: "u1" }, makeDeps(firestore));
    expect(result.isNewWeeklyBest).toBe(true);
    expect(result.isNewMonthlyBest).toBe(true);
    expect(result.isNewAllTimeBest).toBe(true);
    expect(firestore.leaderboards.get("weekly_2026-W38")?.get("u1")?.score).toBe(180);
  });

  // I. lower score does not replace best
  it("I: a subsequent lower score does not replace the existing best", async () => {
    await handleSubmitLunchRushScore(
      validPayload({ serves: [{ recipeId: "margherita", qualityTotal: 100, completionStatus: "PASS" }] }),
      { uid: "u1" },
      makeDeps(firestore),
    );
    const secondResult = await handleSubmitLunchRushScore(
      validPayload({ serves: [{ recipeId: "margherita", qualityTotal: 20, completionStatus: "PASS" }] }),
      { uid: "u1" },
      makeDeps(firestore),
    );
    expect(secondResult.isNewAllTimeBest).toBe(false);
    expect(firestore.leaderboards.get("all_all")?.get("u1")?.score).toBe(200); // still the first (higher) score
  });

  // J. higher score replaces best
  it("J: a subsequent higher score replaces the existing best", async () => {
    await handleSubmitLunchRushScore(
      validPayload({ serves: [{ recipeId: "margherita", qualityTotal: 20, completionStatus: "PASS" }] }),
      { uid: "u1" },
      makeDeps(firestore),
    );
    const secondResult = await handleSubmitLunchRushScore(
      validPayload({ serves: [{ recipeId: "margherita", qualityTotal: 100, completionStatus: "PASS" }] }),
      { uid: "u1" },
      makeDeps(firestore),
    );
    expect(secondResult.isNewAllTimeBest).toBe(true);
    expect(firestore.leaderboards.get("all_all")?.get("u1")?.score).toBe(200);
  });

  // K. tie handling deterministic
  it("K: an identical (tied) score submitted again does not update the entry (achievedAt stays the first one's)", async () => {
    await handleSubmitLunchRushScore(validPayload(), { uid: "u1" }, makeDeps(firestore));
    const firstAchievedAt = firestore.leaderboards.get("all_all")?.get("u1")?.achievedAt;

    const secondResult = await handleSubmitLunchRushScore(validPayload(), { uid: "u1" }, makeDeps(firestore));
    expect(secondResult.isNewAllTimeBest).toBe(false);
    expect(secondResult.isNewWeeklyBest).toBe(false);
    expect(secondResult.isNewMonthlyBest).toBe(false);
    // achievedAt is untouched by the tied resubmission -- tie-break (score DESC, achievedAt
    // ASC) stays deterministic: the earliest achiever of a tied score keeps ranking higher.
    expect(firestore.leaderboards.get("all_all")?.get("u1")?.achievedAt).toBe(firstAchievedAt);
  });

  it("K: two different uids tied on the same score both get their own entry (not deduplicated)", async () => {
    await handleSubmitLunchRushScore(validPayload(), { uid: "u1" }, makeDeps(firestore));
    await handleSubmitLunchRushScore(validPayload(), { uid: "u2" }, makeDeps(firestore));
    const period = firestore.leaderboards.get("all_all");
    expect(period?.get("u1")?.score).toBe(180);
    expect(period?.get("u2")?.score).toBe(180);
  });

  // L. server timestamp authority
  it("L: period ids are derived from deps.now() (server clock), never any client-supplied field", async () => {
    const septemberDeps = makeDeps(firestore, Date.UTC(2026, 8, 20, 3)); // 2026-09-20 12:00 JST
    await handleSubmitLunchRushScore(validPayload(), { uid: "u1" }, septemberDeps);
    expect(firestore.leaderboards.has("weekly_2026-W38")).toBe(true);
    expect(firestore.leaderboards.has("monthly_2026-09")).toBe(true);

    const firestore2 = new FakeFirestore();
    const januaryDeps = makeDeps(firestore2, Date.UTC(2027, 0, 1, 3)); // 2027-01-01 12:00 JST
    await handleSubmitLunchRushScore(validPayload(), { uid: "u1" }, januaryDeps);
    expect(firestore2.leaderboards.has("weekly_2026-W53")).toBe(true);
    expect(firestore2.leaderboards.has("monthly_2027-01")).toBe(true);
  });

  it("L: submittedAt/achievedAt are always the injected serverTimestamp sentinel, never a client value", async () => {
    await handleSubmitLunchRushScore(validPayload(), { uid: "u1" }, makeDeps(firestore));
    expect(firestore.leaderboards.get("all_all")?.get("u1")?.achievedAt).toMatch(/^server-timestamp-/);
  });
});
