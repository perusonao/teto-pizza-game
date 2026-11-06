import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { chipOnTrayOrPin } from "./support/handPick";

/**
 * Expansion Batch 18 (#748, PR #759): the Preview-only B18 HV seeds (src/preview/b18HvSeeds.ts; Owner approach A,
 * Issue #748 comment 6656496881) on REAL builds. Like e2e/hint5-preview.spec.ts it builds a production build and a
 * Preview build (`VITE_PREVIEW_MODE`) and serves both from ONE origin under their real base paths, the way
 * `perusonao.github.io` does, so the production save sits right next to the Preview save.
 *
 * - production `?hv=b18-*` seeds nothing and leaves the production save as it was;
 * - Preview `?hv=b18-baingan` / `?hv=b18-reina`: the production save is untouched; Shop NEW cilantro -> buy ->
 *   Research (both new recipes, no identity) -> cook -> bake -> NEW DISCOVERY -> Dex; a reload never reseeds;
 * - Preview `?hv=b18-bbq`: bbq-chicken-pizza's Research label is the Owner-approved 「？？？ピザ B（パクチー）」;
 * - legacy `?hv=normal` still seeds its Hint 5.0 save.
 * Layout: no horizontal overflow, no page scroll, the cooking CTA bar inside the viewport (390×844 / 360×800).
 *
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (human-paced video, 390×844 only).
 */

const PROD_BASE = "/teto-pizza-game/";
const PREVIEW_BASE = "/teto-pizza-game-preview/";
const PROD_KEY = "teto-pizza-save-v1";
const PREVIEW_KEY = "teto-pizza-preview-save-v1";
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79], [22, 63], [25, 36], [50, 52]];
const TOMATO = /(?<!チェリー)トマト(?!ソース)/;

interface Case {
  hv: "b18-baingan" | "b18-reina";
  id: string;
  nameJa: string;
  label: string;
  sibling: string;
  sauce: RegExp;
  cheese: [RegExp, number][];
  toppings: [RegExp, number][];
}
const CASES: readonly Case[] = [
  {
    hv: "b18-baingan",
    id: "baingan-bharta-pizza",
    nameJa: "バインガンバルタピザ",
    label: "？？？ピザ B（パクチー）",
    sibling: "？？？ピザ A（パクチー）",
    sauce: /カレーケチャップ/,
    cheese: [[/モッツァレラ/, 2]],
    toppings: [[/ナス/, 2], [TOMATO, 1], [/たまねぎ/, 1], [/パクチー/, 2]],
  },
  {
    hv: "b18-reina",
    id: "reina-pepiada-pizza",
    nameJa: "ベネズエラレイナペピアーダピザ",
    label: "？？？ピザ A（パクチー）",
    sibling: "？？？ピザ B（パクチー）",
    sauce: /フロマージュブラン/,
    cheese: [[/モッツァレラ/, 2]],
    toppings: [[/チキン/, 2], [/アボカド/, 1], [/マヨネーズ/, 1], [/パクチー/, 2]],
  },
];
const NEW_RECIPE_NAMES = ["バインガンバルタピザ", "ベネズエラレイナペピアーダピザ", "バーベキューチキンピザ", "BBQチキンピザ"];

// ---- two real builds, one static server ---------------------------------------------------------

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
    env.VITE_PREVIEW_PR = "759";
    env.VITE_PREVIEW_SHA = "b18-hv";
  } else {
    delete env.VITE_PREVIEW_MODE;
    delete env.VITE_PREVIEW_PR;
    delete env.VITE_PREVIEW_SHA;
  }
  execFileSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir", "--base", base, "--logLevel", "error"], { env, stdio: "pipe" });
}

test.describe.configure({ mode: "serial" });
if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "b18-hv-preview-"));
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

const PRODUCTION_SENTINEL = JSON.stringify({ schemaVersion: 2, dex: [], pitzBalance: 4321, ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"], missionBest: {}, inventory: {}, starterGrantClaimedRecipeIds: [], unlockedForShopIngredientIds: [] });

async function plantStorage(page: Page, entries: Record<string, string>) {
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
  await page.waitForSelector(".app-frame");
}
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const savedJson = async (page: Page, key: string) => JSON.parse((await stored(page, key)) ?? "null");
const bar = (page: Page) => page.locator(".prepare-bake-bar");
const hold = (page: Page, ms = 1500) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);

async function capture(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}-${test.info().project.name}.png` });
}
async function expectLayout(page: Page, where: string) {
  // Measure the settled layout: a running CSS animation / transition (a step change) is not a layout state.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"), undefined, { timeout: 5_000 }).catch(() => undefined);
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const barEl = document.querySelector(".prepare-bake-bar");
    const b = barEl?.getBoundingClientRect();
    const screen = document.querySelector<HTMLElement>(".game-screen");
    // Diagnostics only (reported with a failure): the bar's ancestor chain [class, left, width, scrollLeft, scrollWidth, clientWidth].
    const chain: unknown[] = [];
    for (let el: HTMLElement | null = barEl as HTMLElement | null; el; el = el.parentElement) {
      const r = el.getBoundingClientRect();
      chain.push([el.className.slice(0, 48), Math.round(r.left), Math.round(r.width), el.scrollLeft, el.scrollWidth, el.clientWidth]);
    }
    return {
      hOverflow: de.scrollWidth - de.clientWidth,
      vScroll: Math.max(de.scrollHeight, document.body.scrollHeight) - innerHeight,
      screenHOverflow: screen ? screen.scrollWidth - screen.clientWidth : 0,
      bar: b ? { top: b.top, bottom: b.bottom, left: b.left, right: b.right } : null,
      vw: innerWidth,
      vh: innerHeight,
      chain: JSON.stringify(chain),
    };
  });
  const at = `${where} (bar ancestors: ${m.chain})`;
  expect(m.hOverflow, `${at}: horizontal overflow`).toBeLessThanOrEqual(0);
  expect(m.vScroll, `${at}: page scroll`).toBeLessThanOrEqual(0);
  expect(m.screenHOverflow, `${at}: the game screen scrolls sideways`).toBeLessThanOrEqual(1);
  if (m.bar) {
    expect(m.bar.bottom, `${at}: CTA bar cut off`).toBeLessThanOrEqual(m.vh + 0.5);
    expect(m.bar.left, at).toBeGreaterThanOrEqual(-0.5);
    expect(m.bar.right, at).toBeLessThanOrEqual(m.vw + 0.5);
  }
}
async function expectNoNewRecipeName(page: Page, where: string) {
  const text = (await page.locator(".dex-overlay__research").innerText().catch(() => "")) ?? "";
  for (const name of NEW_RECIPE_NAMES) expect(text.includes(name), `${where}: Research leaks ${name}`).toBe(false);
}
async function place(page: Page, picks: [RegExp, number][], startSpot: number) {
  let spot = startSpot;
  for (const [name, count] of picks) {
    await (await chipOnTrayOrPin(page, name)).click();
    for (let i = 0; i < count; i += 1) {
      await tapDoughPercent(page, ...SPOTS[spot++ % SPOTS.length]);
      await hold(page, 350);
    }
  }
  return spot;
}
async function openDex(page: Page) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
  await page.waitForSelector(".dex-overlay");
}

// ---- production build ------------------------------------------------------------------------------

test("production build: `?hv=b18-*` seeds nothing and leaves the production save untouched", async ({ page }) => {
  for (const hv of ["b18-baingan", "b18-reina", "b18-bbq"]) {
    await plantStorage(page, { [PROD_KEY]: PRODUCTION_SENTINEL });
    await visit(page, `${origin}${PROD_BASE}?hv=${hv}`);
    await page.waitForTimeout(300);
    expect(await stored(page, PREVIEW_KEY), hv).toBeNull();
    const prod = await savedJson(page, PROD_KEY);
    expect(prod.pitzBalance, hv).toBe(4321);
    expect(prod.dex, hv).toEqual([]);
    await expect(page.locator(".app-header__dex-pill"), hv).not.toHaveText(/89\s*\/|88\s*\//);
  }
});

// ---- Preview build ---------------------------------------------------------------------------------

for (const c of CASES) {
  test(`Preview ?hv=${c.hv}: Shop NEW cilantro -> Research -> cook -> bake -> NEW DISCOVERY -> Dex; production save untouched; reload never reseeds`, async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await plantStorage(page, { [PROD_KEY]: PRODUCTION_SENTINEL });
    await visit(page, `${origin}${PREVIEW_BASE}?hv=${c.hv}`);
    expect(await stored(page, PROD_KEY)).toBe(PRODUCTION_SENTINEL);
    const seeded = await savedJson(page, PREVIEW_KEY);
    expect(seeded.pitzBalance).toBe(500);
    expect(seeded.ownedIngredientIds).not.toContain("cilantro");
    for (const r of ["baingan-bharta-pizza", "reina-pepiada-pizza"]) expect(seeded.dex.map((e: { recipeId: string }) => e.recipeId)).not.toContain(r);
    await expect(page.locator(".preview-badge, [class*=preview-badge]").first()).toBeVisible();
    await capture(page, `b18hv-${c.hv}-home`);
    await hold(page, 2000);

    // 1. Shop: cilantro is NEW (T4: 120 Pitz) -> buy.
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__panel");
    const row = page.locator('.shop-item[data-ingredient-id="cilantro"]');
    await row.scrollIntoViewIfNeeded();
    await expect(row).toHaveAttribute("data-shop-state", "NEW");
    await expect(row).toContainText("パクチー");
    await expect(row).toContainText(/初回 .*120 Pitz/);
    await expectLayout(page, "shop");
    await capture(page, `b18hv-${c.hv}-shop-new`);
    await hold(page, 2000);
    await row.locator(".shop-item__buy-button").click();
    await expect(row).not.toHaveAttribute("data-shop-state", "NEW");
    await hold(page, 1800);
    await page.locator(".shop-overlay__panel").getByRole("button", { name: "閉じる" }).click();

    // A reload keeps the purchase: the seed is never re-applied.
    await page.reload();
    await page.waitForSelector(".app-frame");
    const afterReload = await savedJson(page, PREVIEW_KEY);
    expect(afterReload.ownedIngredientIds).toContain("cilantro");
    expect(afterReload.pitzBalance).toBe(500 - 120);
    expect(await stored(page, PROD_KEY)).toBe(PRODUCTION_SENTINEL);

    // 2. Dex -> both new recipes are Research Entries; only the unlock material and the cohort letter are named.
    await openDex(page);
    const research = page.locator(".dex-overlay__research");
    await expect(research).toContainText(c.label);
    await expect(research).toContainText(c.sibling);
    await expectNoNewRecipeName(page, "Dex Research");
    await expectLayout(page, "Dex Research");
    await research.getByText(c.label).first().scrollIntoViewIfNeeded();
    await capture(page, `b18hv-${c.hv}-research-entry`);
    await hold(page, 2500);
    await research.getByRole("button", { name: new RegExp(`^${c.label}を研究する$`) }).click();

    // 3. Cooking.
    await page.waitForSelector(".pizza-stage");
    await capture(page, `b18hv-${c.hv}-research-prepare`);
    await hold(page, 2000);
    await completeDoughStep(page);
    await hold(page, 1200);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();
    await (await chipOnTrayOrPin(page, c.sauce)).click();
    await hold(page, 1000);
    await paintSauceRing(page, 25, 16);
    await expectLayout(page, "sauce");
    await capture(page, `b18hv-${c.hv}-sauce`);
    await hold(page, 1800);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
    let spot = await place(page, c.cheese, 0);
    await hold(page, 1200);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    spot = await place(page, c.toppings, spot);
    await expectLayout(page, "topped");
    await capture(page, `b18hv-${c.hv}-topped`);
    await hold(page, 2000);
    await bakeToTarget(page, { start: 60, end: 76 });
    await page.waitForSelector(".result-panel");

    // 4. NEW DISCOVERY.
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText(c.nameJa);
    await expectLayout(page, "NEW RECIPE");
    await capture(page, `b18hv-${c.hv}-new-recipe`);
    await hold(page, 3000);

    // 5. Dex card; the other new recipe is still a Research Entry.
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await openDex(page);
    const card = page.locator(".dex-card").filter({ hasText: c.nameJa });
    await expect(card).toHaveCount(1);
    await expect(page.locator(".dex-overlay__research")).toContainText(c.sibling);
    await card.scrollIntoViewIfNeeded();
    await expectLayout(page, "Dex");
    await capture(page, `b18hv-${c.hv}-dex`);
    await hold(page, 3000);
    const final = await savedJson(page, PREVIEW_KEY);
    expect(final.schemaVersion).toBe(2);
    expect(final.dex.map((e: { recipeId: string }) => e.recipeId)).toContain(c.id);
    expect(await stored(page, PROD_KEY)).toBe(PRODUCTION_SENTINEL);
    expect(errors).toEqual([]);
  });
}

test("Preview ?hv=b18-bbq: bbq-chicken-pizza (undiscovered, bbq-sauce then cilantro owned) shows the Owner-approved 「？？？ピザ B（パクチー）」", async ({ page }) => {
  await plantStorage(page, { [PROD_KEY]: PRODUCTION_SENTINEL });
  await visit(page, `${origin}${PREVIEW_BASE}?hv=b18-bbq`);
  const seeded = await savedJson(page, PREVIEW_KEY);
  expect(seeded.ownedIngredientIds.slice(-2)).toEqual(["bbq-sauce", "cilantro"]);
  expect(seeded.dex.map((e: { recipeId: string }) => e.recipeId)).not.toContain("bbq-chicken-pizza");
  await capture(page, "b18hv-b18-bbq-home");
  await hold(page, 1800);
  await openDex(page);
  const research = page.locator(".dex-overlay__research");
  await expect(research).toContainText("？？？ピザ B（パクチー）");
  await expect(research).not.toContainText("バーベキューソース）");
  await expectNoNewRecipeName(page, "Dex Research (bbq)");
  await expectLayout(page, "Dex Research (bbq)");
  await capture(page, "b18hv-b18-bbq-research-label");
  await hold(page, 3000);
  await research.getByRole("button", { name: /^？？？ピザ B（パクチー）を研究する$/ }).click();
  await page.waitForSelector(".pizza-stage");
  await capture(page, "b18hv-b18-bbq-research-prepare");
  await hold(page, 2500);
  expect(await stored(page, PROD_KEY)).toBe(PRODUCTION_SENTINEL);
});

test("Preview: the legacy `?hv=normal` Hint 5.0 seed still applies (meat-lovers save, no cilantro)", async ({ page }) => {
  await plantStorage(page, { [PROD_KEY]: PRODUCTION_SENTINEL });
  await visit(page, `${origin}${PREVIEW_BASE}?hint5=1&hv=normal`);
  const seeded = await savedJson(page, PREVIEW_KEY);
  expect(seeded.pitzBalance).toBe(300);
  expect(seeded.ownedIngredientIds).toContain("ham");
  expect(seeded.ownedIngredientIds).not.toContain("cilantro");
  expect(seeded.dex.map((e: { recipeId: string }) => e.recipeId)).not.toContain("meat-lovers");
  expect(await stored(page, PROD_KEY)).toBe(PRODUCTION_SENTINEL);
});
