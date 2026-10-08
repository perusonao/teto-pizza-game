import { test, expect, type Page } from "@playwright/test";
import { playFullMargheritaRound, startFreshMargherita } from "./gestures";

/**
 * Issue #423: a RESULT `<details>` opened below the fixed `.result-panel__actions` bar used to
 * expand behind it. Opening one now scrolls `.game-screen` so the opened detail ends above the
 * bar (390x844 and 360x800 via the iphone-* projects).
 */

const measure = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector(".result-panel__actions")!.getBoundingClientRect();
    const open = Array.from(document.querySelectorAll<HTMLDetailsElement>(".result-panel details[open]"));
    const last = open[open.length - 1];
    return { barTop: bar.top, lastBottom: last ? last.getBoundingClientRect().bottom : null, nOpen: open.length };
  });

async function expectEveryOpenedDetailClearsBar(page: Page) {
  const summaries = page.locator(".result-panel summary");
  const n = await summaries.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await summaries.nth(i).click();
    await page.waitForTimeout(150);
    const m = await measure(page);
    expect(m.lastBottom, `detail #${i} must end above the fixed bar`).toBeLessThanOrEqual(m.barTop);
  }
  const m = await measure(page);
  expect(m.nOpen).toBe(n);
  // The bar stays operable and the last detail is readable at the very end of the scroll.
  await page.evaluate(() => {
    const g = document.querySelector(".game-screen")!;
    g.scrollTop = g.scrollHeight;
  });
  const end = await measure(page);
  expect(end.lastBottom).toBeLessThanOrEqual(end.barTop);
  await expect(page.getByRole("button", { name: "もう一度つくる" })).toBeVisible();
}

test.describe("#423 RESULT detail vs fixed action bar", () => {
  test("CUTあり: 開くたびに詳細がボタンの上に収まり、開閉を繰り返しても崩れない", async ({ page }) => {
    test.setTimeout(60_000);
    await startFreshMargherita(page);
    await playFullMargheritaRound(page);
    await expect(page.locator(".cut-evaluation-summary")).toBeVisible();
    await expectEveryOpenedDetailClearsBar(page);
    // Close and re-open everything twice more.
    for (let round = 0; round < 2; round++) {
      const summaries = page.locator(".result-panel summary");
      const n = await summaries.count();
      for (let i = 0; i < n; i++) await summaries.nth(i).click();
      expect((await measure(page)).nOpen).toBe(0);
      for (let i = 0; i < n; i++) {
        await summaries.nth(i).click();
        await page.waitForTimeout(150);
        const m = await measure(page);
        expect(m.lastBottom).toBeLessThanOrEqual(m.barTop);
      }
    }
  });
});
