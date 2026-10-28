import { describe, expect, it } from "vitest";
import { PREP_ON_VALUE, PREP_PARAM, resolvePrepOptIn } from "./prepPreview";

describe("resolvePrepOptIn", () => {
  it("is on only for exactly one ?cookPrep=on", () => {
    expect(PREP_PARAM).toBe("cookPrep");
    expect(PREP_ON_VALUE).toBe("on");
    expect(resolvePrepOptIn("?cookPrep=on")).toBe(true);
    expect(resolvePrepOptIn("?a=1&cookPrep=on")).toBe(true);
  });
  it("is off for anything else", () => {
    for (const q of ["", "?", "?cookPrep=off", "?cookPrep=", "?cookPrep=ON", "?cookPrep=on&cookPrep=on", "?cookPrep=on&cookPrep=off", "?prep=on", "?freeFinish=on"]) {
      expect(resolvePrepOptIn(q), q).toBe(false);
    }
    expect(resolvePrepOptIn(undefined)).toBe(false);
    expect(resolvePrepOptIn(null)).toBe(false);
    expect(resolvePrepOptIn(1)).toBe(false);
  });
});
