// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { SQUARE_DOUGH_DIAG_MARK } from "./squareDoughDiag";

/**
 * #535 B2 diagnostics gate (bundle level): the production bundle contains nothing of the temporary on-device diagnostics (no marker, no
 * panel text, no test id), and a Preview bundle does (so this scan can see what it looks for). Real in-memory `vite build`s, one
 * without and one with `VITE_PREVIEW_MODE`, exactly as ./panShapePreview.gate.test.ts. Delete with the diagnostics.
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

const DIAG_ONLY = [SQUARE_DOUGH_DIAG_MARK, "SQUARE DIAG", "square-dough-diag"];

let production = "";
let preview = "";
afterAll(() => {
  production = "";
  preview = "";
});

describe("square dough diagnostics isolation (real vite builds)", () => {
  it("the production bundle has none of the diagnostics", async () => {
    production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000);
    for (const needle of DIAG_ONLY) expect(production.includes(needle), `production bundle contains ${needle}`).toBe(false);
    expect(production.includes("COMMIT_SQUARE_DOUGH")).toBe(true); // sanity: the scan reads the real app
  }, 240_000);

  it("the scan can see it: a Preview bundle carries every one of them (positive control)", async () => {
    preview = await bundleText(true);
    for (const needle of DIAG_ONLY) expect(preview.includes(needle), `Preview bundle is missing ${needle}`).toBe(true);
  }, 240_000);
});
