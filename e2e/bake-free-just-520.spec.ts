import { expect, test, type Page } from "@playwright/test";
import { BAKE_ZONE_FADE_END_S } from "../src/logic/bakeProgress";
import { completeDoughStep, enterBakePaused, landNeedleAndTakeOut, paintSauceRing, tapDoughPercent } from "./gestures";
import { base, openWith } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Issue #520 (Owner, supersedes #481 item 2): Free Cooking draws the JUST band and shows the 5-level 焼き加減 badge, on the generic
 * window its gauge shows (58-78 -> JUST 65-71). Runs on both authority viewports (390x844 / 360x800 projects).
 * HV_SHOT_DIR (optional) writes the before/after screenshots.
 */
const SHOT_DIR = process.env.HV_SHOT_DIR;

async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-${name}.png` });
}

/** Starter trio, targetless Free Cooking, up to (not including) 焼く. No basil: the ORIGINAL pizza (a NEW PIZZA result shows no 焼き加減 badge). */
async function reachFreeBake(page: Page) {
  const { width, height } = page.viewportSize()!;
  await openWith(page, width, height, base(["tomato-sauce", "mozzarella", "basil"]));
  await startTargetlessFreeCook(page);
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
}

/**
 * Enters BAKE with the virtual clock already paused, so the one-way needle starts at exactly 0 (same pattern as `enterBakeAtZero` in
 * bake-one-way.spec.ts). `enterBakePaused` pauses AFTER the 焼く click, so on a loaded runner its `pauseAt` retries ([150, 500, 1500] ms)
 * all run while the needle is moving and can carry it past a low target (the 惜しい（焼き不足）band 59-64). Here the retries run while
 * BAKE is not mounted, and if none lands the helper throws instead of clicking with the clock running. The click is a DOM click:
 * Playwright's own actionability wait would need a running rAF.
 */
async function enterBakeAtZero(page: Page) {
  await page.clock.install();
  let paused = false;
  for (const buffer of [300, 800, 2000]) {
    try {
      await page.clock.pauseAt(Date.now() + buffer);
      paused = true;
      break;
    } catch (error) {
      if (!String(error).includes("to the past")) throw error;
    }
  }
  if (!paused) throw new Error("enterBakeAtZero: could not pause the clock before BAKE (every pauseAt landed in the past)");
  await page.getByRole("button", { name: /焼く/ }).evaluate((el) => (el as HTMLButtonElement).click());
  await page.waitForSelector(".bake-gauge__needle");
}

test("FREE Cooking BAKE draws the JUST band on the generic window, inside the gauge, clear of the CTA, gone with the zone (#520)", async ({ page }) => {
  await reachFreeBake(page);
  await enterBakePaused(page);
  const info = await page.evaluate(() => {
    const band = document.querySelector<HTMLElement>(".bake-gauge__just");
    const gauge = document.querySelector<HTMLElement>(".bake-gauge")!;
    const button = document.querySelector<HTMLElement>(".cta-button--bake")!;
    if (!band) return null;
    const b = band.getBoundingClientRect();
    const g = gauge.getBoundingClientRect();
    const c = button.getBoundingClientRect();
    return {
      left: parseFloat(band.style.left),
      width: parseFloat(band.style.width),
      inZones: band.parentElement?.classList.contains("bake-gauge__zones") ?? false,
      insideGauge: b.left >= g.left - 0.5 && b.right <= g.right + 0.5,
      ctaBelow: c.top >= g.bottom,
      ctaInViewport: c.bottom <= window.innerHeight,
      docScrolls: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(info).not.toBeNull();
  expect(info!.left).toBe(65); // generic window 58-78, centre 68
  expect(info!.width).toBe(6);
  expect(info!.inZones).toBe(true);
  expect(info!.insideGauge).toBe(true);
  expect(info!.ctaBelow).toBe(true);
  expect(info!.ctaInViewport).toBe(true);
  expect(info!.docScrolls).toBe(false);
  await shot(page, "free-bake-just-band");

  await page.clock.runFor((BAKE_ZONE_FADE_END_S + 0.3) * 1000);
  expect(await page.locator(".bake-gauge__just").count()).toBe(0);
  await page.clock.resume();
});

test("FREE Cooking RESULT shows ジャスト / 惜しい on the generic window, and a near-miss never says 完璧 (#520)", async ({ page }) => {
  // Two full rounds (reachFreeBake x 2): ~28.7 s when healthy against the 30 s default (31.1 s timed out, #629), so this test alone gets 60 s.
  test.setTimeout(60_000);
  await reachFreeBake(page);
  await enterBakeAtZero(page);
  await landNeedleAndTakeOut(page, { start: 66, end: 70 }); // 66-70: inside JUST 65-71
  await page.waitForSelector(".result-panel");
  await expect(page.locator(".result-panel__bake-badge").first()).toContainText("焼き加減: ジャスト");
  await shot(page, "free-result-just");

  await reachFreeBake(page);
  await enterBakeAtZero(page);
  // The needle moves one way only and starts at 0 (enterBakeAtZero), so the 惜しい（焼き不足）band 59-64 lies ahead of it:
  // landNeedleAndTakeOut measures where the needle really is and advances from there.
  await landNeedleAndTakeOut(page, { start: 59, end: 64 });
  await page.waitForSelector(".result-panel");
  await expect(page.locator(".result-panel__bake-badge").first()).toContainText("焼き加減: 惜しい（焼き不足）");
  expect(await page.locator("body").innerText()).not.toContain("完璧");
  await shot(page, "free-result-near-miss");
});
