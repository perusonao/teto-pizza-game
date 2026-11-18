import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ParmigianoShavings } from "./ParmigianoShavings";
import { PARMIGIANO_SHAVINGS } from "./parmigianoShavingsData";

/**
 * Topping Visuals 2.0 PR-1, revision 2 (Issue #824, Owner iPhone HV on d218864: the placed parmigiano read as a vivid yellow knot / lump). Pins the SHAPE and
 * COLOUR contract of the placed drawing -- a few separate, thin, flat shavings in low-saturation ivory / cream, of different sizes and directions -- so a later edit
 * cannot drift back into a saturated clump. The drawing itself stays PROVISIONAL (the Owner judges it on a real iPhone); these are guard rails, not a taste test.
 */
afterEach(() => {
  cleanup();
});

/** HSV saturation and value (0..1) of a #rrggbb colour. */
function hsv(hex: string): { s: number; v: number } {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return { s: max === 0 ? 0 : (max - min) / max, v: max / 255 };
}

function colours(container: HTMLElement, attr: "fill" | "stroke"): string[] {
  const found = new Set<string>();
  for (const el of container.querySelectorAll(`[${attr}]`)) {
    const value = el.getAttribute(attr) ?? "";
    if (/^#[0-9a-f]{6}$/i.test(value) && value.toLowerCase() !== "#000000") found.add(value.toLowerCase());
  }
  return [...found];
}

describe("ParmigianoShavings (placed-only drawing)", () => {
  it("is a self-contained 64x64, 1em, aria-hidden svg", () => {
    const { container } = render(<ParmigianoShavings />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("data-ingredient-visual", "parmigiano-shavings");
    expect(svg).toHaveAttribute("viewBox", "0 0 64 64");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "1em");
    expect(container.innerHTML).not.toMatch(/\sid=|url\(#|<defs|Gradient/);
  });

  it("draws a few separate shavings (5 to 8), each with an underside, a top face and a highlight", () => {
    const { container } = render(<ParmigianoShavings />);
    const shavings = container.querySelectorAll("g[data-shaving]");
    expect(shavings.length).toBe(PARMIGIANO_SHAVINGS.length);
    expect(shavings.length).toBeGreaterThanOrEqual(5);
    expect(shavings.length).toBeLessThanOrEqual(8);
    for (const shaving of shavings) expect(shaving.querySelectorAll("path")).toHaveLength(3);
    for (const path of container.querySelectorAll("path")) expect(path.getAttribute("d")).not.toMatch(/NaN|undefined/);
  });

  it("each shaving is long and thin (full thickness at most a third of its length), so none can read as a lump", () => {
    for (const s of PARMIGIANO_SHAVINGS) expect((s.half * 2) / s.len, `shaving at ${s.cx},${s.cy}`).toBeLessThanOrEqual(0.35);
  });

  it("the shavings are scattered with gaps (centres at least 9 apart), differ in size (longest >= 1.8x shortest) and in direction (spread >= 60 degrees)", () => {
    const shavings = PARMIGIANO_SHAVINGS;
    for (let i = 0; i < shavings.length; i += 1) {
      for (let j = i + 1; j < shavings.length; j += 1) {
        const distance = Math.hypot(shavings[i].cx - shavings[j].cx, shavings[i].cy - shavings[j].cy);
        expect(distance, `shavings ${i} and ${j}`).toBeGreaterThanOrEqual(9);
      }
    }
    const lengths = shavings.map((s) => s.len);
    expect(Math.max(...lengths) / Math.min(...lengths)).toBeGreaterThanOrEqual(1.8);
    const angles = shavings.map((s) => s.angle);
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThanOrEqual(60);
    expect(new Set(shavings.map((s) => s.skew)).size).toBe(shavings.length);
  });

  it("every shaving stays inside the 64x64 viewBox", () => {
    for (const s of PARMIGIANO_SHAVINGS) {
      const reach = s.len / 2 + s.half;
      expect(s.cx - reach).toBeGreaterThanOrEqual(0);
      expect(s.cx + reach).toBeLessThanOrEqual(64);
      expect(s.cy - reach).toBeGreaterThanOrEqual(0);
      expect(s.cy + reach).toBeLessThanOrEqual(64);
    }
  });

  it("the fills are pale ivory / cream, not a vivid yellow (HSV saturation <= 0.30, value >= 0.85); the outline stays low-saturation (<= 0.35)", () => {
    const { container } = render(<ParmigianoShavings />);
    const fills = colours(container, "fill");
    expect(fills.length).toBeGreaterThanOrEqual(4);
    for (const fill of fills) {
      const { s, v } = hsv(fill);
      expect(s, `fill ${fill} saturation`).toBeLessThanOrEqual(0.3);
      expect(v, `fill ${fill} value`).toBeGreaterThanOrEqual(0.85);
    }
    for (const stroke of colours(container, "stroke")) expect(hsv(stroke).s, `stroke ${stroke} saturation`).toBeLessThanOrEqual(0.35);
  });

  it("the previous vivid yellows (revision 1) are gone", () => {
    const { container } = render(<ParmigianoShavings />);
    for (const old of ["#f3dc8a", "#ead07a", "#b8963a", "#e2c46c"]) expect(container.innerHTML.toLowerCase()).not.toContain(old);
  });
});
