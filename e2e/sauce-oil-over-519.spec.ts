import { expect, test, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, tapDoughPercent } from "./gestures";
import { base, openWith } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Issue #519 / #521 S1: olive oil laid OVER another sauce must not look like it replaced it. The Owner's order is tomato -> olive oil.
 *
 * Every number here is read from the RENDERED PAGE (a screenshot of the dough, CSS filters and bake tint included), never from the sauce
 * canvases' own pixels: the oil canvas carries a CSS filter (saturate / contrast) that turns its pale swatch into an opaque lime-yellow, and the
 * canvas pixels do not show that. (`sauce-layers-b2.spec.ts` reads canvas pixels, which is why it could not see this.)
 *
 * Sample points are fractions of the dough box: tomato is painted 22% -> 50%, oil 42% -> 74% (same row), so
 *   0.16 = tomato only (its soft edge) | 0.46 = the overlap | 0.84 = oil only | (0.5, 0.18) = bare dough.
 */
const OWNED = ["tomato-sauce", "pesto", "olive-oil", "mozzarella", "basil"];
/** With S1_SHOT_DIR set, the tomato -> oil test also saves the rendered dough (Owner's visual comparison) and prints the samples. */
const SHOT_DIR = process.env.S1_SHOT_DIR;
type Rgb = [number, number, number];
interface Samples {
  tomato: Rgb;
  overlap: Rgb;
  oil: Rgb;
  dough: Rgb;
}

async function start(page: Page) {
  const { width, height } = page.viewportSize()!;
  await openWith(page, width, height, base(OWNED));
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await expect(page.locator(".pizza-dough--interactive")).toBeVisible();
}

async function paint(page: Page, from: number, to: number, ms = 1300) {
  const b = (await page.locator(".pizza-dough--interactive").boundingBox())!;
  const at = (p: number) => ({ x: b.x + (p / 100) * b.width, y: b.y + 0.5 * b.height });
  const a = at(from);
  const z = at(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i += 1) {
    await page.mouse.move(a.x + ((z.x - a.x) * i) / 12, a.y);
    await page.waitForTimeout(ms / 12);
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/** Colours at the sample points of the rendered dough (a real screenshot of its box). */
/** The dough that carries the sauce canvases (on RESULT there can be other `.pizza-dough` boxes -- thumbnails, reference -- so `.first()` is not safe). */
const sauceDough = (page: Page) => page.locator(".pizza-dough:has(canvas.pizza-sauce-heatmap)").first();

async function sample(page: Page): Promise<Samples> {
  await expect(sauceDough(page)).toBeVisible();
  const box = (await sauceDough(page).boundingBox())!;
  const png = await page.screenshot({ clip: box });
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const at = (fx: number, fy: number) => Array.from(ctx.getImageData(Math.round(fx * (c.width - 1)), Math.round(fy * (c.height - 1)), 1, 1).data.slice(0, 3)) as Rgb;
    return { tomato: at(0.16, 0.5), overlap: at(0.46, 0.5), oil: at(0.84, 0.5), dough: at(0.5, 0.18) };
  }, png.toString("base64"));
}

const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const redness = (c: Rgb) => c[0] - c[1];
const sumDiff = (a: Rgb, b: Rgb) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/** "the earlier sauce is still there": the overlap reads as tomato (nearer the tomato-only sample than the oil-only one) and keeps red. */
function expectTomatoStillVisible(s: Samples, label: string) {
  expect(dist(s.overlap, s.tomato), `${label}: overlap nearer to tomato than to oil (${JSON.stringify(s)})`).toBeLessThan(dist(s.overlap, s.oil));
  expect(redness(s.overlap), `${label}: overlap keeps red (${JSON.stringify(s)})`).toBeGreaterThan(redness(s.oil) + 40);
  expect(sumDiff(s.oil, s.dough), `${label}: oil alone stays visible on the dough (${JSON.stringify(s)})`).toBeGreaterThanOrEqual(30);
}

test("#519: tomato then olive oil -- the tomato is still visible under the oil (SAUCE, rendered pixels)", async ({ page }) => {
  await start(page);
  await paint(page, 22, 50);
  const before = await sample(page); // the tomato on its own: the overlap point is plain tomato here
  await page.getByRole("button", { name: /オリーブオイル/ }).click();
  await paint(page, 42, 74);
  const after = await sample(page);
  if (SHOT_DIR) {
    const box = (await sauceDough(page).boundingBox())!;
    await page.screenshot({ path: `${SHOT_DIR}/${test.info().project.name}-tomato-then-oil.png`, clip: box });
    console.log(`SAMPLES ${JSON.stringify({ before, after })}`);
  }
  expectTomatoStillVisible(after, "tomato -> oil");
  // the tomato's own red/green gap at the overlap point keeps most of its size (it was about 0.23 of it before the fix)
  expect(redness(after.overlap)).toBeGreaterThanOrEqual(0.55 * redness(before.overlap));
  // and the sauce the oil was NOT laid over did not change colour
  expect(sumDiff(after.tomato, before.tomato)).toBeLessThanOrEqual(24);
});

test("#519: olive oil then tomato -- the later tomato is on top and reads as tomato", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: /オリーブオイル/ }).click();
  await paint(page, 22, 50);
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paint(page, 42, 74);
  const s = await sample(page);
  // here the tomato is the upper run: the overlap is red, not lime
  expect(redness(s.overlap), JSON.stringify(s)).toBeGreaterThan(60);
});

test("#519: single sauces keep their own look -- tomato, pesto and olive oil each read distinctly on the dough", async ({ page }) => {
  for (const [name, check] of [
    [/トマトソース/, (c: Rgb, d: Rgb) => c[0] - c[1] > 60 && sumDiff(c, d) > 80],
    [/ジェノベーゼ/, (c: Rgb, d: Rgb) => c[1] > c[0] - 20 && sumDiff(c, d) > 40],
    [/オリーブオイル/, (c: Rgb, d: Rgb) => sumDiff(c, d) >= 30],
  ] as const) {
    await start(page);
    await page.getByRole("button", { name }).click();
    await paint(page, 30, 62);
    const s = await sample(page);
    expect(check(s.overlap, s.dough), `${name}: ${JSON.stringify(s)}`).toBe(true);
    // a single sauce never takes the layered path: one heatmap + its overflow canvas, no per-kind classes
    await expect(page.locator("canvas.pizza-sauce-heatmap")).toHaveCount(2);
    await expect(page.locator("canvas[class*='--kind-']")).toHaveCount(0);
  }
});

test("#519: tomato then olive oil stays visible through CHEESE, BAKE and RESULT", async ({ page }) => {
  test.setTimeout(180_000);
  await start(page);
  await paint(page, 22, 50);
  await page.getByRole("button", { name: /オリーブオイル/ }).click();
  await paint(page, 42, 74);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  // cheese well away from the sample row (y = 50)
  await tapDoughPercent(page, 40, 20);
  await tapDoughPercent(page, 60, 80);
  expectTomatoStillVisible(await sample(page), "CHEESE step");
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  await tapDoughPercent(page, 55, 22);
  await tapDoughPercent(page, 45, 78);
  await bakeToTarget(page, { start: 58, end: 72 });
  await expect(page.locator(".result-panel").first()).toBeVisible();
  await page.waitForTimeout(500);
  // the RESULT shows the same layered pizza (baked: the bake tint applies to both layers)
  expectTomatoStillVisible(await sample(page), "RESULT");
});
