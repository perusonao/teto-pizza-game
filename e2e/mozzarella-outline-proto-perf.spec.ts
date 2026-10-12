import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { completeDoughStep, enterBakePaused, paintSauceRing, startFreshMargherita, tapDoughPercent } from "./gestures";

/**
 * #421 outline prototype: a rough rendering-cost measurement of the mozzarella during BAKE (Chromium tracing, software raster in
 * headless CI-like conditions, NOT an iPhone). The same file runs against the M1 build and each prototype build. It steps the faked clock in
 * 16 ms frames across the whole bake (needle 0 -> ~80), so the cheese's style changes every frame, and sums the main-thread / raster
 * trace events. Skipped unless PROTO_PERF_DIR is set.
 */
const DIR = process.env.PROTO_PERF_DIR;
test.skip(!DIR, "measurement utility: set PROTO_PERF_DIR");
test.use({ deviceScaleFactor: 3 });
test.setTimeout(180_000);

const FRAMES = 150;
const NAMES = ["Paint", "PrePaint", "Layerize", "UpdateLayoutTree", "RasterTask", "Decode LazyPixelRef"];

async function flush(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const c = new MessageChannel();
        c.port1.onmessage = () => {
          c.port1.close();
          resolve();
        };
        c.port2.postMessage(null);
      }),
  );
}

test("trace mozzarella rendering cost during bake", async ({ page, browser }) => {
  mkdirSync(DIR!, { recursive: true });
  const size = page.viewportSize()!;
  await startFreshMargherita(page);
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  await enterBakePaused(page);
  await browser.startTracing(page, { categories: ["devtools.timeline", "cc", "disabled-by-default-devtools.timeline"] });
  for (let i = 0; i < FRAMES; i += 1) {
    await page.clock.runFor(16);
    await flush(page);
    await page.waitForTimeout(8); // let the compositor produce the frame
  }
  const buf = await browser.stopTracing();
  const parsed = JSON.parse(buf.toString());
  const events: Array<{ name: string; ph: string; dur?: number }> = Array.isArray(parsed) ? parsed : parsed.traceEvents;
  const totals: Record<string, { ms: number; n: number }> = {};
  for (const e of events) {
    if (e.ph !== "X" || !e.dur || !NAMES.includes(e.name)) continue;
    totals[e.name] ??= { ms: 0, n: 0 };
    totals[e.name].ms += e.dur / 1000;
    totals[e.name].n += 1;
  }
  const shadowLayers = await page.locator(".pizza-cheese--mozzarella").first().evaluate((el) => getComputedStyle(el).boxShadow.replace(/rgba?\([^)]*\)/g, "C").split(",").length);
  writeFileSync(`${DIR}/perf-${size.width}x${size.height}-${Date.now()}.json`, JSON.stringify({ frames: FRAMES, totals, shadowLayers }));
});
