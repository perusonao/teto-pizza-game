import { test, expect } from "@playwright/test";
import {
  bakeToTarget,
  completeDoughStep,
  paintSauceRing,
  startFreshMargherita,
  tapDoughPercent,
  cutThreeLines,
} from "./gestures";

/**
 * Issue #453: leaving Guided POST_BAKE/CUT via 🏠ホーム asks for confirmation (cancel keeps the
 * CUT step, OK resets the round). `HV_SHOT_DIR` (unset in CI) additionally writes the
 * Human Verification screenshots.
 */
test("Guided CUT: HOME asks first; cancel stays, OK leaves and the next round is fresh", async ({ page }) => {
  test.setTimeout(45_000);
  const shotDir = process.env.HV_SHOT_DIR;
  const shot = async (name: string) => {
    if (shotDir) await page.screenshot({ path: `${shotDir}/${name}.png` });
  };
  await startFreshMargherita(page);
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
  if (await page.getByRole("button", { name: /バジル/ }).count()) {
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);
  }
  await bakeToTarget(page, { start: 60, end: 80 });
  await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
  await cutThreeLines(page);
  await shot("01-cut-in-progress");

  const messages: string[] = [];
  let accept = false;
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await (accept ? dialog.accept() : dialog.dismiss());
  });

  await page.getByRole("button", { name: /ホーム/ }).click();
  expect(messages).toHaveLength(1);
  await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
  await expect(page.locator(".pizza-cut-mark")).toHaveCount(3);
  await shot("02-after-cancel-stays");

  accept = true;
  await page.getByRole("button", { name: /ホーム/ }).click();
  expect(messages).toHaveLength(2);
  await expect(page.locator(".home-screen")).toBeVisible();
  await shot("03-home-after-confirm");

  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /^マルゲリータ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
  await expect(page.getByRole("button", { name: /切り終わる/ })).toHaveCount(0);
  await expect(page.locator(".pizza-cut-mark")).toHaveCount(0);
  await shot("04-next-round-fresh");
});
