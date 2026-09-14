import { describe, expect, it } from "vitest";
import {
  EMPTY_MISSION_METRICS,
  averageQualityScore,
  isNewMissionBest,
  missionScore,
  recordServe,
} from "./missionScoring";

describe("recordServe", () => {
  it("starts every metric at 0", () => {
    expect(EMPTY_MISSION_METRICS).toEqual({
      servedCount: 0,
      totalQualityScore: 0,
      bestQualityScore: 0,
    });
  });

  it("increments servedCount and accumulates totalQualityScore per serve", () => {
    let metrics = EMPTY_MISSION_METRICS;
    metrics = recordServe(metrics, 80);
    metrics = recordServe(metrics, 92);
    expect(metrics.servedCount).toBe(2);
    expect(metrics.totalQualityScore).toBe(172);
  });

  it("tracks the highest single quality total as bestQualityScore", () => {
    let metrics = EMPTY_MISSION_METRICS;
    metrics = recordServe(metrics, 60);
    metrics = recordServe(metrics, 94);
    metrics = recordServe(metrics, 71);
    expect(metrics.bestQualityScore).toBe(94);
  });

  it("never lets a lower-scoring serve pull bestQualityScore back down", () => {
    let metrics = recordServe(EMPTY_MISSION_METRICS, 88);
    metrics = recordServe(metrics, 40);
    expect(metrics.bestQualityScore).toBe(88);
  });

  it("does not mutate the metrics object passed in", () => {
    const before = recordServe(EMPTY_MISSION_METRICS, 50);
    const beforeCopy = { ...before };
    recordServe(before, 90);
    expect(before).toEqual(beforeCopy);
  });
});

describe("averageQualityScore", () => {
  it("is 0 when nothing has been served yet (no NaN)", () => {
    expect(averageQualityScore(EMPTY_MISSION_METRICS)).toBe(0);
  });

  it("is the mean of every served quality total", () => {
    let metrics = recordServe(EMPTY_MISSION_METRICS, 70);
    metrics = recordServe(metrics, 90);
    expect(averageQualityScore(metrics)).toBe(80);
  });
});

describe("missionScore", () => {
  it("is 0 for an empty run", () => {
    expect(missionScore(EMPTY_MISSION_METRICS)).toBe(0);
  });

  it("matches the SSOT formula: servedCount * 100 + totalQualityScore", () => {
    let metrics = recordServe(EMPTY_MISSION_METRICS, 92);
    metrics = recordServe(metrics, 85);
    metrics = recordServe(metrics, 78);
    metrics = recordServe(metrics, 87);
    // 4 served, quality total 342 -> 4*100 + 342 = 742 (matches the SSOT's own worked example)
    expect(metrics.servedCount).toBe(4);
    expect(metrics.totalQualityScore).toBe(342);
    expect(missionScore(metrics)).toBe(742);
  });

  it("rounds to the nearest whole point", () => {
    let metrics = recordServe(EMPTY_MISSION_METRICS, 70.4);
    metrics = recordServe(metrics, 70.4);
    // servedCount*100 (200) + 140.8 = 340.8 -> rounds to 341
    expect(missionScore(metrics)).toBe(341);
  });

  it("is distinct from a single pizza's own quality total -- serving more pizzas can beat a single higher-quality pizza", () => {
    const oneGreatPizza = recordServe(EMPTY_MISSION_METRICS, 99);
    const threeGoodPizzas = recordServe(
      recordServe(recordServe(EMPTY_MISSION_METRICS, 60), 60),
      60,
    );
    expect(missionScore(threeGoodPizzas)).toBeGreaterThan(missionScore(oneGreatPizza));
  });
});

describe("isNewMissionBest", () => {
  it("is true only when the candidate strictly beats the current best", () => {
    expect(isNewMissionBest(742, 700)).toBe(true);
    expect(isNewMissionBest(700, 742)).toBe(false);
    expect(isNewMissionBest(700, 700)).toBe(false);
  });

  it("treats 0 as a valid current best (fresh player, never played before)", () => {
    expect(isNewMissionBest(1, 0)).toBe(true);
    expect(isNewMissionBest(0, 0)).toBe(false);
  });
});
