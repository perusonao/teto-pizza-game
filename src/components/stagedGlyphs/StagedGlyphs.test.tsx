import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { StagedGlyph } from "./StagedGlyphs";
import { STAGED_GLYPH_FOR_INGREDIENT, STAGED_GLYPH_IDS, STAGED_GLYPH_PALETTE } from "./stagedGlyphPalette";

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe("staged glyphs B21/B22 (unwired, PROVISIONAL)", () => {
  it("covers the 13 scatter ingredients of B21 + B22, one visual each", () => {
    expect(STAGED_GLYPH_IDS).toHaveLength(13);
    expect(Object.keys(STAGED_GLYPH_FOR_INGREDIENT)).toHaveLength(13);
    expect(new Set(Object.values(STAGED_GLYPH_FOR_INGREDIENT)).size).toBe(13);
  });

  it.each(STAGED_GLYPH_IDS)("%s renders a decorative 1em 64x64 inline SVG with its visual id", (id) => {
    const html = renderToStaticMarkup(<StagedGlyph id={id} />);
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html).toContain('width="1em"');
    expect(html).toContain('height="1em"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`data-ingredient-visual="${id}"`);
    expect(html).toContain(`ingredient-glyph--${id}`);
  });

  it.each(STAGED_GLYPH_IDS)("%s uses no ids, gradients, clip paths or url() references", (id) => {
    const html = renderToStaticMarkup(<StagedGlyph id={id} />);
    expect(html).not.toMatch(/\sid=/);
    expect(html).not.toMatch(/Gradient|clipPath|url\(/);
  });

  it.each(STAGED_GLYPH_IDS)("%s outline is the darkest tone and stays readable on baked cheese and pale dough", (id) => {
    const p = STAGED_GLYPH_PALETTE[id];
    expect(lum(p.outline)).toBeLessThan(lum(p.fill));
    expect(lum(p.outline)).toBeLessThan(lum(p.detail));
    expect(contrast(p.outline, "#e8c15a")).toBeGreaterThan(3);
    expect(contrast(p.outline, "#f1dcae")).toBeGreaterThan(3);
  });

  it("only lettuce-leaf and cabbage-shreds are wired into IngredientGlyph.tsx (Owner 2026-11-09, #799); the other eleven visual ids are still unknown to it", () => {
    const src = readFileSync(join(__dirname, "..", "IngredientGlyph.tsx"), "utf8");
    const WIRED = ["lettuce-leaf", "cabbage-shreds"];
    for (const id of STAGED_GLYPH_IDS) {
      if (WIRED.includes(id)) expect(src).toContain(`"${id}"`);
      else expect(src).not.toContain(`"${id}"`);
    }
  });

  it("stays unwired except for IngredientGlyph.tsx: no other production source imports it", () => {
    const root = join(__dirname, "..", "..");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    const offenders = walk(root).filter(
      (f) => !f.includes("stagedGlyphs") && !f.endsWith("components/IngredientGlyph.tsx") && /from\s+["'][^"']*stagedGlyphs/.test(readFileSync(f, "utf8")) && !/\.test\.tsx?$/.test(f),
    );
    expect(offenders).toEqual([]);
  });
});
