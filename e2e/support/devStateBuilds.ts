import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

/**
 * DEV State Editor (Issue #403): a production build and a Preview build (`VITE_PREVIEW_MODE`) of this repo, made in
 * a temp dir and served from ONE origin under their real base paths, the way `perusonao.github.io` serves production
 * and Preview (so the production save sits right next to the Preview one). Nothing is written into the repo.
 */
export const PROD_BASE = "/teto-pizza-game/";
export const PREVIEW_BASE = "/teto-pizza-game-preview/";
export const PROD_KEY = "teto-pizza-save-v1";
export const PREVIEW_KEY = "teto-pizza-preview-save-v1";

const MIME: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

function build(outDir: string, base: string, preview: boolean) {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
  delete env.TETO_TEST_HOOKS;
  if (preview) {
    env.VITE_PREVIEW_MODE = "1";
    env.VITE_PREVIEW_PR = "403";
    env.VITE_PREVIEW_SHA = "dev-state";
  } else {
    delete env.VITE_PREVIEW_MODE;
    delete env.VITE_PREVIEW_PR;
    delete env.VITE_PREVIEW_SHA;
  }
  execFileSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir", "--base", base, "--logLevel", "error"], { env, stdio: "pipe" });
}

export interface DevStateServers {
  origin: string;
  close: () => Promise<void>;
}

export async function startDevStateServers(): Promise<DevStateServers> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-state-editor-"));
  const prod = path.join(workDir, "production");
  const prev = path.join(workDir, "preview");
  build(prod, PROD_BASE, false);
  build(prev, PREVIEW_BASE, true);
  const roots: [string, string][] = [[PROD_BASE, prod], [PREVIEW_BASE, prev]];
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
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return {
    origin,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(workDir, { recursive: true, force: true });
    },
  };
}
