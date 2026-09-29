#!/usr/bin/env node
/**
 * LC-R3 Human Verification capture (manual): HOME -> FREE Cooking -> cooking -> 食材庫 open -> scroll -> close
 * -> cooking continues, at 390x844 and 360x800. Video (WebM, Playwright has no H.264 encoder) goes to
 * artifacts/review/lc-r3/ (gitignored, delivered directly to the user); screenshots go to
 * docs/reports/screenshots/large-catalog-pantry-shell/ (committed). "before" = the same state with the entry
 * hidden by CSS (the entry is absolutely positioned, so hiding it reproduces the pre-R3 layout exactly).
 *
 *   npm run dev -- --port 5183 --strictPort   # in another shell
 *   node tools/large-catalog-ux/hv-pantry-shell.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:5183/teto-pizza-game/";
const SHOTS = "docs/reports/screenshots/large-catalog-pantry-shell";
const VIDEOS = "artifacts/review/lc-r3";
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

async function run(browser, width, height) {
  const tag = `${width}x${height}`;
  const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: VIDEOS, size: { width, height } } });
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
  // before (entry hidden) / after (entry visible)
  await page.addStyleTag({ content: ".pantry-entry{display:none !important}" });
  await page.screenshot({ path: join(SHOTS, `before-${tag}-topping-tray.png`) });
  await page.evaluate(() => { for (const s of document.querySelectorAll("style")) if (s.textContent?.includes(".pantry-entry{display:none")) s.remove(); });
  await hold(page, 800);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-topping-tray-entry.png`) });
  await page.getByRole("button", { name: /食材庫/ }).click();
  await hold(page, 1800);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-open.png`) });
  await page.locator(".pantry-sheet__list").focus();
  await page.keyboard.press("PageDown");
  await hold(page, 1500);
  await page.keyboard.press("PageDown");
  await hold(page, 1500);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-scrolled.png`) });
  await page.getByRole("dialog").getByRole("button", { name: "閉じる" }).click();
  await hold(page, 1500);
  await page.getByRole("button", { name: /バジル/ }).first().click();
  await tap(page, 45, 60);
  await hold(page, 1200);
  await tap(page, 58, 42);
  await hold(page, 1500);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-cooking-continues.png`) });
  const video = page.video();
  await context.close();
  const path = await video.path();
  const out = join(VIDEOS, `lc-r3-pantry-shell-${tag}.webm`);
  renameSync(path, out);
  console.log("video", out);
}

const browser = await chromium.launch();
try {
  await run(browser, 390, 844);
  await run(browser, 360, 800);
} finally {
  await browser.close();
}
console.log(readdirSync(VIDEOS).join("\n"));
