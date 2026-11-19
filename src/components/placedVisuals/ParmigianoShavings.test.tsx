import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ParmigianoShavings } from "./ParmigianoShavings";
import { flakePath, ribbonPath } from "./parmigianoShavingPaths";
import { sprinkleLayout } from "./sprinkleLayout";

/**
 * The placed parmigiano drawing (rev. 3). SVG-only checks: the Style Lock V2 shape (64x64, 1em, aria-hidden, no id / gradient / defs / url), three real-cheese kinds, low
 * saturation ivory fills, a soft shadow, a translucent look. Whether it reads as freshly shaved cheese is the Owner's iPhone judgement.
 */
afterEach(() => {
  cleanup();
});

const { shavings } = sprinkleLayout("topping-3");

function draw() {
  return render(<ParmigianoShavings shavings={shavings} />).container;
}

describe("ParmigianoShavings", () => {
  it("is a self-contained 64x64, 1em, aria-hidden svg with no id / gradient / defs / url references", () => {
    const container = draw();
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("viewBox", "0 0 64 64");
    expect(svg).toHaveAttribute("width", "1em");
    expect(svg).toHaveAttribute("height", "1em");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("data-ingredient-visual", "parmigiano-shavings");
    const markup = svg.outerHTML;
    expect(markup).not.toMatch(/\bid=/);
    expect(markup).not.toMatch(/url\(/);
    expect(markup).not.toMatch(/<defs|Gradient|<image|<foreignObject|<style/i);
  });

  it("draws every shaving of the layout with its kind, a contact shadow and a top face", () => {
    const container = draw();
    const groups = [...container.querySelectorAll("g[data-shaving]")];
    expect(groups).toHaveLength(shavings.length);
    groups.forEach((group, index) => {
      expect(group.getAttribute("data-shaving")).toBe(shavings[index].kind);
      const paths = group.querySelectorAll("path");
      expect(paths.length).toBeGreaterThanOrEqual(2);
      // shadow first (dark, faint), then the translucent ivory top face
      expect(Number(paths[0].getAttribute("opacity"))).toBeLessThanOrEqual(0.18);
      expect(Number(paths[0].getAttribute("opacity"))).toBeGreaterThan(0);
      expect(Number(paths[1].getAttribute("fill-opacity"))).toBeLessThan(0.9);
    });
    // flakes carry a lighter core, ribbons a highlight line
    expect(container.querySelectorAll('g[data-shaving="flake"] path')).toHaveLength(shavings.filter((s) => s.kind === "flake").length * 3);
    expect(container.querySelectorAll('g[data-shaving="ribbon"] path[fill="none"]')).toHaveLength(shavings.filter((s) => s.kind === "ribbon").length);
  });

  it("uses only low-saturation ivory / cream fills (never a vivid yellow)", () => {
    const container = draw();
    const hsv = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b);
      return { s: max === 0 ? 0 : (max - Math.min(r, g, b)) / max, v: max };
    };
    const fills = new Set<string>();
    for (const path of container.querySelectorAll("path[fill^='#']")) fills.add(path.getAttribute("fill")!);
    for (const fill of fills) {
      if (fill === "#5a4a22") continue; // the shadow
      expect(hsv(fill).s, fill).toBeLessThanOrEqual(0.3);
      expect(hsv(fill).v, fill).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("applies a rim shift as one translate on the whole field, and none when the shift is zero", () => {
    const shifted = render(<ParmigianoShavings shavings={shavings} shift={{ x: -6, y: 3 }} />).container;
    expect(shifted.querySelector("svg > g")?.getAttribute("transform")).toBe("translate(-6 3)");
    cleanup();
    const plain = render(<ParmigianoShavings shavings={shavings} shift={{ x: 0, y: 0 }} />).container;
    expect(plain.querySelector("svg > g")?.getAttribute("transform")).toBeNull();
  });
});

describe("path geometry", () => {
  it("a flake is a closed soft polygon with one rounded corner per factor; two different factor sets give two different outlines", () => {
    const a = flakePath(14, 9, [1, 0.9, 1.1, 0.8, 1.05, 0.95, 1.1]);
    const b = flakePath(14, 9, [0.8, 1.1, 0.9, 1.15, 0.85, 1.1, 0.95]);
    expect(a).not.toBe(b);
    expect(a.match(/Q/g)).toHaveLength(7);
    expect(a.endsWith("Z")).toBe(true);
    expect(a).not.toMatch(/NaN|Infinity/);
  });

  it("a ribbon is a closed strip whose bend bows it to the chosen side, and whose width profile changes its outline", () => {
    const even = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const uneven = [0.7, 1.2, 0.8, 1.1, 0.9, 1.15, 0.65, 1, 0.8, 1.2];
    const up = ribbonPath(18, 3.5, 0.3, 0, even);
    const down = ribbonPath(18, 3.5, -0.3, 0, even);
    expect(ribbonPath(18, 3.5, 0.1, 0.03, uneven)).not.toBe(ribbonPath(18, 3.5, 0.1, 0.03, even));
    expect(up).not.toBe(down);
    expect(up.startsWith("M ")).toBe(true);
    expect(up.endsWith("Z")).toBe(true);
    expect(up).not.toMatch(/NaN|Infinity/);
    // the middle of the strip is displaced in the direction of the bend (negative y is up in svg)
    const ys = (d: string) => [...d.matchAll(/ (-?\d+(?:\.\d+)?)(?= L| Z|$)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys(down))).toBeLessThan(Math.min(...ys(up)));
  });
});
