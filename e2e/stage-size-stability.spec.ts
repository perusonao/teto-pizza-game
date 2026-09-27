import { expect, test, type Page } from "@playwright/test";
import { runOnlyOnWidth } from "./support/projectGuard";
import { completeDoughStep, cutThreeLines, enterBakePaused, landNeedleAndTakeOut, tapDoughPercent } from "./gestures";

/**
 * DM-3R-0 Cooking Stage Size Stability (Issue #245): pointer / gesture smoke at the size the
 * dough actually has after the fix. The PREPARE dock now keeps the dough at one (smaller than
 * the 290px cap) size from DOUGH to TOPPING on a short visible height, so every gesture family
 * is driven there -- and at the 844 authority height for comparison -- and must land where the
 * pointer went. The diameters themselves are pinned by the Layout Contract (LC-S1..LC-S4).
 */

const SAVE_KEY = "teto-pizza-save-v1";
const SAVE = {
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }],
  pitzBalance: 150,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
  missionBest: {},
};

async function openMargherita(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(SAVE)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).first().click();
  await page.getByRole("button", { name: /^マルゲリータ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
  await page.waitForSelector(".pizza-stage");
}

const doughWidth = async (page: Page) => (await page.locator(".pizza-dough").boundingBox())!.width;

/** The placed topping's own position (its inline left/top %, the reducer's dough coordinates). */
async function lastToppingPercent(page: Page) {
  return page.locator(".pizza-topping").last().evaluate((el) => {
    const s = (el as HTMLElement).style;
    return { x: parseFloat(s.left), y: parseFloat(s.top) };
  });
}

/** Where a single sauce dab landed: the alpha-weighted centroid of the sauce heatmap canvas,
 *  in percent of the canvas box (which spans the dough). */
async function sauceCentroidPercent(page: Page) {
  return page.locator(".pizza-dough canvas").first().evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let sx = 0;
    let sy = 0;
    let sw = 0;
    for (let y = 0; y < c.height; y += 1) {
      for (let x = 0; x < c.width; x += 1) {
        const a = data[(y * c.width + x) * 4 + 3];
        if (a > 32) {
          sx += x * a;
          sy += y * a;
          sw += a;
        }
      }
    }
    return sw ? { x: (sx / sw / c.width) * 100, y: (sy / sw / c.height) * 100, painted: sw } : null;
  });
}

for (const [label, width, height] of [
  ["390x844", 390, 844],
  ["390x664 (Safari-like)", 390, 664],
  ["360x640 (Safari-like)", 360, 640],
] as const) {
  test(`DM-3R-0 pointer smoke ${label}: dough stretch, sauce dab, topping taps and CUT land where the pointer went`, async ({ page }) => {
    test.setTimeout(90_000);
    runOnlyOnWidth(test.info(), width === 390 ? 390 : 360);
    await openMargherita(page, width, height);

    const dough = await doughWidth(page);
    await completeDoughStep(page);
    await expect(page.locator(".prepare-bake-bar").getByRole("button", { name: /次へ/ })).toBeEnabled();
    await page.locator(".prepare-bake-bar").getByRole("button", { name: /次へ/ }).click();

    // SAUCE: one short dab off-center; its centroid must be where the pointer was.
    await page.getByRole("button", { name: /トマトソース/ }).click();
    expect(await doughWidth(page), `${label}: SAUCE keeps the DOUGH diameter`).toBeCloseTo(dough, 0);
    await tapDoughPercent(page, 35, 40);
    const dab = await sauceCentroidPercent(page);
    expect(dab, `${label}: the dab painted something`).not.toBeNull();
    expect(Math.abs(dab!.x - 35), `${label}: sauce dab x (${dab!.x.toFixed(1)}%)`).toBeLessThanOrEqual(4);
    expect(Math.abs(dab!.y - 40), `${label}: sauce dab y (${dab!.y.toFixed(1)}%)`).toBeLessThanOrEqual(4);
    for (const [x, y] of [[50, 30], [65, 50], [50, 70], [35, 55]] as const) await tapDoughPercent(page, x, y);
    await page.locator(".prepare-bake-bar").getByRole("button", { name: /次へ/ }).click();

    // CHEESE / TOPPING: taps at known dough percentages.
    expect(await doughWidth(page), `${label}: CHEESE keeps the DOUGH diameter`).toBeCloseTo(dough, 0);
    await page.getByRole("button", { name: /モッツァレラ/ }).click();
    for (const [x, y] of [[30, 45], [68, 55]] as const) {
      await tapDoughPercent(page, x, y);
      const at = await lastToppingPercent(page);
      expect(Math.hypot(at.x - x, at.y - y), `${label}: mozzarella at ${x},${y} landed at ${at.x.toFixed(1)},${at.y.toFixed(1)}`).toBeLessThanOrEqual(3);
    }
    await page.locator(".prepare-bake-bar").getByRole("button", { name: /次へ/ }).click();
    expect(await doughWidth(page), `${label}: TOPPING keeps the DOUGH diameter`).toBeCloseTo(dough, 0);
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 50, 28);
    const basil = await lastToppingPercent(page);
    expect(Math.hypot(basil.x - 50, basil.y - 28), `${label}: basil landed at ${basil.x.toFixed(1)},${basil.y.toFixed(1)}`).toBeLessThanOrEqual(3);

    // BAKE -> CUT: three drag-across lines register at the post-bake size.
    await enterBakePaused(page);
    await landNeedleAndTakeOut(page, { start: 58, end: 78 });
    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await cutThreeLines(page);
    await expect(page.locator(".pizza-cut-line")).toHaveCount(3);
  });
}
