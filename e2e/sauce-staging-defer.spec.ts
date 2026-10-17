import { expect, test, type Page } from "@playwright/test";
import { completeDoughStep } from "./gestures";
import { base, openWith } from "./support/familyTray";
import { startTargetlessFreeCook } from "./support/startFreeCook";

/**
 * #524 Owner HV (iPhone Safari: after the oil is painted the tomato layer's canvas holds the oil's pixels). Hypothesis: the sauce canvases shared one 64x64
 * staging canvas as the `drawImage` source, and a GPU canvas reads that source late. Here a browser that reads a 64x64 canvas source at the END of the task
 * is simulated (an init script wraps `drawImage`); every sauce canvas must still hold its own pixels and the tomato must stay red on screen.
 * Red on the shared-staging code (verified), green with a staging surface per canvas. A model of the hypothesis, not proof about the device.
 */
const OWNED = ["tomato-sauce", "pesto", "olive-oil", "mozzarella", "basil"];

async function lateRead(page: Page) {
  await page.addInitScript(() => {
    const orig = CanvasRenderingContext2D.prototype.drawImage as (...a: unknown[]) => void;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
      const src = args[0];
      if (src instanceof HTMLCanvasElement && src.width === 64 && src.height === 64) {
        queueMicrotask(() => orig.apply(this, args)); // the source is read after the synchronous commit finished
        return;
      }
      return orig.apply(this, args);
    } as typeof CanvasRenderingContext2D.prototype.drawImage;
  });
}

async function paint(page: Page, x0: number, x1: number, y: number) {
  const b = (await page.locator(".pizza-dough--interactive").boundingBox())!;
  await page.mouse.move(b.x + x0 * b.width, b.y + y * b.height);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) {
    await page.mouse.move(b.x + (x0 + ((x1 - x0) * i) / 16) * b.width, b.y + y * b.height);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  await page.waitForTimeout(600);
}

/** alpha masks of the heat canvases (the first two canvases of the dough once two sauces are on it) */
const masks = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll(".pizza-dough canvas"))
      .slice(0, 2)
      .map((el) => {
        const c = el as HTMLCanvasElement;
        const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        let px = 0;
        let h = 0x811c9dc5;
        for (let i = 3; i < d.length; i += 4) {
          const on = d[i] > 8 ? 1 : 0;
          px += on;
          h = Math.imul(h ^ on, 0x01000193) >>> 0;
        }
        return { px, h };
      }),
  );

async function tomatoThenOil(page: Page) {
  const { width, height } = page.viewportSize()!;
  await openWith(page, width, height, base(OWNED));
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paint(page, 0.2, 0.5, 0.4);
  await page.getByRole("button", { name: /オリーブオイル/ }).click();
  await paint(page, 0.55, 0.8, 0.65);
}

test("#524: with a canvas that reads its drawImage source late, the tomato canvas and the oil canvas still hold their OWN pixels", async ({ page }) => {
  await lateRead(page);
  await tomatoThenOil(page);
  const [tomato, oil] = await masks(page);
  expect(tomato.px, "tomato canvas is not empty").toBeGreaterThan(500);
  expect(oil.px, "oil canvas is not empty").toBeGreaterThan(500);
  expect(tomato.h, `the two canvases do not hold the same mask (the symptom: ${JSON.stringify({ tomato, oil })})`).not.toBe(oil.h);
});

test("#524: ...and the tomato stays red on the screen (rendered pixels)", async ({ page }) => {
  await lateRead(page);
  await tomatoThenOil(page);
  const dough = page.locator(".pizza-dough:has(canvas.pizza-sauce-heatmap)").first();
  const box = (await dough.boundingBox())!;
  const png = await page.screenshot({ clip: box });
  const [r, g] = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    // the tomato was painted over x 20..50 %, y 40 % of the dough box: sample its middle (35 %, 40 %)
    const p = ctx.getImageData(Math.round(0.35 * (c.width - 1)), Math.round(0.4 * (c.height - 1)), 1, 1).data;
    return [p[0], p[1]];
  }, png.toString("base64"));
  expect(r - g, "red-green gap of the tomato's middle").toBeGreaterThan(60);
});

test("#524: without the late-read simulation the same flow still gives two different canvases (no behaviour change)", async ({ page }) => {
  await tomatoThenOil(page);
  const [tomato, oil] = await masks(page);
  expect(tomato.h).not.toBe(oil.h);
  expect(tomato.px).toBeGreaterThan(500);
});
