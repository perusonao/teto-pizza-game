import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import flagSource from "./progressionModelFlag.ts?raw";
import { parseProgressionPreviewParam, resolveProgressionPreviewDecision } from "./progressionPreviewOptIn";
import { memoryStorage } from "../../state/testSupport/memoryStorage";

/**
 * B案 Phase 1a (Issue #901), design §3.4 `progressionModelFlag`: the production default is legacy, and only Preview / DEV
 * instructions change it (vitest is a DEV build, so those paths are live here). The flag is a module constant, so every
 * case imports a fresh copy. The production bundle side is in ../../preview/previewIsolation.gate.test.ts.
 */

const DEV_KEY = "teto.dev.progressionModel";
const PREVIEW_KEY = "teto-pizza-preview-progression-model";

async function idFor(search: string): Promise<string> {
  window.history.replaceState({}, "", `/${search}`);
  vi.resetModules();
  const flag = await import("./progressionModelFlag");
  expect(flag.progressionModelId()).toBe(flag.PROGRESSION_MODEL_ID);
  return flag.PROGRESSION_MODEL_ID;
}

async function activeIdFor(search: string): Promise<string> {
  window.history.replaceState({}, "", `/${search}`);
  vi.resetModules();
  return (await import("./progressionModel")).activeProgressionModel().id;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("progression model flag", () => {
  it("the production default is the literal \"legacy\", written once", () => {
    const defaults = flagSource.match(/^const PROGRESSION_MODEL_PRODUCTION_DEFAULT: ProgressionModelId = "(\w+)";$/gm) ?? [];
    expect(defaults).toEqual(['const PROGRESSION_MODEL_PRODUCTION_DEFAULT: ProgressionModelId = "legacy";']);
  });

  it("nothing set: legacy", async () => {
    expect(await idFor("")).toBe("legacy");
    expect(await activeIdFor("")).toBe("legacy");
  });

  it("an unrelated parameter or an unknown value changes nothing", async () => {
    expect(await idFor("?hv=normal")).toBe("legacy");
    expect(await idFor("?progression=reputation")).toBe("legacy");
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBeNull();
  });

  it("?progression=shop selects shop and is remembered in the Preview key; ?progression=legacy switches back", async () => {
    expect(await idFor("?progression=shop")).toBe("shop");
    expect(await activeIdFor("")).toBe("shop");
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBe("shop");
    expect(await idFor("")).toBe("shop");
    expect(await idFor("?progression=legacy")).toBe("legacy");
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBe("legacy");
    expect(await idFor("")).toBe("legacy");
  });

  it("the DEV key selects a model; the Preview instruction wins over it", async () => {
    window.localStorage.setItem(DEV_KEY, "shop");
    expect(await idFor("")).toBe("shop");
    expect(await idFor("?progression=legacy")).toBe("legacy");
    window.localStorage.clear();
    window.localStorage.setItem(DEV_KEY, "nonsense");
    expect(await idFor("")).toBe("legacy");
  });

  it("the Preview key is separate from the save keys and leaves the save untouched", async () => {
    window.localStorage.setItem("teto-pizza-save-v1", "PRODUCTION-SAVE");
    expect(await idFor("?progression=shop")).toBe("shop");
    expect(window.localStorage.getItem("teto-pizza-save-v1")).toBe("PRODUCTION-SAVE");
    expect(PREVIEW_KEY).not.toBe("teto-pizza-save-v1");
    expect(PREVIEW_KEY).not.toBe("teto-pizza-preview-save-v1");
  });

  it("a production build (neither DEV nor Preview) ignores the URL, the Preview key and the DEV key", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_PREVIEW_MODE", "");
    window.localStorage.setItem(DEV_KEY, "shop");
    window.localStorage.setItem(PREVIEW_KEY, "shop");
    expect(await idFor("?progression=shop")).toBe("legacy");
    expect(await activeIdFor("?progression=shop")).toBe("legacy");
  });

  it("a Preview build (not DEV) honours the URL / Preview key but not the DEV key", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_PREVIEW_MODE", "1");
    window.localStorage.setItem(DEV_KEY, "shop");
    expect(await idFor("")).toBe("legacy");
    expect(await idFor("?progression=shop")).toBe("shop");
  });
});

describe("Preview instruction parsing", () => {
  it("parses only shop / legacy", () => {
    expect(parseProgressionPreviewParam("?progression=shop")).toBe("shop");
    expect(parseProgressionPreviewParam("?progression=legacy")).toBe("legacy");
    expect(parseProgressionPreviewParam("?progression=")).toBeNull();
    expect(parseProgressionPreviewParam("?progression=SHOP")).toBeNull();
    expect(parseProgressionPreviewParam(undefined)).toBeNull();
  });

  it("a failing storage never throws: the parameter still counts, nothing stored reads as null", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => undefined };
    expect(resolveProgressionPreviewDecision("?progression=shop", broken)).toBe("shop");
    expect(resolveProgressionPreviewDecision("", broken)).toBeNull();
    expect(resolveProgressionPreviewDecision("?progression=shop", null)).toBe("shop");
  });

  it("stores the choice and reads it back", () => {
    const storage = memoryStorage();
    expect(resolveProgressionPreviewDecision("", storage)).toBeNull();
    expect(resolveProgressionPreviewDecision("?progression=shop", storage)).toBe("shop");
    expect(resolveProgressionPreviewDecision("", storage)).toBe("shop");
    expect(storage.keys()).toEqual([PREVIEW_KEY]);
  });
});
