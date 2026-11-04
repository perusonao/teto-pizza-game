import { describe, expect, it } from "vitest";
import { STEAMED_PIECE_CLASS, steamedPieceStyle, steamedPieceVisual, steamedSheen } from "./steamedLook";
import { STEAM_AMOUNT_OPEN_MAX, STEAM_AMOUNT_OVER, STEAM_SHELL_THRESHOLDS } from "./steamPot";

const num = (amount: number, key: string) => Number((steamedPieceStyle(amount) as Record<string, string>)[key]);

describe("steamedPieceStyle", () => {
  it("un-steamed and unreadable values add NO style (an ordinary piece stays byte-identical)", () => {
    for (const v of [undefined, NaN, Infinity, -Infinity]) expect(steamedPieceStyle(v)).toBeUndefined();
    expect(steamedPieceVisual(undefined)).toBeNull();
    expect(steamedPieceVisual(NaN)).toBeNull();
  });
  it("only the three steam custom properties, and no transform / filter shorthand of its own", () => {
    const style = steamedPieceStyle(0.5) as Record<string, string>;
    expect(Object.keys(style).sort()).toEqual(["--steam-bright", "--steam-sat", "--steam-sheen"]);
    for (const v of Object.values(style)) expect(Number.isFinite(Number(v))).toBe(true);
  });
  it("never uses the other treatments' custom properties", () => {
    const keys = Object.keys(steamedPieceStyle(0.9) as object).join(" ");
    expect(keys).not.toMatch(/--sear-|--prep-/);
  });
  it("brightness, saturation and sheen rise with the steam until every shell is open", () => {
    let prev = { b: 0, s: 0, g: -1 };
    for (let i = 0; i <= 95; i += 1) {
      const a = i / 100;
      const cur = { b: num(a, "--steam-bright"), s: num(a, "--steam-sat"), g: num(a, "--steam-sheen") };
      expect(cur.b).toBeGreaterThanOrEqual(prev.b);
      expect(cur.s).toBeGreaterThanOrEqual(prev.s);
      expect(cur.g).toBeGreaterThanOrEqual(prev.g);
      prev = cur;
    }
    expect(num(0, "--steam-bright")).toBe(1);
    expect(num(0, "--steam-sat")).toBe(1);
    expect(num(0, "--steam-sheen")).toBe(0);
    expect(num(STEAM_AMOUNT_OPEN_MAX, "--steam-sheen")).toBe(1);
  });
  it("the sheen is full exactly when the last shell opens", () => {
    const last = STEAM_SHELL_THRESHOLDS[STEAM_SHELL_THRESHOLDS.length - 1];
    expect(steamedSheen(last)).toBe(1);
    expect(steamedSheen(last / 2)).toBeCloseTo(0.5, 9);
    expect(steamedSheen(NaN)).toBe(0);
    expect(steamedSheen(-1)).toBe(0);
  });
  it("over is a step down: dimmer and duller than an unsteamed piece, little sheen", () => {
    expect(num(STEAM_AMOUNT_OVER, "--steam-bright")).toBeLessThan(1);
    expect(num(STEAM_AMOUNT_OVER, "--steam-sat")).toBeLessThan(1);
    expect(num(STEAM_AMOUNT_OVER, "--steam-sheen")).toBeLessThan(num(STEAM_AMOUNT_OPEN_MAX, "--steam-sheen"));
  });
  it("is deterministic", () => {
    expect(JSON.stringify(steamedPieceStyle(0.6))).toBe(JSON.stringify(steamedPieceStyle(0.6)));
  });
  it("steamedPieceVisual pairs the class with the style", () => {
    expect(steamedPieceVisual(0.6)).toEqual({ className: STEAMED_PIECE_CLASS, style: steamedPieceStyle(0.6) });
  });
});
