import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { playFullMargheritaRound } from "./gestures";
import { SAVE_KEY, starGateSave } from "./support/starGateSave";

/**
 * Batch 6 PR-3 Owner-HV walkthrough: one continuous, real-browser recording per viewport that shows every state the Owner
 * would otherwise have to build by hand. Starting saves only (test-only, `./support/starGateSave.ts`); every transition on screen
 * is real UI. Nothing here changes game code, Production or a real save.
 *
 *   A step 50 / 119 stars  -> Shop: 「⭐あと1個」, anonymous LOCKED slots, no goat-cheese row
 *   B step 50 / 120 stars  -> load unlocks retroactively and silently: goat-cheese NEW, no ⭐ line, no notice
 *   C step 51 / 129 stars  -> Shop: 「⭐あと1個」 for the 130 gate, goat-cheese NEW, no spinach row
 *   D step 51 / 130 stars  -> spinach NEW, no ⭐ line
 *   E step 50 / 119 stars  -> Lunch Rush: a serve crosses 120 -> the run result announces the unlock once
 *
 * Output: HV_OUT_DIR (screenshots + the recorded video copied there). HV_VIDEO_SIZE=WxH sets the video size (default = viewport).
 */
const OUT = process.env.HV_OUT_DIR;
const [VW, VH] = (process.env.HV_VIDEO_SIZE ?? "").split("x").map(Number);
test.use({ video: VW && VH ? { mode: "on", size: { width: VW, height: VH } } : "on" });

const hold = (page: Page, ms = 1800) => page.waitForTimeout(ms);
async function shot(page: Page, name: string, project: string) {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}-${project}.png` });
}
async function noOverflow(page: Page, where: string) {
  const d = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(d, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}
async function inViewport(page: Page, selector: string, where: string) {
  const box = await page.locator(selector).first().boundingBox();
  const vp = page.viewportSize()!;
  expect(box, `${where}: ${selector} missing`).not.toBeNull();
  expect(box!.y, `${where}: top cut off`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${where}: bottom cut off`).toBeLessThanOrEqual(vp.height);
  expect(box!.x + box!.width, `${where}: right cut off`).toBeLessThanOrEqual(vp.width);
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
async function openShop(page: Page) {
  await page.getByRole("button", { name: /ショップ/ }).first().click();
  await page.waitForSelector(".shop-overlay__panel");
}
const row = (page: Page, id: string) => page.locator(`[data-ingredient-id="${id}"]`);
const starLine = (page: Page) => page.locator("[data-shop-star-progress]");

async function expectAnonymousLocked(page: Page) {
  const slots = page.locator(".shop-locked__cell");
  expect(await slots.count()).toBeGreaterThan(0);
  const html = await slots.evaluateAll((els) => els.map((e) => e.innerHTML));
  expect(new Set(html).size, "every LOCKED slot is identical").toBe(1);
  await expect(page.locator(".shop-locked")).not.toContainText(/⭐|あと|ゴート|ほうれん|スピナ/);
  expect(await starLine(page).evaluateAll((els) => els.filter((e) => e.closest(".shop-locked")).length)).toBe(0);
}

test("Batch 6 PR-3 HV walkthrough (A-E) with video", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const project = testInfo.project.name;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // A: step 50, 119 stars
  await open(page, starGateSave(50, 119));
  await expect(page.locator(".material-unlock-notice")).toHaveCount(0);
  await hold(page);
  await openShop(page);
  await expect(starLine(page)).toHaveText(/あと1個で新しい材料が入荷/);
  await expect(row(page, "goat-cheese")).toHaveCount(0);
  await expect(row(page, "avocado")).toHaveCount(1); // step 50's ladder-only material is already on sale
  await expectAnonymousLocked(page);
  await noOverflow(page, "A shop");
  await page.locator(".shop-locked").scrollIntoViewIfNeeded();
  await hold(page);
  await shot(page, "A-step50-stars119-shop", project);
  await page.locator(".shop-overlay__body").evaluate((el) => (el.scrollTop = 0));
  await hold(page);

  // B: step 50, 120 stars -- the save's ledger lacks goat-cheese, so the load itself unlocks it (retroactive, silent)
  await open(page, starGateSave(50, 120));
  await expect(page.locator(".material-unlock-notice")).toHaveCount(0);
  await hold(page);
  await openShop(page);
  await expect(starLine(page)).toHaveCount(0);
  await expect(row(page, "goat-cheese")).toHaveAttribute("data-shop-state", "NEW");
  await expect(page.locator(".material-unlock-notice")).toHaveCount(0);
  await expectAnonymousLocked(page);
  await noOverflow(page, "B shop");
  await hold(page);
  await shot(page, "B-step50-stars120-shop-retro", project);

  // C: step 51, 129 stars
  await open(page, starGateSave(51, 129));
  await openShop(page);
  await expect(starLine(page)).toHaveText(/あと1個で新しい材料が入荷/);
  await expect(row(page, "goat-cheese")).toHaveAttribute("data-shop-state", "NEW");
  await expect(row(page, "artichoke")).toHaveCount(1);
  await expect(row(page, "spinach")).toHaveCount(0);
  await expectAnonymousLocked(page);
  await noOverflow(page, "C shop");
  await hold(page);
  await shot(page, "C-step51-stars129-shop", project);

  // D: step 51, 130 stars
  await open(page, starGateSave(51, 130));
  await openShop(page);
  await expect(starLine(page)).toHaveCount(0);
  await expect(row(page, "spinach")).toHaveAttribute("data-shop-state", "NEW");
  await expect(page.locator(".material-unlock-notice")).toHaveCount(0);
  await expect(page.locator(".shop-locked")).toHaveCount(0); // every material is unlocked: no LOCKED slot is left to show
  await noOverflow(page, "D shop");
  await hold(page);
  await shot(page, "D-step51-stars130-shop", project);

  // E: Lunch Rush crossing 120 (step 50, 119 stars -> a margherita serve)
  await open(page, starGateSave(50, 119), "?missionDuration=25");
  await page.getByRole("button", { name: /ランチラッシュ/ }).click();
  await hold(page, 1200);
  await page.getByRole("button", { name: "スタート" }).click();
  await page.getByRole("button", { name: "ピザを作る！" }).click();
  await page.waitForSelector(".pizza-stage");
  await playFullMargheritaRound(page);
  await expect(page.locator(".mission-serve-panel")).toBeVisible();
  await expect(page.locator(".material-unlock-notice")).toHaveCount(0); // never mid-run
  await hold(page);
  await page.getByRole("button", { name: "次の注文へ" }).click();
  await page.waitForSelector(".mission-result__stats", { timeout: 45_000 });
  const notice = page.locator(".material-unlock-notice");
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText(/新しい材料が入荷：.+/);
  await noOverflow(page, "E result");
  await inViewport(page, ".mission-overlay__panel", "E result");
  await inViewport(page, ".material-unlock-notice", "E result notice");
  await hold(page, 3000);
  await shot(page, "E-lunch-rush-result-notice", project);

  // after the run: the Shop shows the unlocked material as NEW and no ⭐ line
  await page.getByRole("button", { name: /ホームへ/ }).click();
  await openShop(page);
  await expect(row(page, "goat-cheese")).toHaveAttribute("data-shop-state", "NEW");
  await expect(starLine(page)).toHaveCount(0);
  await hold(page);
  await shot(page, "E-after-run-shop", project);

  expect(errors, "page errors").toEqual([]);

  // the recording is finalized when the page closes
  const video = page.video();
  await page.close();
  if (OUT && video) {
    mkdirSync(OUT, { recursive: true });
    await video.saveAs(`${OUT}/batch6-pr3-hv-${project}.webm`); // waits until the recording is finalized
  }
});
