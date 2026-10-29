// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { COOK_PREP_HV_MARK, COOK_PREP_HV_PARAM } from "./cookPrepHv";

/**
 * Cooking Prep HV entry gate (bundle level), the same shape as ./prepPreview.gate.test.ts: the PRODUCTION bundle contains nothing of the
 * `?cookPrepHv=1` entry (no query name, no mark), and a Preview bundle does (so the scan can see what it looks for). Real, in-memory
 * `vite build`s of this tree, one without and one with `VITE_PREVIEW_MODE`.
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

let production = "";
let preview = "";
afterAll(() => {
  production = "";
  preview = "";
});

describe("Cooking Prep HV entry isolation (real vite builds)", () => {
  it("the names are what the Owner types (a rename here must be deliberate)", () => {
    expect(COOK_PREP_HV_PARAM).toBe("cookPrepHv");
  });

  it("the production bundle has none of the entry: no query name, no mark", async () => {
    production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000); // a real app bundle, not an empty result
    for (const needle of [COOK_PREP_HV_PARAM, COOK_PREP_HV_MARK]) expect(production.includes(needle), `production bundle contains ${needle}`).toBe(false);
  }, 240_000);

  it("the scan can see it: a Preview bundle carries both (positive control)", async () => {
    preview = await bundleText(true);
    for (const needle of [COOK_PREP_HV_PARAM, COOK_PREP_HV_MARK]) expect(preview.includes(needle), `Preview bundle is missing ${needle}`).toBe(true);
  }, 240_000);
});
