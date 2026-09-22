import { describe, expect, it } from "vitest";
import { deriveMissionResultStats } from "./missionResultStats";
import type { LunchRushServeRecord } from "../shared/lunchRushScoring";

function serve(status: "PASS" | "FAILED", qualityTotal = 80): LunchRushServeRecord {
  return { recipeId: "margherita", qualityTotal, completionStatus: status };
}

describe("deriveMissionResultStats", () => {
  it("0 outcomes -> all zero, 0% success rate (never NaN)", () => {
    expect(deriveMissionResultStats([])).toEqual({
      attempts: 0,
      successes: 0,
      failures: 0,
      successRatePercent: 0,
    });
  });

  it("1 PASS -> 100%", () => {
    expect(deriveMissionResultStats([serve("PASS")])).toEqual({
      attempts: 1,
      successes: 1,
      failures: 0,
      successRatePercent: 100,
    });
  });

  it("1 FAILED -> 0%", () => {
    expect(deriveMissionResultStats([serve("FAILED")])).toEqual({
      attempts: 1,
      successes: 0,
      failures: 1,
      successRatePercent: 0,
    });
  });

  it("2 PASS + 1 FAILED -> 67% (rounds up from 66.67)", () => {
    expect(deriveMissionResultStats([serve("PASS"), serve("PASS"), serve("FAILED")])).toEqual({
      attempts: 3,
      successes: 2,
      failures: 1,
      successRatePercent: 67,
    });
  });

  it("1 PASS + 2 FAILED -> 33% (rounds down from 33.33)", () => {
    expect(deriveMissionResultStats([serve("PASS"), serve("FAILED"), serve("FAILED")])).toEqual({
      attempts: 3,
      successes: 1,
      failures: 2,
      successRatePercent: 33,
    });
  });

  it("all PASS -> 100%", () => {
    const serves = [serve("PASS"), serve("PASS"), serve("PASS")];
    expect(deriveMissionResultStats(serves)).toEqual({
      attempts: 3,
      successes: 3,
      failures: 0,
      successRatePercent: 100,
    });
  });

  it("all FAILED -> 0%", () => {
    const serves = [serve("FAILED"), serve("FAILED")];
    expect(deriveMissionResultStats(serves)).toEqual({
      attempts: 2,
      successes: 0,
      failures: 2,
      successRatePercent: 0,
    });
  });

  it("qualityTotal is irrelevant to this derivation -- only completionStatus matters", () => {
    const stats = deriveMissionResultStats([serve("PASS", 0), serve("PASS", 100)]);
    expect(stats.successes).toBe(2);
  });
});
