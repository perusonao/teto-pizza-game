import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getFirebaseApp = vi.fn();
vi.mock("./client", () => ({
  getFirebaseApp: (...args: unknown[]) => getFirebaseApp(...args),
}));

type FakeUser = { uid: string };
type AuthStateListener = (user: FakeUser | null) => void;

let fakeAuth: { currentUser: FakeUser | null };
let authStateListeners: AuthStateListener[];
const getAuth = vi.fn((_app: unknown) => fakeAuth);
const signInAnonymously = vi.fn((_auth: unknown): Promise<{ user: FakeUser }> => {
  throw new Error("signInAnonymously mock not configured for this test");
});
const onAuthStateChanged = vi.fn(
  (_auth: unknown, onNext: AuthStateListener, _onError: (error: unknown) => void) => {
    authStateListeners.push(onNext);
    return () => {
      authStateListeners = authStateListeners.filter((listener) => listener !== onNext);
    };
  },
);

vi.mock("firebase/auth", () => ({
  getAuth: (app: unknown) => getAuth(app),
  signInAnonymously: (auth: unknown) => signInAnonymously(auth),
  onAuthStateChanged: (
    auth: unknown,
    onNext: AuthStateListener,
    onError: (error: unknown) => void,
  ) => onAuthStateChanged(auth, onNext, onError),
}));

function emitAuthState(user: FakeUser | null): void {
  for (const listener of [...authStateListeners]) listener(user);
}

describe("firebase/auth", () => {
  beforeEach(() => {
    vi.resetModules();
    fakeAuth = { currentUser: null };
    authStateListeners = [];
    getFirebaseApp.mockReset();
    getAuth.mockClear();
    signInAnonymously.mockReset();
    onAuthStateChanged.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test F: Firebase unavailable -> getCurrentAuthUser is null, never calls getAuth", async () => {
    getFirebaseApp.mockReturnValue(null);
    const { getCurrentAuthUser } = await import("./auth");
    expect(getCurrentAuthUser()).toBeNull();
    expect(getAuth).not.toHaveBeenCalled();
  });

  it("Test F: Firebase unavailable -> ensureAnonymousUser resolves null, never throws", async () => {
    getFirebaseApp.mockReturnValue(null);
    const { ensureAnonymousUser } = await import("./auth");
    await expect(ensureAnonymousUser()).resolves.toBeNull();
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("Test C: an already-hydrated currentUser is reused without calling signInAnonymously", async () => {
    getFirebaseApp.mockReturnValue({});
    fakeAuth.currentUser = { uid: "existing-user" };
    const { ensureAnonymousUser } = await import("./auth");
    await expect(ensureAnonymousUser()).resolves.toEqual({ uid: "existing-user" });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("Test C: a persisted session restored via onAuthStateChanged is reused, not re-signed-in", async () => {
    getFirebaseApp.mockReturnValue({});
    const { ensureAnonymousUser } = await import("./auth");
    const pending = ensureAnonymousUser();
    emitAuthState({ uid: "restored-user" });
    await expect(pending).resolves.toEqual({ uid: "restored-user" });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("Test D: no existing/restored user -> signs in anonymously", async () => {
    getFirebaseApp.mockReturnValue({});
    signInAnonymously.mockResolvedValue({ user: { uid: "new-anon-user" } });
    const { ensureAnonymousUser } = await import("./auth");
    const pending = ensureAnonymousUser();
    emitAuthState(null);
    await expect(pending).resolves.toEqual({ uid: "new-anon-user" });
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("Test E: signInAnonymously failure resolves null instead of rejecting/throwing", async () => {
    getFirebaseApp.mockReturnValue({});
    signInAnonymously.mockRejectedValue(new Error("network error"));
    const { ensureAnonymousUser } = await import("./auth");
    const pending = ensureAnonymousUser();
    emitAuthState(null);
    await expect(pending).resolves.toBeNull();
  });

  it("Test G: concurrent calls while a sign-in is in flight share one signInAnonymously call", async () => {
    getFirebaseApp.mockReturnValue({});
    signInAnonymously.mockResolvedValue({ user: { uid: "shared-user" } });
    const { ensureAnonymousUser } = await import("./auth");
    const first = ensureAnonymousUser();
    const second = ensureAnonymousUser();
    emitAuthState(null);
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual({ uid: "shared-user" });
    expect(secondResult).toEqual({ uid: "shared-user" });
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("Test G: a second call after resolution reuses currentUser, no duplicate sign-in", async () => {
    getFirebaseApp.mockReturnValue({});
    signInAnonymously.mockResolvedValue({ user: { uid: "once-user" } });
    const { ensureAnonymousUser } = await import("./auth");
    const pending = ensureAnonymousUser();
    emitAuthState(null);
    await pending;
    fakeAuth.currentUser = { uid: "once-user" };

    await ensureAnonymousUser();
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });
});
