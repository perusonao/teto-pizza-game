import { test, expect } from "@playwright/test";
import { playFullMargheritaRound, startFreshMargherita } from "./gestures";

/**
 * Viewport 1-screen-completion regression suite (see docs/reports/
 * TETO_VIEWPORT-1SCREEN_Result.md for the audit this codifies). Real Chromium only -- these
 * assertions (page/body scroll, modal height, internal-vs-page scroll boundary) need real
 * layout, which vitest/jsdom (this repo's `npm test`) cannot produce. Two Playwright *projects*
 * (playwright.config.ts) run every test at both 390x844 (authority) and 360x800 (secondary).
 *
 * Scope: CSS/layout only. Firebase, ranking data, scoring, Dex/progression are untouched by
 * this task and are not re-verified here -- the existing vitest suite (src/**\/*.test.ts(x))
 * already owns that behavior.
 */

async function freshHome(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".app-frame");
}

async function pageScrollState(page: import("@playwright/test").Page) {
  return page.evaluate(() => ({
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    docScrollHeight: document.documentElement.scrollHeight,
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollHeight: document.body.scrollHeight,
  }));
}

test.describe("Static screens fit the viewport with no page/body scroll", () => {
  test("HOME", async ({ page }) => {
    await freshHome(page);
    const s = await pageScrollState(page);
    expect(s.docScrollHeight).toBeLessThanOrEqual(s.innerHeight);
    expect(s.docScrollWidth).toBeLessThanOrEqual(s.innerWidth);
  });

  test("Settings / Shop / Inventory / Dex overlays never grow the page", async ({ page }) => {
    await freshHome(page);
    for (const name of [/ショップ/, /材料/, /ピザ図鑑/]) {
      await page.getByRole("button", { name }).click();
      const s = await pageScrollState(page);
      expect(s.docScrollHeight, `${name} overlay produced page scroll`).toBeLessThanOrEqual(s.innerHeight);
      await page.getByRole("button", { name: "閉じる" }).click();
    }
    await page.getByRole("button", { name: "設定" }).click();
    const s = await pageScrollState(page);
    expect(s.docScrollHeight).toBeLessThanOrEqual(s.innerHeight);
  });
});

test.describe("Recipe Select: browse grid scrolls internally, not the page", () => {
  test("grid content overflows its own scroll region, never the document", async ({ page }) => {
    await freshHome(page);
    await page.getByRole("button", { name: /ピザを作る/ }).click();

    const s = await pageScrollState(page);
    expect(s.docScrollHeight, "Recipe Select must not grow the page").toBeLessThanOrEqual(s.innerHeight);

    const body = await page.evaluate(() => {
      const el = document.querySelector(".pizza-select-body")!;
      return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowY: getComputedStyle(el).overflowY };
    });
    // The grid (15 recipes) is a known long-content case -- it's expected to overflow its own
    // region and scroll there, just never the page.
    expect(body.overflowY).toBe("auto");
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);

    await page.evaluate(() => document.querySelector(".pizza-select-body")!.scrollTo(0, 300));
    const after = await page.evaluate(() => ({
      bodyScrollTop: document.querySelector(".pizza-select-body")!.scrollTop,
      docScrollTop: document.documentElement.scrollTop,
    }));
    expect(after.bodyScrollTop).toBeGreaterThan(0);
    expect(after.docScrollTop).toBe(0);
  });
});

test.describe("Weekly Ranking modal sizes to content, not a fixed 80dvh", () => {
  test("empty/status-only state (no Firebase configured in this env) stays compact", async ({ page }) => {
    await freshHome(page);
    await page.getByRole("button", { name: /ランキング/ }).click();
    await page.waitForTimeout(300);

    const s = await pageScrollState(page);
    expect(s.docScrollHeight).toBeLessThanOrEqual(s.innerHeight);

    const panel = page.locator(".ranking-overlay__panel");
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    // A single status line must never reserve anywhere near the shared shell's ~80dvh ceiling --
    // this is the regression this whole task exists to fix (see the Result Report's before/
    // after: 675px/640px before this fix, well under 200px after).
    expect(box!.height).toBeLessThan(s.innerHeight * 0.3);
  });

  test("2 synthetic rows render compact; 10 synthetic rows cap and scroll internally", async ({ page }) => {
    await freshHome(page);
    await page.getByRole("button", { name: /ランキング/ }).click();
    await page.waitForTimeout(300);

    // The dev environment has no Firebase project configured, so getWeeklyLeaderboard() always
    // resolves to `{status:"unavailable"}` -- there is no seam to inject real leaderboard rows
    // without touching ranking data/Firebase code, which this task must not do. Instead this
    // swaps in synthetic rows using the *exact* real classes WeeklyRankingOverlay.tsx renders
    // (`.ranking-overlay__list`/`.ranking-overlay__row`, App.css), so this test still exercises
    // the real CSS layout this task changed -- only the data source is faked, not the styling.
    async function renderRows(count: number) {
      await page.evaluate((n) => {
        const body = document.querySelector(".ranking-overlay__body")!;
        const rows = Array.from(
          { length: n },
          (_, i) => `<li class="ranking-overlay__row"><span class="ranking-overlay__rank">${i + 1}位</span><span class="ranking-overlay__name">Player ${i + 1}</span><span class="ranking-overlay__score">${1000 - i}</span></li>`,
        ).join("");
        body.innerHTML = `<p class="ranking-overlay__week">今週 9/14〜9/20</p><ol class="ranking-overlay__list">${rows}</ol>`;
      }, count);
    }

    await renderRows(2);
    const s2 = await pageScrollState(page);
    expect(s2.docScrollHeight).toBeLessThanOrEqual(s2.innerHeight);
    const panel2 = await page.locator(".ranking-overlay__panel").boundingBox();
    const bodyMetrics2 = await page.evaluate(() => {
      const el = document.querySelector(".ranking-overlay__body")!;
      return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
    });
    // 2 rows must not overflow their own body region -- no internal scroll needed for this few.
    expect(bodyMetrics2.scrollHeight).toBeLessThanOrEqual(bodyMetrics2.clientHeight + 1);

    await renderRows(10);
    const s10 = await pageScrollState(page);
    expect(s10.docScrollHeight, "10-row ranking must still never scroll the page").toBeLessThanOrEqual(s10.innerHeight);
    const panel10 = await page.locator(".ranking-overlay__panel").boundingBox();
    const bodyMetrics10 = await page.evaluate(() => {
      const el = document.querySelector(".ranking-overlay__body")!;
      return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowY: getComputedStyle(el).overflowY };
    });

    // The panel must have grown to accommodate more content (content-sized, not fixed)...
    expect(panel10!.height).toBeGreaterThan(panel2!.height);
    // ...up to the shared shell's max-height cap, where its own body region takes over via
    // internal scroll instead of pushing the panel/page any taller.
    expect(bodyMetrics10.overflowY).toBe("auto");
    if (bodyMetrics10.scrollHeight > bodyMetrics10.clientHeight) {
      // Only scrolls internally if 10 rows actually exceed the cap at this viewport -- either
      // way the page itself (asserted above) never does.
      await page.evaluate(() => document.querySelector(".ranking-overlay__body")!.scrollTo(0, 200));
      const scrolled = await page.evaluate(() => ({
        bodyScrollTop: document.querySelector(".ranking-overlay__body")!.scrollTop,
        docScrollTop: document.documentElement.scrollTop,
      }));
      expect(scrolled.bodyScrollTop).toBeGreaterThan(0);
      expect(scrolled.docScrollTop).toBe(0);
    }
  });

  test("opening the modal never enables background page scroll", async ({ page }) => {
    await freshHome(page);
    const before = await page.evaluate(() => getComputedStyle(document.documentElement).overflowY);
    await page.getByRole("button", { name: /ランキング/ }).click();
    await page.waitForTimeout(200);
    const s = await pageScrollState(page);
    expect(s.docScrollHeight).toBeLessThanOrEqual(s.innerHeight);
    const after = await page.evaluate(() => getComputedStyle(document.documentElement).overflowY);
    expect(after).toBe("hidden");
    expect(before).toBe("hidden");
  });
});

test.describe("Lunch Rush RESULT -> Weekly Ranking stack never scrolls the page", () => {
  test("mission result + ranking overlay stacked", async ({ page }) => {
    await page.goto("/?missionDuration=1");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector(".app-frame");

    await page.getByRole("button", { name: /ランチラッシュ/ }).click();
    await page.getByRole("button", { name: "スタート" }).click();
    await page.waitForSelector(".mission-overlay__panel", { timeout: 8000 });

    const resultState = await pageScrollState(page);
    expect(resultState.docScrollHeight).toBeLessThanOrEqual(resultState.innerHeight);

    await page.getByRole("button", { name: /ランキングを見る/ }).click();
    await page.waitForTimeout(300);
    const stackedState = await pageScrollState(page);
    expect(stackedState.docScrollHeight).toBeLessThanOrEqual(stackedState.innerHeight);

    const panel = await page.locator(".ranking-overlay__panel").boundingBox();
    expect(panel).not.toBeNull();
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(stackedState.innerHeight + 1);
  });
});

test.describe("FREE RESULT: real content overflow scrolls .game-screen, never the page", () => {
  test("margherita CUT round -- CTA reachable via internal scroll only", async ({ page }) => {
    test.setTimeout(60_000);
    await startFreshMargherita(page);
    await playFullMargheritaRound(page);
    await page.waitForTimeout(200);

    const s = await pageScrollState(page);
    expect(s.docScrollHeight, "RESULT must never grow the page, even when content is tall").toBeLessThanOrEqual(
      s.innerHeight,
    );

    const gs = await page.evaluate(() => {
      const el = document.querySelector(".game-screen")!;
      return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowY: getComputedStyle(el).overflowY };
    });
    expect(gs.overflowY).toBe("auto");

    // Whatever the content height, the primary retry CTA must be reachable by scrolling
    // .game-screen to its own bottom -- never permanently clipped by .app-frame's overflow:
    // hidden (the real risk this task's fix had to avoid).
    await page.evaluate(() => {
      const el = document.querySelector(".game-screen")!;
      el.scrollTo(0, el.scrollHeight);
    });
    await page.waitForTimeout(100);
    const cta = await page.locator(".result-panel__actions").boundingBox();
    expect(cta).not.toBeNull();
    const vh = page.viewportSize()!.height;
    expect(cta!.y).toBeGreaterThanOrEqual(0);
    expect(cta!.y + cta!.height).toBeLessThanOrEqual(vh + 1);

    // And the document itself still never scrolled to get there.
    const finalState = await pageScrollState(page);
    expect(finalState.docScrollHeight).toBeLessThanOrEqual(finalState.innerHeight);
  });
});
