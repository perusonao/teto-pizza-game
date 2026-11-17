import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { StagedGlyph } from "./StagedGlyphs";
import { NDUJA_DOLLOP_BOX, NDUJA_PLACED_DOLLOPS, NDUJA_SELECTION_DOLLOPS, STAGED_GLYPH_FOR_INGREDIENT, STAGED_GLYPH_IDS, STAGED_GLYPH_PALETTE } from "./stagedGlyphPalette";

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe("staged glyphs B21/B22 plus T25 dedicated candidates", () => {
  it("covers the 13 B21/B22, six T25 and one T26 (nduja) visuals, one visual each", () => {
    expect(STAGED_GLYPH_IDS).toHaveLength(20);
    expect(Object.keys(STAGED_GLYPH_FOR_INGREDIENT)).toHaveLength(20);
    expect(new Set(Object.values(STAGED_GLYPH_FOR_INGREDIENT)).size).toBe(20);
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

  it("the adopted B21/B22 and T25 visuals are wired into IngredientGlyph.tsx", () => {
    const src = readFileSync(join(__dirname, "..", "IngredientGlyph.tsx"), "utf8");
    const WIRED = ["lettuce-leaf", "cabbage-shreds", "tortilla-chip-triangles", "brie-wedge", "fennel-slices", "orange-slices", "carrot-rounds", "red-cabbage-shreds", "sunflower-kernels", "radicchio-leaf", "truffle-shavings", "cauliflower-floret", "kebab-sauce-swirl", "daikon-matchsticks", "liver-pate-quenelle", "lime-wedge", "asparagus-spears"];
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
      (f) => !f.includes("stagedGlyphs") && !f.replace(/\\/g, "/").endsWith("components/IngredientGlyph.tsx") && /from\s+["'][^"']*stagedGlyphs/.test(readFileSync(f, "utf8")) && !/\.test\.tsx?$/.test(f),
    );
    expect(offenders).toEqual([]);
  });
});

describe("T26 nduja-dollops (#866, Owner D2/D3 2026-11-17; UNWIRED, PROVISIONAL)", () => {
  const count = (html: string) => (html.match(/data-dollop=""/g) ?? []).length;
  const selection = renderToStaticMarkup(<StagedGlyph id="nduja-dollops" variant="selection" />);
  const placed = renderToStaticMarkup(<StagedGlyph id="nduja-dollops" variant="placed" />);

  it("visual contract: the tray (selection) is a group of THREE small dollops, a placed piece is exactly ONE", () => {
    expect(count(selection)).toBe(3);
    expect(count(placed)).toBe(1);
    expect(NDUJA_SELECTION_DOLLOPS).toHaveLength(3);
    expect(NDUJA_PLACED_DOLLOPS).toHaveLength(1);
    expect(selection).not.toBe(placed);
  });

  it("the default variant is the tray group, and both variants keep the 64x64 / 1em / aria-hidden contract", () => {
    expect(renderToStaticMarkup(<StagedGlyph id="nduja-dollops" />)).toBe(selection);
    for (const html of [selection, placed]) {
      expect(html).toContain('viewBox="0 0 64 64"');
      expect(html).toContain('width="1em"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('data-ingredient-visual="nduja-dollops"');
      expect(html).not.toMatch(/\sid=|Gradient|clipPath|url\(/);
    }
  });

  it("the tray dollops are SEPARATE: no two boxes touch (gap >= 2 in the 64x64 box) and all stay inside the box", () => {
    const boxes = NDUJA_SELECTION_DOLLOPS.map(({ tx, ty, s }) => ({
      x0: tx + NDUJA_DOLLOP_BOX.x * s, y0: ty + NDUJA_DOLLOP_BOX.y * s,
      x1: tx + (NDUJA_DOLLOP_BOX.x + NDUJA_DOLLOP_BOX.size) * s, y1: ty + (NDUJA_DOLLOP_BOX.y + NDUJA_DOLLOP_BOX.size) * s,
    }));
    for (const b of boxes) for (const v of [b.x0, b.y0, b.x1, b.y1]) {
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(62);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const gapX = Math.max(a.x0 - b.x1, b.x0 - a.x1);
      const gapY = Math.max(a.y0 - b.y1, b.y0 - a.y1);
      expect(Math.max(gapX, gapY), `${i}-${j}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("a placed dollop is centred and larger than any tray dollop (it must read at the 28px piece scale)", () => {
    const [p] = NDUJA_PLACED_DOLLOPS;
    const cx = p.tx + (NDUJA_DOLLOP_BOX.x + NDUJA_DOLLOP_BOX.size / 2) * p.s;
    const cy = p.ty + (NDUJA_DOLLOP_BOX.y + NDUJA_DOLLOP_BOX.size / 2) * p.s;
    expect(Math.abs(cx - 32)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(cy - 32)).toBeLessThanOrEqual(1.5);
    for (const t of NDUJA_SELECTION_DOLLOPS) expect(p.s).toBeGreaterThan(t.s * 1.5);
  });

  it("the base colour is the Owner-approved #a13517, and the visual is mapped from the ingredient id `nduja`", () => {
    expect(STAGED_GLYPH_PALETTE["nduja-dollops"].fill).toBe("#a13517");
    expect(selection).toContain("#a13517");
    expect(placed).toContain("#a13517");
    expect(STAGED_GLYPH_FOR_INGREDIENT.nduja).toBe("nduja-dollops");
  });

  it("is UNWIRED: the id is not registered in IngredientGlyph.tsx, ingredients.ts, or any catalog file (the T26 apply does that)", () => {
    const root = join(__dirname, "..", "..");
    for (const f of ["components/IngredientGlyph.tsx", "data/ingredients.ts", "data/lateCatalog.ts", "data/recipes.ts"]) {
      expect(readFileSync(join(root, f), "utf8"), f).not.toContain("nduja-dollops");
    }
  });
});
