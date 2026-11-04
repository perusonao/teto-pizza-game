import { afterEach, describe, expect, it } from "vitest";
import {
  FRY_OFF_VALUE,
  FRY_ON_VALUE,
  FRY_OPT_IN_STORAGE_KEY,
  FRY_PARAM,
  FRY_TIME_PARAM,
  FRY_VARIANT_PARAM,
  fryPreviewOptedIn,
  fryTimeScaleOverride,
  fryVariantChoice,
  resetFryPreviewForTest,
  resolveFryOptIn,
  resolveFryOptInSticky,
  resolveFryTimeScale,
  resolveFryVariant,
} from "./fryPreview";
import { FRY_EXPERIENCE_PRODUCTION, fryExperienceEnabled } from "../data/fryExperienceGate";

describe("?cookFry=on", () => {
  it("the names are what the Owner types (a rename here must be deliberate)", () => {
    expect([FRY_PARAM, FRY_ON_VALUE, FRY_OFF_VALUE, FRY_VARIANT_PARAM, FRY_TIME_PARAM]).toEqual(["cookFry", "on", "off", "cookFryVariant", "cookFryTime"]);
  });
  it("on only for exactly one cookFry=on", () => {
    expect(resolveFryOptIn("?cookFry=on")).toBe(true);
    expect(resolveFryOptIn("?x=1&cookFry=on")).toBe(true);
    for (const q of ["", "?cookFry=off", "?cookFry=1", "?cookFry=on&cookFry=on", "?cookFry=ON", "?cookSteam=on", "?cookSear=on", "?cookPrep=on", "?cookFryVariant=tap"]) expect(resolveFryOptIn(q)).toBe(false);
    for (const junk of [undefined, null, 42, {}]) expect(resolveFryOptIn(junk)).toBe(false);
  });
  it("is independent of the other opt-ins, and they of it", () => {
    expect(resolveFryOptIn("?cookSteam=on&cookSear=on&cookPrep=on")).toBe(false);
  });
});

describe("per-tab memory", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { m, storage: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } };
  };
  it("on remembers, a later query-less load still counts, off forgets", () => {
    const { m, storage } = memory();
    expect(resolveFryOptInSticky("", storage)).toBe(false);
    expect(resolveFryOptInSticky("?cookFry=on", storage)).toBe(true);
    expect(m.get(FRY_OPT_IN_STORAGE_KEY)).toBe("1");
    expect(resolveFryOptInSticky("", storage)).toBe(true);
    expect(resolveFryOptInSticky("?cookFry=off", storage)).toBe(false);
    expect(m.has(FRY_OPT_IN_STORAGE_KEY)).toBe(false);
  });
  it("a repeated value neither remembers nor forgets", () => {
    const { m, storage } = memory();
    m.set(FRY_OPT_IN_STORAGE_KEY, "1");
    expect(resolveFryOptInSticky("?cookFry=on&cookFry=off", storage)).toBe(true);
    expect(m.get(FRY_OPT_IN_STORAGE_KEY)).toBe("1");
  });
  it("storage that throws, or none, falls back to the query alone; the key is its own", () => {
    const boom = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
    expect(resolveFryOptInSticky("?cookFry=on", boom)).toBe(true);
    expect(resolveFryOptInSticky("", boom)).toBe(false);
    expect(resolveFryOptInSticky("?cookFry=on", null)).toBe(true);
    expect(FRY_OPT_IN_STORAGE_KEY).toBe("teto:cookFry");
  });
});

describe("?cookFryVariant= / ?cookFryTime=", () => {
  it("tap / drag narrow it; anything else is both", () => {
    expect(resolveFryVariant("?cookFryVariant=tap")).toBe("tap");
    expect(resolveFryVariant("?cookFryVariant=drag")).toBe("drag");
    for (const q of ["", "?cookFryVariant=both", "?cookFryVariant=TAP", "?cookFryVariant=tap&cookFryVariant=drag", "?cookFryVariant="]) expect(resolveFryVariant(q)).toBe("both");
    expect(resolveFryVariant(undefined)).toBe("both");
  });
  it("short / standard / long map to the scales; anything else is the default (null)", () => {
    expect(resolveFryTimeScale("?cookFryTime=short")).toBe(0.75);
    expect(resolveFryTimeScale("?cookFryTime=standard")).toBe(1);
    expect(resolveFryTimeScale("?cookFryTime=long")).toBe(1.35);
    for (const q of ["", "?cookFryTime=", "?cookFryTime=LONG", "?cookFryTime=toString", "?cookFryTime=constructor", "?cookFryTime=short&cookFryTime=long", "?cookFryTime=1"]) expect(resolveFryTimeScale(q)).toBeNull();
    expect(resolveFryTimeScale(undefined)).toBeNull();
  });
});

describe("the gate", () => {
  afterEach(() => resetFryPreviewForTest());
  it("production is fixed OFF", () => {
    expect(FRY_EXPERIENCE_PRODUCTION).toBe(false);
  });
  it("without the query nothing is on or overridden (the test environment is a DEV build, so the readers are live)", () => {
    resetFryPreviewForTest();
    expect(fryPreviewOptedIn()).toBe(false);
    expect(fryExperienceEnabled()).toBe(false);
    expect(fryVariantChoice()).toBe("both");
    expect(fryTimeScaleOverride()).toBeNull();
  });
});
