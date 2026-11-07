// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { describe, expect, it } from "vitest";

/**
 * FOLD+SEAL Lab (Issue #773 T6-F2) gate (bundle level), the same shape as the other DEV-lab gates: real, in-memory `vite build`s of this tree, one without and
 * one with `VITE_PREVIEW_MODE` (what the Preview pipeline sets). The lab is a stand-alone HTML entry that no build includes, so NEITHER output may contain
 * it: no foldseal-lab.html, no lab chunk, no lab text, no lab class, and no F1 machine code (it is only reachable from the lab).
 */
const root = path.resolve(__dirname, "../../..");
const NEEDLES = ["FOLD+SEAL Lab", "fsl__", "fsl-hit", "foldseal-lab", "foldSealLab", "seam-bin-", "前の工程を変える", "foldSealReduce", "FOLD_BUTTON", "SEAL_RESET"];

async function outputs(previewMode: boolean) {
  const saved = process.env.VITE_PREVIEW_MODE;
  const savedNodeEnv = process.env.NODE_ENV;
  if (previewMode) process.env.VITE_PREVIEW_MODE = "1";
  else delete process.env.VITE_PREVIEW_MODE;
  process.env.NODE_ENV = "production"; // Vitest's "test" would make this a DEV build
  try {
    const result = await build({ root, logLevel: "silent", mode: "production", build: { write: false, minify: false, reportCompressedSize: false } });
    const list = (Array.isArray(result) ? result : [result]).flatMap((r) => ("output" in r ? r.output : []));
    return list.map((o) => ({ name: o.fileName, text: o.type === "chunk" ? o.code : typeof o.source === "string" ? o.source : "" }));
  } finally {
    if (saved === undefined) delete process.env.VITE_PREVIEW_MODE;
    else process.env.VITE_PREVIEW_MODE = saved;
    process.env.NODE_ENV = savedNodeEnv;
  }
}

describe("the lab is excluded from every build", () => {
  it.each([["production", false], ["Preview (VITE_PREVIEW_MODE)", true]] as const)("%s bundle: no lab HTML, chunk, text or machine code", async (_n, preview) => {
    const out = await outputs(preview);
    expect(out.length).toBeGreaterThan(0);
    expect(out.map((o) => o.name).filter((n) => /foldseal/i.test(n))).toEqual([]);
    expect(out.filter((o) => o.name.endsWith(".html")).map((o) => o.name)).toEqual(["index.html"]);
    for (const needle of NEEDLES) expect(out.filter((o) => o.text.includes(needle)).map((o) => o.name), needle).toEqual([]);
  }, 180_000);
});
