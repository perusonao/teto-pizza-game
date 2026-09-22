import { test, expect } from "@playwright/test";
import {
  playFullMargheritaRound,
  startFreshMargherita,
  startQuattroFormaggiHeavyInventory,
} from "./gestures";

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

    // Regression: closing the ranking overlay returns to a still-intact RESULT panel underneath
    // (Gameplay UX Phase 2, Issue #157 scenario A).
    await page.getByRole("button", { name: "閉じる" }).click();
    await page.waitForTimeout(200);
    await expect(page.locator(".mission-overlay__panel")).toBeVisible();
    await expect(page.getByRole("button", { name: /ホームへ/ })).toBeVisible();
  });
});

/**
 * Gameplay UX Phase 2 (Issue #157): 🏠 ホームへ CTA on Lunch Rush RESULT
 * (docs/reports/TETO_GAMEPLAY-UX_Phase2_Lunch-Rush-Home_Result.md). Covers the four RESULT
 * navigation CTAs fitting without page scroll at both viewports, HOME navigation itself (no
 * stale mission/result overlay left behind), and regression for the three pre-existing CTAs
 * (ランキング covered above; もう一度/フリープレイへ here).
 */
async function reachLunchRushResult(page: import("@playwright/test").Page) {
  await page.goto("/?missionDuration=1");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".app-frame");

  await page.getByRole("button", { name: /ランチラッシュ/ }).click();
  await page.getByRole("button", { name: "スタート" }).click();
  await page.waitForSelector(".mission-overlay__panel", { timeout: 8000 });
}

test.describe("Lunch Rush RESULT: four navigation CTAs (Gameplay UX Phase 2)", () => {
  test("ランキング / もう一度 / フリープレイへ / 🏠ホームへ all visible with no overflow", async ({
    page,
  }) => {
    await reachLunchRushResult(page);

    const s = await pageScrollState(page);
    expect(s.docScrollHeight, "RESULT with 4 CTAs must not grow the page").toBeLessThanOrEqual(
      s.innerHeight,
    );
    expect(s.docScrollWidth, "RESULT with 4 CTAs must never overflow horizontally").toBeLessThanOrEqual(
      s.innerWidth,
    );

    await expect(page.getByRole("button", { name: /ランキングを見る/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "もう一度" })).toBeVisible();
    await expect(page.getByRole("button", { name: "フリープレイへ" })).toBeVisible();
    const homeButton = page.getByRole("button", { name: /ホームへ/ });
    await expect(homeButton).toBeVisible();

    // Touch target floor: buttons must not be shrunk so small they become hard to tap (both
    // paired nav buttons share `.secondary-button`'s 44px min-height).
    const homeBox = await homeButton.boundingBox();
    expect(homeBox).not.toBeNull();
    expect(homeBox!.height).toBeGreaterThanOrEqual(44);

    const freePlayBox = await page.getByRole("button", { name: "フリープレイへ" }).boundingBox();
    expect(freePlayBox).not.toBeNull();
    expect(freePlayBox!.height).toBeGreaterThanOrEqual(44);

    // The paired row must stay within the viewport (never clipped off the bottom).
    expect(homeBox!.y + homeBox!.height).toBeLessThanOrEqual(s.innerHeight + 1);
  });

  test("🏠 ホームへ navigates to HOME with no stale mission/result overlay", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await reachLunchRushResult(page);
    await page.getByRole("button", { name: /ホームへ/ }).click();
    await page.waitForTimeout(300);

    // HOME is showing, RESULT/mission overlays are fully gone -- not merely hidden underneath.
    await expect(page.locator(".home-screen")).toBeVisible();
    expect(await page.locator(".mission-overlay").count()).toBe(0);
    expect(await page.locator(".mission-serve-panel").count()).toBe(0);

    const s = await pageScrollState(page);
    expect(s.docScrollHeight, "HOME after ホームへ must not scroll the page").toBeLessThanOrEqual(
      s.innerHeight,
    );

    // HOME's own primary CTA must be genuinely operable post-navigation -- hover it (Human Feel
    // Gate: a numerically-present but inert button would not be a real fix) and confirm it still
    // opens Pizza Select on click.
    const primaryCta = page.getByRole("button", { name: /ピザを作る/ });
    await expect(primaryCta).toBeVisible();
    await primaryCta.hover();
    await primaryCta.click();
    await expect(page.locator(".pizza-select-body")).toBeVisible();

    expect(consoleErrors, `console errors after ホームへ navigation: ${consoleErrors.join("; ")}`).toEqual(
      [],
    );
  });

  test("もう一度 restarts Lunch Rush (regression)", async ({ page }) => {
    await reachLunchRushResult(page);
    await page.getByRole("button", { name: "もう一度" }).click();
    await page.waitForTimeout(300);

    // A fresh Mission run is PLAYING again (mission-run START, src/mission/lunchRush.ts) --
    // the old RESULT overlay is gone and the live-run timer HUD (MissionHud, rendered only
    // while isMissionPlaying) is back.
    expect(await page.locator(".mission-overlay__panel").count()).toBe(0);
    await expect(page.locator(".mission-hud")).toBeVisible();
  });

  test("フリープレイへ enters FREE flow (regression)", async ({ page }) => {
    await reachLunchRushResult(page);
    await page.getByRole("button", { name: "フリープレイへ" }).click();
    await page.waitForTimeout(300);

    expect(await page.locator(".mission-overlay__panel").count()).toBe(0);
    expect(await page.locator(".mission-serve-panel").count()).toBe(0);
    // Still on GAME (not bounced to HOME) -- FREE's own PREPARE round.
    await expect(page.locator(".game-screen")).toBeVisible();
    await expect(page.locator(".home-screen")).toHaveCount(0);
  });
});

async function gameScreenScrollState(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const el = document.querySelector(".game-screen")!;
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  });
}

async function boundingBoxOf(page: import("@playwright/test").Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  expect(box, `${selector} must be present and visible`).not.toBeNull();
  return box!;
}

/**
 * Gameplay UX Phase 1 (材料選択スクロール解消): the real-machine iPhone report this task exists
 * for was "スクロールが必要で材料が見づらい" -- PR #152 only turned page/body scroll into
 * `.game-screen`'s own internal scroll (see the suite above), it never removed the need to
 * scroll to reach a material during PREPARE. This directly asserts that need is gone: on every
 * PREPARE step that shows the Ingredient Palette (SAUCE/CHEESE/TOPPING -- DOUGH has none, see
 * GameScreen.tsx), `.game-screen`'s own scrollHeight must not exceed its clientHeight (Playwright
 * projects run this at both 390x844 and 360x800, playwright.config.ts). Reverting this task's
 * CSS (PizzaStage's PREPARE roomy size, `.ingredient-tray`'s row sizing, and the small chrome
 * trims -- see docs/reports/TETO_GAMEPLAY-UX_Phase1_Ingredient-Selection_Result.md) reproduces a
 * failure here, which is what confirms this suite actually covers the reported bug rather than
 * just the fixed code path.
 */
test.describe("PREPARE: ingredient selection never needs vertical scroll (Gameplay UX Phase 1)", () => {
  test("margherita baseline -- one ingredient per category still fits with no overflow", async ({
    page,
  }) => {
    await startFreshMargherita(page);
    await page.waitForSelector(".pizza-stage");

    for (const step of ["DOUGH", "SAUCE", "CHEESE", "TOPPING"] as const) {
      const s = await pageScrollState(page);
      expect(s.docScrollWidth, `${step}: page must never overflow horizontally`).toBeLessThanOrEqual(
        s.innerWidth,
      );
      const gs = await gameScreenScrollState(page);
      expect(
        gs.scrollHeight,
        `${step}: .game-screen must not need internal scroll to reach the ingredient tray`,
      ).toBeLessThanOrEqual(gs.clientHeight);

      const bar = await boundingBoxOf(page, ".prepare-bake-bar");
      const vh = page.viewportSize()!.height;
      expect(bar.y + bar.height, `${step}: bottom action bar must stay on-screen`).toBeLessThanOrEqual(
        vh + 1,
      );

      if (step !== "TOPPING") {
        if (step === "DOUGH") {
          const box = await page.locator('[data-pizza-drop-target="true"]').boundingBox();
          const cx = box!.x + box!.width / 2;
          const cy = box!.y + box!.height / 2;
          const r = box!.width * 0.46;
          for (let i = 0; i < 8; i += 1) {
            const angle = (i / 8) * Math.PI * 2;
            await page.mouse.move(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
            await page.mouse.down();
            await page.mouse.up();
          }
        }
        await page.getByRole("button", { name: /次へ/ }).click();
      }
    }
  });

  test("quattro-formaggi heavy inventory -- multi-owned SAUCE/CHEESE all fit with no overflow", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await startQuattroFormaggiHeavyInventory(page);

    // DOUGH must be completed before SAUCE/CHEESE are reachable (one-way flow, Issue #32
    // Phase 2) -- not itself part of this fixture's reproduction (DOUGH never shows a
    // multi-item tray), so it's driven through without being asserted on here.
    const box = await page.locator('[data-pizza-drop-target="true"]').boundingBox();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const r = box!.width * 0.46;
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      await page.mouse.move(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      await page.mouse.down();
      await page.mouse.up();
    }
    await page.getByRole("button", { name: /次へ/ }).click();

    // Gameplay UX / Scoring 3.0 PR-A (Dynamic Cooking Steps, see
    // docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md Audit F): quattro-formaggi has no
    // required topping-category ingredient, so its own derived CookingProfile
    // (../src/data/cookingProfiles.ts's `getCookingProfile`) never includes a TOPPING step at
    // all any more -- there is no longer an "empty TOPPING tray" to special-case (Issue #159 P0's
    // old "quattro-formaggi requires none in TOPPING, so that step's own tray is legitimately
    // empty" comment described the *pre-PR-A* behavior; the step itself doesn't exist now). This
    // loop only walks SAUCE/CHEESE; CHEESE is this recipe's own last PREPARE step, and its own
    // CTA already reads 焼く！ there (GameScreen.tsx's `isLastPrepareStep`), not a 次へ that would
    // go nowhere.
    for (const step of ["SAUCE", "CHEESE"] as const) {
      const s = await pageScrollState(page);
      expect(s.docScrollWidth, `${step}: page must never overflow horizontally`).toBeLessThanOrEqual(
        s.innerWidth,
      );
      const gs = await gameScreenScrollState(page);
      expect(
        gs.scrollHeight,
        `${step}: .game-screen must not need internal scroll to reach every owned ingredient ` +
          `(this is the exact 複数材料 fixture the Fresh Audit reproduced overflow with)`,
      ).toBeLessThanOrEqual(gs.clientHeight);

      const bar = await boundingBoxOf(page, ".prepare-bake-bar");
      const vh = page.viewportSize()!.height;
      expect(bar.y + bar.height, `${step}: bottom action bar must stay on-screen`).toBeLessThanOrEqual(
        vh + 1,
      );

      // The tray must still be genuinely operable, not merely short -- selecting a chip must
      // still work post-layout-change (Human Feel Gate: a numerically-passing but inert tray
      // would not be a real fix). Both SAUCE and CHEESE are genuinely required for
      // quattro-formaggi, so the tray must never be empty at either step now.
      const chipCount = await page.locator(".ingredient-chip").count();
      expect(chipCount, `${step}: quattro-formaggi requires ingredients at every remaining step`).toBeGreaterThan(
        0,
      );
      const anyChip = page.locator(".ingredient-chip").first();
      await anyChip.click();
      await expect(anyChip).toHaveClass(/ingredient-chip--selected/);

      if (step !== "CHEESE") {
        await page.getByRole("button", { name: /次へ/ }).click();
      } else {
        // Regression coverage for this task's own navigation fix: CHEESE being quattro-formaggi's
        // own last PREPARE step means the CTA must already read 焼く！, never get stuck on 次へ.
        await expect(page.getByRole("button", { name: /焼く！/ })).toBeVisible();
        await expect(page.getByRole("button", { name: "次へ" })).toHaveCount(0);
      }
    }
  });
});

test.describe("FREE RESULT: real content overflow scrolls .game-screen, never the page", () => {
  // Gameplay UX PR-D (RESULT 1-Screen 2.0, Fresh Audit §6): the CTA row is no longer a plain
  // `.action-row` that merely happens to be reachable by scrolling -- it is `position: fixed`
  // (the same `.prepare-bake-bar` contract every MAKING-phase CTA already uses), so it must be
  // visible and tappable in the *first* viewport, with zero scrolling, regardless of how tall
  // the collapsed-by-default detail content above it is.
  test("margherita CUT round -- CTA visible in the first viewport, no scroll required", async ({ page }) => {
    test.setTimeout(60_000);
    await startFreshMargherita(page);
    await playFullMargheritaRound(page);
    await page.waitForTimeout(200);

    const s = await pageScrollState(page);
    expect(s.docScrollHeight, "RESULT must never grow the page, even when content is tall").toBeLessThanOrEqual(
      s.innerHeight,
    );

    const vh = page.viewportSize()!.height;
    const cta = await page.locator(".result-panel__actions").boundingBox();
    expect(cta).not.toBeNull();
    expect(cta!.y).toBeGreaterThanOrEqual(0);
    expect(cta!.y + cta!.height).toBeLessThanOrEqual(vh + 1);

    // Default-closed details (CUT/score breakdown/Pitz breakdown) fit the first viewport with
    // zero overflow -- confirmed by real measurement (Result Report), not assumed from CSS.
    const gs = await page.evaluate(() => {
      const el = document.querySelector(".game-screen")!;
      return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
    });
    expect(gs.scrollHeight).toBeLessThanOrEqual(gs.clientHeight);
  });

  test("margherita CUT round, every <details> expanded -- CTA stays fixed/reachable, expanded content scrolls above it", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startFreshMargherita(page);
    await playFullMargheritaRound(page);
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      document.querySelectorAll("details").forEach((d) => ((d as HTMLDetailsElement).open = true));
    });
    await page.waitForTimeout(100);

    const gs = await page.evaluate(() => {
      const el = document.querySelector(".game-screen")!;
      return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowY: getComputedStyle(el).overflowY };
    });
    expect(gs.overflowY).toBe("auto");
    // With every detail block open, content now legitimately exceeds the viewport -- this is
    // expected (information is not deleted, just re-homed into <details>), the CTA below must
    // stay reachable regardless.
    expect(gs.scrollHeight).toBeGreaterThan(gs.clientHeight);

    const vh = page.viewportSize()!.height;
    const ctaBeforeScroll = await page.locator(".result-panel__actions").boundingBox();
    expect(ctaBeforeScroll).not.toBeNull();
    expect(ctaBeforeScroll!.y + ctaBeforeScroll!.height).toBeLessThanOrEqual(vh + 1);

    // Scroll .game-screen to its own end: the fixed CTA must not move, and no real content
    // (the last <details> block) may render underneath/behind it.
    await page.evaluate(() => {
      const el = document.querySelector(".game-screen")!;
      el.scrollTo(0, el.scrollHeight);
    });
    await page.waitForTimeout(100);

    const ctaAfterScroll = await page.locator(".result-panel__actions").boundingBox();
    expect(ctaAfterScroll).not.toBeNull();
    expect(Math.round(ctaAfterScroll!.y)).toBe(Math.round(ctaBeforeScroll!.y));

    const lastDetailsBottom = await page.evaluate(() => {
      const details = document.querySelectorAll(".result-panel details");
      const last = details[details.length - 1];
      return last.getBoundingClientRect().bottom;
    });
    expect(lastDetailsBottom).toBeLessThanOrEqual(ctaAfterScroll!.y + 1);

    // The document itself still never scrolled to get here.
    const finalState = await pageScrollState(page);
    expect(finalState.docScrollHeight).toBeLessThanOrEqual(finalState.innerHeight);
  });
});
