import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import flagSource from "./progressionModelFlag.ts?raw";
import { parseProgressionParam } from "./progressionParam";
import { resolveProgressionPreviewDecision } from "./progressionPreviewOptIn";
import { memoryStorage } from "../../state/testSupport/memoryStorage";

/**
 * Phase 4 switch design §2: the flag is resolved once at module initialization.
 * The production bundle is also exercised by the isolation gate and the built-Web smoke test.
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock("../../data/menuCatalog");
  vi.doUnmock("./reputationTable");
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

  it("production ignores a shop request and both remembered choices while its default is legacy", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_PREVIEW_MODE", "");
    window.localStorage.setItem(DEV_KEY, "shop");
    window.localStorage.setItem(PREVIEW_KEY, "shop");
    expect(await idFor("?progression=shop")).toBe("legacy");
    expect(await activeIdFor("?progression=shop")).toBe("legacy");
  });

  it.each(["", "?progression=", "?progression=reputation", "?progression=shop", "?progression=shop&progression=legacy"])(
    "production keeps the configured default for %j",
    async (search) => {
      vi.stubEnv("DEV", false);
      vi.stubEnv("VITE_PREVIEW_MODE", "");
      window.localStorage.setItem(DEV_KEY, "legacy");
      window.localStorage.setItem(PREVIEW_KEY, "legacy");
      const read = vi.spyOn(Storage.prototype, "getItem");
      const write = vi.spyOn(Storage.prototype, "setItem");
      expect(await idFor(search)).toBe("legacy");
      const { resolveProgressionModelId } = await import("./progressionModelFlag");
      expect(resolveProgressionModelId("shop")).toBe("shop");
      expect(read).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    },
  );

  it("production applies the first legacy query for one load without consulting storage", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_PREVIEW_MODE", "");
    window.localStorage.setItem(DEV_KEY, "shop");
    window.localStorage.setItem(PREVIEW_KEY, "shop");
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    expect(await idFor("?progression=legacy&progression=shop")).toBe("legacy");
    const { resolveProgressionModelId, progressionModelId } = await import("./progressionModelFlag");
    expect(resolveProgressionModelId("shop")).toBe("legacy");
    window.history.replaceState({}, "", "/");
    expect(progressionModelId()).toBe("legacy");
    expect(resolveProgressionModelId("shop")).toBe("shop");
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("production treats a missing location as no query", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_PREVIEW_MODE", "");
    vi.stubGlobal("location", undefined);
    vi.resetModules();
    const { PROGRESSION_MODEL_ID, resolveProgressionModelId } = await import("./progressionModelFlag");
    expect(PROGRESSION_MODEL_ID).toBe("legacy");
    expect(resolveProgressionModelId("shop")).toBe("shop");
  });

  it.each(["empty catalog", "incomplete reputation table"])("an %s resolves shop to legacy across the model and UI", async (missing) => {
    if (missing === "empty catalog") {
      vi.doMock("../../data/menuCatalog", async (importOriginal) => ({
        ...await importOriginal<typeof import("../../data/menuCatalog")>(),
        MENU_CATALOG: [],
      }));
    } else {
      // The gate's default argument closes over its module's table, so use its actual validator with the incomplete table.
      vi.doMock("./reputationTable", async (importOriginal) => {
        const actual = await importOriginal<typeof import("./reputationTable")>();
        const table = { ...actual.REPUTATION_TABLE, menuDevelopmentBonus: null };
        return { ...actual, REPUTATION_TABLE: table, canEnableShopProgression: () => actual.canEnableShopProgression(table) };
      });
    }
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_PREVIEW_MODE", "");
    expect(await idFor("")).toBe("legacy");
    const { resolveProgressionModelId } = await import("./progressionModelFlag");
    expect(resolveProgressionModelId("shop")).toBe("legacy");

    vi.stubEnv("VITE_PREVIEW_MODE", "1");
    expect(await idFor("?progression=shop")).toBe("legacy");
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBe("shop");
    const { activeProgressionModel, LEGACY_PROGRESSION } = await import("./progressionModel");
    const { SHOP_COPY_ACTIVE, shopCopy } = await import("./shopCopy");
    const { SHOP_MODEL_ACTIVE, shopReputationStatus } = await import("./shopStatus");
    const { EMPTY_SHOP_PROGRESS } = await import("./shopProgress");
    expect(activeProgressionModel()).toBe(LEGACY_PROGRESSION);
    expect(SHOP_COPY_ACTIVE).toBe(false);
    expect(shopCopy("レシピ発見", "メニュー開発")).toBe("レシピ発見");
    expect(SHOP_MODEL_ACTIVE).toBe(false);
    expect(shopReputationStatus(EMPTY_SHOP_PROGRESS)).toBeNull();
  });

  it("a Preview build (not DEV) honours the URL / Preview key but not the DEV key", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_PREVIEW_MODE", "1");
    window.localStorage.setItem(DEV_KEY, "shop");
    expect(await idFor("")).toBe("legacy");
    expect(await idFor("?progression=shop")).toBe("shop");
    expect(await idFor("")).toBe("shop");
    expect(await idFor("?progression=legacy&progression=shop")).toBe("legacy");
    expect(await idFor("")).toBe("legacy");
  });
});

describe("Preview instruction parsing", () => {
  it("parses only shop / legacy", () => {
    expect(parseProgressionParam("?progression=shop")).toBe("shop");
    expect(parseProgressionParam("?progression=legacy")).toBe("legacy");
    expect(parseProgressionParam("?progression=")).toBeNull();
    expect(parseProgressionParam("?progression=SHOP")).toBeNull();
    expect(parseProgressionParam(undefined)).toBeNull();
    expect(parseProgressionParam("?progression=legacy&progression=shop")).toBe("legacy");
    expect(parseProgressionParam("?progression=shop&progression=legacy")).toBe("shop");
    expect(parseProgressionParam("?progression=unknown&progression=legacy")).toBeNull();
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
