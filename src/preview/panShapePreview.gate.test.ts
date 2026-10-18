// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { PAN_PARAM, PAN_SHAPE_PREVIEW_MARK, SQUARE_START_PARAM } from "./panShapePreview";

/**
 * #535 gate (bundle level): the production bundle contains nothing of the Preview square-pan switch -- no query name that is specific
 * to it, no marker, no badge attribute -- and a Preview bundle does (so this scan can see what it looks for). Real, in-memory
 * `vite build`s of this tree, one without and one with `VITE_PREVIEW_MODE` (what the Preview pipeline sets), exactly as
 * ./resultScalePreview.gate.test.ts. `?pan=` itself is too short a name to scan for (it is part of ordinary words), so the scan
 * uses the marker, the `squareStart` name and the badge attribute, which only the switch has; the unit test of ./panShapePreview.ts
 * pins what `?pan=` does.
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

/** Strings that exist only in the Preview switch (./panShapePreview.ts and its badge). */
const PREVIEW_ONLY = [PAN_SHAPE_PREVIEW_MARK, SQUARE_START_PARAM, "data-pan-shape-preview"];

let production = "";
let preview = "";
afterAll(() => {
  production = "";
  preview = "";
});

describe("square-pan switch isolation (real vite builds)", () => {
  it("the names are what the Owner types (a rename here must be deliberate)", () => {
    expect(PAN_PARAM).toBe("pan");
    expect(SQUARE_START_PARAM).toBe("squareStart");
  });

  it("the production bundle has none of the switch: no marker, no squareStart name, no badge attribute", async () => {
    production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000); // a real app bundle, not an empty result
    for (const needle of PREVIEW_ONLY) expect(production.includes(needle), `production bundle contains ${needle}`).toBe(false);
    // The reducer's own action is in production (it is inert there: no round is a square-pan round).
    expect(production.includes("COMMIT_SQUARE_DOUGH")).toBe(true);
  }, 240_000);

  it("the scan can see it: a Preview bundle carries every one of them (positive control)", async () => {
    preview = await bundleText(true);
    for (const needle of PREVIEW_ONLY) expect(preview.includes(needle), `Preview bundle is missing ${needle}`).toBe(true);
  }, 240_000);
});
