import { devices, expect, test, type Page } from "@playwright/test";
import { completeDoughStep } from "./gestures";
import { base, openWith } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/** DIAGNOSTIC ONLY (#524 Owner HV FAIL): tomato -> olive oil painted at DIFFERENT positions. Prints canvas facts + rendered samples + small JPEGs to the log. Not a regression test. */
type Rgb = [number, number, number];
const dough = (page: Page) => page.locator(".pizza-dough:has(canvas.pizza-sauce-heatmap)").first();

async function paintAt(page: Page, x0: number, x1: number, y: number) {
  const b = (await page.locator(".pizza-dough--interactive").boundingBox())!;
  const a = { x: b.x + x0 * b.width, y: b.y + y * b.height };
  const z = { x: b.x + x1 * b.width, y: a.y };
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) {
    await page.mouse.move(a.x + ((z.x - a.x) * i) / 16, a.y);
    await page.waitForTimeout(60);
  }
  await page.mouse.up();
  await page.waitForTimeout(600);
}

async function report(page: Page, scenario: string, stage: string) {
  const box = (await dough(page).boundingBox())!;
  const png = await page.screenshot({ clip: box });
  const out = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const at = (fx: number, fy: number) => Array.from(ctx.getImageData(Math.round(fx * (c.width - 1)), Math.round(fy * (c.height - 1)), 1, 1).data.slice(0, 3));
    const s = document.createElement("canvas");
    s.width = 200;
    s.height = Math.round((200 * img.height) / img.width);
    s.getContext("2d")!.drawImage(img, 0, 0, s.width, s.height);
    const canvases = Array.from(document.querySelectorAll("canvas.pizza-sauce-heatmap")).map((el) => {
      const cv = el as HTMLCanvasElement;
      const px = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 8) n++;
      const cs = getComputedStyle(cv);
      return { kind: /kind-([a-z-]+)/.exec(cv.className)?.[1] ?? "single", oil: cv.className.includes("--oil"), opaquePx: n, w: cv.width, op: cs.opacity, vis: cs.visibility, disp: cs.display, filter: cs.filter.slice(0, 40) };
    });
    return { samples: { tomato: at(0.35, 0.4), oil: at(0.68, 0.65), dough: at(0.5, 0.12) }, jpeg: s.toDataURL("image/jpeg", 0.6), canvases };
  }, png.toString("base64"));
  console.log(`DIAG ${scenario} ${stage} ${JSON.stringify({ samples: out.samples, canvases: out.canvases })}`);
  console.log(`IMG ${scenario} ${stage} ${out.jpeg}`);
  return out.samples as { tomato: Rgb; oil: Rgb; dough: Rgb };
}

async function run(page: Page, scenario: string) {
  await openWith(page, 390, 844, base(["tomato-sauce", "pesto", "olive-oil", "mozzarella", "basil"]));
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await page.waitForTimeout(500);
  await paintAt(page, 0.2, 0.5, 0.4);
  const s1 = await report(page, scenario, "1-tomato");
  await page.getByRole("button", { name: /オリーブオイル/ }).click();
  await page.waitForTimeout(800);
  await report(page, scenario, "2-oil-selected");
  await paintAt(page, 0.55, 0.8, 0.65);
  const s3 = await report(page, scenario, "3-oil-painted-elsewhere");
  // isolate: hide the oil canvases / drop only their CSS filter, and read the tomato again
  await page.evaluate(() => document.querySelectorAll("canvas.pizza-sauce-heatmap--oil").forEach((e) => ((e as HTMLElement).style.visibility = "hidden")));
  await page.waitForTimeout(300);
  const s4 = await report(page, scenario, "4-oil-canvases-hidden");
  await page.evaluate(() => document.querySelectorAll("canvas.pizza-sauce-heatmap--oil").forEach((e) => { (e as HTMLElement).style.visibility = ""; (e as HTMLElement).style.filter = "none"; }));
  await page.waitForTimeout(300);
  await report(page, scenario, "5-oil-filter-none");
  console.log(`VERDICT ${scenario} tomato(before)=${s1.tomato} tomato(after oil)=${s3.tomato} tomato(oil hidden)=${s4.tomato}`);
  expect(true).toBe(true);
}

test.describe("desktop viewport", () => {
  test("nonoverlap", async ({ page }) => run(page, "desktop-dpr1"));
});
test.describe("iPhone 13 emulation", () => {
  test.use({ userAgent: devices["iPhone 13"].userAgent, deviceScaleFactor: 3, isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
  test("nonoverlap", async ({ page }) => run(page, "iphone13-dpr3"));
});
