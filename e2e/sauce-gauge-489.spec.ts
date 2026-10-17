import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep, startFreshMargherita } from "./gestures";
import { base, openWith } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

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

test("holding to empty stops the sauce: 0% means nothing more comes out, and the pizza stays put", async ({ page }) => {
  await startSauceStep(page);
  const gauge = page.locator(GAUGE);
  const dough = (await page.locator(".pizza-dough--interactive").boundingBox())!;
  const centre = { x: dough.x + dough.width / 2, y: dough.y + dough.height / 2 };
  const hold = async (ms: number) => {
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
    await page.waitForTimeout(150);
  };
  await hold(3200); // ~2.5s empties the bottle (50 ticks)
  await expect(gauge).toHaveAttribute("aria-valuenow", "0");
  const heatmap = () => page.locator("canvas.pizza-sauce-heatmap").first().evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  const emptied = await heatmap();
  await hold(800); // a second press at 0%: nothing more comes out
  await expect(gauge).toHaveAttribute("aria-valuenow", "0");
  expect(await heatmap()).toBe(emptied);
  const after = (await page.locator(".pizza-dough--interactive").boundingBox())!;
  expect(after.width).toBeCloseTo(dough.width, 0);
  expect(after.x).toBeCloseTo(dough.x, 0);
});

/**
 * Issue #489 B3: with several sauces (B1 ledger) the gauge shows the ACTIVE kind's own bottle -- a fresh sauce starts full,
 * switching back shows the first sauce's remaining bottle (not a refill), and the dispenser still caps on the same number.
 */
test("multi-sauce: the gauge follows the active sauce's own bottle", async ({ page }) => {
  const { width, height } = page.viewportSize()!;
  await openWith(page, width, height, base(["tomato-sauce", "pesto"]));
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  const gauge = page.locator(GAUGE);
  const dough = (await page.locator(".pizza-dough--interactive").boundingBox())!;
  const centre = { x: dough.x + dough.width / 2, y: dough.y + dough.height / 2 };
  const hold = async (ms: number) => {
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
    await page.waitForTimeout(150);
  };
  const now = async () => Number(await gauge.getAttribute("aria-valuenow"));

  await hold(1200);
  const tomatoLeft = await now();
  expect(tomatoLeft).toBeLessThan(100);

  await page.getByRole("button", { name: /ジェノベーゼ/ }).click();
  await expect(gauge).toHaveAttribute("aria-valuenow", "100"); // pesto: its own full bottle
  await hold(800);
  expect(await now()).toBeLessThan(100);

  await page.getByRole("button", { name: /トマトソース/ }).click();
  expect(Math.abs((await now()) - tomatoLeft)).toBeLessThanOrEqual(4); // tomato's remaining, not a refill
});

/**
 * Owner Decision on PR #494: the gauge takes the selected sauce's colour, an empty sauce differs from the pizza-wide limit
 * (a quiet hatch), and a pale sauce (olive oil) keeps contrast against the track. The pizza-wide 200% can only bind from the third kind on.
 */
test("gauge colour follows the selected sauce; an empty sauce and the pizza-wide limit look different", async ({ page }) => {
  const { width, height } = page.viewportSize()!;
  await openWith(page, width, height, base(["tomato-sauce", "pesto", "olive-oil"]));
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  const gauge = page.locator(GAUGE);
  const fill = page.locator(".sauce-remaining-gauge__fill");
  const dough = (await page.locator(".pizza-dough--interactive").boundingBox())!;
  const centre = { x: dough.x + dough.width / 2, y: dough.y + dough.height / 2 };
  const hold = async (ms: number) => {
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
    await page.waitForTimeout(150);
  };
  const fillColor = () => fill.evaluate((el) => getComputedStyle(el).backgroundColor);
  const select = (name: RegExp) => page.getByRole("button", { name }).click();

  expect(await fillColor()).toBe("rgb(199, 59, 46)"); // tomato #c73b2e
  await select(/ジェノベーゼ/);
  expect(await fillColor()).toBe("rgb(107, 142, 61)"); // pesto #6b8e3d
  await select(/オリーブオイル/);
  expect(await fillColor()).toBe("rgb(233, 217, 160)"); // olive oil #e9d9a0 (pale)
  // contrast: the track is darker than the cream stage and the pale fill carries its own outline
  const track = await gauge.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(track).toMatch(/^rgba\(60, 40, 20/);
  expect(await fill.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");

  // drain tomato and pesto completely: pizza total 2.0 reached
  await select(/トマトソース/);
  await hold(3400);
  await expect(gauge).toHaveAttribute("aria-valuenow", "0");
  await expect(gauge).not.toHaveAttribute("data-limit"); // tomato is simply empty: no hatch
  await expect(page.locator(".sauce-remaining-gauge__cap")).toHaveCount(0);
  await select(/ジェノベーゼ/);
  await hold(3400);
  await expect(gauge).toHaveAttribute("aria-valuenow", "0");
  await expect(page.locator(".sauce-remaining-gauge__cap")).toHaveCount(0); // two kinds never reach the pizza-wide limit first

  // a fresh third sauce is stopped by the pizza-wide limit alone: empty usable, hatch over its whole bottle
  await select(/オリーブオイル/);
  await expect(gauge).toHaveAttribute("aria-valuenow", "0");
  await expect(gauge).toHaveAttribute("data-limit", "total");
  const cap = await page.locator(".sauce-remaining-gauge__cap").boundingBox();
  const g = (await gauge.boundingBox())!;
  expect(cap).not.toBeNull();
  expect(cap!.height).toBeGreaterThan(g.height * 0.8);
  const before = await page.locator("canvas.pizza-sauce-heatmap").count();
  await hold(800); // nothing more comes out
  expect(await page.locator("canvas.pizza-sauce-heatmap").count()).toBe(before);
});
