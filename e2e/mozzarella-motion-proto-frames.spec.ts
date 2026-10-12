import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { completeDoughStep, enterBakePaused, paintSauceRing, startFreshMargherita, tapDoughPercent } from "./gestures";

/**
 * #421 motion prototype: deterministic frame capture of the whole BAKE sweep (needle 0 -> ~88) at 30 fps of BAKE time (the faked clock is
 * stepped 33 ms per frame, the gauge moves 33.3 pt/s, so 30 fps = real speed). The same file runs against the M1 build and the motion
 * build; scripts compose the frames into the side-by-side comparison video. CSS transitions are switched off for the capture (they run on
 * real time, not the faked clock), so every frame shows the TARGET choreography of that exact needle position, for both builds alike.
 * A capture utility, skipped unless PROTO_FRAMES_DIR is set.
 */
const DIR = process.env.PROTO_FRAMES_DIR;
test.skip(!DIR, "capture utility: set PROTO_FRAMES_DIR");
test.use({ deviceScaleFactor: 2 });
test.setTimeout(240_000);

const FRAME_MS = 33;
const LAST_NEEDLE = 88;

async function flush(page: Page) {
  for (let i = 0; i < 2; i += 1) {
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
}

async function needle(page: Page): Promise<number> {
  await flush(page);
  return page.locator(".bake-gauge__needle").evaluate((el) => Number.parseFloat((el as HTMLElement).style.left) || 0);
}

test("capture the bake sweep frame by frame", async ({ page }) => {
  mkdirSync(DIR!, { recursive: true });
  const size = page.viewportSize()!;
  const tag = `${size.width}x${size.height}`;
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
  if (await page.getByRole("button", { name: /バジル/ }).count()) {
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);
  }
  await enterBakePaused(page);
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; }" });
  // a fixed capture window around the three pieces (with room for the spread), decided once from the raw layout
  const box = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".pizza-cheese--mozzarella")];
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const el of els) {
      const x = el.getBoundingClientRect();
      l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom);
    }
    const pad = 34;
    return { x: Math.max(0, l - pad), y: Math.max(0, t - pad), width: Math.min(innerWidth, r - l + 2 * pad), height: b - t + 2 * pad };
  });
  const meta: Array<{ frame: number; needle: number }> = [];
  for (let frame = 0; frame < 140; frame += 1) {
    const pos = await needle(page);
    if (pos > LAST_NEEDLE) break;
    await page.screenshot({ path: `${DIR}/${tag}-f${String(frame).padStart(3, "0")}.png`, clip: box, scale: "device" });
    meta.push({ frame, needle: Math.round(pos * 10) / 10 });
    await page.clock.runFor(FRAME_MS);
  }
  writeFileSync(`${DIR}/${tag}-meta.json`, JSON.stringify({ box, frames: meta }));
});
