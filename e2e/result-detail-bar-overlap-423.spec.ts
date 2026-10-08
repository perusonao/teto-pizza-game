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

  test("初期表示: 折りたたみの詳細(くわしいスコアを見る含む)の文字全体がボタンの上で読める", async ({ page }) => {
    test.setTimeout(60_000);
    await startFreshMargherita(page);
    await playFullMargheritaRound(page);
    await expect(page.locator(".cut-evaluation-summary")).toBeVisible();
    const m = await page.evaluate(() => {
      const bar = document.querySelector(".result-panel__actions")!.getBoundingClientRect();
      const rects = Array.from(document.querySelectorAll(".result-panel summary")).map((e) => {
        const r = e.getBoundingClientRect();
        return { text: e.textContent!.trim(), top: r.top, bottom: r.bottom };
      });
      return { barTop: bar.top, rects };
    });
    const score = m.rects.find((r) => r.text.includes("くわしいスコアを見る"));
    expect(score, "くわしいスコアを見る summary exists").toBeTruthy();
    for (const r of m.rects) {
      expect(r.top, `${r.text} starts inside the screen`).toBeGreaterThanOrEqual(0);
      expect(r.bottom, `${r.text} ends above the fixed bar`).toBeLessThanOrEqual(m.barTop);
    }
    // And the real tap target is the summary itself, not the bar drawn over it.
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("summary")?.textContent?.trim(), {
      x: 195,
      y: (score!.top + score!.bottom) / 2,
    });
    expect(hit).toContain("くわしいスコアを見る");
  });

  test("短い viewport(ツールバー付きSafari相当 390x664): スクロール領域はボタンの上で終わり、何も背後に入らない", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 664 });
    await startFreshMargherita(page);
    await playFullMargheritaRound(page);
    await expect(page.locator(".cut-evaluation-summary")).toBeVisible();
    const edge = () =>
      page.evaluate(() => {
        const bar = document.querySelector(".result-panel__actions")!.getBoundingClientRect();
        const gs = document.querySelector(".game-screen")!.getBoundingClientRect();
        const d = document.querySelector<HTMLElement>(".result-panel__details-summary")!.getBoundingClientRect();
        return { barTop: bar.top, scrollerBottom: gs.bottom, scoreTop: d.top, scoreBottom: d.bottom };
      });
    const init = await edge();
    expect(init.scrollerBottom, "scroll area ends at the bar").toBeLessThanOrEqual(init.barTop);
    // The row is below the fold at first (reachable by scrolling), never drawn under the bar.
    expect(init.scoreBottom <= init.barTop || init.scoreTop >= init.scrollerBottom).toBe(true);
    await page.evaluate(() => {
      const g = document.querySelector(".game-screen")!;
      g.scrollTop = g.scrollHeight;
    });
    const end = await edge();
    expect(end.scoreTop).toBeGreaterThanOrEqual(0);
    expect(end.scoreBottom, "fully readable at the scroll end").toBeLessThanOrEqual(end.barTop);
    // Open / close keeps working and the auto-scroll still brings an opened detail above the bar.
    await expectEveryOpenedDetailClearsBar(page);
    const summaries = page.locator(".result-panel summary");
    const n = await summaries.count();
    for (let i = 0; i < n; i++) await summaries.nth(i).click();
    expect((await measure(page)).nOpen).toBe(0);
    const closed = await edge();
    expect(closed.scrollerBottom).toBeLessThanOrEqual(closed.barTop);
  });
});
