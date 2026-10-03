import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Contract 2.1 Production Activation: the flag authority, resolved the way each build kind resolves it.
 * A Production build (neither `import.meta.env.DEV` nor `VITE_PREVIEW_MODE`) is ON and cannot be opted out;
 * the dev-only opt-out (`teto.dev.researchIdentify = "0"`) still works in dev / Preview builds.
 */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function flagFor(env: { DEV: boolean; preview?: string }, optOut?: string): Promise<boolean> {
  vi.resetModules();
  vi.stubEnv("DEV", env.DEV);
  vi.stubEnv("VITE_PREVIEW_MODE", env.preview ?? "");
  vi.stubGlobal("localStorage", { getItem: (k: string) => (k === "teto.dev.researchIdentify" ? (optOut ?? null) : null) });
  return (await import("./researchIdentifyFlag")).RESEARCH_IDENTIFY_ENABLED;
}

describe("RESEARCH_IDENTIFY_ENABLED authority", () => {
  it("a Production build is ON", async () => {
    expect(await flagFor({ DEV: false })).toBe(true);
  });
  it("a Production build cannot be opted out through localStorage", async () => {
    expect(await flagFor({ DEV: false }, "0")).toBe(true);
  });
  it("dev and Preview builds are ON by default and keep the dev opt-out", async () => {
    expect(await flagFor({ DEV: true })).toBe(true);
    expect(await flagFor({ DEV: false, preview: "1" })).toBe(true);
    expect(await flagFor({ DEV: true }, "0")).toBe(false);
    expect(await flagFor({ DEV: false, preview: "1" }, "0")).toBe(false);
  });
});
