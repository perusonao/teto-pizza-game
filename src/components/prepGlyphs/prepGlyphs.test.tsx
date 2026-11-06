import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { BurrataSplit, EggplantSlices } from "./prepGlyphs";

/**
 * Eggplant (Style Lock V2 §12) and burrata (Owner R2 D5, candidate C) glyph art, UNWIRED. These tests pin the drawing
 * contract and that nothing imports the module yet, so wiring (ingredients.ts / IngredientGlyph.tsx / App.css) stays a
 * separate, claim-gated change.
 */
const GLYPHS = [
  ["eggplant", EggplantSlices],
  ["burrata", BurrataSplit],
] as const;

const svg = (C: () => ReactElement) => renderToStaticMarkup(<svg viewBox="0 0 64 64">{C()}</svg>);

describe("prepGlyphs (unwired)", () => {
  it.each(GLYPHS)("%s: pure inline art, no ids / gradients / external refs", (_n, C) => {
    const m = svg(C);
    expect(m).not.toMatch(/\sid=|url\(|<image|<script|<style|href=|<defs/);
    expect(m).toMatch(/stroke="#/);
    expect(m).toMatch(/opacity="\.15"/); // ground shadow, like the other 64x64 glyphs
  });

  it("eggplant keeps the state hooks (data-part) used by the baked / fried state CSS", () => {
    const m = svg(EggplantSlices);
    for (const part of ["skin", "shine", "flesh", "crust", "core", "seed", "sheen"]) expect(m).toContain(`data-part="${part}"`);
    expect((m.match(/data-part="skin"/g) ?? []).length).toBe(2); // two round slices
  });

  it("burrata is warm-outlined (not the grey/dark outline of other cheeses) and shows the cream", () => {
    const m = svg(BurrataSplit);
    expect(m).toContain("#85694a");
    expect(m).toContain("#f9e8b4"); // cream
  });

  it("the two drawings differ", () => {
    expect(svg(EggplantSlices)).not.toEqual(svg(BurrataSplit));
  });

  it("is imported by nothing but its own test (wiring is a separate PR)", () => {
    const root = join(__dirname, "..", "..");
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f) && !p.includes("prepGlyphs") && /prepGlyphs/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});
