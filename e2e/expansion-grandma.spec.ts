import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { bakeToTarget, completeDoughStep, tapDoughPercent } from "./gestures";
import { base, openWith } from "./support/familyTray";
import { chipOnTrayOrPin } from "./support/handPick";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * Multi-Sauce S3 (Issue #521): grandma-pizza, the first recipe with TWO required sauces (tomato-sauce + olive-oil), played end to end through the
 * NORMAL flow: SAUCE (tomato -> olive oil, painted by hand) -> CHEESE (mozzarella 3) -> TOPPING (garlic 2) -> BAKE -> RESULT (NEW DISCOVERY) -> Dex.
 *
 * The two layers are read from the RENDERED PAGE (a screenshot of the dough, CSS filters included), like `sauce-oil-over-519.spec.ts`, at the SAUCE step
 * and again on RESULT: the oil laid over the tomato must not make the tomato disappear, and the oil must still change the colour (it is not invisible).
 *
 * Free Cooking judges the bake by the generic window (58-78); grandma's own window is 56-76, so the needle is taken out in their intersection (58-76).
 * Optional output: HV_SCREENSHOT_DIR (screenshots), HV_VIDEO=1 (Playwright video, 390x844 project only).
 */
const SAVE_KEY = "teto-pizza-save-v1";
const OWNED = ["tomato-sauce", "olive-oil", "mozzarella", "garlic"];
const SPOTS: [number, number][] = [[50, 24], [73, 36], [76, 63], [58, 79], [38, 79]];
type Rgb = [number, number, number];

if (process.env.HV_VIDEO) test.use({ video: { mode: "on", size: { width: 390, height: 844 } } });

const bar = (page: Page) => page.locator(".prepare-bake-bar");
const hold = (page: Page, ms = 1400) => page.waitForTimeout(process.env.HV_VIDEO ? ms : 0);
async function capture(page: Page, name: string, project: string) {
  const dir = process.env.HV_SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}-${project}.png` });
}
async function noOverflow(page: Page, where: string) {
  const d = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(d, `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}

/** One hand-painted pass over the dough: concentric rings, so the sauce clears the Completion Gate's quantity / coverage floor. */
async function paintRings(page: Page, radii: readonly number[], msPerRing = 700) {
  const b = (await page.locator(".pizza-dough--interactive").boundingBox())!;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const at = (r: number, a: number) => ({ x: cx + Math.cos(a) * (r / 100) * b.width, y: cy + Math.sin(a) * (r / 100) * b.height });
  const start = at(radii[0], 0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const r of radii) {
    const steps = 24;
    for (let i = 0; i <= steps; i += 1) {
      const p = at(r, (i / steps) * Math.PI * 2);
      await page.mouse.move(p.x, p.y);
      await page.waitForTimeout(msPerRing / steps);
    }
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/** The dough that carries the sauce canvases (on RESULT other `.pizza-dough` boxes exist: thumbnails, the reference). */
const sauceDough = (page: Page) => page.locator(".pizza-dough:has(canvas.pizza-sauce-heatmap)").first();

/** Rendered colour at the dough's centre and at its bare edge-free dough corner region. */
async function sample(page: Page): Promise<{ centre: Rgb; dough: Rgb }> {
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
    return { centre: at(0.5, 0.5), dough: at(0.5, 0.06) };
  }, png.toString("base64"));
}
const redness = (c: Rgb) => c[0] - c[1];
const sumDiff = (a: Rgb, b: Rgb) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

async function place(page: Page, chip: RegExp, count: number, startSpot: number) {
  await (await chipOnTrayOrPin(page, chip)).click();
  for (let i = 0; i < count; i += 1) await tapDoughPercent(page, ...SPOTS[(startSpot + i) % SPOTS.length]);
  return startSpot + count;
}

test.describe("grandma-pizza (two sauces, normal flow)", () => {
  test.setTimeout(240_000);

  test("SAUCE tomato -> olive oil -> CHEESE -> TOPPING -> BAKE -> NEW DISCOVERY; both sauces stay visible, no overflow, save v2", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const project = testInfo.project.name;
    const { width, height } = page.viewportSize()!;
    await openWith(page, width, height, base(OWNED));
    await startTargetlessFreeCook(page);
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "ソース", selected: true })).toBeVisible();

    // SAUCE: tomato first (the primary sauce), then olive oil over it.
    await page.getByRole("button", { name: /トマトソース/ }).click();
    await expect(page.locator(".pizza-dough--interactive")).toBeVisible();
    await paintRings(page, [10, 20, 30, 38]);
    const tomatoOnly = await sample(page);
    await hold(page, 1800);
    expect(redness(tomatoOnly.centre), `tomato reads red: ${JSON.stringify(tomatoOnly)}`).toBeGreaterThan(40);
    await page.getByRole("button", { name: /オリーブオイル/ }).click();
    await paintRings(page, [14, 26, 36], 500);
    const layered = await sample(page);
    await noOverflow(page, "SAUCE both sauces");
    await capture(page, "grandma-sauce-both", project);
    await hold(page, 2200);
    // the tomato is still there under the oil (#519), and the oil visibly did something
    expect(redness(layered.centre), `tomato still visible under the oil: ${JSON.stringify({ tomatoOnly, layered })}`).toBeGreaterThanOrEqual(0.4 * redness(tomatoOnly.centre));
    expect(sumDiff(layered.centre, tomatoOnly.centre), `the oil changes the colour: ${JSON.stringify({ tomatoOnly, layered })}`).toBeGreaterThanOrEqual(8);

    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "チーズ", selected: true })).toBeVisible();
    let spot = await place(page, /モッツァレラ/, 3, 0);
    await hold(page, 1800);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await expect(page.getByRole("tab", { name: "具材", selected: true })).toBeVisible();
    spot = await place(page, /にんにく/, 2, spot);
    expect(spot).toBe(5);
    await hold(page, 1800);
    await capture(page, "grandma-topping", project);
    await bakeToTarget(page, { start: 58, end: 76 });
    await page.waitForSelector(".result-panel");

    // RESULT: a NEW DISCOVERY of grandma-pizza, both sauces still readable on the baked pizza.
    const discovery = page.locator(".result-panel--discovery");
    await expect(discovery).toBeVisible();
    await expect(discovery).toContainText("グランマピザ");
    await noOverflow(page, "NEW RECIPE");
    const baked = await sample(page);
    expect(redness(baked.centre), `the baked pizza still reads red: ${JSON.stringify(baked)}`).toBeGreaterThan(0);
    expect(sumDiff(baked.centre, baked.dough), `the sauce is visible on the baked pizza: ${JSON.stringify(baked)}`).toBeGreaterThanOrEqual(20);
    await capture(page, "grandma-new-recipe", project);
    await hold(page, 3000);

    // Dex: the card exists; the save stays schema v2 and holds the new entry.
    await page.getByRole("button", { name: /ホーム/ }).first().click();
    await page.getByRole("button", { name: /ピザ図鑑/ }).first().click();
    await page.waitForSelector(".dex-overlay");
    const card = page.locator(".dex-card").filter({ hasText: "グランマピザ" });
    await expect(card).toHaveCount(1);
    await card.scrollIntoViewIfNeeded();
    await noOverflow(page, "Dex");
    await capture(page, "grandma-dex", project);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SAVE_KEY);
    expect(saved.schemaVersion).toBe(2);
    expect(saved.dex.map((e: { recipeId: string }) => e.recipeId)).toContain("grandma-pizza");
    expect(errors).toEqual([]);
  });

  test("olive oil only (the tomato forgotten) does not pass: no NEW DISCOVERY of grandma-pizza", async ({ page }) => {
    const { width, height } = page.viewportSize()!;
    await openWith(page, width, height, base(OWNED));
    await startTargetlessFreeCook(page);
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /オリーブオイル/ }).click();
    await paintRings(page, [10, 20, 30, 38]);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await place(page, /モッツァレラ/, 3, 0);
    await bar(page).getByRole("button", { name: /次へ/ }).click();
    await place(page, /にんにく/, 2, 3);
    await bakeToTarget(page, { start: 58, end: 76 });
    await page.waitForSelector(".result-panel");
    await expect(page.locator(".result-panel--discovery")).toHaveCount(0);
    await expect(page.locator(".result-panel")).not.toContainText("グランマピザ");
  });
});
