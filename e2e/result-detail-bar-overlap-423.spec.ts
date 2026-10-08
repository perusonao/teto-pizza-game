import { test, expect, type Page } from "@playwright/test";
import { playFullMargheritaRound, startFreshMargherita } from "./gestures";
import { runOnlyOnWidth } from "./support/projectGuard";

/**
 * Issue #423: RESULT's `.result-panel__actions` bar is a fixed bar at the bottom of the screen over the scrolling
 * `.game-screen`. Contract (390x844 and 360x800 via the project, plus a short Safari-like viewport):
 *  - both buttons are ALWAYS present, inside the screen, topmost at their own centre (the real tap target), at every scroll
 *    position and in every detail state -- the Owner's iPhone once showed no buttons at all;
 *  - the bar is opaque, so nothing shows through it (content is cleanly cut at its top edge);
 *  - a `<details>` opened below the bar's top edge is scrolled up above it;
 *  - at the default viewports nothing collapsed sits under the bar at first view.
 */

const measure = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector(".result-panel__actions")!.getBoundingClientRect();
    const open = Array.from(document.querySelectorAll<HTMLDetailsElement>(".result-panel details[open]"));
    const last = open[open.length - 1];
    return { barTop: bar.top, lastBottom: last ? last.getBoundingClientRect().bottom : null, nOpen: open.length };
  });

/** Presence / visibility / opacity / tap-target checks for the two action buttons in the current state. */
async function expectActionBarUsable(page: Page, label: string) {
  const m = await page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>(".result-panel__actions");
    const btns = Array.from(document.querySelectorAll<HTMLElement>(".result-panel__actions button"));
    const cs = bar && getComputedStyle(bar);
    const alpha = (c: string) => (c.startsWith("rgba") ? Number(c.replace(/^rgba\(|\)$/g, "").split(",")[3]) : 1);
    return {
      exists: !!bar,
      visible: !!cs && cs.visibility === "visible" && cs.display !== "none" && cs.opacity === "1",
      opaque: !!cs && cs.backgroundImage === "none" && alpha(cs.backgroundColor) === 1,
      barBottom: bar?.getBoundingClientRect().bottom ?? -1,
      vh: window.innerHeight,
      buttons: btns.map((b) => {
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { text: b.textContent, top: r.top, bottom: r.bottom, tappable: hit === b || b.contains(hit) };
      }),
    };
  });
  expect(m.exists, `${label}: bar exists`).toBe(true);
  expect(m.visible, `${label}: bar visible`).toBe(true);
  expect(m.opaque, `${label}: bar is opaque (nothing shows through it)`).toBe(true);
  expect(m.barBottom, `${label}: bar sits at the bottom of the screen`).toBeGreaterThanOrEqual(m.vh - 1);
  expect(m.buttons.map((b) => b.text)).toEqual(["もう一度つくる", "別のピザを作る"]);
  for (const b of m.buttons) {
    expect(b.top, `${label}: ${b.text} top in screen`).toBeGreaterThanOrEqual(0);
    expect(b.bottom, `${label}: ${b.text} bottom in screen`).toBeLessThanOrEqual(m.vh);
    expect(b.tappable, `${label}: ${b.text} is the topmost element at its centre`).toBe(true);
  }
}

async function expectEveryOpenedDetailClearsBar(page: Page) {
  const summaries = page.locator(".result-panel summary");
  const n = await summaries.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await summaries.nth(i).click();
    await page.waitForTimeout(150);
    const m = await measure(page);
    expect(m.lastBottom, `detail #${i} must end above the fixed bar`).toBeLessThanOrEqual(m.barTop);
    await expectActionBarUsable(page, `open ${i + 1}/${n}`);
  }
  expect((await measure(page)).nOpen).toBe(n);
  for (const top of [0, 150, 99999]) {
    await page.evaluate((t) => {
      document.querySelector(".game-screen")!.scrollTop = t;
    }, top);
    await page.waitForTimeout(120);
    await expectActionBarUsable(page, `all open, scrollTop=${top}`);
  }
  // At the very end of the scroll the last detail is readable above the bar.
  const end = await measure(page);
  expect(end.lastBottom).toBeLessThanOrEqual(end.barTop);
}

async function reachCutResult(page: Page) {
  await startFreshMargherita(page);
  await playFullMargheritaRound(page);
  await expect(page.locator(".cut-evaluation-summary")).toBeVisible();
}

test.describe("#423 RESULT detail vs fixed action bar", () => {
  test("CUTあり: 初期から両ボタンが表示・タップ可能、開くたびに詳細がボタンの上に収まり、開閉を繰り返しても崩れない", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await reachCutResult(page);
    await expectActionBarUsable(page, "initial");
    await expectEveryOpenedDetailClearsBar(page);
    // Close and re-open everything twice more.
    for (let round = 0; round < 2; round++) {
      const summaries = page.locator(".result-panel summary");
      const n = await summaries.count();
      for (let i = 0; i < n; i++) await summaries.nth(i).click();
      expect((await measure(page)).nOpen).toBe(0);
      await expectActionBarUsable(page, `closed again (${round + 1})`);
      for (let i = 0; i < n; i++) {
        await summaries.nth(i).click();
        await page.waitForTimeout(150);
        const m = await measure(page);
        expect(m.lastBottom).toBeLessThanOrEqual(m.barTop);
      }
    }
    // The primary button really works: a tap starts the next round (RESULT is left).
    await page.getByRole("button", { name: "もう一度つくる" }).click();
    await expect(page.locator(".result-panel")).toHaveCount(0);
  });

  test("初期表示: 折りたたみの詳細(くわしいスコアを見る含む)の文字全体がボタンの上で読める", async ({ page }) => {
    test.setTimeout(60_000);
    await reachCutResult(page);
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

  for (const [w, h] of [
    [390, 664],
    [390, 560],
  ] as const) {
    test(`短い viewport(ツールバー付きSafari相当 ${w}x${h}): 両ボタンは常に表示・タップ可能で、末尾までスクロールすれば詳細が読める`, async ({
      page,
    }, testInfo) => {
      runOnlyOnWidth(testInfo, 390);
      test.setTimeout(90_000);
      await page.setViewportSize({ width: w, height: h });
      await reachCutResult(page);
      await expectActionBarUsable(page, "initial");
      await expectEveryOpenedDetailClearsBar(page);
      // Closed again, the last collapsed row is reachable above the bar at the end of the scroll.
      const summaries = page.locator(".result-panel summary");
      const n = await summaries.count();
      for (let i = 0; i < n; i++) await summaries.nth(i).click();
      await page.evaluate(() => {
        const g = document.querySelector(".game-screen")!;
        g.scrollTop = g.scrollHeight;
      });
      const end = await page.evaluate(() => {
        const bar = document.querySelector(".result-panel__actions")!.getBoundingClientRect();
        const d = document.querySelector(".result-panel__details-summary")!.getBoundingClientRect();
        return { barTop: bar.top, top: d.top, bottom: d.bottom };
      });
      expect(end.top).toBeGreaterThanOrEqual(0);
      expect(end.bottom, "くわしいスコアを見る is fully readable at the scroll end").toBeLessThanOrEqual(end.barTop);
      await expectActionBarUsable(page, "closed, scroll end");
    });
  }
});
