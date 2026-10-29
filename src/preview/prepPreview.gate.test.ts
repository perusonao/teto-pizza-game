// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { PREP_ON_VALUE, PREP_PARAM } from "./prepPreview";

/**
 * Cooking Prep Phase 1 PR-A gate (bundle level), the same shape as ./freeFinishPreview.gate.test.ts: the PRODUCTION bundle contains nothing of the
 * Preview opt-in -- no `cookPrep` query name, so the prep experience cannot be switched on there -- and a Preview bundle does (so the scan can see
 * what it looks for). Real, in-memory `vite build`s of this tree, one without and one with `VITE_PREVIEW_MODE`. The production literal stays
 * `false` (PREP_EXPERIENCE_PRODUCTION), so no literal override is needed for the positive control.
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

describe("Cooking Prep opt-in isolation (real vite builds)", () => {
  it("the names are what the Owner types (a rename here must be deliberate)", () => {
    expect(PREP_PARAM).toBe("cookPrep");
    expect(PREP_ON_VALUE).toBe("on");
  });

  it("the production bundle has none of the opt-in: no cookPrep query name", async () => {
    production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000); // a real app bundle, not an empty result
    expect(production.includes(PREP_PARAM), `production bundle contains ${PREP_PARAM}`).toBe(false);
  }, 240_000);

  it("the scan can see it: a Preview bundle carries the query name (positive control)", async () => {
    preview = await bundleText(true);
    expect(preview.includes(PREP_PARAM), `Preview bundle is missing ${PREP_PARAM}`).toBe(true);
  }, 240_000);
});
