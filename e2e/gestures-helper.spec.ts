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
 *     or non-interactive for UNREADY_MS of real time right before the gesture starts.
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

  // A: margherita's bakeTarget is 60-80. `advanceMs` parks the needle (55 pt/s, bouncing at 100):
  // 1200ms ~ 66 going up, 2500ms ~ 62 coming down, 3300ms ~ 18 coming down. In every case the
  // committed style lags the real position by the delayed commit.
  for (const advanceMs of [1200, 2500, 3300]) {
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
      await expect(page.locator(".result-panel").first()).toContainText("焼き加減: いい焼き加減");
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
});
