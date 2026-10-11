// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { BROWSER_ENV_PREVIEW_MARK } from "./browserEnvPreview";
import { PIECE_RELIEF_PARAM, PIECE_RELIEF_PREVIEW_MARK } from "./pieceReliefPreview";

/**
 * #467 gate (bundle level): the production bundle contains nothing of the diagnostic `?pieceRelief=off` -- no query name,
 * no marker -- and a Preview bundle does. Real in-memory `vite build`s, as ./cutThresholdPreview.gate.test.ts.
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

const PREVIEW_ONLY = [PIECE_RELIEF_PARAM, PIECE_RELIEF_PREVIEW_MARK, "RELIEF OFF", "data-piece-relief-preview", BROWSER_ENV_PREVIEW_MARK, "data-browser-env-preview"];

let production = "";
let preview = "";
afterAll(() => {
  production = "";
  preview = "";
});

describe("#467 pieceRelief diagnostic isolation (real vite builds)", () => {
  it("the production bundle has none of it", async () => {
    production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000);
    for (const text of PREVIEW_ONLY) expect(production, text).not.toContain(text);
  }, 180_000);

  it("a Preview bundle has all of it (so the scan can see what it looks for)", async () => {
    preview = await bundleText(true);
    for (const text of PREVIEW_ONLY) expect(preview, text).toContain(text);
  }, 180_000);
});
