import { expect, test, type Page } from "@playwright/test";
import {
  completeDoughStep,
  cutThreeLines,
  enterBakePaused,
  landNeedleAndTakeOut,
  paintSauceRing,
  startFreshMargherita,
  tapDoughPercent,
} from "./gestures";
import { chipOnTray, chipOnTrayOrPin, pressPager, trayToFirstPage } from "./support/handPick";

/**
 * #394 Phase 1: regression coverage for the two `e2e/gestures.ts` helper families that the WebKit
 * cooking-E2E flake pointed at. Each failure mechanism is reproduced *deterministically* by
 * stretching one real-time gap the helpers used to guess at (they never wait on a state signal):
 *
 *  A. `bakeToTarget` / `landNeedleAndTakeOut` planned the landing from `.bake-gauge__needle`'s
 *     `style.left` after a fixed `waitForTimeout(50)`. That style is written by a React render
 *     (scheduled on the Scheduler's MessageChannel), so on a slow runner it is stale while
 *     `BakeOverlay`'s `positionRef` (what 取り出す！ scores) has already moved on. Here every
 *     `MessagePort.postMessage` is deferred by a real `setTimeout` (captured before `page.clock`
 *     can fake it), so the render commit lands ~SCHEDULER_DELAY_MS late no matter how fast the
 *     machine is -- far longer than the old 50ms guess.
 *  B. `doughBox` read `boundingBox()` once (no auto-wait; null -> "Pizza dough missing") and the
 *     tap helpers then fired `page.mouse` at once, while `PizzaStage`'s pointerdown silently drops
 *     presses when the dough is not `interactive`. Here the dough is made un-laid-out, covered,
 *     or non-interactive for UNREADY_MS of real time right before the gesture starts. The
 *     readiness wait must also not demand more than a press needs: a dough whose box never holds
 *     still (sub-pixel jitter) is still perfectly pressable, so Playwright's "stable" wait (a
 *     `hover()`-based readiness timed out on WebKit CI that way, #395) must not come back.
 *
 * Test-only: no production code, hook or data-attribute is involved.
 */

const SCHEDULER_DELAY_MS = 250;
const UNREADY_MS = 1500; // longer than the whole 16-press ring, so a helper that does not wait loses every press

/** Defers every MessagePort.postMessage (React's Scheduler) by `window.__schedulerDelayMs` real ms.
 *  Default 0 = pass-through, so only the code under test is slowed. Uses the real setTimeout
 *  captured at init, which `page.clock.install()` later replaces. */
async function installSchedulerDelay(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __schedulerDelayMs: number };
    w.__schedulerDelayMs = 0;
    const realSetTimeout = window.setTimeout.bind(window);
    const original = MessagePort.prototype.postMessage;
    MessagePort.prototype.postMessage = function (this: MessagePort, ...args: unknown[]) {
      const delay = w.__schedulerDelayMs;
      if (!delay) return (original as (...a: unknown[]) => void).apply(this, args);
      realSetTimeout(() => (original as (...a: unknown[]) => void).apply(this, args), delay);
    } as typeof MessagePort.prototype.postMessage;
  });
}

async function setSchedulerDelay(page: Page, ms: number) {
  await page.evaluate((delay) => {
    (window as unknown as { __schedulerDelayMs: number }).__schedulerDelayMs = delay;
  }, ms);
}

async function reachSauceStep(page: Page) {
  await startFreshMargherita(page);
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
}

async function reachBakeStep(page: Page) {
  await reachSauceStep(page);
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  await tapDoughPercent(page, 45, 55);
  await tapDoughPercent(page, 55, 45);
}

test.describe("e2e/gestures helpers (#394 Phase 1)", () => {
  test.setTimeout(120_000);

  // A: margherita's bakeTarget is 60-80. `advanceMs` parks the one-way needle (33.3 pt/s for the 3s bake, #419):
  // 400ms ~ 13, 800ms ~ 27, 1200ms ~ 40 -- all still short of the window. In every case the
  // committed style lags the real position by the delayed commit.
  for (const advanceMs of [400, 800, 1200]) {
    test(`bake landing is correct when the React commit is ${SCHEDULER_DELAY_MS}ms late (needle parked after ${advanceMs}ms)`, async ({ page }) => {
      await installSchedulerDelay(page);
      await reachBakeStep(page);
      await enterBakePaused(page);
      await page.clock.runFor(advanceMs);
      await setSchedulerDelay(page, SCHEDULER_DELAY_MS);
      await landNeedleAndTakeOut(page, { start: 60, end: 80 });
      await setSchedulerDelay(page, 0);

      if (await page.getByRole("button", { name: /切り終わる/ }).count()) {
        await cutThreeLines(page);
        await page.getByRole("button", { name: /切り終わる/ }).click();
      }
      await expect(page.locator(".result-panel").first()).toContainText(/焼き加減: (ジャスト|惜しい（焼き(不足|すぎ)）)/);
    });
  }

  // B: a sauce press that registers renders `.pizza-sauce-heatmap` inside the dough; presses
  // that arrive while the dough is not ready are dropped, leaving it absent.
  test("paintSauceRing waits for a dough that is momentarily not laid out", async ({ page }) => {
    await reachSauceStep(page);
    const heatmap = page.locator(".pizza-dough .pizza-sauce-heatmap");
    await expect(heatmap).toHaveCount(0);
    await page.addStyleTag({ content: "html[data-hide-dough] [data-pizza-drop-target] { display: none !important; }" });
    await page.evaluate((ms) => {
      document.documentElement.setAttribute("data-hide-dough", "");
      setTimeout(() => document.documentElement.removeAttribute("data-hide-dough"), ms);
    }, UNREADY_MS);
    await paintSauceRing(page, 25, 16);
    await expect(heatmap.first()).toBeVisible(); // a registered sauce deposit renders the heatmap
  });

  test("paintSauceRing waits for a dough that is momentarily covered by another element", async ({ page }) => {
    await reachSauceStep(page);
    const heatmap = page.locator(".pizza-dough .pizza-sauce-heatmap");
    await expect(heatmap).toHaveCount(0);
    await page.evaluate((ms) => {
      const cover = document.createElement("div");
      cover.id = "gesture-test-cover";
      cover.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:transparent";
      document.body.appendChild(cover);
      setTimeout(() => cover.remove(), ms);
    }, UNREADY_MS);
    await paintSauceRing(page, 25, 16);
    await expect(heatmap.first()).toBeVisible(); // a registered sauce deposit renders the heatmap
  });

  test("paintSauceRing waits for the dough to become interactive (presses on a non-interactive dough are silently dropped)", async ({ page }) => {
    await reachSauceStep(page);
    const heatmap = page.locator(".pizza-dough .pizza-sauce-heatmap");
    await expect(heatmap).toHaveCount(0);
    // The 見本 popover is a real UI state that makes PizzaStage non-interactive; its backdrop is
    // made click-through so the presses reach the dough itself and only `interactive` gates them.
    await page.getByRole("button", { name: /見本/ }).first().click();
    await expect(page.locator(".pizza-dough--interactive")).toHaveCount(0);
    await page.addStyleTag({ content: ".reference-preview__backdrop { pointer-events: none !important; }" });
    await page.evaluate((ms) => {
      setTimeout(() => (document.querySelector(".reference-preview__close") as HTMLElement | null)?.click(), ms);
    }, UNREADY_MS);
    await paintSauceRing(page, 25, 16);
    await expect(heatmap.first()).toBeVisible(); // a registered sauce deposit renders the heatmap
  });

  test("paintSauceRing does not wait for a dough box that never holds still (sub-pixel jitter is still pressable)", async ({ page }) => {
    test.setTimeout(30_000); // a readiness that demands a stable box would otherwise sit here for the whole 120s
    await reachSauceStep(page);
    const heatmap = page.locator(".pizza-dough .pizza-sauce-heatmap");
    await expect(heatmap).toHaveCount(0);
    // 7ms is not a multiple of the 16ms frame, so no two consecutive frames share a box.
    await page.addStyleTag({
      content:
        "@keyframes gesture-test-jitter { from { transform: translate(0, 0); } to { transform: translate(0.5px, 0.5px); } }" +
        "[data-pizza-drop-target] { animation: gesture-test-jitter 7ms linear infinite alternate !important; }",
    });
    await paintSauceRing(page, 25, 16);
    await expect(heatmap.first()).toBeVisible(); // a registered sauce deposit renders the heatmap
  });
});

/**
 * #394 Phase 1b: `chipOnTrayOrPin` (e2e/support/handPick.ts, used by 29 specs) paged the tray with `while (await button.isEnabled()) await button.click()`, a
 * check and an act with two round trips between them. If the tray re-renders in that gap (here: it jumps to the first / last page 300 ms after the helper
 * starts, while the pager button is still sliding into place for 1.2 s, so Playwright's own click is still in its "stable" wait), the button is disabled
 * by the time the click can start, and the old click waited for "enabled" until the test timeout (2026-11-03: 300 s in two WebKit shards). The race is
 * made deterministic by the page's own timers (no dependence on the machine's speed for the FIXED helper: it decides and presses in one browser task).
 * A synthetic 3-page tray with the real pager markup (`.ingredient-page-nav__label`, 前のページ / 次のページ, `.ingredient-chip`) keeps the test independent of the game.
 */
test.describe("chipOnTrayOrPin: the tray re-renders between the check and the press (#394 Phase 1b)", () => {
  test.setTimeout(15_000); // the old helper hangs here; a failure must show up as a failure, not as a 5-minute wait

  const TRAY = `
    <style>
      @keyframes slide { from { transform: translateX(80px); } to { transform: translateX(0); } }
      .pager { display: flex; gap: 8px; align-items: center; padding: 12px; }
      .sliding { animation: slide 1200ms ease-out; }
    </style>
    <div class="ingredient-page-nav__pager pager">
      <button id="prev" class="ingredient-page-nav__button" aria-label="前のページ">◀</button>
      <span class="ingredient-page-nav__label"></span>
      <button id="next" class="ingredient-page-nav__button" aria-label="次のページ">▶</button>
    </div>
    <div id="tray"></div>
    <script>
      const PAGES = [["A1", "A2"], ["B1", "B2"], ["C1", "C2"]];
      let page = START;
      const prev = document.getElementById("prev");
      const next = document.getElementById("next");
      function render() {
        document.getElementById("tray").innerHTML = PAGES[page].map((n) => '<button class="ingredient-chip">' + n + "</button>").join("");
        document.querySelector(".ingredient-page-nav__label").textContent = page + 1 + " / " + PAGES.length;
        prev.disabled = page === 0;
        next.disabled = page === PAGES.length - 1;
      }
      prev.addEventListener("click", () => { page -= 1; render(); });
      next.addEventListener("click", () => { page += 1; render(); });
      // the race: a re-render that moves the tray to the page where the pager button we are about to press is DISABLED
      window.armRace = (button, jumpTo) => {
        button.classList.add("sliding");
        setTimeout(() => { page = jumpTo; render(); }, 300);
      };
      render();
    </script>`;

  const open = async (page: import("@playwright/test").Page, start: number) => {
    await page.goto("about:blank");
    await page.setContent(TRAY.replace("START", String(start)));
  };

  test("going back to page 1: the tray jumps to page 1 while the 前のページ press is pending", async ({ page }) => {
    await open(page, 2);
    await page.evaluate(() => (window as unknown as { armRace: (b: Element, to: number) => void }).armRace(document.getElementById("prev")!, 0));
    const chip = await chipOnTrayOrPin(page, "A1"); // page 1; the old helper parked on a disabled 前のページ
    await expect(chip).toBeVisible();
    await expect(page.locator(".ingredient-page-nav__label")).toHaveText("1 / 3");
  });

  test("paging forward: the tray jumps to the last page while the 次のページ press is pending", async ({ page }) => {
    await open(page, 0);
    await page.evaluate(() => (window as unknown as { armRace: (b: Element, to: number) => void }).armRace(document.getElementById("next")!, 2));
    const chip = await chipOnTrayOrPin(page, "C2"); // the last page; the old helper parked on a disabled 次のページ
    await expect(chip).toBeVisible();
    await expect(page.locator(".ingredient-page-nav__label")).toHaveText("3 / 3");
  });

  test("a chip on a middle page is still found by pressing, and a chip that is not on any page still fails (the helper does not weaken the check)", async ({ page }) => {
    await open(page, 2);
    await expect(await chipOnTrayOrPin(page, "B2")).toBeVisible();
    await expect(page.locator(".ingredient-page-nav__label")).toHaveText("2 / 3");
    await expect(chipOnTrayOrPin(page, "Z9")).rejects.toThrow(/toBeVisible|not found|element\(s\) not found/i);
  });

  // #828: the specs kept their own copies of the old loop; they now use these shared helpers, so the same race has to be closed for them too.
  test("chipOnTray (a Locator, e.g. an exact-name chip): the tray jumps to the last page while the 次のページ press is pending", async ({ page }) => {
    await open(page, 0);
    await page.evaluate(() => (window as unknown as { armRace: (b: Element, to: number) => void }).armRace(document.getElementById("next")!, 2));
    const exact = page.locator(".ingredient-chip").filter({ hasText: /^C1$/ }).first();
    await expect(await chipOnTray(page, exact)).toBeVisible();
    await expect(page.locator(".ingredient-page-nav__label")).toHaveText("3 / 3");
  });

  test("trayToFirstPage: the tray jumps to page 1 while the 前のページ press is pending; a tray already on page 1 is left alone", async ({ page }) => {
    await open(page, 2);
    await page.evaluate(() => (window as unknown as { armRace: (b: Element, to: number) => void }).armRace(document.getElementById("prev")!, 0));
    await trayToFirstPage(page);
    await expect(page.locator(".ingredient-page-nav__label")).toHaveText("1 / 3");
    await trayToFirstPage(page); // 前のページ is disabled now: nothing to press, and nothing to wait for
    await expect(page.locator(".ingredient-page-nav__label")).toHaveText("1 / 3");
  });

  test("pressPager does not press (and does not wait) when the button is disabled or missing, and presses an enabled one", async ({ page }) => {
    await open(page, 0);
    expect(await pressPager(page, page.getByRole("button", { name: "前のページ" }))).toBe(false); // disabled on page 1
    expect(await pressPager(page, page.getByRole("button", { name: "存在しないボタン" }))).toBe(false); // no such button (a tray without a pager)
    await expect(page.locator(".ingredient-page-nav__label")).toHaveText("1 / 3");
    expect(await pressPager(page, page.getByRole("button", { name: "次のページ" }))).toBe(true);
    await expect(page.locator(".ingredient-page-nav__label")).toHaveText("2 / 3");
  });
});
