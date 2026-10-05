// @vitest-environment node
import path from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { DEV_BACKUP_KEY_SUFFIX, DEV_EDITOR_BACKUP_TITLE, DEV_EDITOR_REVIEW_TITLE, DEV_STATE_EDITOR_MARK, DEV_STATE_EDITOR_TITLE } from "../devtools/marks";
import { PENDING_PRESETS, PRESETS } from "../devtools/presets";
import { HV_SCENARIOS } from "./hvSeeds";

/**
 * Discovery Hint 5.0 H5-5, gates P1 / P4 (bundle level): the production bundle contains none of the
 * Preview Hint 5.0 helper, and a Preview bundle does (so this scan can see what it looks for).
 *
 * Both builds are real `vite build`s of this repo, made in memory (nothing is written), one without and
 * one with `VITE_PREVIEW_MODE` (what the Preview pipeline sets). The behavioural counterparts on the built
 * apps are in e2e/hint5-preview.spec.ts (P2 / P3 / P5 to P12).
 */

const root = path.resolve(__dirname, "../..");

async function bundleText(previewMode: boolean): Promise<string> {
  const saved = process.env.VITE_PREVIEW_MODE;
  const savedNodeEnv = process.env.NODE_ENV;
  if (previewMode) process.env.VITE_PREVIEW_MODE = "1";
  else delete process.env.VITE_PREVIEW_MODE;
  // Vitest runs with NODE_ENV=test, which Vite would read as a DEV build (import.meta.env.DEV = true).
  // A production build has NODE_ENV=production.
  process.env.NODE_ENV = "production";
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

/** Strings that exist only in the Preview Hint 5.0 helper (./hint5PreviewOptIn.ts, ./hvSeeds.ts). */
const PREVIEW_ONLY_STRINGS = [
  "h5-preview-helper-v1", // PREVIEW_HELPER_MARK: in both helper modules
  "teto-pizza-preview-hint5-optin", // the opt-in key
  // Every seed id except "normal" (an ordinary word that production code uses too), and every seed label.
  ...HV_SCENARIOS.map((s) => s.id).filter((id) => id !== "normal"),
  ...HV_SCENARIOS.map((s) => s.labelJa),
  "teto-pizza-preview-save-v1", // the Preview save namespace (already compiled out before H5-5)
  "teto.dev.hint5Ladder", // the DEV opt-in key (already compiled out before H5-5)
  "discovery-progression-inspector-v1", // INSPECTOR_MARK: the DEV / Preview-only Discovery Progression Inspector (src/dev)
  // Issue #403: the DEV / Preview-only State Editor (src/devtools): its mark, title, backup-key suffix and preset labels / ids.
  DEV_STATE_EDITOR_MARK,
  DEV_STATE_EDITOR_TITLE,
  DEV_BACKUP_KEY_SUFFIX,
  DEV_EDITOR_REVIEW_TITLE,
  DEV_EDITOR_BACKUP_TITLE,
  ...PRESETS.map((p) => p.labelJa),
  ...PENDING_PRESETS.map((p) => p.labelJa),
  "research-step12-ready",
  "step12-abc-undiscovered",
];

let production = "";
let preview = "";

afterAll(() => {
  production = "";
  preview = "";
});

describe("Preview Hint 5.0 helper isolation (real vite builds)", () => {
  it("P1: the production bundle has no Preview opt-in, no seed and no Preview key", async () => {
    production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000); // a real app bundle, not an empty result
    for (const needle of PREVIEW_ONLY_STRINGS) expect(production.includes(needle), `production bundle contains ${needle}`).toBe(false);
  }, 180_000);

  it("the scan can see the helper: a Preview bundle has the opt-in, every seed and the Preview keys", async () => {
    preview = await bundleText(true);
    for (const needle of PREVIEW_ONLY_STRINGS.filter((n) => n !== "teto.dev.hint5Ladder")) {
      expect(preview.includes(needle), `Preview bundle is missing ${needle}`).toBe(true);
    }
    // The DEV opt-in stays out of every non-DEV build, Preview included.
    expect(preview.includes("teto.dev.hint5Ladder")).toBe(false);
  }, 180_000);

  it("the two builds differ only by the Preview helper, badge and save namespace: the ladder code itself is in both (it is behind a flag that is off)", () => {
    expect(production.includes("PURCHASE_HINT5_RUNG")).toBe(true);
    expect(preview.includes("PURCHASE_HINT5_RUNG")).toBe(true);
    expect(preview.length).toBeGreaterThan(production.length);
  });
});
