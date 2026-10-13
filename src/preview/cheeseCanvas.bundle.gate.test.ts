// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { describe, expect, it } from "vitest";

/**
 * #486 T1, bundle gate: with `CHEESE_CANVAS_PRODUCTION_ENABLED = false` (the committed value) a real production `vite build` carries NO Canvas mozzarella
 * path (renderer, canvas component, opt-in key, query switch), so production shows M1 only. A Preview build (VITE_PREVIEW_MODE) does carry it (so this scan
 * can see what it looks for). The constant being flipped is simulated in memory (nothing is written), to show the opt-in key then appears in a production build.
 */
const root = path.resolve(__dirname, "../..");
const MARKERS = ["pizza-cheese-canvas", "teto-pizza-cheese-canvas", "blank canvas"]; // class name, opt-in key, a string only the Canvas component throws (function names are minified away)
const FLAG_LINE = /^export const CHEESE_CANVAS_PRODUCTION_ENABLED = false;$/m;

async function bundleText(opts: { preview: boolean; enableProduction?: boolean }): Promise<string> {
  const saved = { p: process.env.VITE_PREVIEW_MODE, n: process.env.NODE_ENV };
  if (opts.preview) process.env.VITE_PREVIEW_MODE = "1";
  else delete process.env.VITE_PREVIEW_MODE;
  process.env.NODE_ENV = "production";
  try {
    const result = await build({
      root,
      logLevel: "silent",
      mode: "production",
      build: { write: false, minify: true, reportCompressedSize: false },
      plugins: opts.enableProduction
        ? [
            {
              name: "cheese-canvas-flag-on",
              enforce: "pre",
              transform(code, id) {
                if (id.includes("?") || !id.replace(/\\/g, "/").endsWith("/src/preview/cheeseRenderMode.ts")) return null;
                if (!FLAG_LINE.test(code)) throw new Error("flag line not found (fail closed)");
                return code.replace(FLAG_LINE, "export const CHEESE_CANVAS_PRODUCTION_ENABLED = true;");
              },
            },
          ]
        : [],
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => ("output" in r ? r.output : []));
    return outputs.map((o) => (o.type === "chunk" ? o.code : "")).join("\n");
  } finally {
    if (saved.n === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved.n;
    if (saved.p === undefined) delete process.env.VITE_PREVIEW_MODE;
    else process.env.VITE_PREVIEW_MODE = saved.p;
  }
}

describe("#486 T1: Canvas mozzarella production bundle gate (real vite builds)", () => {
  it("the committed production bundle has no Canvas mozzarella path", async () => {
    const prod = await bundleText({ preview: false });
    expect(prod.length).toBeGreaterThan(100_000);
    for (const m of ["teto-pizza-cheese-canvas", "blank canvas"]) expect(prod.includes(m), `production bundle contains ${m}`).toBe(false);
    // the drawing code's own strings (the component's class name is also in the shipped CSS, which is not scanned here)
    expect(prod.includes("pizza-cheese-canvas")).toBe(false);
  }, 240_000);

  it("the scan can see them: a Preview bundle carries the Canvas path", async () => {
    const preview = await bundleText({ preview: true });
    for (const m of MARKERS) expect(preview.includes(m), `Preview bundle is missing ${m}`).toBe(true);
  }, 240_000);

  it("flipping the constant (in memory) puts the opt-in into a production bundle, which proves the committed false is what keeps it out", async () => {
    const on = await bundleText({ preview: false, enableProduction: true });
    for (const m of MARKERS) expect(on.includes(m), `enabled production bundle is missing ${m}`).toBe(true);
  }, 240_000);
});
