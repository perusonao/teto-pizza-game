import { expect, test, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, startFreshMargherita, tapDoughPercent } from "./gestures";

/**
 * Square-Pan Dough D2-a2 (#537, Epic #532): the square pan through every cooking step of the real game -- DOUGH -> SAUCE -> CHEESE -> TOPPING -> BAKE ->
 * RESULT -- with the Preview switch `?pan=square&squareStart=lumpy` (no catalog recipe uses the tray yet, so Production never reaches this). The
 * viewport comes from the project (390x844 / 360x800). Measured on the real page: the pan is the same size and place at every step, no round dough
 * shows under it, sauce reaches the four corners and stops at the pan's edge (read off the heatmap canvas' own pixels), pieces can be put at the
 * corners and not past the edge, and nothing scrolls. The second test pins that a round pizza is the same as it has always been.
 * HV_SHOT_DIR (optional) writes the screenshots.
 */
const QUERY = "?pan=square&squareStart=lumpy";
const SHOT_DIR = process.env.HV_SHOT_DIR;
const PAN = { from: 6, to: 94 }; // SQUARE_PAN_GEOMETRY, in percent of the dough's border box

async function shot(page: Page, name: string) {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-${name}.png` });
}

async function noScroll(page: Page) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(m.sw).toBeLessThanOrEqual(m.iw);
}

const rectOf = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, selector);

/** the pan's square in page pixels, from the dough's own border box */
async function expectedPan(page: Page) {
  const d = await rectOf(page, ".pizza-dough");
  return { x: d.x + (d.w * PAN.from) / 100, y: d.y + (d.h * PAN.from) / 100, w: (d.w * (PAN.to - PAN.from)) / 100, h: (d.h * (PAN.to - PAN.from)) / 100 };
}

function expectRect(actual: { x: number; y: number; w: number; h: number }, expected: { x: number; y: number; w: number; h: number }, tolerance = 1.5) {
  for (const key of ["x", "y", "w", "h"] as const) expect(Math.abs(actual[key] - expected[key]), key).toBeLessThanOrEqual(tolerance);
}

/** alpha of the heatmap canvas at a dough-percent point (the canvas is 200px over the dough's border box) */
const alphaAt = (page: Page, xPercent: number, yPercent: number) =>
  page.evaluate(
    ([x, y]) => {
      const canvas = document.querySelector("canvas.pizza-sauce-heatmap.square-sauce-canvas") as HTMLCanvasElement;
      return canvas.getContext("2d")!.getImageData(Math.round(x * 2), Math.round(y * 2), 1, 1).data[3];
    },
    [xPercent, yPercent],
  );

test.describe("D2-a2 square pan: DOUGH -> RESULT", () => {
  test("the pan stays one square at every step; sauce, cheese and toppings reach the corners and stop at the edge", async ({ page }) => {
    test.setTimeout(90_000);
    await startFreshMargherita(page, QUERY);
    await page.waitForSelector('[data-testid="square-dough-layer"]');

    // DOUGH: the layer's pan is the 6%..94% square of the dough's border box (the box every later step measures against)
    expectRect(await rectOf(page, ".square-dough-layer__pan"), await expectedPan(page));
    await expect(page.locator(".pizza-dough-shape")).toHaveCount(0);
    await shot(page, "1-dough");
    await noScroll(page);

    // SAUCE
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /トマトソース/ }).click();
    await expect(page.locator(".pizza-dough")).toHaveClass(/pizza-dough--square-pan/);
    await expect(page.locator(".pizza-dough")).not.toHaveClass(/pizza-dough--has-shape-layer/);
    await expect(page.locator(".pizza-dough-shape")).toHaveCount(0); // no round dough under the tray
    expectRect(await rectOf(page, ".pizza-dough-square"), await rectOf(page, ".pizza-dough")); // the plate is the dough's box, clipped to the pan by CSS
    expect(await page.locator(".pizza-dough-square").evaluate((el) => getComputedStyle(el).clipPath)).toContain("inset(6%");
    await expect(page.locator("svg.square-target-guide rect")).toHaveCount(1);
    await expect(page.locator(".sauce-target-guide")).toHaveCount(0);
    for (const [x, y] of [[9, 9], [91, 9], [91, 91], [9, 91]]) await tapDoughPercent(page, x, y);
    await tapDoughPercent(page, 50, 50);
    await expect.poll(() => alphaAt(page, 9, 9)).toBeGreaterThan(40);
    expect(await alphaAt(page, 91, 91)).toBeGreaterThan(40); // all four corners are reached, none rounded off
    expect(await alphaAt(page, 91, 9)).toBeGreaterThan(40);
    expect(await alphaAt(page, 9, 91)).toBeGreaterThan(40);
    expect(await alphaAt(page, 3, 3)).toBe(0); // nothing is drawn past the pan's edge
    expect(await alphaAt(page, 3, 50)).toBe(0);
    expect(await alphaAt(page, 97, 50)).toBe(0);
    expect(await page.locator("canvas.pizza-sauce-heatmap.square-sauce-canvas").evaluate((el) => getComputedStyle(el).clipPath)).toContain("inset(6%"); // and the blur cannot bleed past it
    await shot(page, "2-sauce");
    await noScroll(page);

    // CHEESE: the corners take a piece; just past the edge takes none
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /モッツァレラ/ }).click();
    await tapDoughPercent(page, 90, 90);
    await tapDoughPercent(page, 10, 10);
    await expect(page.locator("[data-topping-id]")).toHaveCount(2);
    await tapDoughPercent(page, 3, 50); // inside the dough box, off the pan
    await tapDoughPercent(page, 50, 97);
    await expect(page.locator("[data-topping-id]")).toHaveCount(2);
    const pan = await expectedPan(page);
    for (const piece of await page.locator("[data-topping-id]").all()) {
      const b = (await piece.boundingBox())!;
      expect(b.x + b.width / 2).toBeGreaterThan(pan.x);
      expect(b.x + b.width / 2).toBeLessThan(pan.x + pan.w);
      expect(b.y + b.height / 2).toBeGreaterThan(pan.y);
      expect(b.y + b.height / 2).toBeLessThan(pan.y + pan.h);
    }
    await shot(page, "3-cheese");
    await noScroll(page);

    // TOPPING
    await page.getByRole("button", { name: /次へ/ }).click();
    if (await page.getByRole("button", { name: /バジル/ }).count()) {
      await page.getByRole("button", { name: /バジル/ }).click();
      await tapDoughPercent(page, 12, 88);
      await tapDoughPercent(page, 88, 12);
    }
    await expect(page.locator(".pizza-dough-shape")).toHaveCount(0);
    await shot(page, "4-topping");

    // BAKE -> RESULT (a square round has no CUT)
    await bakeToTarget(page, { start: 60, end: 80 });
    await expect(page.getByRole("button", { name: /切り終わる/ })).toHaveCount(0);
    await expect(page.locator(".pizza-stage--result")).toBeVisible();
    await expect(page.locator(".pizza-dough")).toHaveClass(/pizza-dough--square-pan/);
    await expect(page.locator(".pizza-dough-shape")).toHaveCount(0);
    const result = await rectOf(page, ".pizza-dough");
    expect(Math.abs(result.w - result.h)).toBeLessThanOrEqual(1); // the square stays square at the RESULT's scale
    expect(result.w).toBeGreaterThan(150);
    expectRect(await rectOf(page, ".pizza-dough-square"), result);
    await shot(page, "5-result");
    await noScroll(page);
  });

  test("a round pizza is unchanged: the round dough, the round guide, and its rim ring past 48 is not on it", async ({ page }) => {
    await startFreshMargherita(page);
    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /トマトソース/ }).click();
    await expect(page.locator(".pizza-dough")).not.toHaveClass(/pizza-dough--square-pan/);
    await expect(page.locator(".pizza-dough")).toHaveClass(/pizza-dough--has-shape-layer/);
    await expect(page.locator(".pizza-dough-shape")).toHaveCount(1);
    await expect(page.locator(".sauce-target-guide circle")).toHaveCount(1);
    expect(await page.evaluate(() => document.body.innerHTML.includes("square-"))).toBe(false);
    // 15%/15% is 49.5 from the centre: on the round dough's rim ring, past its 48 -- a square pan would take it, a round dough does not
    const box = (await page.locator(".pizza-dough").boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.15);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(200);
    await expect(page.locator("canvas.pizza-sauce-heatmap")).toHaveCount(0);
    await tapDoughPercent(page, 50, 50);
    await expect(page.locator("canvas.pizza-sauce-heatmap").first()).toBeVisible();
  });
});
