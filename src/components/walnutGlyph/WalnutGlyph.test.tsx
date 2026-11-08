import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WalnutGlyph, WalnutKernel } from "./WalnutGlyph";
import { WALNUT_PALETTE } from "./walnutPalette";

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe("WalnutGlyph (Batch 20-A)", () => {
  it("renders a decorative 1em inline SVG with a 64x64 box", () => {
    const html = renderToStaticMarkup(<WalnutGlyph />);
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html).toContain('width="1em"');
    expect(html).toContain('height="1em"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-ingredient-visual="walnut-kernel"');
  });

  it("defaults to raw and exposes the bake state", () => {
    expect(renderToStaticMarkup(<WalnutGlyph />)).toContain('data-walnut-state="raw"');
    expect(renderToStaticMarkup(<WalnutGlyph state="baked" />)).toContain('data-walnut-state="baked"');
  });

  it("uses no ids, gradients or url() references, so many can share one page", () => {
    for (const state of ["raw", "baked"] as const) {
      const html = renderToStaticMarkup(<WalnutGlyph state={state} />);
      expect(html).not.toMatch(/\sid=/);
      expect(html).not.toMatch(/Gradient|clipPath|url\(/);
    }
  });

  it("keeps one silhouette for both states (only colours differ)", () => {
    const strip = (s: string) => s.replace(/#[0-9a-f]{6}/gi, "#").replace(/data-walnut-state="\w+"/, "");
    expect(strip(renderToStaticMarkup(<WalnutGlyph state="raw" />))).toBe(
      strip(renderToStaticMarkup(<WalnutGlyph state="baked" />)),
    );
  });

  it("baked is darker than raw, and the outline is the darkest tone in each state", () => {
    expect(lum(WALNUT_PALETTE.baked.fill)).toBeLessThan(lum(WALNUT_PALETTE.raw.fill));
    for (const s of ["raw", "baked"] as const) {
      const p = WALNUT_PALETTE[s];
      expect(lum(p.outline)).toBeLessThan(lum(p.fold));
      expect(lum(p.fold)).toBeLessThan(lum(p.fill));
      expect(lum(p.fill)).toBeLessThan(lum(p.light));
    }
  });

  it("outline keeps a readable contrast against baked cheese (#e8c15a-ish) and pale dough, for both states", () => {
    for (const s of ["raw", "baked"] as const) {
      expect(contrast(WALNUT_PALETTE[s].outline, "#e8c15a")).toBeGreaterThan(4);
      expect(contrast(WALNUT_PALETTE[s].outline, "#f1dcae")).toBeGreaterThan(4);
    }
  });

  it("is imported by exactly one production module: IngredientGlyph.tsx (Batch 20-A wiring, #790)", async () => {
    const { execSync } = await import("node:child_process");
    const out = execSync(
      "grep -rl 'walnutGlyph' src --include=*.ts --include=*.tsx || true",
      { cwd: process.cwd() },
    ).toString();
    const importers = out.split("\n").filter((f) => f && !f.includes("src/components/walnutGlyph/"));
    expect(importers).toEqual(["src/components/IngredientGlyph.tsx"]);
  });

  it("WalnutKernel (the art inside IngredientGlyph) draws the same shapes as the standalone glyph", () => {
    const inner = renderToStaticMarkup(<WalnutGlyph />).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    expect(renderToStaticMarkup(<WalnutKernel />)).toBe(inner);
  });
});
