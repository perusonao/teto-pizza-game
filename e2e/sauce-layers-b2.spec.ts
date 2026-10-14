import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep } from "./gestures";
import { base, openWith } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Sauce B2 (layered painting) in the real browser, at 390x844 and 360x800 (the viewport comes from the project): each sauce kind is
 * its own heatmap layer, first laid at the bottom; what was painted before a switch keeps its colour and its place; the pizza's
 * box (and so every touch coordinate) is the same with and without the extra layers. The numbers are read from the canvases' own
 * pixels. Screenshots (HV_SHOT_DIR) are for the Owner's review of the overlap.
 */
const OWNED = ["tomato-sauce", "pesto", "olive-oil", "mozzarella", "basil"];
const SHOT_DIR = process.env.B2_SHOT_DIR;

async function startSauceStep(page: Page) {
  const { width, height } = page.viewportSize()!;
  await openWith(page, width, height, base(OWNED));
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await expect(page.locator(".pizza-dough--interactive")).toBeVisible();
}

async function doughBox(page: Page) {
  const box = await page.locator(".pizza-dough--interactive").boundingBox();
  if (!box) throw new Error("dough has no box");
  return box;
}

/** Holds the finger down at `from`, then drags to `to` over `ms`. Percent coordinates of the dough box. */
async function paint(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, ms: number) {
  const b = await doughBox(page);
  const at = (p: { x: number; y: number }) => ({ x: b.x + (p.x / 100) * b.width, y: b.y + (p.y / 100) * b.height });
  const a = at(from);
  const z = at(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(a.x + ((z.x - a.x) * i) / steps, a.y + ((z.y - a.y) * i) / steps);
    await page.waitForTimeout(ms / steps);
  }
  await page.mouse.up();
  await page.waitForTimeout(150);
}

/** Alpha-weighted statistics of one heatmap canvas, in canvas pixels. */
async function layerStats(page: Page, kind: string) {
  return page.locator(`canvas.pizza-sauce-heatmap--kind-${kind}`).first().evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const { data, width, height } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    let n = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let minX = width;
    let maxX = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const a = data[(y * width + x) * 4 + 3];
        if (a < 24) continue;
        n += 1;
        r += data[(y * width + x) * 4];
        g += data[(y * width + x) * 4 + 1];
        b += data[(y * width + x) * 4 + 2];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    const alphaAt = (fx: number, fy: number) => data[(Math.round(fy * (height - 1)) * width + Math.round(fx * (width - 1))) * 4 + 3];
    return {
      painted: n,
      r: n ? r / n : 0,
      g: n ? g / n : 0,
      b: n ? b / n : 0,
      minX,
      maxX,
      width,
      alphaLeft: alphaAt(0.3, 0.5),
      alphaCentre: alphaAt(0.5, 0.5),
      alphaRight: alphaAt(0.72, 0.5),
    };
  });
}

test("a second sauce is its own layer on top; the first keeps its colour and its place", async ({ page }) => {
  await startSauceStep(page);
  const before = await doughBox(page);

  // one sauce: exactly the single heatmap + its overflow canvas (the historical DOM)
  await paint(page, { x: 22, y: 50 }, { x: 52, y: 50 }, 1500);
  await expect(page.locator("canvas.pizza-sauce-heatmap")).toHaveCount(2); // heatmap + overflow markers
  await expect(page.locator("canvas[class*='--kind-']")).toHaveCount(0);
  const tomatoAlone = await page.locator("canvas.pizza-sauce-heatmap").first().evaluate((el) => (el as HTMLCanvasElement).toDataURL());

  await page.getByRole("button", { name: /ジェノベーゼ/ }).click();
  await paint(page, { x: 48, y: 50 }, { x: 78, y: 50 }, 1500);

  // two sauces: one heatmap and one overflow canvas per kind, the first laid at the bottom
  const kinds = await page.locator("canvas.pizza-sauce-heatmap").evaluateAll((els) =>
    els.map((el) => (el.className.match(/--kind-([a-z-]+)/) ?? [])[1]),
  );
  expect(kinds).toEqual(["tomato-sauce", "pesto", "tomato-sauce", "pesto"]); // heatmaps in layer order, then the markers

  const tomato = await layerStats(page, "tomato-sauce");
  const pesto = await layerStats(page, "pesto");
  expect(tomato.painted).toBeGreaterThan(200);
  expect(pesto.painted).toBeGreaterThan(200);
  // each layer is its own sauce's colour: tomato red, pesto green
  expect(tomato.r).toBeGreaterThan(tomato.g + 20);
  expect(pesto.g).toBeGreaterThan(pesto.r + 10);
  // positions kept: tomato was painted on the left, pesto on the right, and they overlap in the middle
  expect(tomato.alphaLeft).toBeGreaterThan(40);
  expect(tomato.alphaRight).toBeLessThan(24);
  expect(pesto.alphaRight).toBeGreaterThan(40);
  expect(pesto.alphaLeft).toBeLessThan(24);
  expect(tomato.alphaCentre).toBeGreaterThan(40);
  expect(pesto.alphaCentre).toBeGreaterThan(40);
  // the first layer is not repainted when the second sauce is laid
  const tomatoAfter = await page.locator("canvas.pizza-sauce-heatmap--kind-tomato-sauce").first().evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  expect(tomatoAfter).toBe(tomatoAlone);

  // layout: the pizza is exactly where it was, the page does not scroll sideways, nothing sits outside the viewport
  const after = await doughBox(page);
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  const vw = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);

  if (SHOT_DIR) {
    const name = test.info().project.name;
    await page.screenshot({ path: `${SHOT_DIR}/${name}-two-sauces-alpha.png` });
    // comparison for the Owner only (not shipped): the same pizza with a multiply blend on the layers
    await page.addStyleTag({ content: "canvas.pizza-sauce-heatmap[class*='--kind-'] { mix-blend-mode: multiply; }" });
    await page.screenshot({ path: `${SHOT_DIR}/${name}-two-sauces-multiply.png` });
  }
});

test("switching back adds to the first layer and keeps three kinds in order; the layers follow the pizza to the next step", async ({ page }) => {
  await startSauceStep(page);
  await paint(page, { x: 25, y: 38 }, { x: 45, y: 38 }, 1000);
  await page.getByRole("button", { name: /ジェノベーゼ/ }).click();
  await paint(page, { x: 45, y: 55 }, { x: 70, y: 55 }, 1000);
  await page.getByRole("button", { name: /オリーブオイル/ }).click();
  await paint(page, { x: 30, y: 70 }, { x: 60, y: 70 }, 1000);
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paint(page, { x: 25, y: 45 }, { x: 45, y: 45 }, 800); // back to tomato: the bottom layer grows, it does not move

  const heatKinds = async () =>
    page.locator("canvas.pizza-sauce-heatmap").evaluateAll((els) => els.map((el) => (el.className.match(/--kind-([a-z-]+)/) ?? [])[1]));
  expect((await heatKinds()).slice(0, 3)).toEqual(["tomato-sauce", "pesto", "olive-oil"]);

  await page.getByRole("button", { name: /次へ/ }).click(); // SAUCE -> CHEESE
  expect((await heatKinds()).slice(0, 3)).toEqual(["tomato-sauce", "pesto", "olive-oil"]);
  expect(await page.locator(".pizza-sauce-oil-sheen").count()).toBe(1);
});
