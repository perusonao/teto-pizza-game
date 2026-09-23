import { describe, expect, it } from "vitest";
import {
  applyPitzCredit,
  calculatePitzReward,
  PITZ_FIRST_DISCOVERY_BONUS,
  PITZ_QUALITY_FLOOR,
  qualityMultiplierForScore,
} from "./pitzReward";

describe("qualityMultiplierForScore -- V1 band boundaries", () => {
  it.each([
    [0, 0],
    [39, 0],
    [40, 0.5],
    [59, 0.5],
    [60, 0.8],
    [74, 0.8],
    [75, 1.0],
    [89, 1.0],
    [90, 1.2],
    [100, 1.2],
  ])("total=%s -> multiplier=%s", (total, expected) => {
    expect(qualityMultiplierForScore(total)).toBe(expected);
  });
});

describe("calculatePitzReward -- V1 formula (recipeBaseReward x qualityMultiplier)", () => {
  it.each([
    [39, 20], // OD-02 floor: raw 100*0=0, floored to PITZ_QUALITY_FLOOR
    [40, 50],
    [59, 50],
    [60, 80],
    [74, 80],
    [75, 100],
    [89, 100],
    [90, 120],
    [100, 120],
  ])("baseReward=100, total=%s -> earnedPitz=%s", (total, expectedEarned) => {
    const result = calculatePitzReward(100, total);
    expect(result.earnedPitz).toBe(expectedEarned);
    expect(result.baseReward).toBe(100);
  });

  it("is deterministic -- same input always produces the same output", () => {
    const a = calculatePitzReward(100, 82);
    const b = calculatePitzReward(100, 82);
    expect(a).toEqual(b);
  });

  it("OD-02: the 0-39 band still floors to PITZ_QUALITY_FLOOR (20) whenever baseRewardPitz is valid, never exactly 0", () => {
    expect(calculatePitzReward(500, 0).earnedPitz).toBe(PITZ_QUALITY_FLOOR);
    expect(calculatePitzReward(500, 39).earnedPitz).toBe(PITZ_QUALITY_FLOOR);
  });

  it("OD-02: the floor never applies when baseRewardPitz itself is invalid (no real recipe reward to floor)", () => {
    expect(calculatePitzReward(0, 0).earnedPitz).toBe(0);
    expect(calculatePitzReward(-100, 0).earnedPitz).toBe(0);
    expect(calculatePitzReward(NaN, 0).earnedPitz).toBe(0);
  });

  it("OD-02: discoveryBonusPitz is PITZ_FIRST_DISCOVERY_BONUS only when wasNewDiscovery is true and baseRewardPitz is valid", () => {
    expect(calculatePitzReward(100, 82).discoveryBonusPitz).toBe(0);
    expect(calculatePitzReward(100, 82, false).discoveryBonusPitz).toBe(0);
    expect(calculatePitzReward(100, 82, true).discoveryBonusPitz).toBe(PITZ_FIRST_DISCOVERY_BONUS);
    expect(calculatePitzReward(0, 82, true).discoveryBonusPitz).toBe(0);
  });

  it("rounds a non-integer product per Math.round, pinned at a .5 boundary", () => {
    // 65 * 0.5 = 32.5 -> Math.round rounds .5 up to 33 (not floor/ceil/bankers rounding).
    expect(calculatePitzReward(65, 40).earnedPitz).toBe(33);
    // 75 * 0.8 = 60 exactly -- sanity check for a clean non-.5 product too.
    expect(calculatePitzReward(75, 60).earnedPitz).toBe(60);
  });

  it("clamps a negative/NaN/non-finite baseRewardPitz to 0 rather than propagating it", () => {
    expect(calculatePitzReward(-100, 100).baseReward).toBe(0);
    expect(calculatePitzReward(-100, 100).earnedPitz).toBe(0);
    expect(calculatePitzReward(NaN, 100).baseReward).toBe(0);
    expect(calculatePitzReward(Infinity, 100).baseReward).toBe(0);
    expect(calculatePitzReward(0, 100).baseReward).toBe(0);
  });

  it("clamps an out-of-range/malformed scoreTotal to the safe (0) band", () => {
    expect(calculatePitzReward(100, -50).multiplier).toBe(0);
    expect(calculatePitzReward(100, NaN).multiplier).toBe(0);
    expect(calculatePitzReward(100, Infinity).multiplier).toBe(0); // non-finite is never trusted
    expect(calculatePitzReward(100, -Infinity).multiplier).toBe(0);
  });

  it("earnedPitz is never negative", () => {
    expect(calculatePitzReward(-1, -1).earnedPitz).toBeGreaterThanOrEqual(0);
  });
});

describe("applyPitzCredit -- before/after balance snapshot", () => {
  it("credits the balance by exactly earnedPitz", () => {
    const credit = applyPitzCredit(100, 96, 50);
    expect(credit.baseReward).toBe(100);
    expect(credit.multiplier).toBe(1.2);
    expect(credit.earnedPitz).toBe(120);
    expect(credit.balanceBefore).toBe(50);
    expect(credit.balanceAfter).toBe(170);
  });

  it("OD-02: the floor still applies inside applyPitzCredit -- a low-quality credit is never 0", () => {
    const credit = applyPitzCredit(100, 20, 30);
    expect(credit.earnedPitz).toBe(PITZ_QUALITY_FLOOR);
    expect(credit.balanceBefore).toBe(30);
    expect(credit.balanceAfter).toBe(50);
  });

  it("OD-02: wasNewDiscovery folds the first-discovery bonus into balanceAfter", () => {
    const credit = applyPitzCredit(100, 96, 50, true);
    expect(credit.earnedPitz).toBe(120);
    expect(credit.discoveryBonusPitz).toBe(PITZ_FIRST_DISCOVERY_BONUS);
    expect(credit.balanceBefore).toBe(50);
    expect(credit.balanceAfter).toBe(50 + 120 + PITZ_FIRST_DISCOVERY_BONUS);
  });

  it("clamps a malformed starting balance to 0", () => {
    expect(applyPitzCredit(100, 100, -5).balanceBefore).toBe(0);
    expect(applyPitzCredit(100, 100, NaN).balanceBefore).toBe(0);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const a = applyPitzCredit(100, 82, 10);
    const b = applyPitzCredit(100, 82, 10);
    expect(a).toEqual(b);
  });
});
