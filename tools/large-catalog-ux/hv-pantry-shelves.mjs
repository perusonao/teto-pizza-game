#!/usr/bin/env node
/**
 * LC-R4 Human Verification capture (manual): HOME -> FREE Cooking -> topping step -> 食材庫 -> shelf chips
 * (すべて / 肉 / horizontal chip scroll / その他) -> list scroll resets on filter -> close -> reopen (back on
 * すべて) -> cooking continues, at 390x844 and 360x800 (video + screenshots) and 390x664 / 360x640 (screenshots).
 * Video (WebM: Playwright has no H.264 encoder) goes to artifacts/review/lc-r4/ (gitignored, delivered directly);
 * screenshots go to docs/reports/screenshots/large-catalog-pantry-shelves/ (committed). "before" = the R3 pantry:
 * the same sheet with the chip slot hidden by CSS (the R3 sheet had no chip row).
 *
 *   npm run dev -- --port 5183 --strictPort   # in another shell
 *   node tools/large-catalog-ux/hv-pantry-shelves.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:5183/teto-pizza-game/";
const SHOTS = "docs/reports/screenshots/large-catalog-pantry-shelves";
const VIDEOS = "artifacts/review/lc-r4";
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

async function run(browser, width, height, withVideo) {
  const tag = `${width}x${height}`;
  const context = await browser.newContext({
    viewport: { width, height },
    ...(withVideo ? { recordVideo: { dir: VIDEOS, size: { width, height } } } : {}),
  });
  const page = await context.newPage();
  await page.goto(BASE + "icons/icon-16.png");
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, ["teto-pizza-save-v1", JSON.stringify(SAVE)]);
  await page.goto(BASE);
  await page.waitForSelector(".app-frame");
  await hold(page);
  await page.getByRole("button", { name: /レシピ発見/ }).click();
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
  // a Builder selection that pantry filtering must not clear
  await page.getByRole("button", { name: /バジル/ }).first().click();
  await hold(page, 800);

  await page.getByRole("button", { name: /食材庫/ }).click();
  await hold(page, 1200);
  // before (R3 pantry: no chip slot) / after (R4)
  await page.addStyleTag({ content: ".pantry-sheet__shelves{display:none !important}" });
  await page.screenshot({ path: join(SHOTS, `before-${tag}-pantry-no-chips.png`) });
  await page.evaluate(() => { for (const s of document.querySelectorAll("style")) if (s.textContent?.includes(".pantry-sheet__shelves{display:none")) s.remove(); });
  await hold(page, 1500);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-all.png`) });
  await page.locator(".pantry-sheet__list").focus();
  await page.keyboard.press("PageDown");
  await hold(page, 1500);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-all-scrolled.png`) });
  await page.getByRole("button", { name: "肉", exact: true }).click();
  await hold(page, 1800);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-meat.png`) });
  await page.evaluate(() => { document.querySelector(".shelf-chips").scrollLeft = 9999; });
  await hold(page, 1500);
  await page.getByRole("button", { name: "その他", exact: true }).click();
  await hold(page, 1800);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-other-chips-scrolled.png`) });
  await page.getByRole("button", { name: "すべて", exact: true }).click();
  await hold(page, 1500);
  await page.getByRole("dialog").getByRole("button", { name: "閉じる" }).click();
  await hold(page, 1500);
  await page.getByRole("button", { name: /食材庫/ }).click();
  await hold(page, 1800);
  await page.screenshot({ path: join(SHOTS, `after-${tag}-pantry-reopened-all.png`) });
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
    const out = join(VIDEOS, `lc-r4-pantry-shelves-${tag}.webm`);
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
