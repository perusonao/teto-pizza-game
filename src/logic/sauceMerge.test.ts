import { describe, expect, it } from "vitest";
import { bakeOilHex, bakeOilRgb, bakeOliveOilLook, compositeOver } from "./sauceDisplay";

const px = (...rgba: number[]) => new Uint8ClampedArray(rgba);

describe("compositeOver (flattening runs: source-over, as the browser stacks canvases)", () => {
  it("an opaque source replaces the destination; a transparent one leaves it alone", () => {
    const dst = px(10, 20, 30, 255, 1, 2, 3, 128);
    compositeOver(dst, px(200, 100, 50, 255, 9, 9, 9, 0));
    expect([...dst]).toEqual([200, 100, 50, 255, 1, 2, 3, 128]);
  });

  it("matches the source-over formula for translucent over translucent", () => {
    const dst = px(200, 0, 0, 128);
    compositeOver(dst, px(0, 200, 0, 128));
    const sa = 128 / 255;
    const da = 128 / 255;
    const oa = sa + da * (1 - sa);
    expect(dst[3]).toBe(Math.round(oa * 255) === dst[3] ? dst[3] : Math.round(oa * 255));
    expect(dst[3]).toBeGreaterThanOrEqual(Math.floor(oa * 255));
    expect(dst[3]).toBeLessThanOrEqual(Math.ceil(oa * 255));
    expect(dst[1]).toBeCloseTo((200 * sa) / oa, -0.5);
    expect(dst[0]).toBeCloseTo((200 * da * (1 - sa)) / oa, -0.5);
  });

  it("stacking runs in order equals compositing them one after another (associativity of the order used)", () => {
    const a = px(200, 30, 30, 200);
    const b = px(30, 200, 30, 150);
    const c = px(30, 30, 200, 100);
    const flat = new Uint8ClampedArray(4);
    for (const layer of [a, b, c]) compositeOver(flat, layer);
    const nested = new Uint8ClampedArray(4);
    compositeOver(nested, a);
    compositeOver(nested, b);
    compositeOver(nested, c);
    expect([...flat]).toEqual([...nested]);
    expect(flat[3]).toBeGreaterThan(200); // three translucent layers are more opaque than any one
  });
});

describe("bakeOliveOilLook (the oil CSS treatment, colour only)", () => {
  it("leaves transparent pixels and every alpha untouched", () => {
    const p = px(200, 180, 100, 0, 200, 180, 100, 77);
    bakeOliveOilLook(p);
    expect([p[0], p[1], p[2], p[3]]).toEqual([200, 180, 100, 0]);
    expect(p[7]).toBe(77);
  });

  it("a mid grey stays grey (saturate keeps grey, contrast keeps 0.5) and is darkened by the brightness 0.82", () => {
    const p = px(128, 128, 128, 255);
    bakeOliveOilLook(p);
    expect(p[0]).toBe(p[1]);
    expect(p[1]).toBe(p[2]);
    expect(p[0]).toBeCloseTo(0.5 * 0.82 * 255, -0.7);
  });

  it("pale gold oil becomes a deeper, more saturated amber", () => {
    const p = px(233, 217, 160, 255); // olive oil's swatch
    bakeOliveOilLook(p);
    const sat = (r: number, g: number, b: number) => Math.max(r, g, b) - Math.min(r, g, b);
    expect(sat(p[0], p[1], p[2])).toBeGreaterThan(sat(233, 217, 160));
    expect(p[0] + p[1] + p[2]).toBeLessThan(233 + 217 + 160);
  });
});

describe("bakeOilHex / bakeOilRgb (the oil look for one colour)", () => {
  it("is exactly what bakeOliveOilLook does to a pixel of that colour", () => {
    for (const hex of ["#e9d9a0", "#c8412b", "#6b8f3a", "#ffffff", "#000000", "#808080"]) {
      const n = parseInt(hex.slice(1), 16);
      const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      const p = new Uint8ClampedArray([...rgb, 255]);
      bakeOliveOilLook(p);
      expect([...bakeOilRgb(rgb[0], rgb[1], rgb[2])]).toEqual([p[0], p[1], p[2]]);
      expect(bakeOilHex(hex)).toBe(`#${[p[0], p[1], p[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
    }
  });

  it("leaves a value that is not a #rrggbb colour alone", () => {
    expect(bakeOilHex("red")).toBe("red");
    expect(bakeOilHex("#abc")).toBe("#abc");
  });
});
