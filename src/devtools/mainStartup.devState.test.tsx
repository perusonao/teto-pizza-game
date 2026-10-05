import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

/**
 * DEV State Editor (Issue #403) S3: startup order in src/main.tsx. A `?dev=state` request is decided BEFORE
 * the Preview HV seed, so opening the editor never seeds, resets, persists or removes anything (Owner Contract
 * 7), and in production the parameter is inert. main.tsx is imported for real; only the heavy App is stubbed.
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
const PREVIEW_KEY = "teto-pizza-preview-save-v1";
const PROD_KEY = "teto-pizza-save-v1";

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

const editor = () => document.querySelector("[data-dev-state-editor]");
const inspector = () => document.querySelector("[data-inspector]");
const app = () => document.querySelector('[data-testid="app-stub"]');

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("main.tsx startup order for ?dev=state", () => {
  it("Preview + ?dev=state + a valid hv: the editor opens and nothing seeds, resets, persists, writes or removes", async () => {
    const SAVE = JSON.stringify({ schemaVersion: 2, dex: [], futureKey: 1 });
    window.localStorage.setItem(PREVIEW_KEY, SAVE);
    window.localStorage.setItem(PROD_KEY, "production-save");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    const { seeds, persistence } = await boot(`?dev=state&hv=${VALID_HV}`, { preview: true, dev: false });
    await waitFor(() => expect(editor()).not.toBeNull());
    expect(app()).toBeNull();
    expect(inspector()).toBeNull();
    expect(seeds.applyPreviewHvSeed).not.toHaveBeenCalled();
    expect(persistence.resetSave).not.toHaveBeenCalled();
    expect(persistence.persistProgress).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBe(SAVE);
    expect(window.localStorage.getItem(PROD_KEY)).toBe("production-save");
    expect(window.localStorage.length).toBe(2);
  });

  it("DEV + ?dev=state with an empty storage: the editor opens and storage stays empty", async () => {
    const { seeds, persistence } = await boot("?dev=state", { preview: false, dev: true });
    await waitFor(() => expect(editor()).not.toBeNull());
    expect(seeds.applyPreviewHvSeed).not.toHaveBeenCalled();
    expect(persistence.persistProgress).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });

  it("the Inspector request still wins over ?dev=state (one developer page at a time)", async () => {
    await boot("?inspector=discovery&dev=state", { preview: false, dev: true });
    await waitFor(() => expect(inspector()).not.toBeNull());
    expect(editor()).toBeNull();
  });

  it("production + ?dev=state (+ hv): the editor is unreachable, the app opens, no seed, nothing is written", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { seeds, persistence } = await boot(`?dev=state&hv=${VALID_HV}`, { preview: false, dev: false });
    await waitFor(() => expect(app()).not.toBeNull());
    expect(editor()).toBeNull();
    expect(document.body.textContent).not.toMatch(/DEV State Editor/);
    expect(seeds.applyPreviewHvSeed).not.toHaveBeenCalled();
    expect(persistence.resetSave).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });

  it("Preview without ?dev=state: the existing HV seed and the app are unchanged", async () => {
    const { seeds } = await boot(`?hv=${VALID_HV}`, { preview: true, dev: false });
    await waitFor(() => expect(app()).not.toBeNull());
    expect(editor()).toBeNull();
    expect(seeds.applyPreviewHvSeed).toHaveBeenCalledTimes(1);
  });

  it("a different value of the parameter (dev=1, dev=State) never opens the editor", async () => {
    await boot("?dev=1", { preview: true, dev: true });
    await waitFor(() => expect(app()).not.toBeNull());
    expect(editor()).toBeNull();
  });
});
