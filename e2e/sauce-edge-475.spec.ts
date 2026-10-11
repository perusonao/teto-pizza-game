import { expect, test, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, cutThreeLines, startFreshMargherita, tapDoughPercent } from "./gestures";
import {
  alphaOfRgba,
  CORE_ALPHA,
  EXTENT_ALPHA,
  shapeStats,
  type AlphaMap,
} from "../src/logic/testSupport/sauceDisplayMetrics";

/**
 * Issue #475 Slice 1 (A1): the sauce heatmap's edge on the REAL canvas, in Chromium and WebKit, at 390x844
 * and 360x800 (the viewport comes from the project). The old display rasterized a 16x16 field whose square
 * support read as a square dab and a staircase edge; the new one splats round Gaussians on a 64x64 grid.
 *
 * The numbers are read straight off the heatmap <canvas>'s own pixels (getImageData), so they are the same
 * in every browser and need no screenshot to be viewed. They are measured BEFORE the CSS blur (which only
 * softens further), so the thresholds here are deliberately a little looser than the Result Report's
 * screenshot-level figures (distortion 1.57 -> 1.05, spiral roughness 0.64% -> 0.24%).
 *
 * Measured on this branch (canvas level, Chromium): centre hold distortion 1.044 / roughness 0.229%,
 * in-ring spiral roughness 0.357-0.378%, ring of taps distortion 1.035 / roughness 0.315%; on main the same
 * gestures read 1.134 / 0.297%, 0.703-0.722% and 1.187 / 0.794%.
 */

const HEATMAP = "canvas.pizza-sauce-heatmap";

async function startSauceStep(page: Page) {
  await startFreshMargherita(page);
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await expect(page.locator(".pizza-dough--interactive")).toBeVisible();
}

async function doughRect(page: Page) {
  const box = await page.locator(".pizza-dough--interactive").boundingBox();
  if (!box) throw new Error("dough has no box");
  return box;
}

/** Holds the finger down for `ms` while walking `path` (dough-percent points), evenly in time. */
async function drag(page: Page, path: ReadonlyArray<{ x: number; y: number }>, ms: number) {
  const box = await doughRect(page);
  const at = (p: { x: number; y: number }) => ({ x: box.x + (p.x / 100) * box.width, y: box.y + (p.y / 100) * box.height });
  const first = at(path[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  const t0 = Date.now();
  for (let i = 1; i < path.length; i += 1) {
    const p = at(path[i]);
    await page.mouse.move(p.x, p.y);
    const wait = t0 + (ms * i) / (path.length - 1) - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
  }
  await page.mouse.up();
}

async function readHeatmap(page: Page, index = 0): Promise<AlphaMap & { dataUrl: string }> {
  const raw = await page.locator(HEATMAP).nth(index).evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    return { size: canvas.width, rgba: Array.from(data), dataUrl: canvas.toDataURL() };
  });
  return { size: raw.size, alpha: alphaOfRgba(raw.rgba), dataUrl: raw.dataUrl };
}

const spiral = (rMax: number, n = 140) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const a = t * 3 * Math.PI * 2;
    return { x: 50 + Math.cos(a) * rMax * t, y: 50 + Math.sin(a) * rMax * t };
  });

test.describe("sauce heatmap edge (Issue #475 Slice 1)", () => {
  test("a held dab is round and sits under the finger", async ({ page }) => {
    test.setTimeout(45_000);
    await startSauceStep(page);
    await drag(page, [{ x: 50, y: 50 }, { x: 50, y: 50 }], 2300);
    await expect(page.locator(HEATMAP).first()).toBeVisible();
    const map = await readHeatmap(page);
    const core = shapeStats(map, CORE_ALPHA);
    const extent = shapeStats(map, EXTENT_ALPHA);
    expect(core.distortion).toBeGreaterThan(0);
    expect(core.distortion).toBeLessThanOrEqual(1.15); // criterion 1 (main: 1.57 on the screenshot)
    expect(Math.hypot(extent.cx - 50, extent.cy - 50)).toBeLessThanOrEqual(1); // criterion 4 (main: 3.1 off)
    // criterion 3: the painted area stays within a browser-tolerant band around main's 18.4%.
    expect(extent.areaPct).toBeGreaterThan(16.9);
    expect(extent.areaPct).toBeLessThan(19.9);
  });

  test("a spiral inside the ideal ring has a smooth edge", async ({ page }) => {
    test.setTimeout(45_000);
    await startSauceStep(page);
    await drag(page, spiral(30), 2300);
    const map = await readHeatmap(page);
    const core = shapeStats(map, CORE_ALPHA);
    const extent = shapeStats(map, EXTENT_ALPHA);
    expect(core.roughnessPct).toBeLessThanOrEqual(0.5); // criterion 2 (main: 0.70-0.72 at canvas level)
    // The deposits of a timed drag depend on the machine (a loaded CI runner delivers fewer ticks: 28-33%
    // seen with two workers in parallel, 45% idle), so only "a substantial coat, nowhere near the whole
    // dough" is asserted here; the strict +-5% extent check is the deterministic unit test
    // (src/logic/sauceDisplay.test.ts) and the deterministic hold / ring tests in this file.
    expect(extent.areaPct).toBeGreaterThan(15);
    expect(extent.areaPct).toBeLessThan(60);
    expect(Math.hypot(extent.cx - 50, extent.cy - 48)).toBeLessThanOrEqual(5); // the gesture's own offset
  });

  test("a ring of taps reads as a round ring, centred", async ({ page }) => {
    test.setTimeout(45_000);
    await startSauceStep(page);
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      await tapDoughPercent(page, 50 + Math.cos(a) * 25, 50 + Math.sin(a) * 25);
    }
    const map = await readHeatmap(page);
    const core = shapeStats(map, CORE_ALPHA);
    const extent = shapeStats(map, EXTENT_ALPHA);
    expect(core.distortion).toBeLessThanOrEqual(1.1); // main: 1.19
    expect(core.roughnessPct).toBeLessThanOrEqual(0.5); // main: 0.79
    expect(Math.hypot(extent.cx - 50, extent.cy - 50)).toBeLessThanOrEqual(1);
  });

  test("the same pixels carry SAUCE -> BAKE -> CUT -> RESULT (continuity and determinism)", async ({ page }) => {
    test.setTimeout(60_000);
    await startSauceStep(page);
    await drag(page, spiral(30), 2300);
    const sauce = await readHeatmap(page);
    expect(shapeStats(sauce, EXTENT_ALPHA).areaPct).toBeGreaterThan(15);

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

    // BAKE: same deposits, same silhouette -> the very same canvas pixels (only CSS tints change).
    await bakeToTarget(page, { start: 60, end: 80 });
    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    const painted = async () => {
      const count = await page.locator(HEATMAP).count();
      const maps = [];
      for (let i = 0; i < count; i += 1) maps.push(await readHeatmap(page, i));
      return maps.filter((m) => shapeStats(m, EXTENT_ALPHA).areaPct > 0);
    };

    // CUT: the pizza is drawn once per piece; every piece must carry the identical sauce canvas.
    await cutThreeLines(page);
    await expect(page.locator(".pizza-cut-mark")).toHaveCount(3);
    const inCut = await painted();
    expect(inCut.length).toBeGreaterThanOrEqual(2);
    for (const map of inCut) expect(map.dataUrl).toBe(sauce.dataUrl);

    await page.getByRole("button", { name: /切り終わる/ }).click();
    await expect(page.locator(".result-panel")).toBeVisible();
    const inResult = await painted();
    expect(inResult.length).toBe(inCut.length);
    for (const map of inResult) expect(map.dataUrl).toBe(sauce.dataUrl);
  });

  test("the 見本 (Reference) draws through the same pipeline: thumbnail and popover agree and are round", async ({ page }) => {
    test.setTimeout(45_000);
    await startSauceStep(page);
    const read = (selector: string) =>
      page.locator(selector).first().evaluate((el) => {
        const canvas = el as HTMLCanvasElement;
        return { size: canvas.width, rgba: Array.from(canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data), dataUrl: canvas.toDataURL() };
      });
    const thumb = await read("canvas.reference-thumbnail__base");
    await page.getByRole("button", { name: /見本を拡大表示/ }).click();
    const popover = await read("canvas.reference-mini-pizza__sauce");
    // Same fixture, same shape, same colour -> identical canvases, whatever size each is shown at.
    expect(popover.dataUrl).toBe(thumb.dataUrl);
    const stats = shapeStats({ size: popover.size, alpha: alphaOfRgba(popover.rgba) }, CORE_ALPHA);
    expect(stats.distortion).toBeLessThanOrEqual(1.1);
    expect(Math.hypot(stats.cx - 50, stats.cy - 50)).toBeLessThanOrEqual(1);
  });
});
