import { describe, expect, it } from "vitest";
import { resolveSearOptIn, SEAR_ON_VALUE, SEAR_PARAM } from "./searPreview";

describe("?cookSear=on", () => {
  it("the names are what the Owner types (a rename here must be deliberate)", () => {
    expect(SEAR_PARAM).toBe("cookSear");
    expect(SEAR_ON_VALUE).toBe("on");
  });
  it("on only for exactly one cookSear=on", () => {
    expect(resolveSearOptIn("?cookSear=on")).toBe(true);
    for (const q of ["", "?cookSear=off", "?cookSear=1", "?cookSear=on&cookSear=on", "?cookPrep=on", "?cookSear=ON"]) expect(resolveSearOptIn(q)).toBe(false);
    expect(resolveSearOptIn(undefined)).toBe(false);
    expect(resolveSearOptIn(42)).toBe(false);
  });
});

import { resolveSearFullMs, SEAR_MS_CHOICES, SEAR_MS_PARAM } from "./searPreview";

describe("?cookSearMs= (the 2 / 3 / 4 second comparison)", () => {
  it("the names and the three choices are what the Owner types", () => {
    expect(SEAR_MS_PARAM).toBe("cookSearMs");
    expect(SEAR_MS_CHOICES).toEqual([2000, 3000, 4000]);
  });
  it("only exactly one of the three values counts; anything else is the default (null)", () => {
    expect(resolveSearFullMs("?cookSear=on&cookSearMs=2000")).toBe(2000);
    expect(resolveSearFullMs("?cookSearMs=3000")).toBe(3000);
    expect(resolveSearFullMs("?cookSearMs=4000")).toBe(4000);
    for (const q of ["", "?cookSearMs=1000", "?cookSearMs=2500", "?cookSearMs=02000", "?cookSearMs=2000&cookSearMs=3000", "?cookSearMs=abc", "?cookSearMs="]) expect(resolveSearFullMs(q)).toBeNull();
    expect(resolveSearFullMs(undefined)).toBeNull();
  });
});

import { resolveSearOptInSticky, SEAR_OPT_IN_STORAGE_KEY } from "./searPreview";

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe("the opt-in survives a load without the query (iPhone HV #724: the pill never appeared)", () => {
  it("?cookSear=on is remembered for the tab; a later load without the query stays on", () => {
    const s = memory();
    expect(resolveSearOptInSticky("", s)).toBe(false);
    expect(resolveSearOptInSticky("?cookSear=on", s)).toBe(true);
    expect(resolveSearOptInSticky("", s)).toBe(true);
    expect(resolveSearOptInSticky("?cookPrep=on", s)).toBe(true);
  });
  it("?cookSear=off forgets it; nothing else turns it on", () => {
    const s = memory();
    resolveSearOptInSticky("?cookSear=on", s);
    expect(resolveSearOptInSticky("?cookSear=off", s)).toBe(false);
    expect(resolveSearOptInSticky("", s)).toBe(false);
    for (const q of ["?cookSear=1", "?cookSear=ON", "?cookSear=on&cookSear=on"]) expect(resolveSearOptInSticky(q, memory())).toBe(false);
    expect(s.getItem(SEAR_OPT_IN_STORAGE_KEY)).toBeNull();
  });
  it("a storage that throws or is absent falls back to the query alone", () => {
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
    expect(resolveSearOptInSticky("?cookSear=on", broken)).toBe(true);
    expect(resolveSearOptInSticky("", broken)).toBe(false);
    expect(resolveSearOptInSticky("?cookSear=on", null)).toBe(true);
    expect(resolveSearOptInSticky("", null)).toBe(false);
  });
});
