import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

/**
 * DEV State Editor (Issue #403) S3, on REAL builds: a production build and a Preview build (`VITE_PREVIEW_MODE`,
 * what the Preview pipeline sets), served from ONE origin under their real base paths, the way
 * `perusonao.github.io` serves production and Preview (so the production save sits right next to the Preview one).
 *
 * - production: `?dev=state` is inert. The home screen opens; the DOM, the accessibility tree, the requests and
 *   localStorage hold no editor, no entry, no backup key and no preset label; the production save is untouched.
 * - Preview: `?dev=state` opens the editor shell (a labelled main landmark, 390x844 / 360x800 without overflow),
 *   and merely opening it (with or without a `hv` seed parameter, and on reload) writes / removes / seeds nothing.
 *   The Preview game itself carries no DEV entry.
 * The production-bundle string scan is src/preview/previewIsolation.gate.test.ts.
 */

const PROD_BASE = "/teto-pizza-game/";
const PREVIEW_BASE = "/teto-pizza-game-preview/";
const PROD_KEY = "teto-pizza-save-v1";
const PREVIEW_KEY = "teto-pizza-preview-save-v1";

/** A readable v2 save of a newer build: an unknown top-level key, an unknown id, a Mission BEST. */
const PLANTED = JSON.stringify({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
  pitzBalance: 123,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "future-ingredient"],
  missionBest: { "lunch-rush": 640 },
  inventory: {},
  futureTopLevel: { keep: true },
});

let origin = "";
let server: http.Server | null = null;
let workDir = "";

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

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-state-editor-"));
  const prod = path.join(workDir, "production");
  const prev = path.join(workDir, "preview");
  build(prod, PROD_BASE, false);
  build(prev, PREVIEW_BASE, true);
  const roots: [string, string][] = [[PROD_BASE, prod], [PREVIEW_BASE, prev]];
  server = http.createServer((req, res) => {
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
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server!.address() as { port: number }).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
});

// ---- helpers --------------------------------------------------------------------------------------

async function seedStorage(page: Page, entries: Record<string, string>) {
  await page.goto(`${origin}${PREVIEW_BASE}icons/icon-16.png`);
  await page.evaluate((e) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v);
  }, entries);
}

/** A fresh navigation (about:blank first, so it is a `navigate`, never a reload). */
async function visit(page: Page, url: string) {
  await page.goto("about:blank");
  await page.goto(url);
}

const storageDump = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).map((k) => [k, localStorage.getItem(k)])));

/**
 * The storage the ordinary game leaves behind for `url` (the game normalizes a save it loads, e.g. fills ledger
 * fields). "Inert" means `?dev=state` leaves exactly what the same URL without it leaves.
 */
async function settledStorage(page: Page, base: string, query: string, seed: Record<string, string>) {
  await seedStorage(page, seed);
  await visit(page, `${origin}${base}${query}`);
  await page.waitForSelector(".app-frame");
  await page.waitForLoadState("networkidle");
  return storageDump(page);
}

/** Everything a person or an assistive technology could find as an editor entry. */
async function expectNoEditorSurface(page: Page, where: string) {
  const tree = await page.locator("body").ariaSnapshot();
  expect(tree, `${where}: accessibility tree`).not.toMatch(/State Editor|\bDEV\b|dev=state|プリセット|Fresh Start|Everything Unlocked/);
  const html = await page.content();
  expect(html, `${where}: DOM`).not.toMatch(/data-dev-state-editor|dev-state-editor-v1|DEV State Editor|dev-backup|StateEditorShell|class="dse/);
  expect(await page.locator("[data-dev-state-editor], .dse").count(), `${where}: editor element`).toBe(0);
  for (const role of ["button", "link", "heading", "tab"] as const) {
    for (const el of await page.getByRole(role).all()) {
      expect((await el.innerText()).trim() + (await el.getAttribute("aria-label") ?? ""), `${where}: ${role}`).not.toMatch(/DEV|State Editor/i);
    }
  }
}

function watchRequests(page: Page) {
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  return urls;
}

// ---- production build ------------------------------------------------------------------------------

test.describe("production build: ?dev=state is inert", () => {
  test("the home screen opens, with no editor in the DOM, the accessibility tree or the requests; storage is what the plain app leaves", async ({ page }) => {
    const baseline = await settledStorage(page, PROD_BASE, "", { [PROD_KEY]: PLANTED });
    await seedStorage(page, { [PROD_KEY]: PLANTED });
    const requests = watchRequests(page);
    await visit(page, `${origin}${PROD_BASE}?dev=state`);
    await page.waitForSelector(".app-frame");
    await page.waitForLoadState("networkidle");
    await expectNoEditorSurface(page, "production ?dev=state");
    expect(requests.filter((u) => /StateEditorShell|devtools/i.test(u))).toEqual([]);
    const dump = await storageDump(page);
    expect(dump).toEqual(baseline);
    expect(Object.keys(dump).filter((k) => /dev-backup/.test(k))).toEqual([]);
    expect(dump[PREVIEW_KEY]).toBeUndefined();
    // the planted data is still there (the unknown key and the Mission BEST survive the game's own write)
    const saved = JSON.parse(dump[PROD_KEY]!);
    expect(saved.pitzBalance).toBe(123);
    expect(saved.futureTopLevel).toEqual({ keep: true });
    expect(saved.missionBest).toEqual({ "lunch-rush": 640 });
  });

  test("with a seed parameter too (?dev=state&hv=...): still the plain app, no seed, no Preview key", async ({ page }) => {
    const baseline = await settledStorage(page, PROD_BASE, "?hv=pool2-onion", { [PROD_KEY]: PLANTED });
    const dump = await settledStorage(page, PROD_BASE, "?dev=state&hv=pool2-onion", { [PROD_KEY]: PLANTED });
    await expectNoEditorSurface(page, "production ?dev=state&hv");
    expect(dump).toEqual(baseline);
    expect(dump[PREVIEW_KEY]).toBeUndefined();
    expect(JSON.parse(dump[PROD_KEY]!).pitzBalance).toBe(123);
  });

  test("the plain production app has no DEV entry either", async ({ page }) => {
    await visit(page, `${origin}${PROD_BASE}`);
    await page.waitForSelector(".app-frame");
    await expectNoEditorSurface(page, "production /");
  });
});

// ---- Preview build ---------------------------------------------------------------------------------

test.describe("Preview build: ?dev=state opens the shell and changes nothing", () => {
  test("the editor shell: a labelled main landmark, the Preview key, the presets, no horizontal overflow", async ({ page }) => {
    await seedStorage(page, { [PREVIEW_KEY]: PLANTED, [PROD_KEY]: "production-save" });
    const before = await storageDump(page);
    await visit(page, `${origin}${PREVIEW_BASE}?dev=state`);
    const main = page.getByRole("main", { name: "DEV State Editor" });
    await expect(main).toBeVisible();
    await expect(main.getByRole("heading", { level: 1, name: "DEV State Editor" })).toBeVisible();
    await expect(main).toContainText("PREVIEW");
    await expect(main).toContainText(PREVIEW_KEY);
    await expect(main).toContainText("読み取り可");
    for (const label of ["Fresh Start", "Margherita discovered", "Research Step 12 Ready", "Step 12 A/B/C undiscovered", "All Ingredients", "All Recipes", "Everything Unlocked", "Step 12 B discovered"]) {
      await expect(main.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button")).toHaveCount(0);
    const m = await page.evaluate(() => ({ vw: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, link: document.querySelector<HTMLElement>(".dse__link")!.getBoundingClientRect().height }));
    expect(m.scrollWidth, "horizontal overflow").toBeLessThanOrEqual(m.vw);
    expect(m.link, "link tap height").toBeGreaterThanOrEqual(44);
    expect(await storageDump(page)).toEqual(before);
  });

  test("opening it with a seed parameter, and reloading, writes / removes / seeds nothing (Owner Contract 7)", async ({ page }) => {
    await seedStorage(page, { [PREVIEW_KEY]: PLANTED, [PROD_KEY]: "production-save" });
    const before = await storageDump(page);
    await visit(page, `${origin}${PREVIEW_BASE}?dev=state&hv=pool2-onion`);
    await expect(page.getByRole("main", { name: "DEV State Editor" })).toBeVisible();
    expect(await storageDump(page)).toEqual(before);
    await page.reload();
    await expect(page.getByRole("main", { name: "DEV State Editor" })).toBeVisible();
    expect(await storageDump(page)).toEqual(before);
  });

  test("an empty / corrupt save is described, not repaired", async ({ page }) => {
    await seedStorage(page, {});
    await visit(page, `${origin}${PREVIEW_BASE}?dev=state`);
    await expect(page.getByRole("main")).toContainText("セーブなし");
    expect(await storageDump(page)).toEqual({});
    await seedStorage(page, { [PREVIEW_KEY]: "{not json" });
    await visit(page, `${origin}${PREVIEW_BASE}?dev=state`);
    await expect(page.getByRole("main")).toContainText("壊れている");
    expect(await storageDump(page)).toEqual({ [PREVIEW_KEY]: "{not json" });
  });

  test("「ゲームへ戻る」 leads to the Preview game, which carries no editor entry, and the save is still untouched", async ({ page }) => {
    await seedStorage(page, { [PREVIEW_KEY]: PLANTED });
    await visit(page, `${origin}${PREVIEW_BASE}?dev=state`);
    await page.getByRole("link", { name: "ゲームへ戻る" }).click();
    await page.waitForSelector(".app-frame");
    expect(new URL(page.url()).search).toBe("");
    await expectNoEditorSurface(page, "Preview game");
    const saved = JSON.parse((await storageDump(page))[PREVIEW_KEY]!);
    expect(saved.pitzBalance).toBe(123);
    expect(saved.futureTopLevel).toEqual({ keep: true });
  });

  test("the plain Preview game has no DEV entry and never requests the editor chunk", async ({ page }) => {
    const requests = watchRequests(page);
    await visit(page, `${origin}${PREVIEW_BASE}`);
    await page.waitForSelector(".app-frame");
    await expectNoEditorSurface(page, "Preview /");
    expect(requests.filter((u) => /StateEditorShell/.test(u))).toEqual([]);
  });
});
