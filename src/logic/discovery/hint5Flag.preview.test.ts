import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Discovery Hint 5.0 H5-5 / H5-6: how the production default and the Preview URL instruction combine in
 * `HINT5_LADDER_ENABLED` (vitest is a DEV build, so the Preview path is live). The flag is a module constant,
 * so every case imports a fresh copy. The production default is ON (H5-6); `?hint5=0` is a Preview / DEV kill
 * switch. The DEV key (`teto.dev.hint5Ladder`) is an opt-OUT only: "0" turns the ladder off, "1" does nothing.
 */

const DEV_KEY = "teto.dev.hint5Ladder";
const PREVIEW_KEY = "teto-pizza-preview-hint5-optin";

async function flagFor(search: string): Promise<boolean> {
  window.history.replaceState({}, "", `/${search}`);
  vi.resetModules();
  return (await import("./hint5Flag")).HINT5_LADDER_ENABLED;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.resetModules();
});

describe("HINT5_LADDER_ENABLED: production default x Preview instruction", () => {
  it("nothing set: ON (the production default, H5-6)", async () => {
    expect(await flagFor("")).toBe(true);
  });

  it("the DEV key is an opt-out only: \"0\" turns the ladder off, \"1\" (the old opt-in) and anything else change nothing", async () => {
    window.localStorage.setItem(DEV_KEY, "0");
    expect(await flagFor("")).toBe(false);
    window.localStorage.setItem(DEV_KEY, "1");
    expect(await flagFor("")).toBe(true);
    window.localStorage.setItem(DEV_KEY, "off");
    expect(await flagFor("")).toBe(true);
  });

  it("?hint5=1 turns the ladder on even with the DEV opt-out set", async () => {
    window.localStorage.setItem(DEV_KEY, "0");
    expect(await flagFor("?hint5=1")).toBe(true);
  });

  it("?hint5=1: on, and remembered in the Preview key", async () => {
    expect(await flagFor("?hint5=1")).toBe(true);
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBe("1");
    expect(await flagFor("")).toBe(true);
  });

  it("?hint5=0 (Preview / DEV kill switch): off, stored as an explicit off, and it stays off after a reload without the parameter", async () => {
    expect(await flagFor("?hint5=0")).toBe(false);
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBe("0");
    expect(await flagFor("")).toBe(false); // the parameter is gone from the URL: still off
    expect(await flagFor("?hv=normal")).toBe(false);
  });

  it("?hint5=1 after an explicit off returns to on, and stays on after a reload", async () => {
    expect(await flagFor("?hint5=0")).toBe(false);
    expect(await flagFor("?hint5=1")).toBe(true);
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBe("1");
    expect(await flagFor("")).toBe(true);
  });

  it("a stored Preview off wins over nothing but is separate from the production save key", async () => {
    window.localStorage.setItem("teto-pizza-save-v1", "PRODUCTION-SAVE");
    expect(await flagFor("?hint5=0")).toBe(false);
    expect(window.localStorage.getItem("teto-pizza-save-v1")).toBe("PRODUCTION-SAVE");
    expect(PREVIEW_KEY).not.toBe("teto-pizza-save-v1");
  });

  it("an unrelated parameter changes nothing", async () => {
    expect(await flagFor("?hv=normal")).toBe(true);
  });
});
