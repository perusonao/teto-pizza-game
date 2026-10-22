import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { SAVE_KEY } from "./support/starGateSave";

/**
 * Save Protection PR-3 (#560): the write gate knows what THIS page loaded. Real browser, 390x844 and 360x800. Seeds only
 * this browser context's own storage (a fresh Playwright profile; never a real user's).
 *
 *   N1    the first read of the save on page load throws once (a transient failure), every later read works. Before PR-3 the
 *         mount-time save then replaced the real save with the default state.
 *   #282  a second tab of the same browser saves; this tab's next save (a Shop purchase) must be refused.
 *
 * Output (optional): HV_OUT_DIR gets screenshots and the recorded video. HV_VIDEO_SIZE=WxH sets the video size.
 */
const OUT = process.env.HV_OUT_DIR;
const [VW, VH] = (process.env.HV_VIDEO_SIZE ?? "").split("x").map(Number);
if (OUT) test.use({ video: VW && VH ? { mode: "on", size: { width: VW, height: VH } } : "on" });

const REAL_SAVE = JSON.stringify({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 90, bestStars: 5, timesMade: 9 }],
  pitzBalance: 5000,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
  missionBest: {},
  inventory: {},
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: ["mushroom"],
});

/** Playwright's screencast only emits frames on repaint; an invisible repaint keeps a still screen on video. */
async function hold(page: Page, ms = 1800) {
  if (!OUT) return;
  const end = Date.now() + ms;
  let n = 0;
  while (Date.now() < end) {
    await page.evaluate((i) => { document.documentElement.style.backgroundColor = i % 2 ? "#fffffe" : "#ffffff"; }, n++);
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => { document.documentElement.style.backgroundColor = ""; });
}
async function shot(page: Page, name: string, project: string) {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}-${project}.png` });
}
const readSave = (page: Page) => page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
async function seed(page: Page, raw: string) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem(k, v); }, [SAVE_KEY, raw] as const);
}
async function expectNoOverflow(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}

test("N1: a transient startup read failure never overwrites the save; the notice offers a reload that recovers", async ({ page }, info) => {
  await seed(page, REAL_SAVE);
  await page.addInitScript((key) => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = function (this: Storage, k: string) {
      if (k === key && sessionStorage.getItem("pr3-failed-once") === null) {
        sessionStorage.setItem("pr3-failed-once", "1");
        throw new Error("transient");
      }
      return real.call(this, k);
    };
  }, SAVE_KEY);

  await page.goto("/");
  await page.waitForSelector(".app-frame");
  const alert = page.locator('[data-save-notice="load-failed"]');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("保存データには手を加えていません");
  expect(await readSave(page)).toBe(REAL_SAVE);
  await expectNoOverflow(page, "load-failed notice");
  await hold(page);
  await shot(page, "after-01-home-load-failed", info.project.name);

  await alert.getByRole("button", { name: "再読み込み" }).click();
  await page.waitForSelector(".app-frame");
  await expect(page.locator("[data-save-notice]")).toHaveCount(0);
  const stored = JSON.parse((await readSave(page)) as string);
  expect(stored.pitzBalance).toBe(5000);
  expect(stored.dex.map((e: { recipeId: string }) => e.recipeId)).toEqual(["margherita"]);
  await hold(page);
  await shot(page, "after-02-home-after-reload", info.project.name);
});

test("#282: a tab whose save is out of date does not overwrite what another tab saved", async ({ page, context }, info) => {
  await seed(page, REAL_SAVE);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await expect(page.locator("[data-save-notice]")).toHaveCount(0);
  await hold(page, 1000);

  // Another tab of the same browser saves a different Pitz balance.
  const other = await context.newPage();
  await other.goto("icons/icon-16.png");
  const savedByOtherTab = JSON.stringify({ ...JSON.parse(REAL_SAVE), pitzBalance: 9000 });
  await other.evaluate(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, savedByOtherTab] as const);
  await other.close();

  // This (stale) tab buys something: it would save its own Pitz balance.
  await page.getByRole("button", { name: /ショップ/ }).click();
  await page.waitForSelector(".shop-overlay__body");
  await hold(page, 1000);
  await page.getByRole("button", { name: "仕入れる" }).first().click();
  await hold(page, 1000);
  expect(await readSave(page)).toBe(savedByOtherTab);

  await page.getByRole("button", { name: "閉じる" }).first().click();
  const alert = page.locator('[data-save-notice="stale-save"]');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("別のタブ");
  await expectNoOverflow(page, "stale-save notice");
  await hold(page);
  await shot(page, "after-03-home-stale-save", info.project.name);
  expect(await readSave(page)).toBe(savedByOtherTab);

  await alert.getByRole("button", { name: "再読み込み" }).click();
  await page.waitForSelector(".app-frame");
  await expect(page.locator("[data-save-notice]")).toHaveCount(0);
  expect(JSON.parse((await readSave(page)) as string).pitzBalance).toBe(9000);
  await hold(page);
});
