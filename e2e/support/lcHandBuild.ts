import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "vite";

/**
 * LC-R6-b (test-only): real `vite build`s of THIS source tree for the Preview activation proofs.
 *
 * `variant` rewrites the one committed line `LC_HAND_PREVIEW_CAPACITY = null` of src/preview/lcHandPreview.ts
 * in memory (nothing is written to the repo), which is exactly what an HV-only disposable commit changes. The
 * transform throws unless it finds that line exactly once, so a refactor cannot silently turn a "variant" build
 * into a plain build (fail closed).
 */
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const VARIANT_FILE = "/src/preview/lcHandPreview.ts";
export const VARIANT_LINE = /^export const LC_HAND_PREVIEW_CAPACITY: LcHandPreviewCapacity = null;$/m;

/** LC-R6-e: the ONE rollback line of src/logic/catalog/handPolicy.ts. */
const POLICY_FILE = "/src/logic/catalog/handPolicy.ts";
export const PRODUCTION_FLAG_LINE = /^export const HAND_ENFORCEMENT_PRODUCTION = true;$/m;

export interface LcBuildSpec {
  outDir: string;
  base: string;
  /** VITE_PREVIEW_MODE=1 (what the Preview pipeline sets). Production builds never set it. */
  preview: boolean;
  /** null = the source exactly as committed. */
  variant: 9 | 12 | null;
  /** LC-R6-e: build with the Production flag rolled back (`HAND_ENFORCEMENT_PRODUCTION = false`), i.e. what a rollback commit deploys. */
  rollback?: boolean;
}

function rollbackPlugin(): Plugin {
  return {
    name: "lc-hand-rollback",
    enforce: "pre",
    transform(code, id) {
      if (id.includes("?") || !id.replace(/\\/g, "/").endsWith(POLICY_FILE)) return null;
      const hits = code.match(new RegExp(PRODUCTION_FLAG_LINE.source, "gm"))?.length ?? 0;
      if (hits !== 1) throw new Error(`[lc-hand-rollback] the production flag line matched ${hits}x (fail closed)`);
      return code.replace(PRODUCTION_FLAG_LINE, "export const HAND_ENFORCEMENT_PRODUCTION = false;");
    },
  };
}

function variantPlugin(variant: 9 | 12): Plugin {
  return {
    name: `lc-hand-variant-${variant}`,
    enforce: "pre",
    transform(code, id) {
      if (id.includes("?") || !id.replace(/\\/g, "/").endsWith(VARIANT_FILE)) return null;
      const hits = code.match(new RegExp(VARIANT_LINE.source, "gm"))?.length ?? 0;
      if (hits !== 1) throw new Error(`[lc-hand-variant-${variant}] the variant line matched ${hits}x (fail closed)`);
      return code.replace(VARIANT_LINE, `export const LC_HAND_PREVIEW_CAPACITY: LcHandPreviewCapacity = ${variant};`);
    },
  };
}

const ENV_KEYS = ["VITE_PREVIEW_MODE", "VITE_PREVIEW_PR", "VITE_PREVIEW_SHA", "NODE_ENV"] as const;

/** Builds sequentially only: it mutates process.env the way Vite's own env loading reads it. */
export async function buildLcApp(spec: LcBuildSpec, write: boolean): Promise<string> {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  delete process.env.VITE_PREVIEW_MODE;
  delete process.env.VITE_PREVIEW_PR;
  delete process.env.VITE_PREVIEW_SHA;
  process.env.NODE_ENV = "production"; // a production build; Vitest's "test" would read as a DEV build
  if (spec.preview) {
    process.env.VITE_PREVIEW_MODE = "1";
    process.env.VITE_PREVIEW_PR = "r6b";
    process.env.VITE_PREVIEW_SHA = "r6b0000";
  }
  try {
    const result = await build({
      root: ROOT,
      base: spec.base,
      logLevel: "silent",
      mode: "production",
      plugins: [...(spec.variant === null ? [] : [variantPlugin(spec.variant)]), ...(spec.rollback ? [rollbackPlugin()] : [])],
      build: { write, outDir: spec.outDir, emptyOutDir: true, minify: true, reportCompressedSize: false },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => ("output" in r ? r.output : []));
    return outputs.map((o) => (o.type === "chunk" ? o.code : "")).join("\n");
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const MIME: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

/** One static server for several builds, each under its own base path (like `github.io/<repo>/`). */
export function serveBuilds(roots: readonly (readonly [string, string])[]): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const hit = roots.find(([prefix]) => url.startsWith(prefix));
    if (!hit) {
      res.writeHead(404);
      return void res.end();
    }
    let file = path.join(hit[1], url.slice(hit[0].length) || "index.html");
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      return void res.end();
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}
