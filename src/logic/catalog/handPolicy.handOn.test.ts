import { describe, expect, it } from "vitest";
import { DEFAULT_HAND_CAPACITY_CANDIDATE, HAND_ENFORCEMENT_ENABLED, HAND_PREVIEW_VARIANT, handCapacityFor, isHandCapacityCandidate } from "./handPolicy";

/**
 * LC-R5-e-h (H-2): the hand-on projects (`vitest.config.ts`) compile the REAL `handPolicy.ts` with the flag on and one
 * capacity candidate. This file proves the transform actually applied (otherwise every *.handOn test would silently be
 * a flag-off run) and that the real `handCapacityFor` -- never mocked here -- enforces the candidate.
 */
const POLICY_SOURCE = import.meta.glob<string>("./handPolicy.ts", { query: "?raw", import: "default", eager: true })["./handPolicy.ts"];
const HAND_ON_TESTS = import.meta.glob<string>(["../../**/*.handOn.test.ts", "../../**/*.handOn.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("hand-on project: the real handPolicy is compiled ON (no vi.mock)", () => {
  it("the flag is on and the capacity is one of the supported capacities (12 = OD-5 production, 9 = coverage parameter)", () => {
    expect(HAND_ENFORCEMENT_ENABLED).toBe(true);
    expect(isHandCapacityCandidate(DEFAULT_HAND_CAPACITY_CANDIDATE)).toBe(true);
    expect([9, 12]).toContain(DEFAULT_HAND_CAPACITY_CANDIDATE);
  });

  it("the real handCapacityFor enforces the candidate whatever the owned count", () => {
    for (const owned of [0, 3, 9, 10, 12, 13, 22]) {
      expect(handCapacityFor(owned, DEFAULT_HAND_CAPACITY_CANDIDATE)).toBe(DEFAULT_HAND_CAPACITY_CANDIDATE);
    }
  });

  it("the shipped source is ON since LC-R6-e (these projects compile the same flag value; they pin the capacity)", () => {
    expect(POLICY_SOURCE).toMatch(/^export const HAND_ENFORCEMENT_PRODUCTION = true;$/m);
  });

  it("the Preview variant is not what turned it on: no variant is in effect in these projects", () => {
    expect(HAND_PREVIEW_VARIANT).toBeNull();
  });

  it("no *.handOn test mocks the hand policy (the flag and capacity function are never mocked together)", () => {
    const files = Object.entries(HAND_ON_TESTS);
    expect(files.length).toBeGreaterThanOrEqual(1); // the importing file itself is excluded by Vite
    for (const [file, text] of files) {
      expect(text, file).not.toMatch(/vi\.(?:do)?[mM]ock\(\s*["'][^"']*handPolicy/);
    }
  });
});
