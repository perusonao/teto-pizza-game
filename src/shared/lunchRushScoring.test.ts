import { describe, expect, it } from "vitest";
import {
  calculateLunchRushMissionScore,
  calculateLunchRushMissionScoreForRuleset,
  calculateLunchRushMissionScoreV2,
  isValidLunchRushServeRecord,
  isValidLunchRushServeRecordForRuleset,
  isValidLunchRushServeRecordV2,
  LUNCH_RUSH_RULESET_DURATION_SECONDS,
  LUNCH_RUSH_RULESET_VERSION,
  LUNCH_RUSH_RULESET_VERSION_V1,
  LUNCH_RUSH_RULESET_VERSION_V2,
  LUNCH_RUSH_V2_ACCURACY_FACTORS,
  lunchRushV2AccuracyFactor,
  MAX_SERVES_PER_RUN,
  parseLunchRushRulesetVersion,
  type LunchRushServeRecord,
  type LunchRushServeRecordV2,
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

// ---------------------------------------------------------------------------------------------
// Lunch Rush v2 (PR-A: shared authority only; no client submits v2 yet)
// ---------------------------------------------------------------------------------------------

function passV2(qualityTotal: number, wrongIngredientTypes: number, recipeId = "margherita"): LunchRushServeRecordV2 {
  return { recipeId, qualityTotal, completionStatus: "PASS", wrongIngredientTypes };
}

function failedV2(wrongIngredientTypes = 0): LunchRushServeRecordV2 {
  return { recipeId: "margherita", qualityTotal: 0, completionStatus: "FAILED", wrongIngredientTypes };
}

describe("ruleset identity", () => {
  it("v1 is unchanged and v2 is lunch-rush-v2", () => {
    expect(LUNCH_RUSH_RULESET_VERSION).toBe("lunch-rush-v1");
    expect(LUNCH_RUSH_RULESET_VERSION_V1).toBe("lunch-rush-v1");
    expect(LUNCH_RUSH_RULESET_VERSION_V2).toBe("lunch-rush-v2");
  });

  it("parseLunchRushRulesetVersion accepts exactly the two known ids", () => {
    expect(parseLunchRushRulesetVersion("lunch-rush-v1")).toBe("lunch-rush-v1");
    expect(parseLunchRushRulesetVersion("lunch-rush-v2")).toBe("lunch-rush-v2");
    for (const bad of ["lunch-rush-v0", "lunch-rush-v3", "LUNCH-RUSH-V2", "lunch-rush-v2 ", "", undefined, null, 2, {}, []]) {
      expect(parseLunchRushRulesetVersion(bad)).toBeNull();
    }
  });
});

describe("v2 accuracy factor table", () => {
  it("is the fixed table [1, 0.8, 0.64] (no Math.pow)", () => {
    expect([...LUNCH_RUSH_V2_ACCURACY_FACTORS]).toEqual([1, 0.8, 0.64]);
    expect(Object.isFrozen(LUNCH_RUSH_V2_ACCURACY_FACTORS)).toBe(true);
  });

  it("maps w=0/1/2 to 1.00/0.80/0.64", () => {
    expect(lunchRushV2AccuracyFactor(0)).toBe(1);
    expect(lunchRushV2AccuracyFactor(1)).toBe(0.8);
    expect(lunchRushV2AccuracyFactor(2)).toBe(0.64);
  });

  it("has no factor for w >= 3 (a FAILED pizza) or an invalid count", () => {
    for (const bad of [3, 4, 64, -1, 0.5, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "1", null, undefined]) {
      expect(lunchRushV2AccuracyFactor(bad)).toBeNull();
    }
  });
});

describe("isValidLunchRushServeRecordV2", () => {
  it("accepts PASS with w = 0, 1, 2", () => {
    for (const w of [0, 1, 2]) expect(isValidLunchRushServeRecordV2(passV2(70, w))).toBe(true);
  });

  it("rejects PASS with w >= 3 (that pizza is FAILED under v2)", () => {
    expect(isValidLunchRushServeRecordV2(passV2(70, 3))).toBe(false);
    expect(isValidLunchRushServeRecordV2(passV2(70, 10))).toBe(false);
  });

  it("accepts FAILED with any recorded w in range, including w >= 3", () => {
    expect(isValidLunchRushServeRecordV2(failedV2(0))).toBe(true);
    expect(isValidLunchRushServeRecordV2(failedV2(3))).toBe(true);
    expect(isValidLunchRushServeRecordV2(failedV2(64))).toBe(true);
    expect(isValidLunchRushServeRecordV2(failedV2(65))).toBe(false);
  });

  it("requires wrongIngredientTypes to be present and a non-negative integer", () => {
    expect(isValidLunchRushServeRecordV2(pass(70))).toBe(false);
    for (const bad of [-1, 0.5, Number.NaN, "0", null, undefined]) {
      expect(isValidLunchRushServeRecordV2({ ...passV2(70, 0), wrongIngredientTypes: bad })).toBe(false);
    }
  });

  it("still applies every v1 check (quality range, status, recipeId)", () => {
    expect(isValidLunchRushServeRecordV2(passV2(101, 0))).toBe(false);
    expect(isValidLunchRushServeRecordV2(passV2(-1, 0))).toBe(false);
    expect(isValidLunchRushServeRecordV2({ ...passV2(50, 0), completionStatus: "MAYBE" })).toBe(false);
    expect(isValidLunchRushServeRecordV2({ ...passV2(50, 0), recipeId: "" })).toBe(false);
  });

  it("v1 validation is unchanged: it neither requires nor rejects the new field", () => {
    expect(isValidLunchRushServeRecord(pass(70))).toBe(true);
    expect(isValidLunchRushServeRecord(passV2(70, 1))).toBe(true);
  });
});

describe("calculateLunchRushMissionScoreV2", () => {
  it("0 serves -> all zero", () => {
    expect(calculateLunchRushMissionScoreV2([])).toEqual({
      servedCount: 0,
      totalQualityScore: 0,
      bestQualityScore: 0,
      score: 0,
    });
  });

  it("servedValue = (100 + q) * factor, summed, then rounded", () => {
    expect(calculateLunchRushMissionScoreV2([passV2(100, 0)]).score).toBe(200);
    expect(calculateLunchRushMissionScoreV2([passV2(100, 1)]).score).toBe(160);
    expect(calculateLunchRushMissionScoreV2([passV2(100, 2)]).score).toBe(128);
    expect(calculateLunchRushMissionScoreV2([passV2(50, 1)]).score).toBe(120);
    expect(calculateLunchRushMissionScoreV2([passV2(0, 2)]).score).toBe(64);
  });

  it("rounds the run total once (not each serve)", () => {
    // (100+33.3)*0.8 = 106.64 ; (100+41.1)*0.64 = 90.304 ; sum 196.944 -> 197
    const result = calculateLunchRushMissionScoreV2([passV2(33.3, 1), passV2(41.1, 2)]);
    expect(result.score).toBe(197);
    expect(Number.isInteger(result.score)).toBe(true);
  });

  it("FAILED entries contribute nothing, whatever their wrongIngredientTypes", () => {
    const result = calculateLunchRushMissionScoreV2([passV2(80, 0), failedV2(0), failedV2(3)]);
    expect(result).toEqual({ servedCount: 1, totalQualityScore: 80, bestQualityScore: 80, score: 180 });
  });

  it("totalQualityScore / bestQualityScore stay raw (un-factored), as in v1", () => {
    const result = calculateLunchRushMissionScoreV2([passV2(90, 2), passV2(60, 0)]);
    expect(result.totalQualityScore).toBe(150);
    expect(result.bestQualityScore).toBe(90);
    expect(result.servedCount).toBe(2);
  });

  it("perfect play beats one wrong, which beats two wrong (same quality)", () => {
    const [w0, w1, w2] = [0, 1, 2].map((w) => calculateLunchRushMissionScoreV2([passV2(85, w)]).score);
    expect(w0).toBeGreaterThan(w1);
    expect(w1).toBeGreaterThan(w2);
    expect(w2).toBeGreaterThan(0);
  });

  it("is deterministic and order-independent for the same multiset of serves", () => {
    const serves = [passV2(71.25, 1), passV2(88.5, 0), passV2(63, 2)];
    const forward = calculateLunchRushMissionScoreV2(serves);
    const reversed = calculateLunchRushMissionScoreV2([...serves].reverse());
    expect(forward.score).toBe(reversed.score);
    expect(calculateLunchRushMissionScoreV2(serves)).toEqual(forward);
  });

  it("golden vector (pinned so the browser and the Cloud Function can never drift apart)", () => {
    const serves = [passV2(92.5, 0), passV2(78.25, 1), passV2(66.125, 2), failedV2(3), passV2(100, 0)];
    // 192.5 + 178.25*0.8 (=142.6) + 166.125*0.64 (=106.32) + 200 = 641.42
    expect(calculateLunchRushMissionScoreV2(serves)).toEqual({
      servedCount: 4,
      totalQualityScore: 92.5 + 78.25 + 66.125 + 100,
      bestQualityScore: 100,
      score: 641,
    });
  });
});

describe("per-ruleset dispatch", () => {
  const v1Serves = [pass(80), pass(60), failed()];

  it("v1 dispatch is exactly calculateLunchRushMissionScore (unchanged)", () => {
    expect(calculateLunchRushMissionScoreForRuleset("lunch-rush-v1", v1Serves)).toEqual(
      calculateLunchRushMissionScore(v1Serves),
    );
    expect(calculateLunchRushMissionScoreForRuleset("lunch-rush-v1", v1Serves).score).toBe(2 * 100 + 140);
  });

  it("v2 dispatch is calculateLunchRushMissionScoreV2", () => {
    const serves = [passV2(80, 1), passV2(60, 0)];
    expect(calculateLunchRushMissionScoreForRuleset("lunch-rush-v2", serves)).toEqual(
      calculateLunchRushMissionScoreV2(serves),
    );
  });

  it("the same serve log scores differently under v1 and v2 (the rulesets are not interchangeable)", () => {
    const serves = [passV2(100, 2)];
    expect(calculateLunchRushMissionScoreForRuleset("lunch-rush-v1", serves).score).toBe(200);
    expect(calculateLunchRushMissionScoreForRuleset("lunch-rush-v2", serves).score).toBe(128);
  });

  it("validator dispatch: a v1-shaped record is valid for v1 but not for v2", () => {
    expect(isValidLunchRushServeRecordForRuleset("lunch-rush-v1", pass(70))).toBe(true);
    expect(isValidLunchRushServeRecordForRuleset("lunch-rush-v2", pass(70))).toBe(false);
    expect(isValidLunchRushServeRecordForRuleset("lunch-rush-v2", passV2(70, 1))).toBe(true);
  });
});
