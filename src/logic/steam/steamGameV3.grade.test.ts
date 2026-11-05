import { describe, expect, it } from "vitest";
import { STEAM_V3_GOALS, STEAM_V3_GRADE_RANK, steamV3Grade, type SteamV3Batch, type SteamV3Grade } from "./steamGameV3";

/**
 * Steam Gameplay V3 grading rule, fixed BEFORE the V3 model / screen (docs/reports/TETO_STEAM-V3_DESIGN.md §2.1, revised):
 * the rescued count decides first, the time only separates 5/5 results. So no 5/5 can ever grade below any 4/5,
 * and for the same count a faster round never grades below a slower one.
 */
const rank = (g: SteamV3Grade) => STEAM_V3_GRADE_RANK[g];
const BATCHES: SteamV3Batch[] = ["clam", "mussel"];
const TIMES = [0, 1000, 3000, 4999, 5000, 5001, 5399, 5400, 5401, 6999, 7000, 7001, 7399, 7400, 7401, 9000, 20_000, 120_000];

describe("V3 grade: thresholds (ms, START to OPEN)", () => {
  it("goal times are the designed ones", () => {
    expect(STEAM_V3_GOALS).toEqual({ clam: { master: 5000, three: 7000 }, mussel: { master: 5400, three: 7400 } });
  });

  it.each([
    ["clam", 5, 5000, "master"], ["clam", 5, 5001, "three"], ["clam", 5, 7000, "three"], ["clam", 5, 7001, "two"],
    ["mussel", 5, 5400, "master"], ["mussel", 5, 5401, "three"], ["mussel", 5, 7400, "three"], ["mussel", 5, 7401, "two"],
    ["clam", 4, 1000, "one"], ["clam", 4, 60_000, "one"], ["clam", 2, 3000, "one"],
    ["clam", 1, 3000, "none"], ["mussel", 0, 3000, "none"],
  ] as const)("%s %i/5 in %i ms -> %s", (batch, rescuedCount, elapsedMs, expected) => {
    expect(steamV3Grade({ batch, rescuedCount, elapsedMs })).toBe(expected);
  });
});

describe("V3 grade: monotonic (5/5 is never below 4/5)", () => {
  it("every 5/5 outranks every 4/5, whatever the two times", () => {
    for (const batch of BATCHES)
      for (const t5 of TIMES)
        for (const t4 of TIMES)
          expect(rank(steamV3Grade({ batch, rescuedCount: 5, elapsedMs: t5 })), `${batch} 5/5@${t5} vs 4/5@${t4}`)
            .toBeGreaterThan(rank(steamV3Grade({ batch, rescuedCount: 4, elapsedMs: t4 })));
  });

  it("more rescued shells never grade lower at any time", () => {
    for (const batch of BATCHES)
      for (const t of TIMES)
        for (let n = 0; n < 5; n++)
          expect(rank(steamV3Grade({ batch, rescuedCount: n + 1, elapsedMs: t }))).toBeGreaterThanOrEqual(rank(steamV3Grade({ batch, rescuedCount: n, elapsedMs: t })));
  });

  it("for the same count, faster never grades lower", () => {
    for (const batch of BATCHES)
      for (let n = 0; n <= 5; n++)
        for (let i = 1; i < TIMES.length; i++)
          expect(rank(steamV3Grade({ batch, rescuedCount: n, elapsedMs: TIMES[i - 1] }))).toBeGreaterThanOrEqual(rank(steamV3Grade({ batch, rescuedCount: n, elapsedMs: TIMES[i] })));
  });

  it("the time only matters for 5/5: below five, the grade is the same at any time", () => {
    for (const batch of BATCHES)
      for (let n = 0; n < 5; n++)
        expect(new Set(TIMES.map((t) => steamV3Grade({ batch, rescuedCount: n, elapsedMs: t }))).size).toBe(1);
  });

  it("ranks are strictly ordered none < one < two < three < master", () => {
    expect([rank("none"), rank("one"), rank("two"), rank("three"), rank("master")]).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("V3 grade: invalid input never earns a grade", () => {
  it.each([
    [{ batch: "clam", rescuedCount: 6, elapsedMs: 3000 }],
    [{ batch: "clam", rescuedCount: -1, elapsedMs: 3000 }],
    [{ batch: "clam", rescuedCount: 4.5, elapsedMs: 3000 }],
    [{ batch: "clam", rescuedCount: 5, elapsedMs: Number.NaN }],
    [{ batch: "clam", rescuedCount: 5, elapsedMs: -1 }],
    [{ batch: "clam", rescuedCount: 5, elapsedMs: Number.POSITIVE_INFINITY }],
    [{ batch: "oyster", rescuedCount: 5, elapsedMs: 3000 }],
  ])("%o -> none", (input) => {
    expect(steamV3Grade(input as never)).toBe("none");
  });
});
