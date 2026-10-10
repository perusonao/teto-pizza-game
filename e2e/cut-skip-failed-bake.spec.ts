import { expect, test, type Page } from "@playwright/test";
import {
  completeDoughStep,
  cutThreeLines,
  enterBakePaused,
  landNeedleAndTakeOut,
  paintSauceRing,
  startFreshMargherita,
  startLunchRushMission,
  startMarinaraUnlocked,
  tapDoughPercent,
} from "./gestures";

/**
 * Issue #256 (OD-CUT256-1..3): a pizza the Completion Gate fails for its bake skips CUT and shows
 * its failure at 取り出す, in Guided and Lunch Rush alike; a servable pizza keeps CUT. Dinner's half
 * lives in dinner-mission.spec.ts.
 *
 * Every take-out stays far from a Completion Gate band edge: the virtual-clock landing can drift
 * by several points on a loaded runner. Margherita (bakeTarget 60-80, band 50-90): raw at 2 and
 * in band at 70. Burnt uses marinara (bakeTarget 45-65, band 35-75) at 97 -- margherita's burnt
 * range (90-100) is too narrow to hit reliably.
 */

const RAW = { start: 0, end: 20 };
const PERFECT = 70;
const MARINARA_BURNT = 97;

async function prepareMargherita(page: Page) {
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
}

/** Marinara PREPARE (no CHEESE step): the same gestures as `playFullMarinaraRound`, without its bake. */
async function prepareMarinara(page: Page) {
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /にんにく/ }).click();
  await tapDoughPercent(page, 35, 45);
  await tapDoughPercent(page, 65, 45);
  await tapDoughPercent(page, 50, 65);
  await page.getByRole("button", { name: /オレガノ/ }).click();
  await tapDoughPercent(page, 45, 30);
  await tapDoughPercent(page, 55, 30);
}

async function bakeAt(page: Page, value: number | { start: number; end: number }) {
  await enterBakePaused(page);
  // #419: the needle only moves forward, so a "raw" take-out is a window at the start of the run
  // (every recipe's bake window starts at 45 or later), not a single point the needle may have passed.
  await landNeedleAndTakeOut(page, typeof value === "number" ? { start: value, end: value } : value);
}

const cutButton = (page: Page) => page.getByRole("button", { name: /切り終わる/ });

test.describe("Issue #256: CUT is skipped only for a Completion-Gate bake failure", () => {
  test("Guided raw: the 失敗 card appears at 取り出す, with no CUT", async ({ page }) => {
    await startFreshMargherita(page);
    await prepareMargherita(page);
    await bakeAt(page, RAW);
    await expect(page.locator(".result-panel--failed")).toBeVisible();
    await expect(page.locator(".result-panel--failed")).toContainText("生焼け");
    await expect(cutButton(page)).toHaveCount(0);
  });

  test("Guided burnt (marinara): the 失敗 card appears at 取り出す, with no CUT", async ({ page }) => {
    await startMarinaraUnlocked(page);
    await prepareMarinara(page);
    await bakeAt(page, MARINARA_BURNT);
    await expect(page.locator(".result-panel--failed")).toBeVisible();
    await expect(page.locator(".result-panel--failed")).toContainText("焦げ");
    await expect(cutButton(page)).toHaveCount(0);
  });

  test("Guided in band: CUT is kept, then the normal result", async ({ page }) => {
    await startFreshMargherita(page);
    await prepareMargherita(page);
    await bakeAt(page, PERFECT);
    await expect(cutButton(page)).toBeVisible();
    await cutThreeLines(page);
    await cutButton(page).click();
    await expect(page.locator(".result-panel")).toBeVisible();
    await expect(page.locator(".result-panel--failed")).toHaveCount(0);
  });

  test("Lunch Rush raw: the FAILED serve panel appears with no CUT, and the run moves on", async ({ page }) => {
    await startLunchRushMission(page, 900);
    await prepareMargherita(page);
    await bakeAt(page, RAW);
    await expect(page.locator(".mission-serve-panel--failed")).toBeVisible();
    await expect(cutButton(page)).toHaveCount(0);
    await page.getByRole("button", { name: /次の注文へ/ }).click();
    await expect(page.locator(".pizza-stage")).toBeVisible();
    await expect(page.locator(".mission-serve-panel")).toHaveCount(0);
  });

  test("Lunch Rush in band: CUT is kept before serving", async ({ page }) => {
    await startLunchRushMission(page, 900);
    await prepareMargherita(page);
    await bakeAt(page, PERFECT);
    await expect(cutButton(page)).toBeVisible();
    await cutThreeLines(page);
    await cutButton(page).click();
    await expect(page.locator(".mission-serve-panel")).toBeVisible();
    await expect(page.locator(".mission-serve-panel--failed")).toHaveCount(0);
  });
});
