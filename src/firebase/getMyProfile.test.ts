import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Player Profile 1.0 Phase 1A (Issue #129). `firebase/firestore` is mocked with only the read
 * functions ./getMyProfile.ts actually imports (doc/getDoc/getFirestore) -- there is no
 * `setDoc`/`updateDoc`/`deleteDoc` stub here at all, mirroring ./getWeeklyLeaderboard.test.ts's
 * own "if a write path ever slipped in, this suite fails at import time" discipline.
 */

const fakeApp = { name: "[DEFAULT]" };
const fakeDb = { app: fakeApp };
const fakeUser = { uid: "test-uid" };

const getFirebaseApp = vi.fn((): typeof fakeApp | null => fakeApp);
vi.mock("./client", () => ({
  getFirebaseApp: () => getFirebaseApp(),
}));

const ensureAnonymousUser = vi.fn((): Promise<typeof fakeUser | null> => Promise.resolve(fakeUser));
vi.mock("./auth", () => ({
  ensureAnonymousUser: () => ensureAnonymousUser(),
}));

let snapshotExists = false;
let snapshotData: Record<string, unknown> = {};
let getDocError: Error | null = null;

const getFirestore = vi.fn((_app: unknown) => fakeDb);
const doc = vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join("/") }));
const getDoc = vi.fn(async (_ref: unknown) => {
  if (getDocError) throw getDocError;
  return { exists: () => snapshotExists, data: () => snapshotData };
});

vi.mock("firebase/firestore", () => ({
  getFirestore: (app: unknown) => getFirestore(app),
  doc: (db: unknown, ...segments: string[]) => doc(db, ...segments),
  getDoc: (ref: unknown) => getDoc(ref),
}));

describe("getMyProfile", () => {
  beforeEach(() => {
    vi.resetModules();
    getFirebaseApp.mockClear().mockReturnValue(fakeApp);
    ensureAnonymousUser.mockClear().mockResolvedValue(fakeUser);
    getFirestore.mockClear().mockReturnValue(fakeDb);
    doc.mockClear();
    getDoc.mockClear();
    snapshotExists = false;
    snapshotData = {};
    getDocError = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Firebase unavailable -> resolves 'unavailable', never calls ensureAnonymousUser or getDoc", async () => {
    getFirebaseApp.mockReturnValue(null);
    const { getMyProfile } = await import("./getMyProfile");
    const result = await getMyProfile();
    expect(result).toEqual({ status: "unavailable" });
    expect(ensureAnonymousUser).not.toHaveBeenCalled();
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("auth unavailable (ensureAnonymousUser resolves null) -> resolves 'unavailable', never calls getDoc", async () => {
    ensureAnonymousUser.mockResolvedValue(null);
    const { getMyProfile } = await import("./getMyProfile");
    const result = await getMyProfile();
    expect(result).toEqual({ status: "unavailable" });
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("missing profile -> resolves 'success' with profile: null (a normal, permanent state)", async () => {
    snapshotExists = false;
    const { getMyProfile } = await import("./getMyProfile");
    const result = await getMyProfile();
    expect(result).toEqual({ status: "success", profile: null });
  });

  it("existing profile -> resolves 'success' with the displayName", async () => {
    snapshotExists = true;
    snapshotData = { displayName: "Alice", createdAt: {}, updatedAt: {} };
    const { getMyProfile } = await import("./getMyProfile");
    const result = await getMyProfile();
    expect(result).toEqual({ status: "success", profile: { displayName: "Alice" } });
  });

  it("existing document with a non-string/missing displayName -> treated as no profile", async () => {
    snapshotExists = true;
    snapshotData = { createdAt: {}, updatedAt: {} };
    const { getMyProfile } = await import("./getMyProfile");
    const result = await getMyProfile();
    expect(result).toEqual({ status: "success", profile: null });
  });

  it("reads the caller's own uid's document path", async () => {
    snapshotExists = true;
    snapshotData = { displayName: "Alice" };
    const { getMyProfile } = await import("./getMyProfile");
    await getMyProfile();
    expect(doc).toHaveBeenCalledWith(fakeDb, "users", "test-uid");
  });

  it("getDoc throwing -> resolves 'error', never throws", async () => {
    getDocError = new Error("permission-denied");
    const { getMyProfile } = await import("./getMyProfile");
    const result = await getMyProfile();
    expect(result).toEqual({ status: "error", message: "permission-denied" });
  });

  it("ensureAnonymousUser rejecting -> resolves 'error', not an unhandled rejection", async () => {
    ensureAnonymousUser.mockRejectedValue(new Error("network down"));
    const { getMyProfile } = await import("./getMyProfile");
    const result = await getMyProfile();
    expect(result.status).toBe("error");
  });

  it("caches the Firestore instance across calls (getFirestore invoked once)", async () => {
    const { getMyProfile } = await import("./getMyProfile");
    await getMyProfile();
    await getMyProfile();
    expect(getFirestore).toHaveBeenCalledTimes(1);
  });
});
