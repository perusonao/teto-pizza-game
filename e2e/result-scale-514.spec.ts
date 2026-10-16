import { expect, test, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, cutThreeLines, paintSauceRing, playFullCapricciosaRound, startCapricciosaUnlocked, startFreshMargherita, tapDoughPercent } from "./gestures";

/**
 * #514: the RESULT-only topping scale (`?resultScale=`, Preview / DEV). Real game, every engine: the switch shrinks the toppings drawn on the RESULT's pizza by
 * its multiplier, leaves the CUT screen and the mozzarella Canvas alone, and the cut pieces still get their sliced parts. With RESULT_SCALE_CAPTURE_DIR set it
 * also saves the RESULT's dough at 1.0 / 0.85 / 0.75 / 0.65 for margherita and capricciosa (comparison evidence for the PR; not a regression check).
 */
const OUT = process.env.RESULT_SCALE_CAPTURE_DIR;
test.use({ deviceScaleFactor: OUT ? 3 : 1 });

const SCALES = [1, 0.85, 0.75, 0.65];
/** basils near the game's three cuts (0 / 60 / 120 degrees through the centre), as the S3 spec places them */
const BASILS = [{ x: 14, y: 50 }, { x: 86, y: 59 }, { x: 15, y: 63 }, { x: 84, y: 34 }];

async function playMargherita(page: Page, query: string) {
  await startFreshMargherita(page, query);
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 20);
  await tapDoughPercent(page, 60, 20);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  for (const b of BASILS) await tapDoughPercent(page, b.x, b.y);
  await page.waitForTimeout(500);
  await bakeToTarget(page, { start: 60, end: 80 });
  await cutThreeLines(page);
  await page.waitForTimeout(500);
}

/** the basil's emoji font-size in px, the sliced-basil count and the mozzarella canvas's width, at this moment */
async function read(page: Page) {
  return page.evaluate(() => {
    const basil = document.querySelector<HTMLElement>(".pizza-topping--basil .ingredient-piece-visual__emoji");
    const wholeIds = new Set([...document.querySelectorAll<HTMLElement>(".pizza-topping--basil[data-topping-id]")].map((e) => e.dataset.toppingId!));
    const sliced = new Set([...document.querySelectorAll<HTMLElement>(".pizza-topping-half[data-topping-id]")].map((e) => e.dataset.toppingId!).filter((id) => wholeIds.has(id)));
    const canvas = document.querySelector<HTMLElement>(".pizza-cheese-canvas, canvas");
    return {
      fontPx: basil ? parseFloat(getComputedStyle(basil).fontSize) : 0,
      sliced: sliced.size,
      canvasW: canvas ? Math.round(canvas.getBoundingClientRect().width * 10) / 10 : 0,
      doughW: Math.round(document.querySelector(".pizza-dough")!.getBoundingClientRect().width),
    };
  });
}

test.describe("#514 RESULT topping scale (?resultScale=)", () => {
  test("0.75 shrinks the RESULT's toppings by 0.75, leaves the CUT screen and the mozzarella Canvas alone, and keeps the sliced parts", async ({ browser }, info) => {
    test.setTimeout(240_000);
    const seen: Record<string, { cut: Awaited<ReturnType<typeof read>>; result: Awaited<ReturnType<typeof read>> }> = {};
    for (const s of [1, 0.75]) {
      const ctx = await browser.newContext(info.project.use);
      const page = await ctx.newPage();
      await playMargherita(page, s === 1 ? "" : `?resultScale=${s}`);
      const cut = await read(page);
      await page.getByRole("button", { name: /切り終わる/ }).click();
      await page.waitForTimeout(800);
      const result = await read(page);
      seen[s] = { cut, result };
      await ctx.close();
    }
    expect(seen[1].result.canvasW, "the mozzarella Canvas is drawn").toBeGreaterThan(0);
    // the CUT screen: identical with and without the switch
    expect(seen[0.75].cut.fontPx).toBe(seen[1].cut.fontPx);
    expect(seen[0.75].cut.canvasW).toBe(seen[1].cut.canvasW);
    expect(seen[0.75].cut.sliced).toBe(seen[1].cut.sliced);
    // the RESULT: the toppings scale, the mozzarella Canvas and the dough do not
    expect(seen[0.75].result.doughW).toBe(seen[1].result.doughW);
    expect(seen[0.75].result.fontPx / seen[1].result.fontPx).toBeCloseTo(0.75, 2);
    expect(seen[0.75].result.canvasW).toBe(seen[1].result.canvasW);
    // the sliced copies follow the smaller drawing: never more than at 1.0, and still some of them on the RESULT's small dough
    expect(seen[0.75].result.sliced).toBeLessThanOrEqual(seen[1].result.sliced);
    expect(seen[0.75].result.sliced).toBeGreaterThan(0);
  });

  test("an unknown value changes nothing: the RESULT looks like production", async ({ page }) => {
    test.setTimeout(240_000);
    await playMargherita(page, "?resultScale=0.7");
    await page.getByRole("button", { name: /切り終わる/ }).click();
    await page.waitForTimeout(800);
    const r = await read(page);
    expect(r.fontPx).toBeGreaterThan(30); // basil xl x1.3: 28 * 1.3 = 36.4px, not scaled
    await expect(page.locator(".preview-badge")).toHaveCount(0); // dev server: no VITE_PREVIEW_MODE badge
  });

  test("capture: the RESULT at 1.0 / 0.85 / 0.75 / 0.65 (margherita and capricciosa)", async ({ browser }, info) => {
    test.skip(!OUT, "set RESULT_SCALE_CAPTURE_DIR to save comparison images");
    test.setTimeout(480_000);
    for (const recipe of ["margherita", "capricciosa"] as const) {
      for (const s of SCALES) {
        const ctx = await browser.newContext(info.project.use);
        const page = await ctx.newPage();
        const q = s === 1 ? "?resultScale=1.0" : `?resultScale=${s}`;
        if (recipe === "margherita") {
          await playMargherita(page, q);
          await page.getByRole("button", { name: /切り終わる/ }).click();
        } else {
          await startCapricciosaUnlocked(page, q);
          await playFullCapricciosaRound(page);
        }
        await page.waitForTimeout(1200);
        const db = (await page.locator(".pizza-stage--result .pizza-dough").first().boundingBox())!;
        await page.screenshot({ path: `${OUT}/${recipe}-${info.project.name}-s${s}.png`, clip: { x: db.x, y: db.y, width: db.width, height: db.height } });
        await ctx.close();
      }
    }
  });
});
