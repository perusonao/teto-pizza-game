import { describe, expect, it } from "vitest";
import { computeLunchRushPeriodIds, isoWeekId, jstWeekRange, weeklyPeriodId } from "./lunchRushPeriodIds";
import { LUNCH_RUSH_RULESET_VERSION_V1, LUNCH_RUSH_RULESET_VERSION_V2 } from "./lunchRushScoring";

/**
 * Phase 2A (Issue #87). `isoWeekId`/`monthId`/`computeLunchRushPeriodIds` themselves stay
 * covered by functions/src/periodIds.test.ts (unchanged after this module's move -- see
 * functions/src/periodIds.ts's own header) since this file's implementation is identical to
 * what that test already exercises; this file only adds coverage for `jstWeekRange`, the one
 * function Phase 2A itself introduced.
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function jstMidnight(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) - JST_OFFSET_MS;
}

describe("jstWeekRange", () => {
  it("returns the Monday-Sunday JST calendar range for a mid-week Thursday", () => {
    // 2026-09-17 (JST) is a Thursday in ISO week 2026-W38 (Mon 9/14 - Sun 9/20).
    expect(jstWeekRange(jstMidnight(2026, 9, 17))).toEqual({
      monday: { year: 2026, month: 9, day: 14 },
      sunday: { year: 2026, month: 9, day: 20 },
    });
  });

  it("a JST Sunday belongs to the week ending that same day", () => {
    expect(jstWeekRange(jstMidnight(2026, 9, 20))).toEqual({
      monday: { year: 2026, month: 9, day: 14 },
      sunday: { year: 2026, month: 9, day: 20 },
    });
  });

  it("a JST Monday belongs to the week starting that same day", () => {
    expect(jstWeekRange(jstMidnight(2026, 9, 14))).toEqual({
      monday: { year: 2026, month: 9, day: 14 },
      sunday: { year: 2026, month: 9, day: 20 },
    });
  });

  it("a week spanning a month boundary reports the correct month on each end", () => {
    // 2025-12-29 (JST, Monday) starts ISO week 2026-W01, ending 2026-01-04.
    expect(jstWeekRange(jstMidnight(2025, 12, 30))).toEqual({
      monday: { year: 2025, month: 12, day: 29 },
      sunday: { year: 2026, month: 1, day: 4 },
    });
  });
});

describe("Lunch Rush v2 period ids (client-side parity with the server's derivation)", () => {
  it("the period-id ruleset literals equal the scoring module's ruleset constants", () => {
    // typed as the period module's union: this is a compile-time + runtime pin
    const v1: Parameters<typeof weeklyPeriodId>[1] = LUNCH_RUSH_RULESET_VERSION_V1;
    const v2: Parameters<typeof weeklyPeriodId>[1] = LUNCH_RUSH_RULESET_VERSION_V2;
    expect(weeklyPeriodId(0, v1)).toBe(`weekly_${isoWeekId(0)}`);
    expect(weeklyPeriodId(0, v2)).toBe(`weekly_v2_${isoWeekId(0)}`);
  });

  it("the production reader's current derivation (`weekly_${isoWeekId(now)}`) is exactly the v1 id", () => {
    for (const ts of [0, jstMidnight(2026, 9, 17), jstMidnight(2026, 12, 31), jstMidnight(2027, 1, 1)]) {
      expect(`weekly_${isoWeekId(ts)}`).toBe(weeklyPeriodId(ts));
      expect(`weekly_${isoWeekId(ts)}`).toBe(computeLunchRushPeriodIds(ts, "lunch-rush-v1").weekly);
    }
  });

  it("the v2 weekly id is never the v1 id and matches the read rule's ^weekly_ prefix", () => {
    const ts = jstMidnight(2026, 9, 17);
    expect(weeklyPeriodId(ts, "lunch-rush-v2")).toBe("weekly_v2_2026-W38");
    expect(weeklyPeriodId(ts, "lunch-rush-v2")).not.toBe(weeklyPeriodId(ts, "lunch-rush-v1"));
    expect(/^weekly_.*/.test(weeklyPeriodId(ts, "lunch-rush-v2"))).toBe(true);
  });
});
