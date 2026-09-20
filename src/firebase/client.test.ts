import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

function stubValidEnv(): void {
  vi.stubEnv("VITE_FIREBASE_API_KEY", "test-api-key");
  vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "test-project.firebaseapp.com");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "test-project");
  vi.stubEnv("VITE_FIREBASE_APP_ID", "1:123:web:abc");
}

function stubMissingEnv(): void {
  for (const key of ENV_KEYS) vi.stubEnv(key, "");
}

const fakeApp = { name: "[DEFAULT]" };
const initializeApp = vi.fn((_config: unknown) => fakeApp);
const getApps = vi.fn(() => [] as unknown[]);
const getApp = vi.fn(() => fakeApp);

vi.mock("firebase/app", () => ({
  initializeApp: (config: unknown) => initializeApp(config),
  getApps: () => getApps(),
  getApp: () => getApp(),
}));

describe("getFirebaseApp / isFirebaseAvailable", () => {
  beforeEach(() => {
    vi.resetModules();
    initializeApp.mockClear();
    getApps.mockClear();
    getApp.mockClear();
    getApps.mockReturnValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Test A: env unset -> unavailable, never calls initializeApp", async () => {
    stubMissingEnv();
    const { getFirebaseApp, isFirebaseAvailable } = await import("./client");
    expect(getFirebaseApp()).toBeNull();
    expect(isFirebaseAvailable()).toBe(false);
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("Test B: valid config -> initializes exactly once and caches the app", async () => {
    stubValidEnv();
    const { getFirebaseApp, isFirebaseAvailable } = await import("./client");
    const app = getFirebaseApp();
    expect(app).toBe(fakeApp);
    expect(isFirebaseAvailable()).toBe(true);
    getFirebaseApp();
    getFirebaseApp();
    expect(initializeApp).toHaveBeenCalledTimes(1);
  });

  it("reuses an already-initialized app instead of calling initializeApp again", async () => {
    stubValidEnv();
    getApps.mockReturnValue([fakeApp]);
    const { getFirebaseApp } = await import("./client");
    const app = getFirebaseApp();
    expect(app).toBe(fakeApp);
    expect(initializeApp).not.toHaveBeenCalled();
    expect(getApp).toHaveBeenCalled();
  });
});
