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
