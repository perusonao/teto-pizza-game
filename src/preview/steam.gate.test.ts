// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { COOK_STEAM_HV_MARK, COOK_STEAM_HV_PARAM } from "./cookSteamHv";
import { STEAM_MS_PARAM, STEAM_OPT_IN_STORAGE_KEY, STEAM_PARAM, STEAM_VARIANT_PARAM } from "./steamPreview";

/**
 * Cooking Steam Phase 1 (#726, S3) Preview / DEV isolation (bundle level), the same shape as ./searPreview.gate.test.ts and ./cookSearHv.gate.test.ts: the PRODUCTION
 * bundle contains nothing of the `?cookSteam=on` opt-in, its variant / lid-time comparison switches, its tab-memory key or the `?cookSteamHv=1` entry (no query name,
 * no mark), and a Preview bundle does (so the scan can see what it looks for). Real, in-memory `vite build`s of this tree, one without and one with
 * `VITE_PREVIEW_MODE`. The steam itself ships in the bundle (the reducer / layer are there, production flag OFF); only the Preview / DEV switches must be absent.
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

const NEEDLES = [STEAM_PARAM, STEAM_VARIANT_PARAM, STEAM_MS_PARAM, STEAM_OPT_IN_STORAGE_KEY, COOK_STEAM_HV_PARAM, COOK_STEAM_HV_MARK];

let production = "";
let preview = "";
afterAll(() => {
  production = "";
  preview = "";
});

describe("Cooking Steam Preview / DEV isolation (real vite builds)", () => {
  it("the names are what the Owner types (a rename here must be deliberate)", () => {
    expect([STEAM_PARAM, STEAM_VARIANT_PARAM, STEAM_MS_PARAM, STEAM_OPT_IN_STORAGE_KEY, COOK_STEAM_HV_PARAM]).toEqual(["cookSteam", "cookSteamVariant", "cookSteamMs", "teto:cookSteam", "cookSteamHv"]);
  });

  it("the production bundle has none of the switches: no query name, no tab-memory key, no HV mark", async () => {
    production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000); // a real app bundle, not an empty result
    for (const needle of NEEDLES) expect(production.includes(needle), `production bundle contains ${needle}`).toBe(false);
  }, 240_000);

  it("the production bundle still ships the steam itself, with the production flag OFF (the scan is looking at the right bundle)", () => {
    expect(production.includes("STEAM_INGREDIENT")).toBe(true);
    expect(production.includes("cooking-steam-pill")).toBe(true);
  });

  it("the scan can see them: a Preview bundle carries every one (positive control)", async () => {
    preview = await bundleText(true);
    for (const needle of NEEDLES) expect(preview.includes(needle), `Preview bundle is missing ${needle}`).toBe(true);
  }, 240_000);
});
