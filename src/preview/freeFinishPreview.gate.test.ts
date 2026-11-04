// @vitest-environment node
import path from "node:path";
import { build, type Plugin } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { FREE_FINISH_ON_VALUE, FREE_FINISH_PARAM } from "./freeFinishPreview";

/**
 * FINISH FIN-E3a gate (bundle level), the same shape as ./doughKindPreview.gate.test.ts: the production bundle contains nothing of the
 * Preview opt-in for the Free Cooking FINISH step -- no `freeFinish` query name -- and a Preview bundle does (so this scan
 * can see what it looks for). Real, in-memory `vite build`s of this tree, one without and one with `VITE_PREVIEW_MODE`.
 */
const root = path.resolve(__dirname, "../..");

/**
 * E5: the Free Cooking FINISH production literal is `true`, so `FREE_COOK_FINISH_PRODUCTION || freeFinishPreviewOptedIn()` is statically
 * true and a bundler drops the opt-in (the `freeFinish` query name) from EVERY bundle, Preview included. The positive control therefore builds
 * with the literal set back to `false` (the pre-E5 state / the rollback), which is the state in which the opt-in is reachable and the scan must find it.
 */
const GATE_FILE = "/src/data/freeCookFinishGate.ts";
const GATE_LITERAL = /^export const FREE_COOK_FINISH_PRODUCTION = (?:true|false);$/m;
function gateLiteralOff(): Plugin {
  return {
    name: "free-finish-gate-literal-off",
    enforce: "pre",
    transform(code, id) {
      if (id.includes("?") || !id.replace(/\\/g, "/").endsWith(GATE_FILE)) return null;
      if ((code.match(new RegExp(GATE_LITERAL.source, "gm"))?.length ?? 0) !== 1) throw new Error("FREE_COOK_FINISH_PRODUCTION literal not found exactly once (fail closed)");
      return code.replace(GATE_LITERAL, "export const FREE_COOK_FINISH_PRODUCTION = false;");
    },
  };
}

async function bundleText(previewMode: boolean, literalOff = false): Promise<string> {
  const saved = process.env.VITE_PREVIEW_MODE;
  const savedNodeEnv = process.env.NODE_ENV;
  if (previewMode) process.env.VITE_PREVIEW_MODE = "1";
  else delete process.env.VITE_PREVIEW_MODE;
  process.env.NODE_ENV = "production"; // Vitest's "test" would make this a DEV build
  try {
    const result = await build({
      root,
      logLevel: "silent",
      mode: "production",
      plugins: literalOff ? [gateLiteralOff()] : [],
      build: { write: false, minify: true, reportCompressedSize: false },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => ("output" in r ? r.output : []));
    return outputs.map((o) => (o.type === "chunk" ? o.code : "")).join("\n");
  } finally {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    if (saved === undefined) delete process.env.VITE_PREVIEW_MODE;
    else process.env.VITE_PREVIEW_MODE = saved;
  }
}

/** Strings that exist only in the Preview opt-in (./freeFinishPreview.ts). */
const PREVIEW_ONLY = [FREE_FINISH_PARAM];

let production = "";
let preview = "";
afterAll(() => {
  production = "";
  preview = "";
});

describe("Free Cooking FINISH opt-in isolation (real vite builds)", () => {
  it("the names are what the Owner types (a rename here must be deliberate)", () => {
    expect(FREE_FINISH_PARAM).toBe("freeFinish");
    expect(FREE_FINISH_ON_VALUE).toBe("on");
  });

  it("the production bundle has none of the opt-in: no freeFinish query name", async () => {
    production = await bundleText(false);
    expect(production.length).toBeGreaterThan(100_000); // a real app bundle, not an empty result
    for (const needle of PREVIEW_ONLY) expect(production.includes(needle), `production bundle contains ${needle}`).toBe(false);
    // The engine itself is in production (E5: live there, the Free Cooking profile carries FINISH).
    expect(production.includes("deferFreeCookAtBake") || production.includes("POST_BAKE")).toBe(true);
  }, 240_000);

  it("the scan can see it: a Preview bundle built with the production literal OFF carries every one of them (positive control)", async () => {
    preview = await bundleText(true, true);
    for (const needle of PREVIEW_ONLY) expect(preview.includes(needle), `Preview bundle is missing ${needle}`).toBe(true);
  }, 240_000);
});
