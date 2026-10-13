import { test, expect, type Page } from "@playwright/test";
import { cutThreeLines, completeDoughStep, enterBakePaused, landNeedleAndTakeOut, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * #486 T1 (regression): the production opt-in key `teto-pizza-cheese-canvas` (src/preview/cheeseRenderMode.ts). The dev server this config starts allows the
 * Canvas path (a production build ships it OFF: src/preview/cheeseCanvas.bundle.gate.test.ts). Without the key the game shows the M1 cheese; with it, the
 * Canvas mozzarella is on the placed pieces, in the bake and on the cut RESULT, every canvas actually has visible pixels (no transparent cheese), and the page
 * does not scroll sideways. Runs in Chromium 390x844 / 360x800 and in WebKit (CI).
 */
async function playToResult(page: Page, optIn: string | null) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.clear();
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify({
      schemaVersion: 1,
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }],
      pitzBalance: 0,
      ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
      missionBest: {},
    }));
  });
  await page.goto("/");
  if (optIn !== null) await page.evaluate((v) => localStorage.setItem("teto-pizza-cheese-canvas", v), optIn);
  await page.reload(); // CHEESE_RENDER_MODE is read once per page load
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
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  for (const [x, y] of [[45, 55], [55, 45]]) await tapDoughPercent(page, x, y);
  await page.waitForTimeout(500);
  await enterBakePaused(page);
  await page.clock.runFor(1000);
  await landNeedleAndTakeOut(page, { start: 69, end: 71 });
  await page.waitForTimeout(400);
  await cutThreeLines(page);
  await page.getByRole("button", { name: /切り終わる/ }).click();
  await expect(page.locator(".result-panel")).toBeVisible();
  await page.waitForTimeout(600);
}

/** how many visible canvases have at least one non-transparent pixel */
const inkedCanvases = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLCanvasElement>("canvas.pizza-cheese-canvas")].filter((c) => {
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
      return false;
    }).length,
  );
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe.configure({ mode: "serial" });
test.describe("#486 T1 Canvas mozzarella opt-in", () => {
  test("no opt-in key: the M1 cheese only, on the cut RESULT", async ({ page }) => {
    test.setTimeout(120_000);
    await playToResult(page, null);
    await expect(page.locator(".pizza-cheese-canvas")).toHaveCount(0);
    expect(await page.locator(".pizza-cheese").count()).toBeGreaterThan(0);
  });

  test("kill switch '0': the M1 cheese only", async ({ page }) => {
    test.setTimeout(120_000);
    await playToResult(page, "0");
    await expect(page.locator(".pizza-cheese-canvas")).toHaveCount(0);
  });

  test("opt-in c64: every Canvas has pixels on the cut RESULT, the pieces stay whole, no sideways scroll", async ({ page }) => {
    test.setTimeout(120_000);
    await playToResult(page, "c64");
    const canvases = await page.locator(".pizza-cheese-canvas").count();
    expect(canvases).toBeGreaterThanOrEqual(3); // a cut pizza draws a topping in every piece it touches
    expect(await inkedCanvases(page)).toBe(canvases); // none is transparent
    expect(await page.locator(".pizza-piece").count()).toBe(6);
    expect(await noSideScroll(page)).toBe(true);
    // a discarded backing store (iOS) is caught: clear one canvas behind the game's back, then bring the page back
    await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("canvas.pizza-cheese-canvas")!;
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      window.dispatchEvent(new Event("pageshow"));
    });
    expect(await inkedCanvases(page)).toBe(await page.locator(".pizza-cheese-canvas").count()); // redrawn
  });
});
