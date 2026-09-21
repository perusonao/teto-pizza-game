import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("setDisplayName (client)", () => {
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
    const { setDisplayName } = await import("./setDisplayName");
    const result = await setDisplayName({ displayName: "Alice" });
    expect(result).toEqual({ status: "unavailable" });
    expect(ensureAnonymousUser).not.toHaveBeenCalled();
    expect(httpsCallable).not.toHaveBeenCalled();
  });

  it("auth unavailable (ensureAnonymousUser resolves null) -> resolves 'unavailable', never calls the callable", async () => {
    ensureAnonymousUser.mockResolvedValue(null);
    const { setDisplayName } = await import("./setDisplayName");
    const result = await setDisplayName({ displayName: "Alice" });
    expect(result).toEqual({ status: "unavailable" });
    expect(httpsCallable).not.toHaveBeenCalled();
  });

  it("a successful callable invocation resolves 'success' with the server's accepted name", async () => {
    const callableFn = vi.fn().mockResolvedValue({ data: { displayName: "Alice" } });
    httpsCallable.mockReturnValue(callableFn);
    const { setDisplayName } = await import("./setDisplayName");
    const result = await setDisplayName({ displayName: "  Alice  " });
    expect(result).toEqual({ status: "success", displayName: "Alice" });
    expect(httpsCallable).toHaveBeenCalledWith(fakeFunctions, "setDisplayName");
    expect(callableFn).toHaveBeenCalledWith({ displayName: "  Alice  " });
  });

  it("maps a server 'invalid-argument' error to status 'invalid-argument'", async () => {
    const error = Object.assign(new Error("displayName must not be empty."), {
      code: "invalid-argument",
    });
    const callableFn = vi.fn().mockRejectedValue(error);
    httpsCallable.mockReturnValue(callableFn);
    const { setDisplayName } = await import("./setDisplayName");
    const result = await setDisplayName({ displayName: "" });
    expect(result).toEqual({
      status: "invalid-argument",
      message: "displayName must not be empty.",
    });
  });

  it("maps a server 'resource-exhausted' error to status 'cooldown'", async () => {
    const error = Object.assign(new Error("Renaming is limited to once every 60 seconds."), {
      code: "resource-exhausted",
    });
    const callableFn = vi.fn().mockRejectedValue(error);
    httpsCallable.mockReturnValue(callableFn);
    const { setDisplayName } = await import("./setDisplayName");
    const result = await setDisplayName({ displayName: "Bob" });
    expect(result.status).toBe("cooldown");
  });

  it("maps any other server error to status 'failed'", async () => {
    const error = Object.assign(new Error("internal error"), { code: "internal" });
    const callableFn = vi.fn().mockRejectedValue(error);
    httpsCallable.mockReturnValue(callableFn);
    const { setDisplayName } = await import("./setDisplayName");
    const result = await setDisplayName({ displayName: "Bob" });
    expect(result).toEqual({ status: "failed", message: "internal error" });
  });

  it("a rejection with no code (e.g. a network error) resolves 'failed', never throws", async () => {
    const callableFn = vi.fn().mockRejectedValue(new Error("network down"));
    httpsCallable.mockReturnValue(callableFn);
    const { setDisplayName } = await import("./setDisplayName");
    const result = await setDisplayName({ displayName: "Bob" });
    expect(result).toEqual({ status: "failed", message: "network down" });
  });

  it("ensureAnonymousUser rejecting still resolves 'failed', not an unhandled rejection", async () => {
    ensureAnonymousUser.mockRejectedValue(new Error("network down"));
    const { setDisplayName } = await import("./setDisplayName");
    const result = await setDisplayName({ displayName: "Bob" });
    expect(result.status).toBe("failed");
  });

  it("requests the Functions instance for the Firestore-matching region (asia-northeast1)", async () => {
    const callableFn = vi.fn().mockResolvedValue({ data: { displayName: "Bob" } });
    httpsCallable.mockReturnValue(callableFn);
    const { setDisplayName } = await import("./setDisplayName");
    await setDisplayName({ displayName: "Bob" });
    expect(getFunctions).toHaveBeenCalledWith(fakeApp, "asia-northeast1");
  });

  it("caches the Functions instance across calls (getFunctions invoked once)", async () => {
    const callableFn = vi.fn().mockResolvedValue({ data: { displayName: "Bob" } });
    httpsCallable.mockReturnValue(callableFn);
    const { setDisplayName } = await import("./setDisplayName");
    await setDisplayName({ displayName: "Bob" });
    await setDisplayName({ displayName: "Carol" });
    expect(getFunctions).toHaveBeenCalledTimes(1);
  });
});
