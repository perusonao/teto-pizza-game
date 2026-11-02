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
