import { test, expect, type Page } from "@playwright/test";
import { PREVIEW_BASE, PROD_BASE, PROD_KEY, PREVIEW_KEY, startDevStateServers, type DevStateServers } from "./support/devStateBuilds";

/**
 * Settings -> 開発用データ編集 (DEV State Editor link), on REAL builds at 390x844 and 360x800 (the two iphone projects).
 * Preview shows the 「開発・テスト」 section and the link opens the existing `?dev=state` editor, whose 「ゲームへ戻る」
 * returns to the game; Production shows neither and never has the editor.
 */

let servers: DevStateServers;
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  test.setTimeout(240_000);
  servers = await startDevStateServers();
});
test.afterAll(async () => servers.close());

async function openSettings(page: Page, base: string) {
  await page.goto(`${servers.origin}${base}`);
  await page.getByRole("button", { name: "設定" }).click();
  await expect(page.getByRole("heading", { name: /設定/ })).toBeVisible();
}

test("Preview: the link is visible inside the viewport, opens the editor and 「ゲームへ戻る」 returns to the game", async ({ page }) => {
  await openSettings(page, PREVIEW_BASE);
  const link = page.getByRole("link", { name: "開発用データ編集" });
  await link.scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "開発・テスト" })).toBeVisible();
  const box = (await link.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vp.width);

  await link.click();
  await expect(page).toHaveURL(`${servers.origin}${PREVIEW_BASE}?dev=state`);
  await expect(page.getByRole("link", { name: "ゲームへ戻る" })).toBeVisible();
  await page.getByRole("link", { name: "ゲームへ戻る" }).click();
  await expect(page).toHaveURL(`${servers.origin}${PREVIEW_BASE}`);
  await expect(page.getByRole("button", { name: "設定" })).toBeVisible();
});

test("Production: no 開発・テスト section, no link, and ?dev=state does not open the editor", async ({ page }) => {
  await openSettings(page, PROD_BASE);
  await expect(page.getByRole("heading", { name: "ゲームデータ" })).toBeVisible();
  await expect(page.getByText("開発・テスト")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "開発用データ編集" })).toHaveCount(0);
  expect(await page.evaluate(() => document.body.innerHTML.includes("dev=state"))).toBe(false);
  const before = await page.evaluate((k) => localStorage.getItem(k), PROD_KEY);
  await page.goto(`${servers.origin}${PROD_BASE}?dev=state`);
  await expect(page.getByRole("link", { name: "ゲームへ戻る" })).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), PROD_KEY)).toBe(before);
  expect(await page.evaluate((k) => localStorage.getItem(k), PREVIEW_KEY)).toBeNull();
});
