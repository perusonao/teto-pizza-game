import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { RECIPES, countsTowardLadder } from "../src/data/recipes";
import { playFullMargheritaRound } from "./gestures";
import { materialsUpTo } from "../src/logic/catalog/testSupport/catalogDerived";

/**
 * Batch 6 PR-3 (OD-B6-PR3-1/2/3/5/6): the ⭐ shortfall line in the Shop, the silent retroactive unlock on load, and the
 * Lunch Rush unlock notice on the run result. Seeds only the starting save (schema v2, unchanged).
 *
 * Save: 50 credited recipes found (step 50 is reached), `margherita` at 1 star, the rest summing to `REST` stars, so the total is REST + 1.
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];
const CREDITED = RECIPES.filter((r) => countsTowardLadder(r.id)).map((r) => r.id as string);
const FOUND = ["margherita", ...CREDITED.filter((id) => id !== "margherita")].slice(0, 50);

function saveJson(restStars: number, ledger: readonly string[]) {
  // every found recipe holds at least 1 star (a 0-star entry is not a valid save row); the rest is spread up to 5 each
  let extra = restStars - (FOUND.length - 1);
  const dex = FOUND.map((recipeId) => {
    if (recipeId === "margherita") return { recipeId, discovered: true, bestScore: 40, bestStars: 1, timesMade: 1 };
    const add = Math.min(4, extra);
    extra -= add;
    return { recipeId, discovered: true, bestScore: 40, bestStars: 1 + add, timesMade: 1 };
  });
  return JSON.stringify({
    schemaVersion: 2,
    dex,
    pitzBalance: 500,
    ownedIngredientIds: STARTERS,
    missionBest: {},
    inventory: {},
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: ledger,
  });
}

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const hold = (page: Page, ms = 1500) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);
async function capture(page: Page, name: string, project: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}-${project}.png` });
}
async function noOverflow(page: Page, where: string) {
  const d = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(d, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}
async function open(page: Page, json: string, query = "") {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([key, value]) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, [SAVE_KEY, json] as const);
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
}
const openShop = async (page: Page) => {
  await page.getByRole("button", { name: /ショップ/ }).first().click();
  await page.waitForSelector(".shop-overlay__panel");
};
const LEDGER_49 = materialsUpTo(49);

test.describe("Batch 6 PR-3 star-gated unlock UX", () => {
  test.setTimeout(120_000);

  test("Shop shows one aggregated 「⭐あと○個」 line outside the LOCKED slots, with anonymous slots", async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    await open(page, saveJson(118, LEDGER_49)); // total 119: goat-cheese is 1 short
    await hold(page);
    await openShop(page);
    const line = page.locator("[data-shop-star-progress]");
    await expect(line).toHaveText(/あと1個で新しい材料が入荷/);
    expect(await line.evaluate((el) => !!el.closest(".shop-locked"))).toBe(false);
    await expect(page.locator(".shop-locked")).not.toContainText("⭐");
    await expect(page.locator(".shop-locked__cell").first()).toContainText("？？？");
    const body = await page.locator(".shop-overlay__panel").innerText();
    expect(body).not.toMatch(/ゴートチーズ|ほうれん草|ホウレンソウ|スピナッチ/);
    await noOverflow(page, "shop");
    await capture(page, "shop-star-line", project);
    await hold(page, 2500);
  });

  test("load with the gate already met unlocks retroactively and silently (no notice, no ⭐ line)", async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    await open(page, saveJson(124, LEDGER_49)); // total 125 >= 120
    await expect(page.locator(".material-unlock-notice")).toHaveCount(0);
    await hold(page);
    await openShop(page);
    await expect(page.locator("[data-shop-star-progress]")).toHaveCount(0);
    await expect(page.locator('[data-ingredient-id="goat-cheese"][data-shop-state="NEW"]')).toHaveCount(1);
    await expect(page.locator(".material-unlock-notice")).toHaveCount(0);
    await noOverflow(page, "shop-retro");
    await capture(page, "shop-retro-unlocked", project);
    await hold(page, 2500);
  });

  test("Lunch Rush: crossing 120 stars announces the unlock once on the run result", async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    const project = testInfo.project.name;
    await open(page, saveJson(118, LEDGER_49), "?missionDuration=25"); // total 119
    await page.getByRole("button", { name: /ランチラッシュ/ }).click();
    await page.getByRole("button", { name: "スタート" }).click();
    await page.getByRole("button", { name: "ピザを作る！" }).click();
    await page.waitForSelector(".pizza-stage");
    await playFullMargheritaRound(page);
    await expect(page.locator(".mission-serve-panel")).toBeVisible();
    await expect(page.locator(".material-unlock-notice")).toHaveCount(0); // not mid-run
    await hold(page);
    await page.getByRole("button", { name: "次の注文へ" }).click();
    await page.waitForSelector(".mission-result__stats", { timeout: 45_000 });
    const notice = page.locator(".material-unlock-notice");
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText("新しい材料が入荷");
    await noOverflow(page, "mission-result");
    const panel = await page.locator(".mission-overlay__panel").boundingBox();
    const vp = page.viewportSize()!;
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(vp.height);
    await capture(page, "lunch-rush-result-notice", project);
    await hold(page, 3000);
  });
});
