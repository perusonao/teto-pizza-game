import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
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
 * Issue #421 (Finished Pizza Appetite Appeal, Pilot): the baked mozzarella must look different from the raw one in
 * SHAPE (outline, spread, ring, local browning), not only in size / tint. Real Chromium at 390x844 and 360x800.
 *
 * The needle is stepped with the faked clock and the stage is captured at fixed needle positions; margherita's
 * `bakeTarget` is { start: 60, end: 80 } (centre 70 = heat 1), so 0 = raw, 56 = melting, 70 = properly baked,
 * 80 = deep brown, 98 = overbaked. Set MELT_SHOTS_DIR to also write the screenshots (the before/after comparison).
 */

const SHOTS_DIR = process.env.MELT_SHOTS_DIR;
// iPhone-like density so the 28 px mozzarella is judged at the resolution the Owner sees it at.
test.use({ deviceScaleFactor: 3 });

const BAKE_STAGES: ReadonlyArray<{ name: string; needle: number }> = [
  { name: "1-raw", needle: 0 },
  { name: "2-melting", needle: 56 },
  { name: "3-baked", needle: 70 },
  { name: "4-deep", needle: 80 },
  { name: "5-overbaked", needle: 98 },
];
const NEEDLE_PT_PER_S = 55; // BakeOverlay's SPEED (src/components/BakeOverlay.tsx) on this base

async function shot(page: Page, name: string) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  const size = page.viewportSize()!;
  await page.locator(".pizza-stage").screenshot({ path: `${SHOTS_DIR}/${name}-${size.width}x${size.height}.png` });
}

async function shotPage(page: Page, name: string) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  const size = page.viewportSize()!;
  await page.screenshot({ path: `${SHOTS_DIR}/${name}-${size.width}x${size.height}.png` });
}

async function flushReactCommit(page: Page) {
  for (let i = 0; i < 2; i += 1) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => {
            channel.port1.close();
            resolve();
          };
          channel.port2.postMessage(null);
        }),
    );
  }
}

async function needlePosition(page: Page): Promise<number> {
  await flushReactCommit(page);
  return page.locator(".bake-gauge__needle").evaluate((el) => Number.parseFloat((el as HTMLElement).style.left) || 0);
}

async function placeEverythingUpToBake(page: Page) {
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
  if (await page.getByRole("button", { name: /バジル/ }).count()) {
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);
  }
}

/** The mozzarella's own computed look, to assert the shape really changes (not only the colour). */
async function mozzarellaLook(page: Page) {
  return page.locator(".pizza-cheese--mozzarella").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      radius: cs.borderTopLeftRadius,
      boxShadow: cs.boxShadow,
      transform: cs.transform,
      melt: (el as HTMLElement).style.getPropertyValue("--bake-melt"),
    };
  });
}

test.describe("Mozzarella melt Pilot (#421)", () => {
  test("raw -> melting -> baked -> deep -> overbaked: the cheese changes shape, spread and browning", async ({ page }) => {
    await startFreshMargherita(page);
    await placeEverythingUpToBake(page);
    await enterBakePaused(page);

    const looks: Record<string, Awaited<ReturnType<typeof mozzarellaLook>>> = {};
    for (const { name, needle } of BAKE_STAGES) {
      let position = await needlePosition(page);
      if (needle > position) {
        await page.clock.runFor(Math.round(((needle - position) / NEEDLE_PT_PER_S) * 1000));
        position = await needlePosition(page);
      }
      await page.waitForTimeout(350); // the cheese's own 0.3 s transform/filter transition (real time, clock is faked)
      await flushReactCommit(page);
      looks[name] = await mozzarellaLook(page);
      await shot(page, `bake-${name}`);
    }

    // Raw cheese is the unchanged raw look: melt variable at 0 and the original outline.
    expect(Number(looks["1-raw"].melt)).toBeLessThan(0.05);
    // Properly baked: fully melted, and the outline / shadow / transform really differ from raw.
    expect(Number(looks["3-baked"].melt)).toBeGreaterThan(0.95);
    expect(looks["3-baked"].radius).not.toBe(looks["1-raw"].radius);
    expect(looks["3-baked"].boxShadow).not.toBe(looks["1-raw"].boxShadow);
    expect(looks["3-baked"].transform).not.toBe(looks["1-raw"].transform);
    // Not just a uniform scale: the matrix is anisotropic once melted.
    const m = /matrix\(([^,]+),[^,]+,[^,]+,([^,]+),/.exec(looks["3-baked"].transform);
    expect(m).not.toBeNull();
    expect(Math.abs(Number(m![1]) - Number(m![2]))).toBeGreaterThan(0.03);
  });

  test("CUT and RESULT keep the baked look in the pieces, and the layout fits the viewport", async ({ page }) => {
    await startFreshMargherita(page);
    await placeEverythingUpToBake(page);
    await enterBakePaused(page);
    await landNeedleAndTakeOut(page, { start: 60, end: 80 });
    await page.waitForSelector(".pizza-stage");

    await shot(page, "cut-0-before-cut");
    await cutThreeLines(page);
    await expect(page.locator(".pizza-pieces")).toHaveCount(1);
    await shot(page, "cut-1-pieces");
    const cutLook = await mozzarellaLook(page);
    expect(Number(cutLook.melt)).toBeGreaterThan(0.95); // the pieces carry the baked cheese, not the raw one

    await page.getByRole("button", { name: /切り終わる/ }).click();
    await page.waitForSelector(".pizza-stage");
    await shotPage(page, "result-page");
    await shot(page, "result-stage");
    const resultLook = await mozzarellaLook(page);
    expect(Number(resultLook.melt)).toBeGreaterThan(0.95);

    const overflow = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth - window.innerWidth,
    }));
    expect(overflow.horizontal).toBeLessThanOrEqual(0);
  });
});
