import { describe, expect, it } from "vitest";
import { RECIPES } from "../data/recipes";
import { BAKE_LEVEL5_LABEL, JUST_HALF_WIDTH_PT, classifyBake, classifyBake5 } from "./bake";

const T = { start: 58, end: 78 }; // centre 68, the Issue #469 worked example

describe("classifyBake5 (Issue #469)", () => {
  it("labels the five levels in the spec order", () => {
    expect(BAKE_LEVEL5_LABEL).toEqual({
      raw: "生焼け",
      underdone: "惜しい（焼き不足）",
      just: "ジャスト",
      overdone: "惜しい（焼きすぎ）",
      burnt: "焦げ",
    });
  });

  it("pins the just half-width at 3pt", () => {
    expect(JUST_HALF_WIDTH_PT).toBe(3);
  });

  it("classifies the worked example, including every boundary", () => {
    expect(classifyBake5(0, T)).toBe("raw");
    expect(classifyBake5(57.99, T)).toBe("raw");
    expect(classifyBake5(58, T)).toBe("underdone"); // start is inside the window
    expect(classifyBake5(64.99, T)).toBe("underdone");
    expect(classifyBake5(65, T)).toBe("just"); // c-3 inclusive
    expect(classifyBake5(68, T)).toBe("just");
    expect(classifyBake5(71, T)).toBe("just"); // c+3 inclusive
    expect(classifyBake5(71.01, T)).toBe("overdone");
    expect(classifyBake5(78, T)).toBe("overdone"); // end is inside the window
    expect(classifyBake5(78.01, T)).toBe("burnt");
    expect(classifyBake5(100, T)).toBe("burnt");
  });

  it("fails closed to raw for non-finite input", () => {
    for (const v of [Number.NaN, Infinity, -Infinity]) expect(classifyBake5(v, T)).toBe("raw");
  });

  it("agrees with classifyBake for every recipe window (underdone/just/overdone <=> perfect)", () => {
    expect(RECIPES.length).toBeGreaterThan(0);
    for (const { bakeTarget: t } of RECIPES) {
      const c = (t.start + t.end) / 2;
      const samples = [
        -1, 0, t.start - 0.01, t.start, c - JUST_HALF_WIDTH_PT - 0.01, c - JUST_HALF_WIDTH_PT, c, c + JUST_HALF_WIDTH_PT,
        c + JUST_HALF_WIDTH_PT + 0.01, t.end, t.end + 0.01, 100,
      ];
      for (const v of samples) {
        const level = classifyBake5(v, t);
        const coarse = classifyBake(v, t);
        if (coarse === "perfect") expect(["underdone", "just", "overdone"]).toContain(level);
        else expect(level).toBe(coarse);
      }
      expect(classifyBake5(t.start, t)).toBe("underdone");
      expect(classifyBake5(c - JUST_HALF_WIDTH_PT, t)).toBe("just");
      expect(classifyBake5(c, t)).toBe("just");
      expect(classifyBake5(c + JUST_HALF_WIDTH_PT, t)).toBe("just");
      expect(classifyBake5(t.end, t)).toBe("overdone");
    }
  });

  it("depends only on the window centre, not its position (shifted windows classify identically)", () => {
    for (const offset of [0, 10, 20]) {
      const t = { start: 40 + offset, end: 60 + offset };
      expect(classifyBake5(t.start + 6, t)).toBe("underdone");
      expect(classifyBake5(t.start + 10, t)).toBe("just");
      expect(classifyBake5(t.start + 14, t)).toBe("overdone");
    }
  });
});
