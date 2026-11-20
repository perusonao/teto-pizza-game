// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { DRIZZLE_LAB_LABEL, DRIZZLE_LAB_MARK, DRIZZLE_LAB_PARAM } from "./drizzleLab";

/**
 * #579 DRIZZLE Gesture Lab gate (bundle level), the same shape as ./freeFinishPreview.gate.test.ts: the production bundle contains nothing of
 * the lab -- no `drizzleLab` query name, no mark, no label, no component text -- and a Preview bundle does (so this scan can see what it looks
 * for). Real, in-memory `vite build`s of this tree, one without and one with `VITE_PREVIEW_MODE`.
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
    // Chunks AND emitted CSS: the lab's stylesheet must not ship either.
    return outputs.map((o) => (o.type === "chunk" ? o.code : typeof o.source === "string" ? o.source : "")).join("\n");
  } finally {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    if (saved === undefined) delete process.env.VITE_PREVIEW_MODE;
    else process.env.VITE_PREVIEW_MODE = saved;
  }
}

/** Strings that exist only in the lab (./drizzleLab.ts, ./DrizzleLab.tsx, ./drizzleLab.css). */
const LAB_ONLY = [DRIZZLE_LAB_PARAM, DRIZZLE_LAB_MARK, DRIZZLE_LAB_LABEL, "DRIZZLE Gesture Lab", "drizzle-lab__", "drizzle-surface"];

let production = "";
let preview = "";
afterAll(() => {
  production = "";
  preview = "";
});

describe("DRIZZLE Gesture Lab isolation (real vite builds)", () => {
  it("the names are what the Owner types (a rename here must be deliberate)", () => {
    expect(DRIZZLE_LAB_PARAM).toBe("drizzleLab");
    expect(DRIZZLE_LAB_MARK).toBe("drizzle-gesture-lab-v1");
  });

  it("the production bundle has none of the lab: no query name, mark, label, component text or stylesheet", async () => {
    production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000); // a real app bundle, not an empty result
    for (const needle of LAB_ONLY) expect(production.includes(needle), `production bundle contains ${needle}`).toBe(false);
  }, 240_000);

  it("the scan can see it: a Preview bundle carries every one of them (positive control)", async () => {
    preview = await bundleText(true);
    for (const needle of LAB_ONLY) expect(preview.includes(needle), `Preview bundle is missing ${needle}`).toBe(true);
  }, 240_000);
});
