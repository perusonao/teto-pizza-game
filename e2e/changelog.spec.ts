import { test, expect, type Page } from "@playwright/test";

/**
 * 更新情報 (changelog): HOME -> 更新情報 -> close -> HOME. Chromium 390×844 / 360×800: the sheet
 * scrolls vertically, no horizontal overflow, 閉じる reachable, HOME CTAs intact, no internal terms.
 * HV_SCREENSHOT_DIR (optional) writes the Human Verification screenshots.
 */
const INTERNAL = /#\d|\bPR\b|\bIssue\b|\bSHA\b|\bS[0-4]\b|\bCI\b|WebKit|matcher|schema|Codex/;

async function openHome(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function shot(page: Page, name: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: `${dir}/${test.info().project.name.replace("iphone-", "")}-${name}.png` });
}

const overflow = (page: Page) =>
  page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));

test("HOME -> 更新情報 -> close -> HOME", async ({ page }) => {
  await openHome(page);
  const entry = page.getByRole("button", { name: /更新情報/ });
  await entry.scrollIntoViewIfNeeded();
  await shot(page, "home-entry");
  await entry.click();

  const dialog = page.getByRole("dialog", { name: "更新情報" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "レシピ発見アップデート" })).toBeVisible();
  await expect(dialog.getByText("発見したピザは図鑑に登録されます")).toBeVisible();
  expect(await dialog.innerText()).not.toMatch(INTERNAL);
  const m = await overflow(page);
  expect(m.sw).toBeLessThanOrEqual(m.vw);
  await shot(page, "changelog-list");

  // The body is the scroll container; it must be vertically scrollable-or-fitting and never wider than the viewport.
  const body = page.locator(".changelog-overlay__panel .dex-overlay__body");
  const dims = await body.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, oy: getComputedStyle(el).overflowY }));
  expect(dims.sw).toBeLessThanOrEqual(dims.cw);
  expect(dims.oy).toBe("auto");

  const close = dialog.getByRole("button", { name: "閉じる" });
  const box = (await close.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  await close.click();

  await expect(dialog).toHaveCount(0);
  for (const name of [/ピザを作る/, /レシピ発見/, /ピザ図鑑/, /ショップ/]) {
    await expect(page.getByRole("button", { name }).first()).toBeVisible();
  }
});
