import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

/**
 * PR #757 (Codex P2): src/main.tsx decides the Steam Gameplay Lab request BEFORE the Preview HV seed and the Cook HV entries, so
 * opening the Lab (V1 or V2, with or without `?hv=`) never resets, persists, writes or removes the Preview save.
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

describe("main.tsx: a Steam Gameplay Lab URL never seeds the Preview save", () => {
  it.each([
    ["V2 + hv=normal", "?steamGameLab=on&steamGameMode=v2&hv=normal", v2],
    ["V2 + hv before the lab flag", "?hv=normal&steamGameLab=on&steamGameMode=v2", v2],
    ["V1 + hv=normal", "?steamGameLab=on&hv=normal", lab],
    ["V2 + Cook HV entries", "?steamGameLab=on&steamGameMode=v2&cookPrepHv=1&cookSearHv=1&hv=normal", v2],
  ])("Preview %s: the Lab opens, nothing seeds / resets / persists / writes / removes", async (_name, search, screenOf) => {
    const before = snapshot();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    const { seeds, persistence, prep, sear } = await boot(search, { preview: true, dev: false });
    await waitFor(() => expect(screenOf()).not.toBeNull());
    expect(app()).toBeNull();
    expect(seeds.applyPreviewHvSeed).not.toHaveBeenCalled();
    expect(prep.activateCookPrepHv).not.toHaveBeenCalled();
    expect(sear.activateCookSearHv).not.toHaveBeenCalled();
    expect(persistence.resetSave).not.toHaveBeenCalled();
    expect(persistence.persistProgress).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(snapshot()).toBe(before);
  });

  it("DEV + V2 + hv: the Lab opens and no Cook HV entry runs", async () => {
    const { seeds, prep, sear } = await boot("?steamGameLab=on&steamGameMode=v2&hv=normal&cookPrepHv=1", { preview: false, dev: true });
    await waitFor(() => expect(v2()).not.toBeNull());
    expect(seeds.applyPreviewHvSeed).not.toHaveBeenCalled();
    expect(prep.activateCookPrepHv).not.toHaveBeenCalled();
    expect(sear.activateCookSearHv).not.toHaveBeenCalled();
  });

  it("a duplicated lab flag is not a Lab request: the existing HV seed and the app are unchanged", async () => {
    const { seeds } = await boot("?steamGameLab=on&steamGameLab=on&hv=normal", { preview: true, dev: false });
    await waitFor(() => expect(app()).not.toBeNull());
    expect(lab()).toBeNull();
    expect(seeds.applyPreviewHvSeed).toHaveBeenCalledTimes(1);
  });

  it("production + lab flag + hv: the Lab is unreachable, the app opens, no seed", async () => {
    const { seeds, persistence } = await boot("?steamGameLab=on&steamGameMode=v2&hv=normal", { preview: false, dev: false });
    await waitFor(() => expect(app()).not.toBeNull());
    expect(lab()).toBeNull();
    expect(v2()).toBeNull();
    expect(seeds.applyPreviewHvSeed).not.toHaveBeenCalled();
    expect(persistence.resetSave).not.toHaveBeenCalled();
  });
});
