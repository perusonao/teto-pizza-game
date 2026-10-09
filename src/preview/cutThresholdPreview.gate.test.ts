// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { CUT_AREA_PCT_PARAM, CUT_MIN_WIDTH_PARAM, CUT_THRESHOLD_PREVIEW_MARK } from "./cutThresholdPreview";

/**
 * #427 gate (bundle level): the production bundle contains nothing of the Preview CUT-threshold override -- no query names,
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

/** Strings that exist only in the Preview override (../preview/cutThresholdPreview.ts). */
const PREVIEW_ONLY = [CUT_AREA_PCT_PARAM, CUT_MIN_WIDTH_PARAM, CUT_THRESHOLD_PREVIEW_MARK, "data-cut-threshold-preview"];

let production = "";
let preview = "";
afterAll(() => {
  production = "";
  preview = "";
});

describe("CUT threshold override isolation (real vite builds)", () => {
  it("the names are what the Owner types (a rename here must be deliberate)", () => {
    expect(CUT_AREA_PCT_PARAM).toBe("cutAreaPct");
    expect(CUT_MIN_WIDTH_PARAM).toBe("cutMinWidth");
  });

  it("the production bundle has none of the override: no query name, no marker", async () => {
    production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000); // a real app bundle, not an empty result
    for (const needle of PREVIEW_ONLY) expect(production.includes(needle), `production bundle contains ${needle}`).toBe(false);
    // The thresholds themselves are in production (the defaults) -- only the override machinery is not.
    expect(production.includes("areaFraction")).toBe(true);
  }, 240_000);

  it("the scan can see it: a Preview bundle carries every one of them (positive control)", async () => {
    preview = await bundleText(true);
    for (const needle of PREVIEW_ONLY) expect(preview.includes(needle), `Preview bundle is missing ${needle}`).toBe(true);
  }, 240_000);
});
