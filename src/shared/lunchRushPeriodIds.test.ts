import { describe, expect, it } from "vitest";
import { jstWeekRange } from "./lunchRushPeriodIds";

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
