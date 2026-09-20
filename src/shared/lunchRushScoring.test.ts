import { describe, expect, it } from "vitest";
import {
  calculateLunchRushMissionScore,
  isValidLunchRushServeRecord,
  LUNCH_RUSH_RULESET_DURATION_SECONDS,
  LUNCH_RUSH_RULESET_VERSION,
  MAX_SERVES_PER_RUN,
  type LunchRushServeRecord,
} from "./lunchRushScoring";

function pass(qualityTotal: number, recipeId = "margherita"): LunchRushServeRecord {
  return { recipeId, qualityTotal, completionStatus: "PASS" };
}

function failed(recipeId = "margherita"): LunchRushServeRecord {
  return { recipeId, qualityTotal: 0, completionStatus: "FAILED" };
}

describe("LUNCH_RUSH_RULESET_VERSION / DURATION", () => {
  it("is the expected v1 identity and duration", () => {
    expect(LUNCH_RUSH_RULESET_VERSION).toBe("lunch-rush-v1");
    expect(LUNCH_RUSH_RULESET_DURATION_SECONDS).toBe(180);
  });
});

describe("calculateLunchRushMissionScore", () => {
  // A. 0 serves
  it("0 serves -> all zero", () => {
    expect(calculateLunchRushMissionScore([])).toEqual({
      servedCount: 0,
      totalQualityScore: 0,
      bestQualityScore: 0,
      score: 0,
    });
  });

  // B. 1 PASS
  it("1 PASS serve", () => {
    expect(calculateLunchRushMissionScore([pass(80)])).toEqual({
      servedCount: 1,
      totalQualityScore: 80,
      bestQualityScore: 80,
      score: 180, // 1*100 + 80
    });
  });

  // C. multiple PASS
  it("multiple PASS serves accumulate and track the best", () => {
    const result = calculateLunchRushMissionScore([pass(50), pass(90), pass(70)]);
    expect(result).toEqual({
      servedCount: 3,
      totalQualityScore: 210,
      bestQualityScore: 90,
      score: 510, // 3*100 + 210
    });
  });

  // D. FAILED excluded
  it("a lone FAILED serve contributes nothing", () => {
    expect(calculateLunchRushMissionScore([failed()])).toEqual({
      servedCount: 0,
      totalQualityScore: 0,
      bestQualityScore: 0,
      score: 0,
    });
  });

  // E. mixed PASS/FAILED
  it("mixed PASS/FAILED: only PASS entries count, in any order", () => {
    const result = calculateLunchRushMissionScore([pass(60), failed(), pass(40), failed()]);
    expect(result).toEqual({
      servedCount: 2,
      totalQualityScore: 100,
      bestQualityScore: 60,
      score: 300, // 2*100 + 100
    });
  });

  // F. quality 0
  it("a PASS serve with quality 0 still counts as served", () => {
    expect(calculateLunchRushMissionScore([pass(0)])).toEqual({
      servedCount: 1,
      totalQualityScore: 0,
      bestQualityScore: 0,
      score: 100,
    });
  });

  // G. quality max
  it("a PASS serve at max quality (100)", () => {
    expect(calculateLunchRushMissionScore([pass(100)])).toEqual({
      servedCount: 1,
      totalQualityScore: 100,
      bestQualityScore: 100,
      score: 200,
    });
  });

  // H. deterministic result
  it("is deterministic: the same input always yields the same output", () => {
    const serves = [pass(33), failed(), pass(77)];
    const a = calculateLunchRushMissionScore(serves);
    const b = calculateLunchRushMissionScore(serves);
    expect(a).toEqual(b);
  });

  // I. client/server same calculation -- this module IS the shared authority, so calling it
  // twice (simulating "client-side preview" and "server-side recompute") on the same serves
  // log is exactly the property that must hold.
  it("client-preview and server-recompute calls agree on the same serves log", () => {
    const serves = [pass(45), pass(88), failed(), pass(12)];
    const clientPreview = calculateLunchRushMissionScore(serves);
    const serverRecompute = calculateLunchRushMissionScore([...serves]);
    expect(clientPreview).toEqual(serverRecompute);
  });

  it("rounds the final score to an integer, matching missionScoring.ts's own rounding", () => {
    // totalQualityScore itself is always an integer (ScoreBreakdown.total is), but the formula
    // itself (servedCount * 100 + totalQualityScore) is still wrapped in Math.round for parity.
    const result = calculateLunchRushMissionScore([pass(33), pass(34)]);
    expect(Number.isInteger(result.score)).toBe(true);
  });
});

describe("isValidLunchRushServeRecord", () => {
  it("accepts a valid PASS record", () => {
    expect(isValidLunchRushServeRecord(pass(50))).toBe(true);
  });

  it("accepts a valid FAILED record", () => {
    expect(isValidLunchRushServeRecord(failed())).toBe(true);
  });

  it("rejects null/undefined/non-object", () => {
    expect(isValidLunchRushServeRecord(null)).toBe(false);
    expect(isValidLunchRushServeRecord(undefined)).toBe(false);
    expect(isValidLunchRushServeRecord("pass")).toBe(false);
    expect(isValidLunchRushServeRecord(42)).toBe(false);
  });

  it("rejects a missing/empty recipeId", () => {
    expect(isValidLunchRushServeRecord({ qualityTotal: 50, completionStatus: "PASS" })).toBe(false);
    expect(isValidLunchRushServeRecord({ recipeId: "", qualityTotal: 50, completionStatus: "PASS" })).toBe(
      false,
    );
  });

  it("rejects a non-numeric/NaN/Infinity qualityTotal", () => {
    expect(
      isValidLunchRushServeRecord({ recipeId: "margherita", qualityTotal: "50", completionStatus: "PASS" }),
    ).toBe(false);
    expect(
      isValidLunchRushServeRecord({ recipeId: "margherita", qualityTotal: NaN, completionStatus: "PASS" }),
    ).toBe(false);
    expect(
      isValidLunchRushServeRecord({
        recipeId: "margherita",
        qualityTotal: Infinity,
        completionStatus: "PASS",
      }),
    ).toBe(false);
  });

  it("rejects a negative qualityTotal", () => {
    expect(isValidLunchRushServeRecord(pass(-1))).toBe(false);
  });

  it("rejects a qualityTotal above 100 (impossible quality)", () => {
    expect(isValidLunchRushServeRecord(pass(101))).toBe(false);
    expect(isValidLunchRushServeRecord(pass(999999))).toBe(false);
  });

  it("accepts the boundary values 0 and 100", () => {
    expect(isValidLunchRushServeRecord(pass(0))).toBe(true);
    expect(isValidLunchRushServeRecord(pass(100))).toBe(true);
  });

  it("rejects an unknown completionStatus", () => {
    expect(
      isValidLunchRushServeRecord({ recipeId: "margherita", qualityTotal: 50, completionStatus: "MAYBE" }),
    ).toBe(false);
  });
});

describe("MAX_SERVES_PER_RUN", () => {
  it("is derived from the ruleset duration and stays a sane, positive bound", () => {
    expect(MAX_SERVES_PER_RUN).toBeGreaterThan(0);
    expect(MAX_SERVES_PER_RUN).toBeLessThan(200);
  });
});
