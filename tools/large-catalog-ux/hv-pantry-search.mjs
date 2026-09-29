#!/usr/bin/env node
/**
 * LC-R5-b Human Verification capture (manual): HOME -> FREE Cooking -> topping step -> 食材庫 -> search (typed name,
 * approved alias 玉ねぎ, zero results, shelf AND text) -> SIMULATED soft keyboard (Chromium cannot show one: the
 * visual viewport is replaced by a controllable stand-in that shrinks by 338px, the real-iPhone shrink measured in
 * Discovery) -> keyboard released -> close -> cooking continues, at 390x844 and 360x800 (video + screenshots) and
 * 390x664 / 360x640 (screenshots). The real-iPhone keyboard / IME check is a separate manual step (PreAudit §9).
 * Video (WebM) goes to artifacts/review/lc-r5b/ (gitignored, delivered directly); screenshots go to
 * docs/reports/screenshots/large-catalog-pantry-search/ (committed). "before" = the R5-a pantry: the same sheet
 * with the search row hidden and the old 70dvh height forced by CSS.
 *
 *   npm run dev -- --port 5183 --strictPort   # in another shell
 *   node tools/large-catalog-ux/hv-pantry-search.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:5183/teto-pizza-game/";
const SHOTS = "docs/reports/screenshots/large-catalog-pantry-search";
const VIDEOS = "artifacts/review/lc-r5b";
const KEYBOARD_PX = 338;
mkdirSync(SHOTS, { recursive: true });
mkdirSync(VIDEOS, { recursive: true });

const IDS = [
  "tomato-sauce", "olive-oil", "pesto", "mozzarella", "gorgonzola", "parmigiano", "fontina", "basil", "garlic", "oregano",
  "cherry-tomato", "egg", "mushroom", "onion", "sausage", "pepperoni", "anchovy", "tuna", "rosemary", "bacon", "ham",
  "black-olive", "capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato",
];
const SAVE = {
  schemaVersion: 2,
  dex: [],
  pitzBalance: 0,
  ownedIngredientIds: IDS,
  missionBest: {},
  inventory: Object.fromEntries(IDS.map((id) => [id, 9])),
  starterGrantClaimedRecipeIds: [],
};
const hold = (page, ms = 1500) => page.waitForTimeout(ms);

const FAKE_VV = () => {
  class FakeViewport extends EventTarget {
    get width() { return window.innerWidth; }
    get height() { return window.__vvH ?? window.innerHeight; }
    get offsetTop() { return 0; }
    get pageTop() { return 0; }
    get scale() { return 1; }
  }
  const vv = new FakeViewport();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
  window.__setVv = (h) => { window.__vvH = h ?? undefined; vv.dispatchEvent(new Event("resize")); };
};

async function doughBox(page) {
  const b = await page.locator(".pizza-dough").boundingBox();
  return { b, cx: b.x + b.width / 2, cy: b.y + b.height / 2, r: b.width * 0.466 };
}
async function tap(page, xp, yp) {
  const { b } = await doughBox(page);
  await page.mouse.move(b.x + (xp / 100) * b.width, b.y + (yp / 100) * b.height);
  await page.mouse.down();
  await page.mouse.up();
}
async function dough(page) {
  const { cx, cy, r } = await doughBox(page);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    await page.mouse.down();
    await page.mouse.up();
  }
}

async function run(browser, width, height, withVideo) {
  const tag = `${width}x${height}`;
  const context = await browser.newContext({
    viewport: { width, height },
    ...(withVideo ? { recordVideo: { dir: VIDEOS, size: { width, height } } } : {}),
  });
  await context.addInitScript(FAKE_VV);
  const page = await context.newPage();
  await page.goto(BASE + "icons/icon-16.png");
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, ["teto-pizza-save-v1", JSON.stringify(SAVE)]);
  await page.goto(BASE);
  await page.waitForSelector(".app-frame");
  await hold(page);
  await page.getByRole("button", { name: /フリークッキング/ }).click();
  await page.waitForSelector(".pizza-stage");
  await hold(page);
  await dough(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await hold(page, 1000);
  await page.getByRole("button", { name: /トマトソース/ }).click();
  for (let i = 0; i < 16; i += 1) { const a = (i / 16) * Math.PI * 2; await tap(page, 50 + Math.cos(a) * 25, 50 + Math.sin(a) * 25); }
  await page.getByRole("button", { name: /次へ/ }).click();
  await hold(page, 1000);
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tap(page, 40, 50); await tap(page, 60, 50); await tap(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.waitForSelector(".ingredient-chip");
  await hold(page, 1500);

  await page.getByRole("button", { name: /食材庫/ }).click();
  await hold(page, 1200);
  // before (R5-a pantry: no search row, 70dvh)
  await page.addStyleTag({ content: ".pantry-sheet__search{display:none !important}.pantry-sheet{height:min(70dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 20px)) !important}" });
  await page.screenshot({ path: join(SHOTS, `before-${tag}-pantry-no-search.png`) });
  await page.evaluate(() => { for (const s of document.querySelectorAll("style")) if (s.textContent?.includes(".pantry-sheet__search{display:none")) s.remove(); });
  await hold(page, 1500);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-search-empty.png`) });

  const input = page.getByRole("searchbox", { name: "材料を検索" });
  await input.fill("ベーコン");
  await hold(page, 1500);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-search-name.png`) });
  await input.fill("玉ねぎ");
  await hold(page, 1800);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-search-alias.png`) });
  await input.fill("zzzz");
  await hold(page, 1500);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-search-zero.png`) });
  await input.fill("ハ");
  await page.getByRole("button", { name: "肉", exact: true }).click();
  await hold(page, 1500);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-search-and-shelf.png`) });
  await page.getByRole("button", { name: "すべて", exact: true }).click();
  await input.fill("");
  await hold(page, 1000);

  // simulated soft keyboard (visual viewport shrinks by KEYBOARD_PX): the sheet follows it
  await input.focus();
  await page.evaluate((h) => window.__setVv(h), height - KEYBOARD_PX);
  await hold(page, 1800);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-keyboard-simulated.png`) });
  await input.fill("タマ");
  await hold(page, 1800);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-keyboard-simulated-typed.png`) });
  await page.evaluate(() => window.__setVv(null));
  await input.blur();
  await hold(page, 1800);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-keyboard-released.png`) });
  await input.fill("");
  await page.keyboard.press("Escape");
  await hold(page, 1500);
  await page.getByRole("button", { name: /バジル/ }).first().click();
  await tap(page, 45, 60);
  await hold(page, 1200);
  await tap(page, 58, 42);
  await hold(page, 1500);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-cooking-continues.png`) });
  const video = withVideo ? page.video() : null;
  await context.close();
  if (video) {
    const out = join(VIDEOS, `lc-r5b-pantry-search-${tag}.webm`);
    renameSync(await video.path(), out);
    console.log("video", out);
  }
}

const browser = await chromium.launch();
try {
  await run(browser, 390, 844, true);
  await run(browser, 360, 800, true);
  await run(browser, 390, 664, false);
  await run(browser, 360, 640, false);
} finally {
  await browser.close();
}
console.log(readdirSync(VIDEOS).join("\n"));
