import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep, startFreshMargherita } from "./gestures";

/**
 * Issue #489 Phase 2: the remaining-sauce gauge on the SAUCE step. Measures that it sits to the right
 * of the pizza, inside the viewport, never overlaps the dough's hit area, and that the pizza box is the
 * same with and without it (the gauge is out of flow). Viewport comes from the project (390x844 / 360x800).
 */
const GAUGE = ".sauce-remaining-gauge";
const SHOT_DIR = process.env.GAUGE_SHOT_DIR;

async function startSauceStep(page: Page) {
  await startFreshMargherita(page);
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await expect(page.locator(".pizza-dough--interactive")).toBeVisible();
}

test("gauge is right of the pizza, in view, and drains while holding", async ({ page }, info) => {
  await startSauceStep(page);
  const gauge = page.locator(GAUGE);
  await expect(gauge).toBeVisible();
  await expect(gauge).toHaveAttribute("aria-valuenow", "100");

  const dough = (await page.locator(".pizza-dough--interactive").boundingBox())!;
  const g = (await gauge.boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(g.x).toBeGreaterThanOrEqual(dough.x + dough.width - 1); // right of the pizza
  expect(g.x + g.width).toBeLessThanOrEqual(vw); // inside the viewport
  expect(g.width).toBeLessThanOrEqual(14);
  expect(g.height).toBeLessThanOrEqual(96);
  // it must not intercept touches: a point on the gauge hits something that is not the gauge
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest(".sauce-remaining-gauge") !== null,
    [g.x + g.width / 2, g.y + g.height / 2],
  );
  expect(hit).toBe(false);
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${info.project.name}-full.png` });

  // hold in the centre ~1.2s: gauge drains but not to zero yet
  await page.mouse.move(dough.x + dough.width / 2, dough.y + dough.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  const mid = Number(await gauge.getAttribute("aria-valuenow"));
  expect(mid).toBeLessThan(100);
  await page.mouse.up();
  await page.waitForTimeout(100);
  const after = Number(await gauge.getAttribute("aria-valuenow"));
  expect(Math.abs(after - mid)).toBeLessThanOrEqual(8); // commit keeps the value (no flicker back to full)
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${info.project.name}-drained.png` });

  // pizza box unchanged by the gauge's presence
  const dough2 = (await page.locator(".pizza-dough--interactive").boundingBox())!;
  expect(dough2.width).toBeCloseTo(dough.width, 0);
  expect(dough2.x).toBeCloseTo(dough.x, 0);
});

test("gauge disappears after leaving the SAUCE step", async ({ page }) => {
  await startSauceStep(page);
  await expect(page.locator(GAUGE)).toBeVisible();
  await page.getByRole("button", { name: /次へ/ }).click();
  await expect(page.locator(GAUGE)).toHaveCount(0);
});
