import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_DISPLAY_NAME } from "../shared/displayNameValidation";

/**
 * Firebase Ranking 1.0 Phase 2A (Issue #87). `firebase/firestore` is mocked with only the read
 * functions ./getWeeklyLeaderboard.ts actually imports (query/collection/orderBy/limit/where/
 * getDocs/getDoc/doc/getCountFromServer/Timestamp) -- there is no `setDoc`/`addDoc`/`updateDoc`/
 * `deleteDoc` stub here at all, so if the module under test ever tried to import one of those
 * (a write path this task's own security requirements forbid), this suite would fail at import
 * time rather than silently letting a write path slip in. That is this suite's own test J ("no
 * write path exposed") -- there is no separate assertion for it beyond this mock shape.
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
function jstMidnight(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) - JST_OFFSET_MS;
}
// A known Thursday (2026-09-17 JST) inside ISO week 2026-W38 -- every test below reads this
// week's leaderboard unless it says otherwise.
const NOW = jstMidnight(2026, 9, 17) + 12 * 60 * 60 * 1000;
const EXPECTED_PERIOD_ID = "weekly_2026-W38";

const fakeApp = { name: "[DEFAULT]" };
const fakeDb = { app: fakeApp };

const getFirebaseApp = vi.fn((): typeof fakeApp | null => fakeApp);
vi.mock("./client", () => ({
  getFirebaseApp: () => getFirebaseApp(),
}));

const getCurrentAuthUser = vi.fn((): { uid: string } | null => null);
vi.mock("./auth", () => ({
  getCurrentAuthUser: () => getCurrentAuthUser(),
}));

class FakeTimestamp {
  private readonly millis: number;
  constructor(millis: number) {
    this.millis = millis;
  }
  toMillis() {
    return this.millis;
  }
}

interface FakeEntryDoc {
  id: string;
  score: number;
  achievedAt: FakeTimestamp | null;
  /** Player Profile 1.0 Phase 1B (Issue #129). Omitted (`undefined`) simulates a legacy entry
   *  written before this phase shipped -- ./getWeeklyLeaderboard.ts must fall back, not throw or
   *  render `undefined`. */
  displayName?: string;
}

let topDocs: FakeEntryDoc[] = [];
let ownDoc: FakeEntryDoc | null = null;
let higherScoreCount = 0;
let getDocsError: Error | null = null;

const getFirestore = vi.fn((_app: unknown) => fakeDb);
const collection = vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join("/") }));
const query = vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints }));
const orderBy = vi.fn((field: string, direction: string) => ({ type: "orderBy", field, direction }));
const limit = vi.fn((n: number) => ({ type: "limit", n }));
const where = vi.fn((field: string, op: string, value: unknown) => ({ type: "where", field, op, value }));
const doc = vi.fn((ref: { path: string }, id: string) => ({ path: `${ref.path}/${id}`, id }));

const getDocs = vi.fn(async (_q: unknown) => {
  if (getDocsError) throw getDocsError;
  return {
    docs: topDocs.map((d) => ({
      id: d.id,
      data: () => ({ score: d.score, achievedAt: d.achievedAt, displayName: d.displayName }),
    })),
  };
});

const getDoc = vi.fn(async (ref: { id: string }) => ({
  exists: () => ownDoc !== null && ownDoc.id === ref.id,
  data: () =>
    ownDoc ? { score: ownDoc.score, achievedAt: ownDoc.achievedAt, displayName: ownDoc.displayName } : undefined,
}));

const getCountFromServer = vi.fn(async (_q: unknown) => ({
  data: () => ({ count: higherScoreCount }),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: (app: unknown) => getFirestore(app),
  collection: (...args: [unknown, ...string[]]) => collection(...args),
  query: (...args: unknown[]) => (query as (...a: unknown[]) => unknown)(...args),
  orderBy: (field: string, direction: string) => orderBy(field, direction),
  limit: (n: number) => limit(n),
  where: (field: string, op: string, value: unknown) => where(field, op, value),
  doc: (ref: { path: string }, id: string) => doc(ref, id),
  getDocs: (q: unknown) => getDocs(q),
  getDoc: (ref: { id: string }) => getDoc(ref),
  getCountFromServer: (q: unknown) => getCountFromServer(q),
  Timestamp: FakeTimestamp,
}));

describe("getWeeklyLeaderboard", () => {
  beforeEach(() => {
    vi.resetModules();
    getFirebaseApp.mockClear().mockReturnValue(fakeApp);
    getCurrentAuthUser.mockClear().mockReturnValue(null);
    getFirestore.mockClear().mockReturnValue(fakeDb);
    getDocs.mockClear();
    getDoc.mockClear();
    getCountFromServer.mockClear();
    topDocs = [];
    ownDoc = null;
    higherScoreCount = 0;
    getDocsError = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("H. Firebase unavailable -> resolves 'unavailable', never queries Firestore", async () => {
    getFirebaseApp.mockReturnValue(null);
    const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
    const result = await getWeeklyLeaderboard(NOW);
    expect(result).toEqual({ status: "unavailable" });
    expect(getDocs).not.toHaveBeenCalled();
  });

  it("A. selects this week's weekly_ period id from the given clock", async () => {
    const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
    const result = await getWeeklyLeaderboard(NOW);
    expect(result.status).toBe("success");
    expect(result.status === "success" && result.periodId).toBe(EXPECTED_PERIOD_ID);
    expect(collection).toHaveBeenCalledWith(fakeDb, "leaderboards", EXPECTED_PERIOD_ID, "entries");
  });

  it("B/C/D. queries score DESC, achievedAt ASC (tie-break) ordering", async () => {
    const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
    await getWeeklyLeaderboard(NOW);
    expect(orderBy).toHaveBeenNthCalledWith(1, "score", "desc");
    expect(orderBy).toHaveBeenNthCalledWith(2, "achievedAt", "asc");
  });

  it("E. limits the top query to 10 entries", async () => {
    const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
    await getWeeklyLeaderboard(NOW);
    expect(limit).toHaveBeenCalledWith(10);
  });

  it("G. empty week -> top is an empty array, no currentUserOutsideTop", async () => {
    const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
    const result = await getWeeklyLeaderboard(NOW);
    expect(result).toMatchObject({ status: "success", top: [], currentUserOutsideTop: null });
  });

  it("F. marks the signed-in user's own entry within the top 10", async () => {
    getCurrentAuthUser.mockReturnValue({ uid: "bob" });
    topDocs = [
      { id: "alice", score: 500, achievedAt: new FakeTimestamp(1000) as unknown as null, displayName: "テトマスター" },
      { id: "bob", score: 400, achievedAt: new FakeTimestamp(2000) as unknown as null, displayName: "ぺるそなお" },
    ];
    const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
    const result = await getWeeklyLeaderboard(NOW);
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("unreachable");
    expect(result.top).toEqual([
      { rank: 1, score: 500, achievedAt: 1000, isCurrentUser: false, displayName: "テトマスター" },
      { rank: 2, score: 400, achievedAt: 2000, isCurrentUser: true, displayName: "ぺるそなお" },
    ]);
    expect(result.currentUserOutsideTop).toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("outside-top-10: fetches the own entry and derives an approximate rank via count()", async () => {
    getCurrentAuthUser.mockReturnValue({ uid: "carol" });
    topDocs = [{ id: "alice", score: 500, achievedAt: new FakeTimestamp(1000) as unknown as null }];
    ownDoc = { id: "carol", score: 100, achievedAt: new FakeTimestamp(3000) as unknown as null, displayName: "ななしピザ職人2号" };
    higherScoreCount = 4;
    const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
    const result = await getWeeklyLeaderboard(NOW);
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("unreachable");
    expect(result.currentUserOutsideTop).toEqual({ rank: 5, score: 100, displayName: "ななしピザ職人2号" });
    expect(where).toHaveBeenCalledWith("score", ">", 100);
    // No extra users/{uid} profile read -- the name rides the already-fetched leaderboard entry
    // (Option A denormalization); getDoc is only ever called once here, for the leaderboard
    // entry itself.
    expect(getDoc).toHaveBeenCalledTimes(1);
  });

  it("signed-in user with no entry this week -> currentUserOutsideTop stays null, no count() query", async () => {
    getCurrentAuthUser.mockReturnValue({ uid: "dave" });
    topDocs = [{ id: "alice", score: 500, achievedAt: new FakeTimestamp(1000) as unknown as null }];
    ownDoc = null;
    const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
    const result = await getWeeklyLeaderboard(NOW);
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("unreachable");
    expect(result.currentUserOutsideTop).toBeNull();
    expect(getCountFromServer).not.toHaveBeenCalled();
  });

  it("I. a Firestore error resolves 'error' with a message, never throws", async () => {
    getDocsError = new Error("permission-denied: missing or insufficient permissions");
    const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
    const result = await getWeeklyLeaderboard(NOW);
    expect(result).toEqual({
      status: "error",
      message: "permission-denied: missing or insufficient permissions",
    });
  });

  it("caches the Firestore instance across calls (getFirestore invoked once)", async () => {
    const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
    await getWeeklyLeaderboard(NOW);
    await getWeeklyLeaderboard(NOW);
    expect(getFirestore).toHaveBeenCalledTimes(1);
  });

  // Player Profile 1.0 Phase 1B (Issue #129) -- displayName field mapping.
  describe("displayName mapping", () => {
    it("parses a present displayName field through unchanged", async () => {
      topDocs = [
        { id: "alice", score: 500, achievedAt: new FakeTimestamp(1000) as unknown as null, displayName: "テトマスター" },
      ];
      const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
      const result = await getWeeklyLeaderboard(NOW);
      expect(result.status).toBe("success");
      if (result.status !== "success") throw new Error("unreachable");
      expect(result.top[0].displayName).toBe("テトマスター");
    });

    it("a legacy entry with no displayName field falls back to FALLBACK_DISPLAY_NAME", async () => {
      topDocs = [{ id: "alice", score: 500, achievedAt: new FakeTimestamp(1000) as unknown as null }];
      const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
      const result = await getWeeklyLeaderboard(NOW);
      expect(result.status).toBe("success");
      if (result.status !== "success") throw new Error("unreachable");
      expect(result.top[0].displayName).toBe(FALLBACK_DISPLAY_NAME);
    });

    it("a malformed (non-string) displayName field falls back safely instead of throwing", async () => {
      topDocs = [
        {
          id: "alice",
          score: 500,
          achievedAt: new FakeTimestamp(1000) as unknown as null,
          displayName: 12345 as unknown as string,
        },
      ];
      const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
      const result = await getWeeklyLeaderboard(NOW);
      expect(result.status).toBe("success");
      if (result.status !== "success") throw new Error("unreachable");
      expect(result.top[0].displayName).toBe(FALLBACK_DISPLAY_NAME);
    });

    it("an empty-string displayName field falls back rather than rendering blank", async () => {
      topDocs = [
        { id: "alice", score: 500, achievedAt: new FakeTimestamp(1000) as unknown as null, displayName: "" },
      ];
      const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
      const result = await getWeeklyLeaderboard(NOW);
      expect(result.status).toBe("success");
      if (result.status !== "success") throw new Error("unreachable");
      expect(result.top[0].displayName).toBe(FALLBACK_DISPLAY_NAME);
    });

    it("resolving displayName performs no extra users/{uid} profile read (no N+1)", async () => {
      topDocs = Array.from({ length: 10 }, (_, i) => ({
        id: `player-${i}`,
        score: 100 - i,
        achievedAt: new FakeTimestamp(1000 + i) as unknown as null,
        displayName: `Player ${i}`,
      }));
      const { getWeeklyLeaderboard } = await import("./getWeeklyLeaderboard");
      await getWeeklyLeaderboard(NOW);
      // getDocs is the one call that fetches all 10 rows; getDoc (single-doc profile-style
      // reads) is reserved for the own-rank-outside-top-10 path only, and is not called here at
      // all since no signed-in user is set for this test.
      expect(getDocs).toHaveBeenCalledTimes(1);
      expect(getDoc).not.toHaveBeenCalled();
    });
  });
});
