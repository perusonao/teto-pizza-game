import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Discovery Hint 5.0 H5-5: how the DEV opt-in and the Preview URL instruction combine in
 * `HINT5_LADDER_ENABLED` (vitest is a DEV build, so both paths are live). The flag is a module constant, so
 * every case imports a fresh copy. An explicit `?hint5=0` must win over the DEV key (a review finding on the
 * first version, where the DEV key short-circuited the URL).
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

describe("HINT5_LADDER_ENABLED: DEV key x Preview instruction", () => {
  it("nothing set: off", async () => {
    expect(await flagFor("")).toBe(false);
  });

  it("the DEV key alone: on (as before H5-5)", async () => {
    window.localStorage.setItem(DEV_KEY, "1");
    expect(await flagFor("")).toBe(true);
    expect(window.localStorage.getItem(DEV_KEY)).toBe("1");
  });

  it("?hint5=1: on, and remembered in the Preview key", async () => {
    expect(await flagFor("?hint5=1")).toBe(true);
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBe("1");
    expect(await flagFor("")).toBe(true);
  });

  it("?hint5=0 with the DEV key set: off, and both keys are cleared (the review finding)", async () => {
    window.localStorage.setItem(DEV_KEY, "1");
    window.localStorage.setItem(PREVIEW_KEY, "1");
    expect(await flagFor("?hint5=0")).toBe(false);
    expect(window.localStorage.getItem(DEV_KEY)).toBeNull();
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBeNull();
    // ...so it stays off on the next load without the parameter.
    expect(await flagFor("")).toBe(false);
  });

  it("?hint5=0 with only the Preview key set: off and cleared", async () => {
    window.localStorage.setItem(PREVIEW_KEY, "1");
    expect(await flagFor("?hint5=0")).toBe(false);
    expect(window.localStorage.getItem(PREVIEW_KEY)).toBeNull();
  });

  it("?hint5=1 with the DEV key set: on", async () => {
    window.localStorage.setItem(DEV_KEY, "1");
    expect(await flagFor("?hint5=1")).toBe(true);
  });

  it("an unrelated parameter changes nothing", async () => {
    expect(await flagFor("?hv=normal")).toBe(false);
    window.localStorage.setItem(DEV_KEY, "1");
    expect(await flagFor("?hv=normal")).toBe(true);
  });
});
