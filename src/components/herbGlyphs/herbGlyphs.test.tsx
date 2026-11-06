import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ArtichokeQuarter,
  OreganoPile,
  RosemarySprigs,
  SpinachLeaves,
  ARTICHOKE_VISUAL_ID,
  OREGANO_VISUAL_ID,
  ROSEMARY_VISUAL_ID,
  SPINACH_VISUAL_ID,
} from "./herbGlyphs";

/**
 * Herb glyphs (Owner R2 decision 2026-11-06). UNWIRED: these tests pin the drawing contract and that nothing imports the
 * module yet, so the wiring PR (ingredients.ts / IngredientGlyph.tsx / App.css) stays a separate, claim-gated change.
 */
const HERBS = [
  ["rosemary", ROSEMARY_VISUAL_ID, RosemarySprigs],
  ["oregano", OREGANO_VISUAL_ID, OreganoPile],
  ["spinach", SPINACH_VISUAL_ID, SpinachLeaves],
  ["artichoke", ARTICHOKE_VISUAL_ID, ArtichokeQuarter],
] as const;

const svg = (C: () => ReactElement) => renderToStaticMarkup(<svg viewBox="0 0 64 64">{C()}</svg>);

describe("herbGlyphs (unwired)", () => {
  it.each(HERBS)("%s: pure inline art, no ids / gradients / external refs", (_n, _id, C) => {
    const m = svg(C);
    expect(m).not.toMatch(/\sid=|url\(|<image|<script|<style|href=/);
    expect(m).toMatch(/stroke="#/); // Style Lock v2 outline present
    expect(m).toMatch(/opacity="\.15"/); // ground shadow, like the other 64x64 glyphs
  });

  it("the four drawings are all different", () => {
    const set = new Set(HERBS.map(([, , C]) => svg(C)));
    expect(set.size).toBe(4);
  });

  it("uses the Owner-approved candidate ids", () => {
    expect(HERBS.map(([, id]) => id)).toEqual(["rosemary-b", "oregano-b", "spinach-a2", "artichoke-a2"]);
  });

  it("is imported by nothing but its own test (wiring is a separate PR)", () => {
    const root = join(__dirname, "..", "..");
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f) && !p.includes("herbGlyphs") && /herbGlyphs/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});
