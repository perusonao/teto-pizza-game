import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LunchRushServeRecord } from "../shared/lunchRushScoring";

const fakeApp = { name: "[DEFAULT]" };
const fakeFunctions = { app: fakeApp };
const fakeUser = { uid: "test-uid" };

const getFirebaseApp = vi.fn((): typeof fakeApp | null => fakeApp);
vi.mock("./client", () => ({
  getFirebaseApp: () => getFirebaseApp(),
}));

const ensureAnonymousUser = vi.fn((): Promise<typeof fakeUser | null> => Promise.resolve(fakeUser));
vi.mock("./auth", () => ({
  ensureAnonymousUser: () => ensureAnonymousUser(),
}));

const getFunctions = vi.fn((_app: unknown, _region?: string) => fakeFunctions);
const httpsCallable = vi.fn();
vi.mock("firebase/functions", () => ({
  getFunctions: (app: unknown, region?: string) => getFunctions(app, region),
  httpsCallable: (functions: unknown, name: string) => httpsCallable(functions, name),
}));

const serves: LunchRushServeRecord[] = [
  { recipeId: "margherita", qualityTotal: 80, completionStatus: "PASS" },
];

describe("submitLunchRushScore", () => {
  beforeEach(() => {
    vi.resetModules();
    getFirebaseApp.mockClear().mockReturnValue(fakeApp);
    ensureAnonymousUser.mockClear().mockResolvedValue(fakeUser);
    getFunctions.mockClear().mockReturnValue(fakeFunctions);
    httpsCallable.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Firebase unavailable -> resolves 'unavailable', never calls ensureAnonymousUser or the callable", async () => {
    getFirebaseApp.mockReturnValue(null);
    const { submitLunchRushScore } = await import("./submitLunchRushScore");
    const result = await submitLunchRushScore({ clientDurationMs: 180_000, serves });
    expect(result).toEqual({ status: "unavailable" });
    expect(ensureAnonymousUser).not.toHaveBeenCalled();
    expect(httpsCallable).not.toHaveBeenCalled();
  });

  it("auth unavailable (ensureAnonymousUser resolves null) -> resolves 'unavailable', never calls the callable", async () => {
    ensureAnonymousUser.mockResolvedValue(null);
    const { submitLunchRushScore } = await import("./submitLunchRushScore");
    const result = await submitLunchRushScore({ clientDurationMs: 180_000, serves });
    expect(result).toEqual({ status: "unavailable" });
    expect(httpsCallable).not.toHaveBeenCalled();
  });

  it("a successful callable invocation resolves 'submitted' with the server's response data", async () => {
    const serverResponse = {
      score: 180,
      servedCount: 1,
      totalQualityScore: 80,
      bestQualityScore: 80,
      isNewWeeklyBest: true,
      isNewMonthlyBest: true,
      isNewAllTimeBest: true,
    };
    const callableFn = vi.fn().mockResolvedValue({ data: serverResponse });
    httpsCallable.mockReturnValue(callableFn);
    const { submitLunchRushScore } = await import("./submitLunchRushScore");
    const result = await submitLunchRushScore({ clientDurationMs: 180_000, serves });
    expect(result).toEqual({ status: "submitted", ...serverResponse });
    expect(httpsCallable).toHaveBeenCalledWith(fakeFunctions, "submitLunchRushScore");
    expect(callableFn).toHaveBeenCalledWith({
      rulesetVersion: "lunch-rush-v1",
      missionId: "lunch-rush",
      clientDurationMs: 180_000,
      serves,
    });
  });

  it("the server rejecting the call resolves 'failed', never throws", async () => {
    const callableFn = vi.fn().mockRejectedValue(new Error("invalid-argument: malformed serves"));
    httpsCallable.mockReturnValue(callableFn);
    const { submitLunchRushScore } = await import("./submitLunchRushScore");
    const result = await submitLunchRushScore({ clientDurationMs: 180_000, serves });
    expect(result).toEqual({ status: "failed", message: "invalid-argument: malformed serves" });
  });

  it("ensureAnonymousUser rejecting still resolves 'failed', not an unhandled rejection", async () => {
    ensureAnonymousUser.mockRejectedValue(new Error("network down"));
    const { submitLunchRushScore } = await import("./submitLunchRushScore");
    const result = await submitLunchRushScore({ clientDurationMs: 180_000, serves });
    expect(result.status).toBe("failed");
  });

  it("requests the Functions instance for the Firestore-matching region (asia-northeast1)", async () => {
    const callableFn = vi.fn().mockResolvedValue({
      data: {
        score: 0,
        servedCount: 0,
        totalQualityScore: 0,
        bestQualityScore: 0,
        isNewWeeklyBest: false,
        isNewMonthlyBest: false,
        isNewAllTimeBest: false,
      },
    });
    httpsCallable.mockReturnValue(callableFn);
    const { submitLunchRushScore } = await import("./submitLunchRushScore");
    await submitLunchRushScore({ clientDurationMs: 0, serves: [] });
    expect(getFunctions).toHaveBeenCalledWith(fakeApp, "asia-northeast1");
  });

  it("caches the Functions instance across calls (getFunctions invoked once)", async () => {
    const callableFn = vi.fn().mockResolvedValue({
      data: {
        score: 0,
        servedCount: 0,
        totalQualityScore: 0,
        bestQualityScore: 0,
        isNewWeeklyBest: false,
        isNewMonthlyBest: false,
        isNewAllTimeBest: false,
      },
    });
    httpsCallable.mockReturnValue(callableFn);
    const { submitLunchRushScore } = await import("./submitLunchRushScore");
    await submitLunchRushScore({ clientDurationMs: 0, serves: [] });
    await submitLunchRushScore({ clientDurationMs: 0, serves: [] });
    expect(getFunctions).toHaveBeenCalledTimes(1);
  });
});
