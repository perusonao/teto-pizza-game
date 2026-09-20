import { afterEach, describe, expect, it, vi } from "vitest";
import { getFirebaseConfig } from "./config";

const ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

const VALID_ENV: Record<(typeof ENV_KEYS)[number], string> = {
  VITE_FIREBASE_API_KEY: "test-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "test-project.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "test-project",
  VITE_FIREBASE_APP_ID: "1:123:web:abc",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getFirebaseConfig", () => {
  it("returns null when every Firebase env var is unset (Test A: unconfigured build)", () => {
    for (const key of ENV_KEYS) vi.stubEnv(key, "");
    expect(getFirebaseConfig()).toBeNull();
  });

  it("returns the full config when every field is set (Test B: valid config)", () => {
    for (const key of ENV_KEYS) vi.stubEnv(key, VALID_ENV[key]);
    expect(getFirebaseConfig()).toEqual({
      apiKey: VALID_ENV.VITE_FIREBASE_API_KEY,
      authDomain: VALID_ENV.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: VALID_ENV.VITE_FIREBASE_PROJECT_ID,
      appId: VALID_ENV.VITE_FIREBASE_APP_ID,
    });
  });

  it("returns null when only some fields are set (treated the same as fully unset)", () => {
    vi.stubEnv("VITE_FIREBASE_API_KEY", VALID_ENV.VITE_FIREBASE_API_KEY);
    vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "");
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "");
    vi.stubEnv("VITE_FIREBASE_APP_ID", "");
    expect(getFirebaseConfig()).toBeNull();
  });
});
