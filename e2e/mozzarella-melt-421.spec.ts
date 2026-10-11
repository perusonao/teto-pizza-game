import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  completeDoughStep,
  cutThreeLines,
  enterBakePaused,
  landNeedleAndTakeOut,
  paintSauceRing,
  startFreshMargherita,
  tapDoughPercent,
} from "./gestures";

/**
 * Issue #421 (Finished Pizza Appetite Appeal, Pilot): the baked mozzarella must look different from the raw one in
 * SHAPE (outline, spread, ring, local browning), not only in size / tint. Real Chromium at 390x844 and 360x800.
 *
 * The needle is stepped with the faked clock and the stage is captured at fixed needle positions; margherita's
 * `bakeTarget` is { start: 60, end: 80 } (centre 70 = heat 1), so 0 = raw, 56 = melting, 70 = properly baked,
 * 80 = deep brown, 98 = overbaked. Set MELT_SHOTS_DIR to also write the screenshots (the before/after comparison).
 */

const SHOTS_DIR = process.env.MELT_SHOTS_DIR;
// iPhone-like density so the 28 px mozzarella is judged at the resolution the Owner sees it at.
test.use({ deviceScaleFactor: 3 });
// Real WebKit at DPR 3 is slower than Chromium (a full RESULT page capture alone can take seconds); the default 30 s was not enough.
test.setTimeout(120_000);

const BAKE_STAGES: ReadonlyArray<{ name: string; needle: number }> = [
  { name: "1-raw", needle: 0 },
  { name: "2-melting", needle: 56 },
  { name: "3-baked", needle: 70 },
  { name: "4-deep", needle: 80 },
  { name: "5-overbaked", needle: 98 },
];

async function shot(page: Page, name: string) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  const size = page.viewportSize()!;
  await page.locator(".pizza-stage").screenshot({ path: `${SHOTS_DIR}/${name}-${size.width}x${size.height}.png` });
}

async function shotPage(page: Page, name: string) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  const size = page.viewportSize()!;
  await page.screenshot({ path: `${SHOTS_DIR}/${name}-${size.width}x${size.height}.png` });
}

async function flushReactCommit(page: Page) {
  for (let i = 0; i < 2; i += 1) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => {
            channel.port1.close();
            resolve();
          };
          channel.port2.postMessage(null);
        }),
    );
  }
}

async function needlePosition(page: Page): Promise<number> {
  await flushReactCommit(page);
  return page.locator(".bake-gauge__needle").evaluate((el) => Number.parseFloat((el as HTMLElement).style.left) || 0);
}

async function placeEverythingUpToBake(page: Page) {
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
}

/** The mozzarella's own computed look, to assert the shape really changes (not only the colour). */
async function mozzarellaLook(page: Page) {
  return page.locator(".pizza-cheese--mozzarella").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      radius: cs.borderTopLeftRadius,
      boxShadow: cs.boxShadow,
      transform: cs.transform,
      melt: (el as HTMLElement).style.getPropertyValue("--bake-melt"),
    };
  });
}


/** Attaches a small close-up of all the mozzarella pieces to the test report (so a CI WebKit run leaves visible evidence). */
async function attachCloseup(page: Page, name: string) {
  const box = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".pizza-cheese--mozzarella")];
    if (els.length === 0) return null;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const el of els) {
      const x = el.getBoundingClientRect();
      l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom);
    }
    const pad = 30;
    return { x: Math.max(0, l - pad), y: Math.max(0, t - pad), width: r - l + 2 * pad, height: b - t + 2 * pad };
  });
  if (!box) return;
  const size = page.viewportSize()!;
  await test.info().attach(`${name}-${size.width}x${size.height}.png`, { body: await page.screenshot({ clip: box, scale: "css" }), contentType: "image/png" });
}

/** Mean colour of the darkest ~4% of pixels of the first mozzarella (the browning blotches), as actually painted. */
async function darkestSpotColor(page: Page): Promise<{ r: number; g: number; b: number }> {
  const png = await page.locator(".pizza-cheese--mozzarella").first().screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    const px: Array<[number, number, number, number]> = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue; // transparent corners of the rounded box
      px.push([data[i], data[i + 1], data[i + 2], 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]]);
    }
    px.sort((a, b) => a[3] - b[3]);
    const n = Math.max(3, Math.floor(px.length * 0.04));
    const dark = px.slice(0, n);
    const mean = (k: 0 | 1 | 2) => dark.reduce((sum, p) => sum + p[k], 0) / dark.length;
    return { r: mean(0), g: mean(1), b: mean(2) };
  }, png.toString("base64"));
}

test.describe("Mozzarella melt Pilot (#421)", () => {
  test("raw -> melting -> baked -> deep -> overbaked: the cheese changes shape, spread and browning", async ({ page }) => {
    await startFreshMargherita(page);
    await placeEverythingUpToBake(page);
    await enterBakePaused(page);

    const looks: Record<string, Awaited<ReturnType<typeof mozzarellaLook>>> = {};
    let overbakedSpot = { r: 0, g: 0, b: 0 };
    const positions: Record<string, number> = {};
    for (const { name, needle } of BAKE_STAGES) {
      let position = await needlePosition(page);
      // Walk up to the stage's needle position in small closed-loop steps (independent of the gauge's speed / direction, e.g.
      // #419's 7 s one-way gauge) and VERIFY it: a before/after pair is only comparable at the same heat.
      for (let step = 0; step < 600 && needle - position > 1.5; step += 1) {
        await page.clock.runFor(40);
        position = await needlePosition(page);
      }
      positions[name] = Math.round(position * 10) / 10;
      if (needle === 0) expect(position, `${name} needle`).toBeLessThanOrEqual(28); // raw = before the melt starts (heat 0.5 = needle 35)
      else expect(Math.abs(position - needle), `${name} needle ${position}`).toBeLessThanOrEqual(3);
      await page.waitForTimeout(350); // the cheese's own 0.3 s transform/filter transition (real time, clock is faked)
      await flushReactCommit(page);
      looks[name] = await mozzarellaLook(page);
      await shot(page, `bake-${name}`);
      await attachCloseup(page, `bake-${name}`);
      if (name === "5-overbaked") overbakedSpot = await darkestSpotColor(page);
    }

    if (SHOTS_DIR) writeFileSync(`${SHOTS_DIR}/needle-positions-${page.viewportSize()!.width}.json`, JSON.stringify(positions, null, 2));
    // Raw cheese is the unchanged raw look: melt variable at 0 and the original outline.
    expect(Number(looks["1-raw"].melt)).toBeLessThan(0.05);
    // Properly baked: fully melted, and the outline / shadow / transform really differ from raw.
    expect(Number(looks["3-baked"].melt)).toBeGreaterThan(0.95);
    expect(looks["3-baked"].radius).not.toBe(looks["1-raw"].radius);
    expect(looks["3-baked"].boxShadow).not.toBe(looks["1-raw"].boxShadow);
    expect(looks["3-baked"].transform).not.toBe(looks["1-raw"].transform);
    // Overbaked: the blotches are dark and BROWN as painted (red > green > blue), not grey (r ~ g ~ b).
    expect(overbakedSpot.r, JSON.stringify(overbakedSpot)).toBeLessThan(110);
    expect(overbakedSpot.r - overbakedSpot.b, JSON.stringify(overbakedSpot)).toBeGreaterThanOrEqual(14);
    expect(overbakedSpot.r, JSON.stringify(overbakedSpot)).toBeGreaterThan(overbakedSpot.g);
    expect(overbakedSpot.g, JSON.stringify(overbakedSpot)).toBeGreaterThan(overbakedSpot.b);
    // Not just a uniform scale: the matrix is anisotropic once melted.
    const m = /matrix\(([^,]+),[^,]+,[^,]+,([^,]+),/.exec(looks["3-baked"].transform);
    expect(m).not.toBeNull();
    expect(Math.abs(Number(m![1]) - Number(m![2]))).toBeGreaterThan(0.03);
  });

  test("CUT and RESULT keep the baked look in the pieces, and the layout fits the viewport", async ({ page }) => {
    await startFreshMargherita(page);
    await placeEverythingUpToBake(page);
    await enterBakePaused(page);
    await landNeedleAndTakeOut(page, { start: 60, end: 80 });
    await page.waitForSelector(".pizza-stage");

    await shot(page, "cut-0-before-cut");
    await cutThreeLines(page);
    await expect(page.locator(".pizza-pieces")).toHaveCount(1);
    await shot(page, "cut-1-pieces");
    await attachCloseup(page, "cut-1-pieces");
    const cutLook = await mozzarellaLook(page);
    expect(Number(cutLook.melt)).toBeGreaterThan(0.85); // the pieces carry the baked cheese, not the raw one (the needle lands anywhere in 60-80, heat >= 0.857, melt >= 0.89)

    await page.getByRole("button", { name: /切り終わる/ }).click();
    await page.waitForSelector(".pizza-stage");
    await shotPage(page, "result-page");
    await shot(page, "result-stage");
    await attachCloseup(page, "result-stage");
    await test.info().attach(`result-page-${page.viewportSize()!.width}x${page.viewportSize()!.height}.png`, { body: await page.screenshot({ scale: "css" }), contentType: "image/png" });
    const resultLook = await mozzarellaLook(page);
    expect(Number(resultLook.melt)).toBeGreaterThan(0.85);

    const overflow = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth - window.innerWidth,
    }));
    expect(overflow.horizontal).toBeLessThanOrEqual(0);
  });
});
