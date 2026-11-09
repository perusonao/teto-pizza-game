import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { DESSERT_GLYPH_IDS, DessertGlyph } from "./DessertGlyphs";
import { DESSERT_PALETTE } from "./dessertPalette";

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const html = (id: (typeof DESSERT_GLYPH_IDS)[number]) => renderToStaticMarkup(<DessertGlyph id={id} />);

describe("DessertGlyph (Batch 23, unwired)", () => {
  it("covers exactly the six dessert materials", () => {
    expect([...DESSERT_GLYPH_IDS].sort()).toEqual(["apple", "banana", "chocolate", "graham-cracker", "marshmallow", "powdered-sugar"]);
    expect(Object.keys(DESSERT_PALETTE).sort()).toEqual([...DESSERT_GLYPH_IDS].sort());
  });

  it("renders a decorative 1em inline SVG in a 64x64 box with its own visual id", () => {
    for (const id of DESSERT_GLYPH_IDS) {
      const h = html(id);
      expect(h).toContain('viewBox="0 0 64 64"');
      expect(h).toContain('width="1em"');
      expect(h).toContain('height="1em"');
      expect(h).toContain('aria-hidden="true"');
      expect(h).toContain(`data-ingredient-visual="${id}-dessert"`);
    }
  });

  it("uses no ids, gradients or url() references, so many can share one page", () => {
    for (const id of DESSERT_GLYPH_IDS) expect(html(id)).not.toMatch(/\sid=|Gradient|clipPath|url\(/);
  });

  it("every silhouette is different from every other", () => {
    const strip = (s: string) => s.replace(/#[0-9a-f]{6}/gi, "#").replace(/data-ingredient-visual="[^"]*"/, "");
    const shapes = DESSERT_GLYPH_IDS.map((id) => strip(html(id)));
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it("the outline is the darkest tone of each glyph and reads on baked cheese and pale dough (contrast > 3)", () => {
    for (const id of DESSERT_GLYPH_IDS) {
      const p = DESSERT_PALETTE[id];
      expect(lum(p.outline)).toBeLessThanOrEqual(Math.min(lum(p.fill), lum(p.light), lum(p.mark)));
      expect(contrast(p.outline, "#e8c15a"), id).toBeGreaterThan(3);
      expect(contrast(p.outline, "#f1dcae"), id).toBeGreaterThan(3);
    }
  });

  it("is UNWIRED: no other module imports it, and the wiring files do not mention the new visual ids", () => {
    const root = join(__dirname, "..", "..");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        if (p.includes("dessertGlyphs")) return [];
        return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|css)$/.test(n) ? [p] : [];
      });
    for (const file of walk(root)) expect(readFileSync(file, "utf8"), file).not.toMatch(/dessertGlyphs|pieceVisual: "[a-z-]+-dessert"/);
  });
});
