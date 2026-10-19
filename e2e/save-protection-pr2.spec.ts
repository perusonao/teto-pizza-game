import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { SAVE_KEY } from "./support/starGateSave";

/**
 * Save Protection PR-2 (#560): HOME notice, Reset dialog and backup deletion in a real browser, at 390x844 and 360x800.
 * Seeds only this browser context's own storage (a fresh Playwright profile; never a real user's).
 *
 * Output (optional): HV_OUT_DIR gets screenshots and the recorded video. HV_VIDEO_SIZE=WxH sets the video size.
 */
const OUT = process.env.HV_OUT_DIR;
const [VW, VH] = (process.env.HV_VIDEO_SIZE ?? "").split("x").map(Number);
if (OUT) test.use({ video: VW && VH ? { mode: "on", size: { width: VW, height: VH } } : "on" });

const FUTURE = JSON.stringify({ schemaVersion: 3, dex: [], pitzBalance: 777, futureField: { keep: "me" } });
const BROKEN = "{not json";
const FIRST_KEY = `${SAVE_KEY}.quarantine-v1.first`;

/** Playwright's screencast only emits frames on repaint; an invisible repaint keeps a still screen on video. */
async function hold(page: Page, ms = 1800) {
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
async function seed(page: Page, entries: Record<string, string>) {
  await page.goto("icons/icon-16.png");
  await page.evaluate((e) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v);
  }, entries);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}
async function expectFits(page: Page, selector: string, where: string) {
  const box = await page.locator(selector).first().boundingBox();
  const vp = page.viewportSize()!;
  expect(box, `${where}: ${selector} missing`).not.toBeNull();
  expect(box!.y, `${where}: top`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${where}: bottom`).toBeLessThanOrEqual(vp.height);
  expect(box!.x, `${where}: left`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${where}: right`).toBeLessThanOrEqual(vp.width);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}

test("no notice on a healthy first launch", async ({ page }) => {
  await seed(page, {});
  await expect(page.locator("[data-save-notice]")).toHaveCount(0);
});

test("future version: notice, reset dialog, backup notice, explicit backup deletion", async ({ page }, info) => {
  const p = info.project.name;

  // A. Future version: blocking notice, save untouched, HOME still usable.
  await seed(page, { [SAVE_KEY]: FUTURE });
  const banner = page.locator("[data-save-notice]");
  await expect(banner).toHaveAttribute("data-save-notice", "future-version");
  await expectFits(page, "[data-save-notice]", "future-version banner");
  await expect(banner.getByRole("button", { name: "了解" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /ピザを作る/ }).first()).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(FUTURE);
  await hold(page);
  await shot(page, "01-home-future-version", p);

  // B. Settings -> Reset dialog says the data is kept, not deleted; cancel changes nothing.
  await banner.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "ゲームデータをリセット" }).click();
  const dialog = page.locator(".settings-reset-confirm__panel");
  await expect(dialog).toContainText("削除されず端末内に退避");
  await expectFits(page, ".settings-reset-confirm__panel", "reset dialog");
  await hold(page);
  await shot(page, "02-reset-dialog-future-version", p);
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(FUTURE);

  // C. Reset for real: the save moves into the backup, the page reloads onto a fresh game with the info notice.
  await page.getByRole("button", { name: "ゲームデータをリセット" }).click();
  await Promise.all([
    page.waitForEvent("load"),
    dialog.getByRole("button", { name: "最初からやり直す" }).click(),
  ]);
  await page.waitForSelector(".app-frame");
  const kept = page.locator("[data-save-notice]");
  await expect(kept).toHaveAttribute("data-save-notice", "backup-kept");
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBeNull();
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), FIRST_KEY))!).raw).toBe(FUTURE);
  await expectFits(page, "[data-save-notice]", "backup-kept banner");
  await hold(page);
  await shot(page, "03-home-backup-kept", p);

  // D. Backup deletion is its own explicit step: disabled until acknowledged, cancel keeps it.
  await kept.getByRole("button", { name: "設定を開く" }).click();
  await expect(page.getByTestId("settings-backup-section")).toBeVisible();
  await hold(page, 1200);
  await shot(page, "04-settings-backup-section", p);
  await page.getByRole("button", { name: "退避データを削除…" }).click();
  const discard = page.locator(".settings-reset-confirm__panel");
  const confirm = discard.getByRole("button", { name: "削除する" });
  await expect(confirm).toBeDisabled();
  await expectFits(page, ".settings-reset-confirm__panel", "discard dialog");
  await hold(page, 1500);
  await shot(page, "05-discard-dialog", p);
  await discard.getByRole("button", { name: "キャンセル" }).click();
  expect(await page.evaluate((k) => localStorage.getItem(k), FIRST_KEY)).not.toBeNull();
  await page.getByRole("button", { name: "退避データを削除…" }).click();
  await discard.getByRole("checkbox").check();
  await expect(confirm).toBeEnabled();
  await hold(page, 1200);
  await confirm.click();
  await expect(page.getByText("退避データを削除しました。")).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), FIRST_KEY)).toBeNull();
  await hold(page);
  await shot(page, "06-backup-deleted", p);
});

test("corrupt save: its own notice, bytes kept until the first save", async ({ page }, info) => {
  await seed(page, { [SAVE_KEY]: BROKEN });
  await expect(page.locator("[data-save-notice]")).toHaveAttribute("data-save-notice", "corrupt");
  await expectFits(page, "[data-save-notice]", "corrupt banner");
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(BROKEN);
  await hold(page, 1200);
  await shot(page, "07-home-corrupt", info.project.name);
});
