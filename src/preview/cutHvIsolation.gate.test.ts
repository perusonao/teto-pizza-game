// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { describe, expect, it } from "vitest";

/**
 * CUT-S2 Owner HV (Issue #288): the production bundle contains none of the Preview-only CUT HV page, and a
 * Preview bundle does (so this scan can see what it looks for). Real in-memory `vite build`s, like
 * ./previewIsolation.gate.test.ts.
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
    return outputs.map((o) => (o.type === "chunk" ? o.code : typeof o.source === "string" ? o.source : "")).join("\n");
  } finally {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    if (saved === undefined) delete process.env.VITE_PREVIEW_MODE;
    else process.env.VITE_PREVIEW_MODE = saved;
  }
}

const CUT_HV_ONLY_STRINGS = [
  "cut-hv-preview-v1", // CUT_HV_PREVIEW_MARK
  "teto-pizza-preview-cuthv-v1", // the trial-record key
  "cuthv", // the activation query name
  "cut-hv-result", // the page's CSS
  "この回をやり直す（記録しない）",
  "結果をコピー",
  "全部終わり！",
];

describe("CUT HV Preview page isolation (real vite builds)", () => {
  it("the production bundle has no CUT HV page, activation, key or CSS", async () => {
    const production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000);
    for (const needle of CUT_HV_ONLY_STRINGS) expect(production.includes(needle), `production bundle contains ${needle}`).toBe(false);
  }, 180_000);

  it("the scan can see the page: a Preview bundle has every one of those strings", async () => {
    const preview = await bundleText(true);
    for (const needle of CUT_HV_ONLY_STRINGS) expect(preview.includes(needle), `Preview bundle is missing ${needle}`).toBe(true);
  }, 180_000);
});
