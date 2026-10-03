import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

/**
 * Startup order in src/main.tsx: the Inspector request is decided BEFORE the Preview HV seed, so an Inspector
 * URL never seeds (resetSave / persistProgress would write the Preview save, breaking "read-only").
 * main.tsx is imported for real; only the heavy App is stubbed and the persistence writers are passthrough spies.
 */
vi.mock("../App.tsx", () => ({ default: () => <div data-testid="app-stub">APP</div> }));
vi.mock("../state/persistence", async (importOriginal) => {
  const real = await importOriginal<typeof import("../state/persistence")>();
  return { ...real, resetSave: vi.fn(real.resetSave), persistProgress: vi.fn(real.persistProgress) };
});
vi.mock("../preview/hvSeeds", async (importOriginal) => {
  const real = await importOriginal<typeof import("../preview/hvSeeds")>();
  return { ...real, applyPreviewHvSeed: vi.fn((search: unknown, storage: Parameters<typeof real.applyPreviewHvSeed>[1]) => real.applyPreviewHvSeed(search, storage, "navigate")) };
});

const VALID_HV = "pool2-onion";

async function boot(search: string, env: { preview: boolean; dev: boolean }) {
  vi.resetModules();
  vi.stubEnv("VITE_PREVIEW_MODE", env.preview ? "1" : "");
  vi.stubEnv("DEV", env.dev);
  window.history.replaceState(null, "", `/${search}`);
  document.body.innerHTML = '<div id="root"></div>';
  const seeds = await import("../preview/hvSeeds");
  const persistence = await import("../state/persistence");
  await import("../main.tsx");
  return { seeds, persistence };
}

const inspector = () => document.querySelector("[data-inspector]");
const app = () => document.querySelector('[data-testid="app-stub"]');

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("main.tsx startup order", () => {
  it("Preview + ?inspector=discovery + valid hv: the Inspector opens and nothing seeds, resets or persists", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    const { seeds, persistence } = await boot(`?inspector=discovery&hv=${VALID_HV}`, { preview: true, dev: false });
    await waitFor(() => expect(inspector()).not.toBeNull());
    expect(app()).toBeNull();
    expect(seeds.applyPreviewHvSeed).not.toHaveBeenCalled();
    expect(persistence.resetSave).not.toHaveBeenCalled();
    expect(persistence.persistProgress).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });

  it("the same holds with the hv parameter before the inspector parameter, and in DEV", async () => {
    const { seeds, persistence } = await boot(`?hv=${VALID_HV}&inspector=discovery`, { preview: false, dev: true });
    await waitFor(() => expect(inspector()).not.toBeNull());
    expect(seeds.applyPreviewHvSeed).not.toHaveBeenCalled();
    expect(persistence.resetSave).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });

  it("Preview + valid hv without inspector: the existing HV seed still runs and the app opens", async () => {
    const { seeds, persistence } = await boot(`?hv=${VALID_HV}`, { preview: true, dev: false });
    await waitFor(() => expect(app()).not.toBeNull());
    expect(inspector()).toBeNull();
    expect(seeds.applyPreviewHvSeed).toHaveBeenCalledTimes(1);
    expect(persistence.resetSave).toHaveBeenCalled();
    expect(persistence.persistProgress).toHaveBeenCalled();
    expect(window.localStorage.length).toBeGreaterThan(0);
  });

  it("production + ?inspector=discovery (+ hv): the Inspector is unreachable, the app opens, no seed", async () => {
    const { seeds, persistence } = await boot(`?inspector=discovery&hv=${VALID_HV}`, { preview: false, dev: false });
    await waitFor(() => expect(app()).not.toBeNull());
    expect(inspector()).toBeNull();
    expect(seeds.applyPreviewHvSeed).not.toHaveBeenCalled();
    expect(persistence.resetSave).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });
});
