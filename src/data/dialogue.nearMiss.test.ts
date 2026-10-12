import { describe, expect, it } from "vitest";
import { RECIPES } from "./recipes";
import { buildBlueResultLine, buildTetoResultLine } from "./dialogue";
import type { ScoreBreakdown } from "../logic/scoring";

/** Issue #481 (Owner): near-miss suppresses existing 「完璧」 variants; no new near-miss set; ids unchanged. */
describe("result dialogue for near-miss (Issue #481)", () => {
  it("Teto never says 完璧 on a near-miss, for every recipe and bake position", () => {
    for (const r of RECIPES) {
      for (let v = 0; v <= 100; v += 1) {
        expect(buildTetoResultLine(r, "perfect", v, true).textJa).not.toContain("完璧");
      }
    }
  });

  it("without nearMiss the existing 完璧 variant is still reachable (JUST / FREE unchanged)", () => {
    const seen = new Set<string>();
    for (const r of RECIPES) for (let v = 0; v <= 4; v += 1) seen.add(buildTetoResultLine(r, "perfect", v).textJa);
    expect([...seen].some((t) => t.includes("完璧"))).toBe(true);
    expect(buildTetoResultLine(RECIPES[0], "perfect", 70)).toEqual(buildTetoResultLine(RECIPES[0], "perfect", 70, false));
  });

  it("keeps ids and raw / burnt lines identical (nearMiss only filters 完璧 variants)", () => {
    const r = RECIPES[0];
    expect(buildTetoResultLine(r, "perfect", 70, true).id).toBe(`result.teto.perfect.${r.id}`);
    expect(buildTetoResultLine(r, "raw", 10, true)).toEqual(buildTetoResultLine(r, "raw", 10));
    expect(buildTetoResultLine(r, "burnt", 95, true)).toEqual(buildTetoResultLine(r, "burnt", 95));
  });

  it("Blue's mid-band 完璧 variant is suppressed on a near-miss", () => {
    const mid = { stars: 3 } as ScoreBreakdown;
    for (const r of RECIPES.slice(0, 20)) {
      for (let v = 55; v < 85; v += 1) {
        expect(buildBlueResultLine(r, mid, "perfect", v, true).textJa).not.toContain("完璧");
      }
    }
  });
});
