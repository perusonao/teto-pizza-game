import { describe, expect, it } from "vitest";
import { RECIPES, type Recipe } from "../data/recipes";
import { calculatePitzReward } from "./pitzReward";
import {
  calculateEfficiencyBonus,
  efficiencyThresholdsForRecipe,
  efficiencyTierForCookingTime,
  evaluateCookingEfficiency,
  formatCookingTime,
  totalRequiredItemCount,
  type EfficiencyTier,
} from "./efficiency";

/**
 * Cooking Time CT2: `src/logic/efficiency.ts` -- the "手際" tier + additive Pitz bonus module.
 * See docs/reports/TETO_COOKING-TIME_CT2_Efficiency-Result.md for the full design rationale
 * (recipe complexity treatment, threshold sizing, quality-first guard) this suite enforces.
 */

const margherita = RECIPES.find((r) => r.id === "margherita") as Recipe;
const bismarck = RECIPES.find((r) => r.id === "bismarck") as Recipe; // fewest required pieces (5)
const quattroFormaggi = RECIPES.find((r) => r.id === "quattro-formaggi") as Recipe; // most (9)

describe("totalRequiredItemCount", () => {
  it("sums every requirement's minCount", () => {
    expect(totalRequiredItemCount(margherita)).toBe(1 + 3 + 2); // tomato-sauce/mozzarella/basil
    expect(totalRequiredItemCount(bismarck)).toBe(5);
    expect(totalRequiredItemCount(quattroFormaggi)).toBe(9);
  });
});

describe("efficiencyThresholdsForRecipe: recipe complexity treatment (item 17 -- all 25 recipes)", () => {
  it("every shipped recipe gets valid, ordered, strictly-increasing thresholds", () => {
    expect(RECIPES.length).toBe(25);
    for (const recipe of RECIPES) {
      const thresholds = efficiencyThresholdsForRecipe(recipe as Recipe);
      expect(thresholds.comfortableMs).toBeGreaterThan(0);
      expect(thresholds.normalUpperMs).toBeGreaterThan(thresholds.comfortableMs);
    }
  });

  it("a higher-piece-count recipe never gets a shorter comfortable window than a lower one", () => {
    const bismarckThresholds = efficiencyThresholdsForRecipe(bismarck);
    const quattroThresholds = efficiencyThresholdsForRecipe(quattroFormaggi);
    expect(quattroThresholds.comfortableMs).toBeGreaterThan(bismarckThresholds.comfortableMs);
  });
});

describe("efficiencyTierForCookingTime: comfortable -> plateau -> taper, boundary values", () => {
  const thresholds = efficiencyThresholdsForRecipe(margherita); // comfortable=43000, normalUpper=78000

  it("exactly at comfortableMs is still GOOD (inclusive boundary)", () => {
    expect(efficiencyTierForCookingTime(thresholds.comfortableMs, thresholds)).toBe("GOOD");
  });

  it("one ms past comfortableMs is NORMAL", () => {
    expect(efficiencyTierForCookingTime(thresholds.comfortableMs + 1, thresholds)).toBe("NORMAL");
  });

  it("exactly at normalUpperMs is still NORMAL (inclusive boundary)", () => {
    expect(efficiencyTierForCookingTime(thresholds.normalUpperMs, thresholds)).toBe("NORMAL");
  });

  it("one ms past normalUpperMs is SLOW", () => {
    expect(efficiencyTierForCookingTime(thresholds.normalUpperMs + 1, thresholds)).toBe("SLOW");
  });

  it("an extremely long time is still just SLOW, not a worse/negative tier", () => {
    expect(efficiencyTierForCookingTime(10 * 60 * 60 * 1000, thresholds)).toBe("SLOW");
  });

  it("malformed input (negative/NaN) reads as SLOW rather than throwing or fabricating GOOD", () => {
    expect(efficiencyTierForCookingTime(-1, thresholds)).toBe("SLOW");
    expect(efficiencyTierForCookingTime(NaN, thresholds)).toBe("SLOW");
  });
});

describe("no 'faster is always better' -- GOOD is a flat ceiling, not a continuous race", () => {
  const thresholds = efficiencyThresholdsForRecipe(margherita);

  it("an extremely fast completion (near-zero ms) is the same GOOD tier as a merely-comfortable one", () => {
    expect(efficiencyTierForCookingTime(1, thresholds)).toBe("GOOD");
    expect(efficiencyTierForCookingTime(thresholds.comfortableMs, thresholds)).toBe("GOOD");
  });

  it("an extremely fast completion never earns a larger bonus than a merely-comfortable one at the same quality", () => {
    const fast = calculateEfficiencyBonus("GOOD", 95, 100);
    const comfortable = calculateEfficiencyBonus("GOOD", 95, 100);
    expect(fast.bonusPitz).toBe(comfortable.bonusPitz);
    expect(fast.bonusRate).toBeLessThanOrEqual(0.1); // never exceeds the documented 0-10% envelope
  });
});

describe("calculateEfficiencyBonus: quality-first guard", () => {
  it("score below 60 earns zero bonus regardless of tier", () => {
    (["GOOD", "NORMAL", "SLOW"] as EfficiencyTier[]).forEach((tier) => {
      expect(calculateEfficiencyBonus(tier, 59, 100).bonusPitz).toBe(0);
      expect(calculateEfficiencyBonus(tier, 0, 100).bonusPitz).toBe(0);
    });
  });

  it("SLOW never earns a bonus at any quality", () => {
    expect(calculateEfficiencyBonus("SLOW", 100, 100).bonusPitz).toBe(0);
  });

  it("high quality + GOOD efficiency earns a small additive bonus", () => {
    const bonus = calculateEfficiencyBonus("GOOD", 95, 100);
    expect(bonus.bonusPitz).toBeGreaterThan(0);
    expect(bonus.bonusPitz).toBeLessThanOrEqual(10); // <= 10% of baseRewardPitz=100
  });

  it("high quality (75-89 band) + NORMAL efficiency keeps the quality reward unchanged (bonus 0)", () => {
    const bonus = calculateEfficiencyBonus("NORMAL", 80, 100);
    expect(bonus.bonusPitz).toBe(0);
  });

  it("malformed scoreTotal/baseRewardPitz clamp to a safe zero bonus rather than propagating", () => {
    expect(calculateEfficiencyBonus("GOOD", NaN, 100).bonusPitz).toBe(0);
    expect(calculateEfficiencyBonus("GOOD", 95, -50).bonusPitz).toBe(0);
    expect(calculateEfficiencyBonus("GOOD", 95, NaN).bonusPitz).toBe(0);
  });
});

describe("低品質高速 < 高品質通常 (a low-quality, very fast pizza never out-earns a high-quality, normal-pace one)", () => {
  it("total reward (quality credit + efficiency bonus) is strictly less for low-quality-fast", () => {
    const lowQualityFast = calculatePitzReward(100, 65).earnedPitz + calculateEfficiencyBonus("GOOD", 65, 100).bonusPitz;
    const highQualityNormal = calculatePitzReward(100, 80).earnedPitz + calculateEfficiencyBonus("NORMAL", 80, 100).bonusPitz;
    expect(lowQualityFast).toBeLessThan(highQualityNormal);
  });

  it("holds even at the most favorable low-quality edge (score 74, GOOD) vs. the least favorable high-quality edge (score 75, SLOW)", () => {
    const bestLowQualityFast = calculatePitzReward(100, 74).earnedPitz + calculateEfficiencyBonus("GOOD", 74, 100).bonusPitz;
    const worstHighQuality = calculatePitzReward(100, 75).earnedPitz + calculateEfficiencyBonus("SLOW", 75, 100).bonusPitz;
    expect(bestLowQualityFast).toBeLessThan(worstHighQuality);
  });

  it("a below-60-quality pizza can never beat an above-60-quality pizza, at any efficiency extreme", () => {
    const worstQualityBestEfficiency =
      calculatePitzReward(100, 59).earnedPitz + calculateEfficiencyBonus("GOOD", 59, 100).bonusPitz;
    const bestQualityWorstEfficiency =
      calculatePitzReward(100, 60).earnedPitz + calculateEfficiencyBonus("SLOW", 60, 100).bonusPitz;
    expect(worstQualityBestEfficiency).toBeLessThan(bestQualityWorstEfficiency);
  });
});

describe("evaluateCookingEfficiency: the one combined function REGISTER_TO_DEX calls", () => {
  it("combines tier + bonus from a recipe and completedMs in one call", () => {
    const thresholds = efficiencyThresholdsForRecipe(margherita);
    const credit = evaluateCookingEfficiency(margherita, thresholds.comfortableMs, 95, 100);
    expect(credit.tier).toBe("GOOD");
    expect(credit.bonusPitz).toBeGreaterThan(0);
    expect(credit.cookingTimeMs).toBe(thresholds.comfortableMs);
  });

  it("clamps a negative cookingTimeMs to 0 for display rather than propagating it", () => {
    const credit = evaluateCookingEfficiency(margherita, -5, 95, 100);
    expect(credit.cookingTimeMs).toBe(0);
  });
});

describe("formatCookingTime", () => {
  it("formats sub-minute durations as 0:ss", () => {
    expect(formatCookingTime(42_000)).toBe("0:42");
    expect(formatCookingTime(0)).toBe("0:00");
    expect(formatCookingTime(5_000)).toBe("0:05");
  });

  it("formats minute-plus durations as m:ss", () => {
    expect(formatCookingTime(90_000)).toBe("1:30");
    expect(formatCookingTime(600_000)).toBe("10:00");
  });

  it("floors partial seconds rather than rounding up", () => {
    expect(formatCookingTime(42_999)).toBe("0:42");
  });

  it("treats malformed input (negative/NaN) as 0:00", () => {
    expect(formatCookingTime(-100)).toBe("0:00");
    expect(formatCookingTime(NaN)).toBe("0:00");
  });

  // Gameplay UX PR-C (Timing Transparency §12): exact boundary values around the 1s/60s marks,
  // since this exact function is now also reused for the RESULT Timing Detail per-step rows.
  it("floors the sub-second boundary just below 1s to 0:00", () => {
    expect(formatCookingTime(999)).toBe("0:00");
  });

  it("rounds 1000ms exactly to 0:01", () => {
    expect(formatCookingTime(1000)).toBe("0:01");
  });

  it("floors the sub-minute boundary just below 60s to 0:59", () => {
    expect(formatCookingTime(59_999)).toBe("0:59");
  });

  it("rolls 60000ms exactly over to 1:00", () => {
    expect(formatCookingTime(60_000)).toBe("1:00");
  });

  it("formats a long duration (10+ minutes) without truncating the minute digits", () => {
    expect(formatCookingTime(3_723_000)).toBe("62:03");
  });
});
