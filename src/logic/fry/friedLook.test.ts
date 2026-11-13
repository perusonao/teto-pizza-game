import { describe, expect, it } from "vitest";
import { FRIED_PIECE_CLASS, friedGolden, friedPieceStyle, friedPieceVisual } from "./friedLook";
import { fryResultOf, FRY_AMOUNT_CRISP_MAX } from "./fryPot";

const vars = (amount: number) => friedPieceStyle(amount) as Record<string, string>;

describe("friedLook", () => {
  it("an un-fried or unreadable piece adds NO style and no class (byte-identical to today)", () => {
    for (const a of [undefined, NaN, Infinity, -Infinity]) {
      expect(friedPieceStyle(a as never)).toBeUndefined();
      expect(friedPieceVisual(a as never)).toBeNull();
    }
  });
  it("a fried piece gets the class and only custom properties (never transform)", () => {
    const v = friedPieceVisual(0.5);
    expect(v?.className).toBe(FRIED_PIECE_CLASS);
    expect(Object.keys(v?.style ?? {}).sort()).toEqual(["--fry-bright", "--fry-sat", "--fry-sepia", "--fry-sheen"]);
    for (const k of Object.keys(v?.style ?? {})) expect(k).toMatch(/^--fry-/);
  });
  it("golden rises with the amount and is full once crisp", () => {
    expect(friedGolden(0)).toBe(0);
    expect(friedGolden(fryResultOf(3500).amount)).toBeCloseTo(1, 5);
    expect(friedGolden(-1)).toBe(0);
    expect(friedGolden(NaN)).toBe(0);
    expect(Number(vars(fryResultOf(1000).amount)["--fry-sepia"])).toBeLessThan(Number(vars(fryResultOf(3500).amount)["--fry-sepia"]));
  });
  it("raw is plain, crisp is golden and glossy, over is dark and dull", () => {
    const raw = vars(fryResultOf(0).amount);
    const crisp = vars(fryResultOf(5000).amount);
    const over = vars(fryResultOf(9000).amount);
    expect(Number(raw["--fry-sepia"])).toBe(0);
    expect(Number(crisp["--fry-sepia"])).toBeGreaterThan(0.3);
    expect(Number(crisp["--fry-sheen"])).toBeGreaterThan(Number(over["--fry-sheen"]));
    expect(Number(over["--fry-bright"])).toBeLessThan(Number(raw["--fry-bright"]));
    expect(Number(over["--fry-sepia"])).toBeGreaterThan(Number(crisp["--fry-sepia"]));
  });
  it("out-of-range amounts are clamped, not thrown", () => {
    expect(() => friedPieceStyle(5)).not.toThrow();
    expect(() => friedPieceStyle(-5)).not.toThrow();
  });
  it("does not use the other treatments' variables or classes", () => {
    const keys = Object.keys(friedPieceStyle(0.5) ?? {}).join(" ") + FRIED_PIECE_CLASS;
    expect(keys).not.toMatch(/--sear-|--prep-|--steam-|seared|prepared|steamed/);
  });
  it("is deterministic: the same amount is the same style, and it never mutates a shared object", () => {
    expect(friedPieceStyle(0.4)).toEqual(friedPieceStyle(0.4));
    expect(friedPieceStyle(0.4)).not.toBe(friedPieceStyle(0.4));
  });
  it("golden and sepia never go backwards while crisping, and the over look is a step darker than the best crisp", () => {
    let prev = -1;
    for (let a = 0; a <= FRY_AMOUNT_CRISP_MAX + 1e-9; a += 0.05) {
      const sepia = Number(vars(a)["--fry-sepia"]);
      expect(sepia).toBeGreaterThanOrEqual(prev);
      prev = sepia;
    }
    expect(Number(vars(1)["--fry-bright"])).toBeLessThan(Number(vars(FRY_AMOUNT_CRISP_MAX)["--fry-bright"]));
    expect(Number(vars(1)["--fry-sepia"])).toBeGreaterThan(Number(vars(FRY_AMOUNT_CRISP_MAX)["--fry-sepia"]));
  });
  it("every value is a finite plain decimal a CSS filter() can take (no NaN, no exponent), at any amount", () => {
    for (const a of [-5, 0, 0.001, 0.3, 0.7, FRY_AMOUNT_CRISP_MAX, 1, 5]) {
      for (const v of Object.values(vars(a))) expect(v).toMatch(/^-?\d+(\.\d+)?$/);
    }
  });
  it("owns only --fry-* names: it cannot overwrite a bake / placement variable or the transform the placement scale owns", () => {
    const v = friedPieceVisual(0.5);
    expect(Object.keys(v?.style ?? {}).every((k) => k.startsWith("--fry-"))).toBe(true);
    expect(v?.className).toBe("ingredient-piece--fried");
    expect(v?.className).not.toMatch(/bake|baked|burnt|melt/);
  });
});
