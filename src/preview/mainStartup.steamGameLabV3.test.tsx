import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

/**
 * #755 V3: the V3 Lab URL goes through the same main.tsx Steam Lab entry as V1 / V2 (main.tsx is NOT changed for V3), so opening
 * it (with or without `?hv=` / Cook HV / the provisional `steamV3Window`) never resets, persists, writes or removes the Preview save.
 * main.tsx is imported for real; only the heavy App is stubbed and the persistence writers are passthrough spies
 * (the same shape as ../dev/mainStartup.test.tsx).
 */
vi.mock("../App.tsx", () => ({ default: () => <div data-testid="app-stub">APP</div> }));
vi.mock("../state/persistence", async (importOriginal) => {
  const real = await importOriginal<typeof import("../state/persistence")>();
  return { ...real, resetSave: vi.fn(real.resetSave), persistProgress: vi.fn(real.persistProgress) };
});
vi.mock("./hvSeeds", async (importOriginal) => {
  const real = await importOriginal<typeof import("./hvSeeds")>();
  return { ...real, applyPreviewHvSeed: vi.fn((search: unknown, storage: Parameters<typeof real.applyPreviewHvSeed>[1]) => real.applyPreviewHvSeed(search, storage, "navigate")) };
});
vi.mock("./cookPrepHv", async (importOriginal) => {
  const real = await importOriginal<typeof import("./cookPrepHv")>();
  return { ...real, activateCookPrepHv: vi.fn(real.activateCookPrepHv) };
});
vi.mock("./cookSearHv", async (importOriginal) => {
  const real = await importOriginal<typeof import("./cookSearHv")>();
  return { ...real, activateCookSearHv: vi.fn(real.activateCookSearHv) };
});

const SAVED = { key: "teto-existing-preview-save", value: '{"keep":"me"}' };

async function boot(search: string, env: { preview: boolean; dev: boolean }) {
  vi.resetModules();
  vi.stubEnv("VITE_PREVIEW_MODE", env.preview ? "1" : "");
  vi.stubEnv("DEV", env.dev);
  window.history.replaceState(null, "", `/${search}`);
  document.body.innerHTML = '<div id="root"></div>';
  const seeds = await import("./hvSeeds");
  const persistence = await import("../state/persistence");
  const prep = await import("./cookPrepHv");
  const sear = await import("./cookSearHv");
  await import("../main.tsx");
  return { seeds, persistence, prep, sear };
}

const lab = () => document.querySelector('[data-lab="steam-game-lab-v1"]');
const v2 = () => document.querySelector('[data-testid="sgl-v2-scene"]');
const v3 = () => document.querySelector('[data-testid="sgl-v3-scene"]');
const app = () => document.querySelector('[data-testid="app-stub"]');
const snapshot = () => JSON.stringify(Object.entries(window.localStorage).sort());

// A Cook HV entry swaps window.localStorage for a disposable one; put the real one back so one regression cannot cascade.
const realStorage = window.localStorage;
beforeEach(() => {
  Object.defineProperty(window, "localStorage", { configurable: true, get: () => realStorage });
  window.localStorage.clear();
  window.localStorage.setItem(SAVED.key, SAVED.value);
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("main.tsx: a Steam Gameplay V3 URL never seeds the Preview save", () => {
  it.each([
    ["V3", "?steamGameLab=on&steamGameMode=v3"],
    ["V3 + hv=normal", "?steamGameLab=on&steamGameMode=v3&hv=normal"],
    ["V3 + hv before the lab flag", "?hv=normal&steamGameLab=on&steamGameMode=v3"],
    ["V3 + Cook HV entries", "?steamGameLab=on&steamGameMode=v3&cookPrepHv=1&cookSearHv=1&hv=normal"],
    ["V3 + provisional window", "?steamGameLab=on&steamGameMode=v3&steamV3Window=loose&hv=normal"],
  ])("%s (Preview build): renders V3, no seed, no Cook HV, save untouched", async (_name, search) => {
    const before = snapshot();
    const { seeds, persistence, prep, sear } = await boot(search, { preview: true, dev: false });
    await waitFor(() => expect(v3()).not.toBeNull());
    expect(lab()).toBeNull();
    expect(v2()).toBeNull();
    expect(app()).toBeNull();
    expect(seeds.applyPreviewHvSeed).not.toHaveBeenCalled();
    expect(prep.activateCookPrepHv).not.toHaveBeenCalled();
    expect(sear.activateCookSearHv).not.toHaveBeenCalled();
    expect(persistence.resetSave).not.toHaveBeenCalled();
    expect(persistence.persistProgress).not.toHaveBeenCalled();
    expect(snapshot()).toBe(before);
    expect(window.localStorage.getItem(SAVED.key)).toBe(SAVED.value);
  });

  it("a duplicated or unknown mode stays on V1 (V3 is opt-in by the exact value)", async () => {
    for (const q of ["?steamGameLab=on&steamGameMode=v3&steamGameMode=v3", "?steamGameLab=on&steamGameMode=V3"]) {
      await boot(q, { preview: true, dev: false });
      await waitFor(() => expect(lab()).not.toBeNull());
      expect(v3()).toBeNull();
    }
  });

  it("production build: the V3 URL renders the game, not the Lab", async () => {
    const { seeds } = await boot("?steamGameLab=on&steamGameMode=v3", { preview: false, dev: false });
    await waitFor(() => expect(app()).not.toBeNull());
    expect(v3()).toBeNull();
    expect(seeds.applyPreviewHvSeed).not.toHaveBeenCalled();
  });
});
