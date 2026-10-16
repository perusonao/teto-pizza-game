// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { TOPPING_SCALE_PARAM, TOPPING_SCALE_PREVIEW_MARK } from "./toppingScalePreview";

/**
 * #479 S2b-1 gate (bundle level): the production bundle contains nothing of the Preview topping-scale switch -- no query name,
 * no marker -- and a Preview bundle does (so this scan can see what it looks for). Real, in-memory `vite build`s of this
 * tree, one without and one with `VITE_PREVIEW_MODE` (what the Preview pipeline sets), as ./previewIsolation.gate.test.ts.
 */
const root = path.resolve(__dirname, "../..");

async function bundleText(previewMode: boolean): Promise<string> {
  const saved = process.env.VITE_PREVIEW_MODE;
  const savedNodeEnv = process.env.NODE_ENV;
  if (previewMode) process.env.VITE_PREVIEW_MODE = "1";
  else delete process.env.VITE_PREVIEW_MODE;
  process.env.NODE_ENV = "production"; // Vitest's "test" would make this a DEV build
  try {
    const result = await build({ root, logLevel: "silent", mode: "production", build: { write: false, minify: true, reportCompressedSize: false } });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => ("output" in r ? r.output : []));
    return outputs.map((o) => (o.type === "chunk" ? o.code : "")).join("\n");
  } finally {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    if (saved === undefined) delete process.env.VITE_PREVIEW_MODE;
    else process.env.VITE_PREVIEW_MODE = saved;
  }
}

/** Strings that exist only in the Preview switch (../preview/toppingScalePreview.ts). */
const PREVIEW_ONLY = [TOPPING_SCALE_PARAM, TOPPING_SCALE_PREVIEW_MARK, "data-topping-scale-preview"];

let production = "";
let preview = "";
afterAll(() => {
  production = "";
  preview = "";
});

describe("topping-scale switch isolation (real vite builds)", () => {
  it("the names are what the Owner types (a rename here must be deliberate)", () => {
    expect(TOPPING_SCALE_PARAM).toBe("toppingScale");
  });

  it("the production bundle has none of the switch: no query name, no marker", async () => {
    production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000); // a real app bundle, not an empty result
    for (const needle of PREVIEW_ONLY) expect(production.includes(needle), `production bundle contains ${needle}`).toBe(false);
    // The production multipliers (the size-class table, all 1) are in production -- only the comparison switch is not.
    expect(production.includes("piece-rank-scale")).toBe(true);
  }, 240_000);

  it("the scan can see it: a Preview bundle carries every one of them (positive control)", async () => {
    preview = await bundleText(true);
    for (const needle of PREVIEW_ONLY) expect(preview.includes(needle), `Preview bundle is missing ${needle}`).toBe(true);
  }, 240_000);
});
