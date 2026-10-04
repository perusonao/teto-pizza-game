#!/usr/bin/env node
/**
 * Ingredient Pantry / Category Tabs Human Verification capture (manual; follows docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md).
 *
 *   TETO_TEST_HOOKS=1 npm run dev -- --port 5183 --strictPort                 # the branch ("after")
 *   (cd <main worktree> && TETO_TEST_HOOKS=1 npm run dev -- --port 5184 --strictPort)   # main ("before")
 *   node tools/ingredient-category-tabs/hv-category-tabs.mjs after  http://localhost:5183/teto-pizza-game/ [video]
 *   node tools/ingredient-category-tabs/hv-category-tabs.mjs before http://localhost:5184/teto-pizza-game/
 *
 * Screenshots (committed): docs/reports/screenshots/ingredient-pantry-category-tabs/<tag>-<viewport>-<shot>.png.
 * Video (not committed; WebM, converted to MP4 / H.264 by ffmpeg when present): artifacts/review/ingredient-pantry-category-tabs/.
 * The same script runs against main and the branch: a step whose control does not exist yet (before) is skipped.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [, , TAG = "after", BASE = "http://localhost:5183/teto-pizza-game/", VIDEO_FLAG] = process.argv;
const WITH_VIDEO = VIDEO_FLAG === "video";
const SHOTS = "docs/reports/screenshots/ingredient-pantry-category-tabs";
const VIDEOS = "artifacts/review/ingredient-pantry-category-tabs";
mkdirSync(SHOTS, { recursive: true });
mkdirSync(VIDEOS, { recursive: true });

const FINITE = [
  "olive-oil", "pesto", "gorgonzola", "parmigiano", "fontina", "garlic", "oregano", "cherry-tomato", "egg", "mushroom",
  "onion", "sausage", "pepperoni", "anchovy", "tuna", "rosemary", "bacon", "ham", "black-olive", "capers", "clam", "corn",
  "eggplant", "fresh-tomato", "pineapple", "potato", "chicken", "shrimp", "parsley", "bell-pepper", "zucchini",
];
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const NOT_OWNED = ["shrimp", "zucchini", "tuna"]; // Shop NEW rows
const OWNED = [...STARTERS, ...FINITE.filter((id) => !NOT_OWNED.includes(id))];
const SAVE = {
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 72, bestStars: 3, timesMade: 2 }],
  pitzBalance: 999,
  ownedIngredientIds: OWNED,
  missionBest: {},
  inventory: Object.fromEntries(OWNED.map((id) => [id, 9])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: FINITE,
};
// main ("before") still names the family chips 肉 / 魚介 / その他; the branch reads the shared familyDisplay labels.
const L = TAG === "before" ? { meat: "肉", seafood: "魚介", other: "その他" } : { meat: "肉系", seafood: "魚介系", other: "ちょっと変わった材料" };
const hold = (page, ms = 1400) => page.waitForTimeout(ms);
const shot = (page, vp, name) => page.screenshot({ path: `${SHOTS}/${TAG}-${vp}-${name}.png` });

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

async function dough(page) {
  const b = await page.locator(".pizza-dough").boundingBox();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2, r = b.width * 0.466;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    await page.mouse.down();
    await page.mouse.up();
  }
}
async function tapDough(page, xp, yp) {
  const b = await page.locator(".pizza-dough").boundingBox();
  await page.mouse.move(b.x + (xp / 100) * b.width, b.y + (yp / 100) * b.height);
  await page.mouse.down();
  await page.mouse.up();
}
const chip = async (page, group, name) => {
  const scoped = page.getByRole("group", { name: group }).getByRole("button", { name, exact: true });
  const target = (await scoped.count()) ? scoped : page.getByRole("button", { name, exact: true }).first();
  if (!(await target.count())) return false;
  await target.scrollIntoViewIfNeeded();
  await target.click();
  return true;
};

async function run(browser, width, height, withVideo) {
  const vp = `${width}x${height}`;
  const context = await browser.newContext({
    viewport: { width, height },
    ...(withVideo ? { recordVideo: { dir: VIDEOS, size: { width, height } } } : {}),
  });
  const page = await context.newPage();
  await page.addInitScript(FAKE_VV);
  await page.goto(BASE + "icons/icon-16.png");
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, ["teto-pizza-save-v1", JSON.stringify(SAVE)]);
  await page.goto(BASE);
  await page.waitForSelector(".app-frame");
  await hold(page);

  // ---- Inventory (在庫): major tabs, then 具材 + families
  await page.getByRole("button", { name: /材料/ }).click();
  await page.waitForSelector(".inventory-grid");
  await hold(page);
  await shot(page, vp, "inventory-all");
  if (await chip(page, "材料の大分類", "ソース")) { await hold(page); await shot(page, vp, "inventory-sauce"); }
  if (await chip(page, "材料の大分類", "チーズ")) await hold(page);
  if (await chip(page, "材料の大分類", "具材")) {
    await hold(page);
    await shot(page, vp, "inventory-topping");
    await chip(page, "具材の分類", L.meat);
    await hold(page);
    await shot(page, vp, "inventory-topping-meat");
    await chip(page, "具材の分類", L.other);
    await hold(page);
    await chip(page, "具材の分類", "すべて");
    await hold(page, 1000);
    await chip(page, "材料の大分類", "ソース"); // leaving 具材 resets the family
    await hold(page, 1000);
    await chip(page, "材料の大分類", "具材");
    await hold(page, 1000);
  }
  await page.getByRole("button", { name: "閉じる" }).first().click();
  await hold(page, 800);

  // ---- Shop (ショップ)
  await page.getByRole("button", { name: /ショップ/ }).click();
  await page.waitForSelector(".shop-overlay__body");
  await hold(page);
  await shot(page, vp, "shop-all");
  if (await chip(page, "材料の大分類", "具材")) {
    await hold(page);
    await chip(page, "具材の分類", L.seafood);
    await hold(page);
    await shot(page, vp, "shop-topping-seafood");
    await chip(page, "具材の分類", "すべて");
    await hold(page, 1000);
  }
  await page.getByRole("button", { name: "閉じる" }).first().click();
  await hold(page, 800);

  // ---- FREE Cooking: sauce step pantry (no chips, no subtitle), cheese, topping pantry
  const hooked = await page.evaluate(() => { globalThis.__tetoTest?.startTargetlessFreeCook(); return Boolean(globalThis.__tetoTest); });
  if (!hooked) throw new Error("TETO_TEST_HOOKS=1 dev server required");
  await page.waitForSelector(".pizza-stage");
  await hold(page);
  await dough(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await hold(page, 800);
  const entry = page.getByRole("button", { name: /食材庫/ });
  if (await entry.count()) {
    await entry.click();
    await page.waitForSelector(".pantry-sheet");
    await hold(page);
    await shot(page, vp, "pantry-sauce");
    await page.keyboard.press("Escape");
    await hold(page, 800);
  }
  await page.getByRole("button", { name: /トマトソース/ }).click();
  for (let i = 0; i < 16; i += 1) { const a = (i / 16) * Math.PI * 2; await tapDough(page, 50 + Math.cos(a) * 25, 50 + Math.sin(a) * 25); }
  await page.getByRole("button", { name: /次へ/ }).click();
  await hold(page, 800);
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDough(page, 40, 50); await tapDough(page, 60, 50); await tapDough(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.waitForSelector(".ingredient-chip");
  await hold(page);
  await page.getByRole("button", { name: /食材庫/ }).click();
  await page.waitForSelector(".pantry-sheet__list");
  await hold(page);
  await shot(page, vp, "pantry-topping");
  await page.getByRole("button", { name: L.meat, exact: true }).click();
  await hold(page);
  await shot(page, vp, "pantry-topping-meat");
  // pin from the filtered list (HAND is active: 27 toppings), switch the family, the pin stays (strip)
  const tile = page.locator(".pantry-tile__toggle").filter({ hasText: "ベーコン" }).first();
  if (await tile.count()) { await tile.click(); await hold(page); }
  await page.getByRole("button", { name: L.seafood, exact: true }).click();
  await hold(page);
  await shot(page, vp, "pantry-topping-seafood-pin-kept");
  await page.getByRole("button", { name: "すべて", exact: true }).click();
  await hold(page, 1000);
  // search keeps the family tags and ANDs with the family
  const input = page.getByRole("searchbox", { name: "材料を検索" });
  await input.click();
  await input.fill("ソ");
  await hold(page);
  await shot(page, vp, "pantry-topping-search");
  // simulated soft keyboard (Chromium cannot show one): the geometry the Owner's 360x640 concern is about
  await page.evaluate((h) => window.__setVv(h), height - 338);
  await hold(page);
  await shot(page, vp, "pantry-topping-keyboard-338");
  await page.evaluate(() => window.__setVv(null));
  await input.fill("");
  await page.getByRole("button", { name: "閉じる" }).last().click();
  await hold(page, 1000);
  // cooking continues
  const placed = await page.locator(".pizza-topping").count();
  await page.locator(".ingredient-chip:not([disabled])").first().click();
  await tapDough(page, 45, 60);
  await hold(page, 1500);
  console.log(`${TAG} ${vp}: placed ${(await page.locator(".pizza-topping").count()) - placed} topping after the pantry`);
  await context.close();
}

const browser = await chromium.launch();
await run(browser, 390, 844, WITH_VIDEO);
await run(browser, 360, 800, false);
await run(browser, 390, 664, false);
await run(browser, 360, 640, false);
await browser.close();
