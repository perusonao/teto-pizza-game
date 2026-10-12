import { test, type Page } from "@playwright/test";
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
 * #421 outline prototype: a same-conditions capture of the baked mozzarella (stage shots + a close-up of the three pieces + CUT +
 * RESULT) for the before/after comparison. A capture utility, not an assertion suite: it is skipped unless PROTO_SHOTS_DIR is set.
 * The identical file is run against the M1 build and the prototype build, so only the cheese rendering differs.
 */
const DIR = process.env.PROTO_SHOTS_DIR;
test.skip(!DIR, "capture utility: set PROTO_SHOTS_DIR");
test.use({ deviceScaleFactor: 3 });
test.setTimeout(120_000);

const STAGES: ReadonlyArray<{ name: string; needle: number }> = [
  { name: "1-raw", needle: 0 },
  { name: "2-melting", needle: 56 },
  { name: "3-baked", needle: 70 },
  { name: "4-deep", needle: 80 },
  { name: "5-overbaked", needle: 98 },
];

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

async function closeup(page: Page, path: string) {
  const box = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".pizza-cheese--mozzarella")];
    if (els.length === 0) return null;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const el of els) {
      const x = el.getBoundingClientRect();
      l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom);
    }
    return { x: Math.max(0, l - 24), y: Math.max(0, t - 24), width: r - l + 48, height: b - t + 48 };
  });
  if (box) await page.screenshot({ path, clip: box, scale: "device" });
}

/** The mozzarella pieces' bounding boxes in the stage's own CSS-pixel frame, for the ring-brightness measurement in the report. */
async function pieceRects(page: Page, path: string) {
  const rects = await page.evaluate(() => {
    const st = document.querySelector(".pizza-stage")!.getBoundingClientRect();
    return [...document.querySelectorAll(".pizza-cheese--mozzarella")].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - st.left, y: r.top - st.top, w: r.width, h: r.height };
    });
  });
  writeFileSync(path, JSON.stringify(rects));
}

async function build(page: Page) {
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
}

test("capture baked mozzarella stages", async ({ page }) => {
  mkdirSync(DIR!, { recursive: true });
  const size = page.viewportSize()!;
  const tag = `${size.width}x${size.height}`;
  await build(page);
  await enterBakePaused(page);
  for (const { name, needle: target } of STAGES) {
    let pos = await needle(page);
    for (let step = 0; step < 600 && target - pos > 1.5; step += 1) {
      await page.clock.runFor(40);
      pos = await needle(page);
    }
    await page.waitForTimeout(350);
    await flush(page);
    await page.locator(".pizza-stage").screenshot({ path: `${DIR}/${tag}-${name}.png` });
    await closeup(page, `${DIR}/${tag}-${name}-closeup.png`);
    await pieceRects(page, `${DIR}/${tag}-${name}.json`);
  }
});

test("capture CUT and RESULT", async ({ page }) => {
  const size = page.viewportSize()!;
  const tag = `${size.width}x${size.height}`;
  await build(page);
  await enterBakePaused(page);
  await landNeedleAndTakeOut(page, { start: 60, end: 80 });
  await page.waitForSelector(".pizza-stage");
  await cutThreeLines(page);
  await page.locator(".pizza-stage").screenshot({ path: `${DIR}/${tag}-6-cut.png` });
  await page.getByRole("button", { name: /切り終わる/ }).click();
  await page.waitForSelector(".pizza-stage");
  await page.locator(".pizza-stage").screenshot({ path: `${DIR}/${tag}-7-result.png` });
  await closeup(page, `${DIR}/${tag}-7-result-closeup.png`);
});
