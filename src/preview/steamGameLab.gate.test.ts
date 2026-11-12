// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { STEAM_GAME_LAB_LABEL, STEAM_GAME_LAB_MARK, STEAM_GAME_LAB_PARAM } from "./steamGameLab";

/**
 * #755 Steam Gameplay Lab gate (bundle level), the same shape as ./freeFinishPreview.gate.test.ts: the production bundle (JS and CSS) contains
 * nothing of the lab, a Preview bundle does (positive control). Real, in-memory `vite build`s of this tree.
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

const LAB_ONLY = [STEAM_GAME_LAB_PARAM, STEAM_GAME_LAB_MARK, "蒸しミニゲーム", "sgl__", "sgl-scene"];
let production = "";
let preview = "";
afterAll(() => {
  production = "";
  preview = "";
});

describe("Steam Gameplay Lab isolation (real vite builds)", () => {
  it("the production bundle has none of the lab", async () => {
    production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000);
    for (const needle of LAB_ONLY) expect(production.includes(needle), `production bundle contains ${needle}`).toBe(false);
    // the shared "試作・保存されません" label is also used by other labs, so it is not a needle here
    expect(STEAM_GAME_LAB_LABEL.length).toBeGreaterThan(0);
  }, 240_000);
  it("a Preview bundle carries every one of them (positive control)", async () => {
    preview = await bundleText(true);
    for (const needle of LAB_ONLY) expect(preview.includes(needle), `Preview bundle is missing ${needle}`).toBe(true);
  }, 240_000);
});
