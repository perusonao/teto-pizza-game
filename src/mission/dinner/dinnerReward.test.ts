import { describe, expect, it } from "vitest";
import {
  DINNER_CLEAR_TIERS,
  DINNER_PHASE1_REWARD_TABLE_ID,
  DINNER_REWARD_TABLES,
  dinnerClearTier,
  getDinnerRewardTable,
  quoteDinnerReward,
  validateDinnerRewardTable,
  type DinnerRewardTable,
} from "./dinnerReward";

/** Test-only numbers: the real ones are DM-5's to decide. */
const TUNED: DinnerRewardTable = {
  tableId: "test",
  thresholds: { goldMaxClearMs: 100_000, silverMaxClearMs: 150_000, bronzeMaxClearMs: 200_000 },
  pitz: {
    firstClear: { clear: 50, tierBonus: { GOLD: 30, SILVER: 20, BRONZE: 10 } },
    repeatClear: { clear: 5, tierBonus: { GOLD: 3, SILVER: 2, BRONZE: 1 } },
  },
};

describe("Phase 1 reward table (OD-DM-9: shape only)", () => {
  it("ships one untuned table: no thresholds, no Pitz", () => {
    expect(DINNER_REWARD_TABLES).toEqual([{ tableId: DINNER_PHASE1_REWARD_TABLE_ID, thresholds: null, pitz: null }]);
    expect(DINNER_REWARD_TABLES.flatMap(validateDinnerRewardTable)).toEqual([]);
  });

  it("an untuned quote names the clear but pays nothing and has no tier", () => {
    const table = getDinnerRewardTable(DINNER_PHASE1_REWARD_TABLE_ID)!;
    expect(quoteDinnerReward({ kind: "CLEAR", clearMs: 1 }, table, { isFirstClear: true })).toEqual({
      kind: "CLEAR",
      clearMs: 1,
      tier: null,
      pitz: null,
    });
  });

  it("a FAILED run is always worth 0", () => {
    expect(quoteDinnerReward({ kind: "FAILED" }, TUNED, { isFirstClear: true })).toEqual({ kind: "FAILED", pitz: 0 });
  });

  it("the tier is its own GOLD/SILVER/BRONZE concept, never a star count (OD-DM-10)", () => {
    expect(DINNER_CLEAR_TIERS).toEqual(["GOLD", "SILVER", "BRONZE"]);
    for (const tier of DINNER_CLEAR_TIERS) expect(typeof tier).toBe("string");
  });
});

describe("tier boundaries (inclusive upper bounds)", () => {
  const t = TUNED.thresholds;
  it.each([
    [0, "GOLD"],
    [100_000, "GOLD"],
    [100_001, "SILVER"],
    [150_000, "SILVER"],
    [150_001, "BRONZE"],
    [200_000, "BRONZE"],
    [200_001, null],
  ] as const)("%i ms -> %s", (ms, tier) => {
    expect(dinnerClearTier(ms, t)).toBe(tier);
  });

  it("invalid times and untuned thresholds give no tier", () => {
    expect(dinnerClearTier(Number.NaN, t)).toBeNull();
    expect(dinnerClearTier(-1, t)).toBeNull();
    expect(dinnerClearTier(1, null)).toBeNull();
  });
});

describe("quoteDinnerReward with test amounts", () => {
  it("first clear vs repeat clear use separate schedules", () => {
    expect(quoteDinnerReward({ kind: "CLEAR", clearMs: 90_000 }, TUNED, { isFirstClear: true })).toMatchObject({
      tier: "GOLD",
      pitz: { clear: 50, tierBonus: 30, total: 80 },
    });
    expect(quoteDinnerReward({ kind: "CLEAR", clearMs: 90_000 }, TUNED, { isFirstClear: false })).toMatchObject({
      tier: "GOLD",
      pitz: { clear: 5, tierBonus: 3, total: 8 },
    });
  });

  it("a clear slower than BRONZE pays the clear base only", () => {
    expect(quoteDinnerReward({ kind: "CLEAR", clearMs: 250_000 }, TUNED, { isFirstClear: true })).toMatchObject({
      tier: null,
      pitz: { clear: 50, tierBonus: 0, total: 50 },
    });
  });

  it("validation catches unordered thresholds and bad amounts", () => {
    expect(
      validateDinnerRewardTable({ ...TUNED, thresholds: { goldMaxClearMs: 3, silverMaxClearMs: 2, bronzeMaxClearMs: 1 } }),
    ).toContain("test: thresholds must satisfy gold <= silver <= bronze");
    expect(
      validateDinnerRewardTable({
        ...TUNED,
        pitz: { firstClear: { clear: -1, tierBonus: { GOLD: 0, SILVER: 0, BRONZE: 0 } }, repeatClear: TUNED.pitz!.repeatClear },
      }),
    ).toContain("test: Pitz amounts must be non-negative integers");
    expect(validateDinnerRewardTable(TUNED)).toEqual([]);
  });
});
