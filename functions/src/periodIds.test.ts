import { describe, expect, it } from "vitest";
import {
  ALL_TIME_PERIOD_ID,
  ALL_TIME_PERIOD_ID_V2,
  computeLunchRushPeriodIds,
  isoWeekId,
  monthId,
  weeklyPeriodId,
} from "./periodIds";
import { LUNCH_RUSH_RULESET_VERSION_V1, LUNCH_RUSH_RULESET_VERSION_V2 } from "../../src/shared/lunchRushScoring";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** JST-midnight epoch ms for a given JST calendar date. */
function jstMidnight(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) - JST_OFFSET_MS;
}

describe("isoWeekId", () => {
  it("2026-01-01 (JST, a Thursday) is ISO week 2026-W01", () => {
    expect(isoWeekId(jstMidnight(2026, 1, 1))).toBe("2026-W01");
  });

  it("2025-12-29 (JST, a Monday) already belongs to ISO year 2026's week 1", () => {
    expect(isoWeekId(jstMidnight(2025, 12, 29))).toBe("2026-W01");
  });

  it("2025-12-28 23:59:59 JST (a Sunday) is still 2025-W52 -- the prior ISO year/week", () => {
    expect(isoWeekId(jstMidnight(2025, 12, 29) - 1_000)).toBe("2025-W52");
  });

  it("2026-12-31 (JST, a Thursday) is ISO week 2026-W53 (a 53-week year)", () => {
    expect(isoWeekId(jstMidnight(2026, 12, 31))).toBe("2026-W53");
  });

  it("2027-01-01 (JST, a Friday) still belongs to 2026-W53, not the new calendar year", () => {
    expect(isoWeekId(jstMidnight(2027, 1, 1))).toBe("2026-W53");
  });

  it("bucket boundary: 23:59:58 JST Sunday and 00:00:02 JST Monday fall in different weeks", () => {
    const sundayLate = jstMidnight(2026, 9, 13) + 23 * 3_600_000 + 59 * 60_000 + 58_000;
    const mondayEarly = jstMidnight(2026, 9, 14) + 2_000;
    expect(isoWeekId(sundayLate)).toBe("2026-W37");
    expect(isoWeekId(mondayEarly)).toBe("2026-W38");
  });

  it("is a pure function of epochMs: the same input always yields the same output", () => {
    const t = jstMidnight(2026, 9, 20);
    expect(isoWeekId(t)).toBe(isoWeekId(t));
  });
});

describe("monthId", () => {
  it("formats as YYYY-MM in JST", () => {
    expect(monthId(jstMidnight(2026, 9, 20))).toBe("2026-09");
  });

  it("a JST month boundary (23:59:59 vs 00:00:00) belongs to different months", () => {
    expect(monthId(jstMidnight(2025, 12, 29) - 1_000)).toBe("2025-12");
    expect(monthId(jstMidnight(2025, 12, 29))).toBe("2025-12");
    expect(monthId(jstMidnight(2026, 1, 1))).toBe("2026-01");
  });
});

describe("computeLunchRushPeriodIds", () => {
  it("derives all three period ids from the same server-clock timestamp", () => {
    const result = computeLunchRushPeriodIds(jstMidnight(2026, 9, 20));
    expect(result).toEqual({
      weekly: "weekly_2026-W38",
      monthly: "monthly_2026-09",
      allTime: "all_all",
    });
  });

  it("allTime is always the same constant regardless of timestamp", () => {
    expect(computeLunchRushPeriodIds(0).allTime).toBe(ALL_TIME_PERIOD_ID);
    expect(computeLunchRushPeriodIds(Date.now()).allTime).toBe(ALL_TIME_PERIOD_ID);
  });
});

describe("computeLunchRushPeriodIds -- ruleset separation (Lunch Rush v2)", () => {
  const t = jstMidnight(2026, 9, 20);

  it("the ruleset literals used here are pinned to the scoring module's constants", () => {
    expect(LUNCH_RUSH_RULESET_VERSION_V1).toBe("lunch-rush-v1");
    expect(LUNCH_RUSH_RULESET_VERSION_V2).toBe("lunch-rush-v2");
  });

  it("v1 ids are byte-identical to the pre-v2 ids, explicit or defaulted", () => {
    const expected = { weekly: "weekly_2026-W38", monthly: "monthly_2026-09", allTime: "all_all" };
    expect(computeLunchRushPeriodIds(t)).toEqual(expected);
    expect(computeLunchRushPeriodIds(t, "lunch-rush-v1")).toEqual(expected);
  });

  it("v2 ids are distinct, v2-prefixed, and keep the weekly_ prefix the read rule matches", () => {
    const v2 = computeLunchRushPeriodIds(t, "lunch-rush-v2");
    expect(v2).toEqual({ weekly: "weekly_v2_2026-W38", monthly: "monthly_v2_2026-09", allTime: "all_v2" });
    expect(v2.weekly.startsWith("weekly_")).toBe(true);
    expect(/^weekly_.*/.test(v2.weekly)).toBe(true);
  });

  it("no v2 id equals any v1 id, for any timestamp", () => {
    for (const ts of [0, t, jstMidnight(2026, 12, 31), jstMidnight(2027, 1, 1), Date.UTC(2030, 5, 5)]) {
      const v1 = computeLunchRushPeriodIds(ts, "lunch-rush-v1");
      const v2 = computeLunchRushPeriodIds(ts, "lunch-rush-v2");
      const v1Ids = new Set(Object.values(v1));
      for (const id of Object.values(v2)) expect(v1Ids.has(id)).toBe(false);
    }
  });

  it("v2 allTime is its own constant, not v1's all_all", () => {
    expect(ALL_TIME_PERIOD_ID_V2).toBe("all_v2");
    expect(ALL_TIME_PERIOD_ID_V2).not.toBe(ALL_TIME_PERIOD_ID);
    expect(computeLunchRushPeriodIds(0, "lunch-rush-v2").allTime).toBe(ALL_TIME_PERIOD_ID_V2);
  });

  it("weeklyPeriodId is the single weekly derivation (and matches computeLunchRushPeriodIds)", () => {
    expect(weeklyPeriodId(t)).toBe("weekly_2026-W38");
    expect(weeklyPeriodId(t, "lunch-rush-v1")).toBe(computeLunchRushPeriodIds(t).weekly);
    expect(weeklyPeriodId(t, "lunch-rush-v2")).toBe(computeLunchRushPeriodIds(t, "lunch-rush-v2").weekly);
  });
});
