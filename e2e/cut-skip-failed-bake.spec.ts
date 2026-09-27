import { expect, test, type Page } from "@playwright/test";
import {
  completeDoughStep,
  cutThreeLines,
  enterBakePaused,
  landNeedleAndTakeOut,
  paintSauceRing,
  startFreshMargherita,
  startLunchRushMission,
  tapDoughPercent,
} from "./gestures";

/**
 * Issue #256 (OD-CUT256-1..3): a pizza the Completion Gate fails for its bake skips CUT and shows
 * its failure at 取り出す, in Guided and Lunch Rush alike; a servable pizza keeps CUT. Margherita:
 * bakeTarget 60-80, Completion Gate band 50-90. The bakes used here stay far from the band edges
 * (2 / 70 / 99): the needle moves 55 %/s, so a value within a few points of an edge is timing-
 * sensitive. Dinner's half lives in dinner-mission.spec.ts.
 */

const RAW = 2;
const PERFECT = 70;
const BURNT = 99;

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

async function bakeAt(page: Page, value: number) {
  await enterBakePaused(page);
  await landNeedleAndTakeOut(page, { start: value, end: value });
}

const cutButton = (page: Page) => page.getByRole("button", { name: /切り終わる/ });

test.describe("Issue #256: CUT is skipped only for a Completion-Gate bake failure", () => {
  for (const [label, value, reason] of [
    ["raw", RAW, "生焼け"],
    ["burnt", BURNT, "焦げ"],
  ] as const) {
    test(`Guided ${label}: the 失敗 card appears at 取り出す, with no CUT`, async ({ page }) => {
      await startFreshMargherita(page);
      await prepareMargherita(page);
      await bakeAt(page, value);
      await expect(page.locator(".result-panel--failed")).toBeVisible();
      await expect(page.locator(".result-panel--failed")).toContainText(reason);
      await expect(cutButton(page)).toHaveCount(0);
    });
  }

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

  test("Lunch Rush burnt: the FAILED serve panel appears with no CUT, and the run moves on", async ({ page }) => {
    await startLunchRushMission(page, 900);
    await prepareMargherita(page);
    await bakeAt(page, BURNT);
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
