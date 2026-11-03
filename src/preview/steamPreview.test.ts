import { afterEach, describe, expect, it } from "vitest";
import {
  resetSteamPreviewForTest,
  resolveSteamFullMs,
  resolveSteamOptIn,
  resolveSteamOptInSticky,
  resolveSteamVariant,
  STEAM_MS_CHOICES,
  STEAM_MS_PARAM,
  STEAM_OFF_VALUE,
  STEAM_ON_VALUE,
  STEAM_OPT_IN_STORAGE_KEY,
  STEAM_PARAM,
  STEAM_VARIANT_PARAM,
  steamFullMsOverride,
  steamPreviewOptedIn,
  steamVariantChoice,
} from "./steamPreview";
import { STEAM_EXPERIENCE_PRODUCTION, steamExperienceEnabled } from "../data/steamExperienceGate";

describe("?cookSteam=on", () => {
  it("the names are what the Owner types (a rename here must be deliberate)", () => {
    expect(STEAM_PARAM).toBe("cookSteam");
    expect(STEAM_ON_VALUE).toBe("on");
    expect(STEAM_OFF_VALUE).toBe("off");
    expect(STEAM_VARIANT_PARAM).toBe("cookSteamVariant");
    expect(STEAM_MS_PARAM).toBe("cookSteamMs");
  });
  it("on only for exactly one cookSteam=on", () => {
    expect(resolveSteamOptIn("?cookSteam=on")).toBe(true);
    expect(resolveSteamOptIn("?x=1&cookSteam=on")).toBe(true);
    for (const q of ["", "?cookSteam=off", "?cookSteam=1", "?cookSteam=on&cookSteam=on", "?cookSteam=ON", "?cookSear=on", "?cookPrep=on"]) expect(resolveSteamOptIn(q)).toBe(false);
    for (const junk of [undefined, null, 42, {}]) expect(resolveSteamOptIn(junk)).toBe(false);
  });
  it("is independent of the sear and prep opt-ins", () => {
    expect(resolveSteamOptIn("?cookSear=on&cookPrep=on")).toBe(false);
  });
});

describe("per-tab memory", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { m, storage: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } };
  };
  it("on remembers, a later query-less load still counts, off forgets", () => {
    const { m, storage } = memory();
    expect(resolveSteamOptInSticky("", storage)).toBe(false);
    expect(resolveSteamOptInSticky("?cookSteam=on", storage)).toBe(true);
    expect(m.get(STEAM_OPT_IN_STORAGE_KEY)).toBe("1");
    expect(resolveSteamOptInSticky("", storage)).toBe(true);
    expect(resolveSteamOptInSticky("?cookSteam=off", storage)).toBe(false);
    expect(m.has(STEAM_OPT_IN_STORAGE_KEY)).toBe(false);
    expect(resolveSteamOptInSticky("", storage)).toBe(false);
  });
  it("a repeated or odd value neither remembers nor forgets", () => {
    const { m, storage } = memory();
    m.set(STEAM_OPT_IN_STORAGE_KEY, "1");
    expect(resolveSteamOptInSticky("?cookSteam=on&cookSteam=off", storage)).toBe(true);
    expect(m.get(STEAM_OPT_IN_STORAGE_KEY)).toBe("1");
  });
  it("storage that throws, or none at all, falls back to the query alone", () => {
    const boom = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
    expect(resolveSteamOptInSticky("?cookSteam=on", boom)).toBe(true);
    expect(resolveSteamOptInSticky("", boom)).toBe(false);
    expect(resolveSteamOptInSticky("?cookSteam=on", null)).toBe(true);
    expect(resolveSteamOptInSticky("", null)).toBe(false);
  });
  it("does not share the sear / prep memory key", () => {
    expect(STEAM_OPT_IN_STORAGE_KEY).toBe("teto:cookSteam");
  });
});

describe("?cookSteamVariant=", () => {
  it("lid / shake narrow it; anything else (none, both, odd, repeated) is both", () => {
    expect(resolveSteamVariant("?cookSteamVariant=lid")).toBe("lid");
    expect(resolveSteamVariant("?cookSteamVariant=shake")).toBe("shake");
    for (const q of ["", "?cookSteamVariant=both", "?cookSteamVariant=LID", "?cookSteamVariant=lid&cookSteamVariant=shake", "?cookSteamVariant="]) expect(resolveSteamVariant(q)).toBe("both");
    expect(resolveSteamVariant(undefined)).toBe("both");
  });
});

describe("?cookSteamMs=", () => {
  it("only exactly one of the three values counts; anything else is the default (null)", () => {
    expect(STEAM_MS_CHOICES).toEqual([3000, 4500, 6000]);
    for (const n of STEAM_MS_CHOICES) expect(resolveSteamFullMs(`?cookSteamMs=${n}`)).toBe(n);
    for (const q of ["", "?cookSteamMs=1000", "?cookSteamMs=4500.0", "?cookSteamMs=04500", "?cookSteamMs=abc", "?cookSteamMs=3000&cookSteamMs=4500"]) expect(resolveSteamFullMs(q)).toBeNull();
    expect(resolveSteamFullMs(undefined)).toBeNull();
  });
});

describe("the gate", () => {
  afterEach(() => resetSteamPreviewForTest());
  it("production is fixed OFF", () => {
    expect(STEAM_EXPERIENCE_PRODUCTION).toBe(false);
  });
  it("without the query nothing is on or overridden (the test environment is a DEV build, so the readers are live)", () => {
    resetSteamPreviewForTest();
    expect(steamPreviewOptedIn()).toBe(false);
    expect(steamExperienceEnabled()).toBe(false);
    expect(steamVariantChoice()).toBe("both");
    expect(steamFullMsOverride()).toBeNull();
  });
});
