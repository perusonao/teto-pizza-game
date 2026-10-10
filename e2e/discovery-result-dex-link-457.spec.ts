import { test, expect, type Locator, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * #457 (Phase A of the first-play UX audit): a NEW PIZZA result keeps its primary CTA (「🛒 新しい食材を見る」) and gains a
 * secondary 「📖 図鑑を見る」 that opens the Dex over the result; closing the Dex returns to the same result. The Dex footer
 * is 「閉じる」 and does exactly that. Driven through the real UI at 390x844 and 360x800 (the iphone-* projects).
 */

// FREE_COOK_BAKE_TARGET (src/data/freeCook.ts)
const FREE_COOK_BAKE_TARGET = { start: 58, end: 78 };
const MIN_TOUCH = 44;

async function discoverMargherita(page: Page) {
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /レシピ発見/ }).click();
  await page.waitForSelector(".pizza-stage");
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
  await tapDoughPercent(page, 45, 60);
  await tapDoughPercent(page, 58, 42);
  await bakeToTarget(page, FREE_COOK_BAKE_TARGET);
  await page.waitForSelector(".result-panel--discovery");
}

async function expectTapTargetInViewport(page: Page, button: Locator) {
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  const vp = page.viewportSize()!;
  expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
}

async function expectNoHorizontalOverflow(page: Page) {
  const o = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(o.sw).toBeLessThanOrEqual(o.cw);
}

test.describe("#457 discovery result -> Dex link", () => {
  test("RESULT keeps the Shop primary, adds 図鑑を見る, opens the Dex and returns to the same RESULT", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await discoverMargherita(page);
    const shot = (name: string) =>
      process.env.TETO_SHOTS ? page.screenshot({ path: `${process.env.TETO_SHOTS}/${testInfo.project.name}-${name}.png` }) : Promise.resolve();

    const row = page.locator(".dex-registration-row");
    const shop = row.getByRole("button", { name: "🛒 新しい食材を見る" });
    const dexLink = row.getByRole("button", { name: "📖 図鑑を見る" });
    await expect(shop).toHaveClass(/dex-registration-row__cta--primary/);
    await expect(dexLink).toBeVisible();
    await expect(dexLink).not.toHaveClass(/dex-registration-row__cta--primary/);
    // Still no bottom CTA bar on a NEW PIZZA result (#358).
    await expect(page.locator(".result-panel__actions")).toHaveCount(0);
    await expectTapTargetInViewport(page, shop);
    await expectTapTargetInViewport(page, dexLink);
    await expectNoHorizontalOverflow(page);
    await page.waitForTimeout(1000);
    await shot("after-result");

    const before = await page.locator(".result-panel--discovery").innerText();
    await dexLink.click();
    const dex = page.locator(".dex-overlay");
    await expect(dex).toBeVisible();
    await expect(dex).toContainText("マルゲリータ");
    await expectNoHorizontalOverflow(page);
    await page.waitForTimeout(1000);
    await shot("after-dex-open");

    // Footer: label === action (closes only), 44px+, reachable at the end of the list.
    const footer = dex.locator(".dex-overlay__footer").getByRole("button");
    await expect(footer).toHaveText("閉じる");
    await expect(dex.getByRole("button", { name: "次のピザを作る" })).toHaveCount(0);
    await footer.scrollIntoViewIfNeeded();
    await expectTapTargetInViewport(page, footer);
    await page.waitForTimeout(800);
    await shot("after-dex-footer");
    await footer.click();
    await expect(dex).toHaveCount(0);

    // Back on the very same RESULT (nothing re-registered / reset).
    await expect(page.locator(".result-panel--discovery")).toBeVisible();
    expect(await page.locator(".result-panel--discovery").innerText()).toBe(before);
    await expect(page.locator(".discovered-banner__name")).toHaveText("マルゲリータ");
    await expect(shop).toBeVisible();
    await shot("after-result-returned");

    // The header 閉じる also returns to the result, and the save has exactly one margherita entry.
    await dexLink.click();
    await dex.getByRole("button", { name: "閉じる", exact: true }).first().click();
    await expect(dex).toHaveCount(0);
    await expect(page.locator(".result-panel--discovery")).toBeVisible();
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem("teto-pizza-save-v1")!));
    const m = save.dex.find((e: { recipeId: string }) => e.recipeId === "margherita");
    expect(m.discovered).toBe(true);
    expect(m.timesMade).toBe(1);

    // The Shop primary is unchanged: it still opens the Shop over the result.
    await shop.click();
    await expect(page.locator(".shop-overlay__balance")).toBeVisible();
  });
});
