import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep, enterBakePaused, landNeedleAndTakeOut, startFreshMargherita, tapDoughPercent } from "./gestures";

/**
 * Square-Pan Dough D2-b2 (#537, Epic #532): how the square dough LOOKS on its tray -- render only. The production start (a small ball) is pulled to the four corners and along the
 * sides: the dough's canvas now carries the pan's floor, the dough's shadow on it and the dough's own side, so an uncovered patch reads as the tray's floor and not as a gouge. After
 * 「次へ」 the tray's wall frames the plate. Nothing about scoring, completion, the save or CUT is touched, so the layer's own numbers (`data-coverage`, `data-corners`) are read here
 * and must be what the drags did. The viewport comes from the project (390x844 / 360x800). HV_SHOT_DIR (optional) writes screenshots.
 */
const BALL = "?pan=square";
const LUMPY = "?pan=square&squareStart=lumpy";
const SHOT_DIR = process.env.HV_SHOT_DIR;

async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-${name}.png` });
}

const layer = (page: Page) => page.getByTestId("square-dough-layer");
async function at(page: Page, x: number, y: number) {
  const box = (await layer(page).boundingBox())!;
  return { x: box.x + (box.width * x) / 100, y: box.y + (box.height * y) / 100 };
}
async function drag(page: Page, points: Array<[number, number]>) {
  const first = await at(page, ...points[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const p of points.slice(1)) {
    const q = await at(page, ...p);
    await page.mouse.move(q.x, q.y, { steps: 8 });
  }
  await page.mouse.up();
}

/** the dough canvas' own 128 x 128 pixels at a fraction (0..1) of the pan */
const canvasPixels = (page: Page, points: ReadonlyArray<readonly [number, number]>) =>
  page.evaluate((pts) => {
    const canvas = document.querySelector('[data-testid="square-dough-canvas"]') as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    return pts.map(([u, v]) => Array.from(ctx.getImageData(Math.round(u * (canvas.width - 1)), Math.round(v * (canvas.height - 1)), 1, 1).data));
  }, points as Array<readonly [number, number]>);
const lum = (p: number[]) => p[0] + p[1] + p[2];

test.describe("D2-b2 square dough: the tray's floor, the dough's shadow and side", () => {
  test("STEP 1: the gaps between the pulled-out dough are the tray's floor (light top left, shadowed under the dough), not a flat grey cut-out; the numbers are the drags'", async ({ page }) => {
    test.setTimeout(90_000);
    await startFreshMargherita(page, BALL);
    await page.waitForSelector('[data-testid="square-dough-layer"]');
    await shot(page, "1-start");
    await expect(layer(page)).toHaveAttribute("data-renderer", "canvas");
    for (const corner of [[9, 9], [91, 9], [91, 91], [9, 91]] as Array<[number, number]>) await drag(page, [[50, 50], [(50 + corner[0]) / 2, (50 + corner[1]) / 2], corner]);
    await shot(page, "2-corners");
    // read before the next drags (the gaps close as the dough is pulled out): the middle of each gap (top, left, right, bottom edge)
    const gaps = await canvasPixels(page, [[0.5, 0.06], [0.06, 0.5], [0.94, 0.5], [0.5, 0.94]]);
    const afterCorners = { corners: await layer(page).getAttribute("data-corners"), coverage: Number(await layer(page).getAttribute("data-coverage")) };

    // along the sides: the slits that are left are the floor too
    for (const pts of [[[50, 50], [50, 8]], [[50, 50], [92, 50]], [[50, 50], [50, 92]], [[50, 50], [8, 50]]] as Array<Array<[number, number]>>) await drag(page, pts);
    await shot(page, "3-sides");

    // the same numbers the drags always gave (the picture decides nothing)
    expect(afterCorners.corners).toBe("4");
    expect(afterCorners.coverage).toBeGreaterThan(0.7);
    expect(afterCorners.coverage).toBeLessThan(0.8);
    // an empty gap is the floor: opaque, a grey (b >= r: not dough-coloured)
    for (const p of gaps) {
      expect(p[3]).toBe(255);
      expect(p[2], "a grey floor, not dough").toBeGreaterThanOrEqual(p[0]);
    }
    // light top left, dark bottom right: the top and left gaps are brighter than the bottom and right ones
    expect(lum(gaps[0]) + lum(gaps[1])).toBeGreaterThan(lum(gaps[2]) + lum(gaps[3]) + 20);
    // The side sweeps only ever add dough (the numbers are the drags', never the picture's). How far they get depends on the engine's pointer events -- the first CI run measured STEP 1's
    // 95% line (Chromium reached 0.959) as just out of reach in WebKit -- so completion is not this spec's claim; it is `square-dough-corners.spec.ts`'s.
    expect(await layer(page).getAttribute("data-corners")).toBe("4");
    expect(Number(await layer(page).getAttribute("data-coverage"))).toBeGreaterThanOrEqual(afterCorners.coverage);
    const sw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(sw.sw).toBeLessThanOrEqual(sw.iw);
  });

  test("after 「次へ」 the tray's wall frames the plate: the pan's own box, above the sauce, never in the way of a touch; SAUCE still reaches the corners", async ({ page }) => {
    test.setTimeout(90_000);
    await startFreshMargherita(page, LUMPY);
    await page.waitForSelector('[data-testid="square-dough-layer"]');
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /トマトソース/ }).click();
    await shot(page, "4-sauce-empty");
    const wall = await page.locator(".pizza-dough").evaluate((el) => {
      const dough = el.getBoundingClientRect();
      const style = getComputedStyle(el, "::after");
      const border = parseFloat(getComputedStyle(el).borderTopWidth);
      return {
        border,
        box: dough.width, // the border box
        content: style.content,
        position: style.position,
        events: style.pointerEvents,
        // `left` / `top` / `width` of an absolutely positioned pseudo-element are used values, from the padding box
        left: parseFloat(style.left) + border,
        top: parseFloat(style.top) + border,
        width: parseFloat(style.width),
        height: parseFloat(style.height),
        radius: style.borderTopLeftRadius,
        shadow: style.boxShadow,
      };
    });
    expect(wall.content).not.toBe("none");
    expect(wall.position).toBe("absolute");
    expect(wall.events).toBe("none");
    expect(Math.abs(wall.left - wall.box * 0.06), "left edge = the pan's").toBeLessThanOrEqual(1.5);
    expect(Math.abs(wall.top - wall.box * 0.06), "top edge = the pan's").toBeLessThanOrEqual(1.5);
    expect(Math.abs(wall.width - wall.box * 0.88), "width = the pan's").toBeLessThanOrEqual(1.5);
    expect(Math.abs(wall.height - wall.box * 0.88), "height = the pan's").toBeLessThanOrEqual(1.5);
    expect(wall.shadow).toContain("inset");
    // a touch goes through the frame: the four corners take sauce, as before
    for (const [x, y] of [[9, 9], [91, 9], [91, 91], [9, 91]]) await tapDoughPercent(page, x, y);
    const alpha = await page.evaluate(() => {
      const canvas = document.querySelector("canvas.pizza-sauce-heatmap.square-sauce-canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      return [[18, 18], [182, 18], [182, 182], [18, 182]].map(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3]);
    });
    for (const a of alpha) expect(a).toBeGreaterThan(40);
    await shot(page, "4-sauce-corners");
  });

  test("RESULT of a square pizza: the pan's wall is on, the plate is the pan's square, CUT is still off", async ({ page }) => {
    test.setTimeout(90_000);
    await startFreshMargherita(page, LUMPY);
    await page.waitForSelector('[data-testid="square-dough-layer"]');
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /トマトソース/ }).click();
    for (const [x, y] of [[9, 9], [91, 9], [91, 91], [9, 91], [50, 50]]) await tapDoughPercent(page, x, y);
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /モッツァレラ/ }).click();
    await tapDoughPercent(page, 50, 30);
    await page.getByRole("button", { name: /次へ/ }).click();
    await enterBakePaused(page);
    await page.clock.runFor(1200);
    await landNeedleAndTakeOut(page, { start: 60, end: 80 });
    await expect(page.locator(".pizza-stage--result")).toBeVisible();
    await page.waitForTimeout(900);
    await shot(page, "5-result");
    await expect(page.getByRole("button", { name: /切り終わる/ })).toHaveCount(0);
    expect(await page.locator(".pizza-dough").evaluate((el) => getComputedStyle(el, "::after").content)).not.toBe("none");
    const dough = await page.locator(".pizza-dough").boundingBox();
    expect(Math.abs(dough!.width - dough!.height)).toBeLessThanOrEqual(1);
  });

  test("a round pizza is unchanged: no tray wall, no pan-shaped pseudo-element", async ({ page }) => {
    test.setTimeout(90_000);
    await startFreshMargherita(page);
    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /トマトソース/ }).click();
    await expect(page.locator(".pizza-dough")).not.toHaveClass(/pizza-dough--square-pan/);
    expect(await page.locator(".pizza-dough").evaluate((el) => getComputedStyle(el, "::after").content)).toBe("none");
    expect(await page.locator('[data-testid="square-dough-canvas"]').count()).toBe(0);
  });
});
