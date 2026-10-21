// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { SQUARE_MODEL_PARAM, SQUARE_OK_PARAM, SQUARE_STRETCH_PREVIEW_MARK } from "./squareModelPreview";

/**
 * Push-stretch prototype gate (bundle level), exactly as ./panShapePreview.gate.test.ts: the production bundle contains nothing of the
 * prototype switch -- not its query names, not its marker, not the prototype's UI hooks -- and a Preview bundle does (so the scan can see
 * what it looks for). Real, in-memory `vite build`s of this tree, one without and one with `VITE_PREVIEW_MODE`.
 */
const root = path.resolve(__dirname, "../..");

async function bundleText(previewMode: boolean): Promise<string> {
  const saved = process.env.VITE_PREVIEW_MODE;
  const savedNodeEnv = process.env.NODE_ENV;
  if (previewMode) process.env.VITE_PREVIEW_MODE = "1";
  else delete process.env.VITE_PREVIEW_MODE;
  process.env.NODE_ENV = "production";
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

/** Strings that exist only in the prototype (the switch, the stretch model and its STEP 2 marks). */
const PROTOTYPE_ONLY = [SQUARE_STRETCH_PREVIEW_MARK, SQUARE_MODEL_PARAM, SQUARE_OK_PARAM, "square-stretch-marks"];

let production = "";
let preview = "";
afterAll(() => {
  production = "";
  preview = "";
});

describe("square push-stretch prototype isolation (real vite builds)", () => {
  it("the names are what the Owner types (a rename here must be deliberate)", () => {
    expect(SQUARE_MODEL_PARAM).toBe("squareModel");
    expect(SQUARE_OK_PARAM).toBe("squareOk");
  });

  it("the production bundle has none of the prototype: no marker, no query name, no marks", async () => {
    production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000);
    for (const needle of PROTOTYPE_ONLY) expect(production.includes(needle), `production bundle contains ${needle}`).toBe(false);
  }, 240_000);

  it("the scan can see it: a Preview bundle carries every one of them (positive control)", async () => {
    preview = await bundleText(true);
    for (const needle of PROTOTYPE_ONLY) expect(preview.includes(needle), `Preview bundle is missing ${needle}`).toBe(true);
  }, 240_000);
});
