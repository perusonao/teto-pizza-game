import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { EggplantGlyph } from "./EggplantGlyph";
import { EGGPLANT_PALETTE, EGGPLANT_STATES } from "./eggplantPalette";

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe("EggplantGlyph (Issue #417, unwired, PROVISIONAL)", () => {
  it("renders a decorative 1em inline SVG with a 64x64 box", () => {
    const html = renderToStaticMarkup(<EggplantGlyph />);
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html).toContain('width="1em"');
    expect(html).toContain('height="1em"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-ingredient-visual="eggplant-slices"');
  });

  it("defaults to raw / normal outline and exposes the state as a data attribute for every state", () => {
    const def = renderToStaticMarkup(<EggplantGlyph />);
    expect(def).toContain('data-eggplant-state="raw"');
    expect(def).toContain('data-eggplant-outline="normal"');
    for (const s of EGGPLANT_STATES) {
      expect(renderToStaticMarkup(<EggplantGlyph state={s} />)).toContain(`data-eggplant-state="${s}"`);
    }
  });

  it("draws two slices (2 skin rings, 2 flesh discs) and exposes CSS-variable hooks with state-colour fallbacks", () => {
    const html = renderToStaticMarkup(<EggplantGlyph state="fried-crisp" />);
    expect(html.match(/data-part="skin"/g)).toHaveLength(2);
    expect(html.match(/data-part="flesh"/g)).toHaveLength(2);
    for (const v of ["--eg-skin", "--eg-line", "--eg-flesh", "--eg-rim", "--eg-core", "--eg-seed", "--eg-crust", "--eg-sheen"]) {
      expect(html).toContain(`var(${v}, `);
    }
    expect(html).toContain(`var(--eg-flesh, ${EGGPLANT_PALETTE["fried-crisp"].flesh})`);
  });

  it("uses no ids, gradients, filters or url() references, so many can share one page", () => {
    for (const state of EGGPLANT_STATES) {
      for (const outline of ["normal", "strong"] as const) {
        const html = renderToStaticMarkup(<EggplantGlyph state={state} outline={outline} />);
        expect(html).not.toMatch(/\sid=/);
        expect(html).not.toMatch(/Gradient|clipPath|<defs|filter|url\(/);
      }
    }
  });

  it("keeps one silhouette for every state (only colours / state attribute differ)", () => {
    const strip = (s: string) =>
      s.replace(/#[0-9a-f]{6}/gi, "#").replace(/data-eggplant-state="[\w-]+"/, "").replace(/opacity:[^"]*?\)/g, "opacity:");
    const base = strip(renderToStaticMarkup(<EggplantGlyph state="raw" />));
    for (const s of EGGPLANT_STATES) {
      expect(strip(renderToStaticMarkup(<EggplantGlyph state={s} />))).toBe(base);
    }
  });

  it("matches the Style Lock V2 reference SVG geometry (skin rings and flesh discs)", () => {
    const ref = readFileSync("docs/design/references/ingredient-icons-2.0/eggplant.svg", "utf8");
    const html = renderToStaticMarkup(<EggplantGlyph />);
    const circles = [...ref.matchAll(/<circle data-part="(skin|flesh)" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)];
    expect(circles).toHaveLength(4);
    for (const [, part, cx, cy, r] of circles) {
      expect(html).toContain(`data-part="${part}" cx="${cx}" cy="${cy}" r="${r}"`);
    }
  });

  it("raw palette equals the reference SVG raw colours", () => {
    const ref = readFileSync("docs/design/references/ingredient-icons-2.0/eggplant.svg", "utf8");
    const p = EGGPLANT_PALETTE.raw;
    for (const c of [p.skin, p.line, p.flesh, p.rim, p.core, p.seed]) expect(ref).toContain(c);
  });

  it("strong outline is thicker and darker than normal, in every state", () => {
    const n = renderToStaticMarkup(<EggplantGlyph />);
    const s = renderToStaticMarkup(<EggplantGlyph outline="strong" />);
    expect(n).toContain('stroke-width="2.4"');
    expect(s).toContain('stroke-width="3.4"');
    for (const st of EGGPLANT_STATES) {
      const p = EGGPLANT_PALETTE[st];
      expect(lum(p.lineStrong)).toBeLessThan(lum(p.line));
    }
  });

  it("outline is the darkest tone and keeps readable contrast on pale dough and baked cheese (raw / baked / fried)", () => {
    for (const st of EGGPLANT_STATES) {
      const p = EGGPLANT_PALETTE[st];
      expect(lum(p.line)).toBeLessThan(lum(p.skin));
      expect(contrast(p.line, "#e8c15a")).toBeGreaterThan(4);
      expect(contrast(p.line, "#f5e8cc")).toBeGreaterThan(4);
    }
  });

  it("is not imported by any production module yet (unwired)", async () => {
    const { execSync } = await import("node:child_process");
    const out = execSync("grep -rl 'eggplantGlyph' src --include=*.ts --include=*.tsx || true", { cwd: process.cwd() }).toString();
    const importers = out.split("\n").filter((f) => f && !f.includes("src/components/eggplantGlyph/"));
    expect(importers).toEqual([]);
  });
});
