import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { completeDoughStep, enterBakePaused, landNeedleAndTakeOut, paintSauceRing, tapDoughPercent } from "../../e2e/gestures";

/**
 * Wave 2 W2-A1 visual verification (Owner A5/A6): the 8 W2-A materials are catalog-only in
 * production, so this seeds a save that owns them (the sanitizer keeps known ids) and draws them in
 * the real Free Cooking tray, on the dough, after BAKE and on RESULT, next to their nearest look-alikes
 * (bacon, ham, basil, oregano). Screenshots only: docs/reports/screenshots/wave2-w2a1-visual/.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHOT_DIR = join(ROOT, "docs/reports/screenshots/wave2-w2a1-visual");
const FINITE = [
  "olive-oil", "pesto", "gorgonzola", "parmigiano", "fontina", "garlic", "oregano", "cherry-tomato",
  "egg", "mushroom", "onion", "sausage", "pepperoni", "anchovy", "tuna", "rosemary", "bacon", "ham",
  "black-olive", "capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato",
  "prosciutto-crudo", "fromage-blanc-sauce", "arugula", "shrimp", "chicken", "parsley", "bell-pepper", "zucchini",
];

async function open(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate((save) => {
    localStorage.clear();
    localStorage.setItem("teto-pizza-save-v1", save);
  }, JSON.stringify({
    schemaVersion: 2,
    dex: ["margherita", "bismarck", "funghi"].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance: 500,
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...FINITE],
    missionBest: {},
    inventory: Object.fromEntries(FINITE.map((id) => [id, 30])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: FINITE.slice(0, 26),
  }));
  await page.goto("./");
  await page.waitForSelector(".app-frame");
}

const next = (page: Page) => page.locator(".prepare-bake-bar").getByRole("button", { name: /次へ/ }).click();
async function chip(page: Page, name: RegExp) {
  const c = page.locator(".ingredient-chip").filter({ hasText: name });
  for (const dir of ["前のページ", "次のページ"]) {
    const btn = page.getByRole("button", { name: dir });
    for (let i = 0; i < 6 && !(await c.count()) && (await btn.count()) && (await btn.isEnabled()); i += 1) await btn.click();
  }
  await c.first().click();
}

for (const vp of [{ id: "390x844", width: 390, height: 844 }, { id: "360x800", width: 360, height: 800 }]) {
  test(`W2-A1 materials @${vp.id}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(SHOT_DIR, { recursive: true });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);
    await page.getByRole("button", { name: /フリークッキング/ }).first().click();
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await next(page);
    await page.screenshot({ path: join(SHOT_DIR, `01-sauce-tray_${vp.id}.png`) });
    await chip(page, /フロマージュブラン/);
    for (const [r, n] of [[8, 8], [18, 14], [28, 20], [34, 24]] as const) {
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2;
        await tapDoughPercent(page, 50 + Math.cos(a) * r, 50 + Math.sin(a) * r);
      }
    }
    await page.screenshot({ path: join(SHOT_DIR, `02-white-sauce_${vp.id}.png`) });
    await next(page);
    await next(page);
    for (let p = 0; p < 4; p += 1) await page.getByRole("button", { name: "次のページ" }).click();
    await page.screenshot({ path: join(SHOT_DIR, `03-topping-tray-page5_${vp.id}.png`) });
    await page.getByRole("button", { name: "前のページ" }).click();
    await page.screenshot({ path: join(SHOT_DIR, `04-topping-tray-page4_${vp.id}.png`) });
    const spots: [RegExp, number, number][] = [
      [/生ハム/, 30, 30], [/ベーコン/, 50, 24], [/(?<!生)ハム/, 70, 30],
      [/パセリ/, 24, 50], [/バジル/, 40, 46], [/オレガノ/, 60, 46], [/ルッコラ/, 76, 50],
      [/エビ/, 30, 68], [/チキン/, 50, 76], [/パプリカ/, 70, 68], [/ズッキーニ/, 50, 58],
    ];
    for (const [name, x, y] of spots) {
      await chip(page, name);
      await tapDoughPercent(page, x, y);
    }
    await page.locator('[data-pizza-drop-target="true"]').screenshot({ path: join(SHOT_DIR, `05-pieces-on-dough_${vp.id}.png`) });
    await enterBakePaused(page);
    await landNeedleAndTakeOut(page, { start: 60, end: 80 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(SHOT_DIR, `06-result_${vp.id}.png`) });
  });
}
