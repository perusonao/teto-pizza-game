import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * #421 S2-B2 Human Verification video capture (NOT a regression test): one real-time Margherita bake (the needle runs from 0 and is taken out at the
 * target window), recorded at the viewport size, for M1 and the Canvas mozzarella. Skipped unless CHEESE_VIDEO_DIR is set. The video is delivered to
 * the Owner directly and is not committed.
 */
const DIR = process.env.CHEESE_VIDEO_DIR;
const MODE = process.env.CHEESE_VIDEO_MODE ?? "m1";
const TAG = process.env.CHEESE_VIDEO_TAG ?? MODE;

test.use({ video: { mode: "on", size: { width: 390, height: 844 } }, viewport: { width: 390, height: 844 } });

async function reachBake(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify({ schemaVersion: 1, dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }], pitzBalance: 0, ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"], missionBest: {} }));
  });
  await page.goto(`/?cheese=${MODE}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
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
  for (const [x, y] of [[40, 50], [60, 50], [50, 30]]) await tapDoughPercent(page, x, y);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  for (const [x, y] of [[45, 55], [55, 45]]) await tapDoughPercent(page, x, y);
  await page.waitForTimeout(800);
}

test.describe("S2-B2 video", () => {
  test.skip(!DIR, "set CHEESE_VIDEO_DIR");
  test("bake in real time", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const t0 = Date.now(); // the video starts with the page
    await reachBake(page);
    const bakeStartMs = Date.now() - t0;
    await page.getByRole("button", { name: /焼く/ }).click();
    await page.waitForSelector(".bake-gauge__needle");
    await page.waitForFunction(() => Number.parseFloat((document.querySelector(".bake-gauge__needle") as HTMLElement | null)?.style.left ?? "0") >= 66, undefined, { polling: "raf" });
    await page.getByRole("button", { name: "取り出す！" }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator(".pizza-stage").first()).toBeVisible();
    mkdirSync(DIR!, { recursive: true });
    const video = page.video()!;
    await page.close();
    await video.saveAs(`${DIR}/bake-${TAG}.webm`);
    writeFileSync(`${DIR}/bake-${TAG}.json`, JSON.stringify({ bakeStartMs }));
    void testInfo;
  });
});
