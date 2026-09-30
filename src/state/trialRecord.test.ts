import { describe, expect, it, vi } from "vitest";
import { createTrialNotebook, notebookSize } from "../logic/discovery/trialNotebook";
import * as fingerprint from "../logic/discovery/attemptFingerprint";
import { cook, freeRound, ORDINARY } from "./testSupport/trialNotebookFlow";
import { isTrialRecordEligible, recordTrialAttempt } from "./trialRecord";

vi.mock("../logic/discovery/attemptFingerprint", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../logic/discovery/attemptFingerprint")>();
  return { ...actual, attemptFingerprintOfPizza: vi.fn(actual.attemptFingerprintOfPizza) };
});

const original = { kind: "ORIGINAL", blockedTargetIds: [] } as const;

describe("record adapter: fail closed", () => {
  const input = () => ({ ...cook(freeRound(), ORDINARY), trialNotebook: createTrialNotebook() });

  it.each([
    ["a malformed fingerprint", "not-a-fingerprint"],
    ["an unsupported fingerprint version", 'fp2:[["tomato-sauce"],["tomato-sauce"]]'],
    ["a non-string fingerprint", 42],
  ])("%s stores nothing, returns the same notebook and says nothing", (_label, value) => {
    vi.mocked(fingerprint.attemptFingerprintOfPizza).mockReturnValueOnce(value as never);
    const i = input();
    const out = recordTrialAttempt(i, original);
    expect(out.trialNotebook).toBe(i.trialNotebook);
    expect(out.lastTrialAttempt).toBeNull();
    expect(notebookSize(out.trialNotebook).identities).toBe(0);
  });

  it("uses the P1 fingerprint of the pizza (mock sees the exact pizza)", () => {
    const i = input();
    recordTrialAttempt(i, original);
    expect(fingerprint.attemptFingerprintOfPizza).toHaveBeenLastCalledWith(i.pizza);
  });
});

describe("isTrialRecordEligible (OD-P3-16)", () => {
  it("is true for ORIGINAL and AMBIGUOUS only", () => {
    expect(isTrialRecordEligible(original)).toBe(true);
    expect(isTrialRecordEligible({ kind: "AMBIGUOUS", targetIds: [] })).toBe(true);
    for (const kind of ["INCOMPLETE_MATCH", "NEW_DISCOVERY", "ALREADY_DISCOVERED"] as const) {
      expect(isTrialRecordEligible({ kind, recipeId: "funghi", targetId: "t" } as never), kind).toBe(false);
    }
  });
});
