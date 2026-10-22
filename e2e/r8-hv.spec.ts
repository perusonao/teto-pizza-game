import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, cutThreeLines, enterBakePaused, landNeedleAndTakeOut, paintSauceRing, tapDoughPercent } from "./gestures";
import { SAVE_KEY } from "./support/familyTray";

/**
 * Save R8 (#617) Human Verification recording (390x844). Only runs with HV_OUT_DIR (the video is delivered to the Owner directly and is
 * never committed). One continuous story: (1) a save that cannot take the bake stops the round and says why, (2) space is freed, the bake
 * goes through, (3) the app is reloaded in the middle of CUT -> the baked pizza is registered and the notice appears, (4) 確認した removes it,
 * (5) a kept journal this build cannot act on is shown with its recovery steps and left untouched.
 */
const OUT = process.env.HV_OUT_DIR;
test.skip(!OUT, "HV recording only (set HV_OUT_DIR)");
test.use({ video: { mode: "on", size: { width: 390, height: 844 } }, viewport: { width: 390, height: 844 } });

async function hold(page: Page, ms = 2200) {
  const end = Date.now() + ms;
  let n = 0;
  while (Date.now() < end) {
    await page.evaluate((i) => { document.documentElement.style.backgroundColor = i % 2 ? "#fffffe" : "#ffffff"; }, n++);
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => { document.documentElement.style.backgroundColor = ""; });
}
const save = {
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }],
  pitzBalance: 100,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "onion"],
  missionBest: {},
  inventory: { onion: 9 },
  starterGrantClaimedRecipeIds: [] as string[],
};
const readSave = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null") as Record<string, any> | null, SAVE_KEY);

test("R8 HV story", async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(OUT!, { recursive: true });
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [SAVE_KEY, JSON.stringify(save)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /マルゲリータ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  await tapDoughPercent(page, 45, 55);
  await tapDoughPercent(page, 55, 45);

  // (1) the save is full
  await page.evaluate((key) => {
    const real = Storage.prototype.setItem;
    (window as any).__failSave = true;
    Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
      if (k === key && (window as any).__failSave) throw new DOMException("quota", "QuotaExceededError");
      return real.call(this, k, v);
    };
  }, SAVE_KEY);
  await enterBakePaused(page);
  await page.clock.runFor(100);
  await landNeedleAndTakeOut(page, { start: 60, end: 80 });
  const alert = page.locator('[data-round-notice="save-failure"]');
  await expect(alert).toBeVisible();
  await hold(page, 3500);

  // (2) space is freed: the bake goes through (the needle kept running; a bad take-out would end in the failed result, so re-bake aim is not needed
  // for the story -- the next take-out lands wherever it is). Free the space and take out again.
  await page.evaluate(() => { (window as any).__failSave = false; });
  await page.getByRole("button", { name: "取り出す！" }).click();
  await hold(page, 1500);
  if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
    await cutThreeLines(page);
    await hold(page, 2500);
    // (3) reload in the middle of CUT
    await page.reload();
    await page.waitForSelector(".app-frame");
    const notice = page.locator('[data-round-notice="settled"]');
    await expect(notice).toBeVisible();
    await hold(page, 4000);
    // (4) confirm
    await notice.getByRole("button", { name: "確認した" }).click();
    await hold(page, 2000);
  }

  // (5) a journal this build cannot act on
  const current = await readSave(page);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify({ ...current, pendingRound: { v: 2, id: "from-a-newer-build", status: "pending" } })] as const);
  await page.reload();
  await page.waitForSelector(".app-frame");
  await expect(page.locator('[data-round-notice="held"]')).toBeVisible();
  await hold(page, 5000);
});
