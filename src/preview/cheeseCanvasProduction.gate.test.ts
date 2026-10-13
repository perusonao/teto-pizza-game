// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import { CHEESE_CANVAS_OPT_IN_KEY } from "./cheeseRenderMode";

/**
 * #486 T1 (bundle level): the production bundle carries the Canvas mozzarella but only behind the opt-in (OFF by default), and none of the
 * S2-B Preview / DEV comparison switch (`?cheese=` and its `cheesePx` size). A Preview bundle has both, so the scan can see what it looks for.
 */
const root = path.resolve(__dirname, "../..");

async function bundleText(previewMode: boolean): Promise<string> {
  const saved = process.env.VITE_PREVIEW_MODE;
  const savedNodeEnv = process.env.NODE_ENV;
  if (previewMode) process.env.VITE_PREVIEW_MODE = "1";
  else delete process.env.VITE_PREVIEW_MODE;
  process.env.NODE_ENV = "production"; // Vitest's NODE_ENV=test would otherwise read as a DEV build
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

describe("Canvas mozzarella production opt-in (real vite builds)", () => {
  it("production: the opt-in key and the Canvas path are present, the Preview comparison switch is not", async () => {
    const production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000);
    expect(production.includes(CHEESE_CANVAS_OPT_IN_KEY)).toBe(true);
    expect(production.includes("cheeseCanvas")).toBe(true);
    expect(production.includes("pizza-cheese-canvas")).toBe(true);
    expect(production.includes("cheesePx")).toBe(false);
  }, 180_000);

  it("Preview: the opt-in and the ?cheese= comparison switch are both there", async () => {
    const preview = await bundleText(true);
    expect(preview.includes(CHEESE_CANVAS_OPT_IN_KEY)).toBe(true);
    expect(preview.includes("cheesePx")).toBe(true);
  }, 180_000);
});
