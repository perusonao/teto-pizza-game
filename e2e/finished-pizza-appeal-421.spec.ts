import { test, expect, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  cutThreeLines,
  completeDoughStep,
  enterBakePaused,
  landNeedleAndTakeOut,
  paintSauceRing,
  startFreshMargherita,
  tapDoughPercent,
} from "./gestures";

/**
 * #421 (Finished Pizza Appetite Appeal, Pilot): real-browser check of the new bake layers (mozzarella
 * melt/brown, sauce tint, crust blotches) across PREPARE -> BAKE 70% / ~97% -> CUT -> RESULT.
 * Every state is attached as a screenshot (and written to $SHOT_DIR when set), the CUT / RESULT
 * layers are asserted to exist per piece and to stay inside the pizza stage, and a coarse frame-time
 * measurement is taken under CPU throttling (Chromium only) as evidence for the piece-duplication cost.
 */

const MARGHERITA_BAKE = { start: 60, end: 80 };
const NEEDLE_SPEED = 55; // pt/s, BakeOverlay

async function shot(page: Page, testInfo: TestInfo, name: string) {
  const buffer = await page.locator(".pizza-stage").first().screenshot();
  await testInfo.attach(name, { body: buffer, contentType: "image/png" });
  const dir = process.env.SHOT_DIR;
  if (dir) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${testInfo.project.name}-${name}.png`), buffer);
  }
}

async function needlePosition(page: Page) {
  return page.locator(".bake-gauge__needle").evaluate((el) => Number.parseFloat((el as HTMLElement).style.left) || 0);
}

/** Runs the (paused) virtual clock forward until the rising needle reaches `target` (+/- 3 pt). */
async function advanceNeedleTo(page: Page, target: number) {
  for (let i = 0; i < 4; i += 1) {
    await page.waitForTimeout(0);
    const position = await needlePosition(page);
    if (Math.abs(position - target) <= 3) return position;
    expect(position).toBeLessThan(target);
    await page.clock.runFor(Math.max(1, Math.round(((target - position) / NEEDLE_SPEED) * 1000)));
  }
  return needlePosition(page);
}

async function buildToBake(page: Page) {
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
  await tapDoughPercent(page, 50, 70);
  await page.getByRole("button", { name: /次へ/ }).click();
  if (await page.getByRole("button", { name: /バジル/ }).count()) {
    await page.getByRole("button", { name: /バジル/ }).click();
    await tapDoughPercent(page, 45, 55);
    await tapDoughPercent(page, 55, 45);
  }
}

/** Every new layer must exist, be non-empty, and lie inside the pizza stage (no spill / shift). */
async function expectLayersInsideStage(page: Page, expectedPieces?: number) {
  const stage = (await page.locator(".pizza-stage").first().boundingBox())!;
  const slack = 70; // pieces separate outward by a few px; the stage itself has padding for it
  for (const selector of [".pizza-bake-overlay--crust", ".pizza-bake-overlay--sauce", ".pizza-cheese--meltable"]) {
    const boxes = await page.locator(selector).evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }),
    );
    expect(boxes.length, `${selector} count`).toBeGreaterThan(0);
    if (expectedPieces) expect(boxes.length, `${selector} per piece`).toBeGreaterThanOrEqual(expectedPieces);
    for (const b of boxes) {
      expect(b.w, `${selector} width`).toBeGreaterThan(0);
      expect(b.h, `${selector} height`).toBeGreaterThan(0);
      expect(b.x, `${selector} left`).toBeGreaterThanOrEqual(stage.x - slack);
      expect(b.y, `${selector} top`).toBeGreaterThanOrEqual(stage.y - slack);
      expect(b.x + b.w, `${selector} right`).toBeLessThanOrEqual(stage.x + stage.width + slack);
      expect(b.y + b.h, `${selector} bottom`).toBeLessThanOrEqual(stage.y + stage.height + slack);
    }
  }
}

test.describe("#421 finished pizza appeal: PREPARE / BAKE / CUT / RESULT", () => {
  test("layers appear with bake progress, survive CUT and RESULT, and stay inside the stage", async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    await buildToBake(page);

    // PREPARE (before 焼く): no bake layers at all.
    await shot(page, testInfo, "1-before-bake");
    await expect(page.locator(".pizza-bake-overlay--sauce")).toHaveCount(0);
    await expect(page.locator(".pizza-bake-overlay--crust")).toHaveCount(0);
    await expect(page.locator(".pizza-cheese--meltable").first()).toHaveCSS("--melt", "");

    await enterBakePaused(page);
    const at70 = await advanceNeedleTo(page, 70);
    expect(Math.abs(at70 - 70)).toBeLessThanOrEqual(3);
    await expect(page.locator(".pizza-bake-overlay--sauce")).toHaveCount(1);
    await expect(page.locator(".pizza-bake-overlay--crust")).toHaveCount(1);
    const melt70 = Number(await page.locator(".pizza-cheese--meltable").first().evaluate((e) => (e as HTMLElement).style.getPropertyValue("--melt")));
    expect(melt70).toBeGreaterThan(0.9);
    await shot(page, testInfo, "2-bake-70");

    await advanceNeedleTo(page, 97);
    await shot(page, testInfo, "3-bake-97");

    // Back down to the target centre (the needle bounces) and take it out -> CUT.
    await landNeedleAndTakeOut(page, MARGHERITA_BAKE);
    await expect(page.getByRole("button", { name: /切り終わる/ })).toBeVisible();
    await shot(page, testInfo, "4-cut-before-lines");
    await cutThreeLines(page);
    await expect(page.locator(".pizza-cut-mark")).toHaveCount(3);
    const pieces = Number(await page.locator(".pizza-pieces").first().getAttribute("data-piece-count"));
    expect(pieces).toBeGreaterThanOrEqual(6);
    await expectLayersInsideStage(page, pieces);
    await shot(page, testInfo, "5-cut-pieces");

    await page.getByRole("button", { name: /切り終わる/ }).click();
    await expect(page.locator(".result-panel")).toBeVisible();
    await expectLayersInsideStage(page, pieces);
    await shot(page, testInfo, "6-result");

    // No horizontal page overflow introduced by the layers.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("CUT repaint cost with vs without the #421 layers, 6x CPU throttle (Chromium only; evidence, loose bound)", async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== "chromium", "CDP metrics / CPU throttling are Chromium-only");
    test.setTimeout(150_000);
    await buildToBake(page);
    await enterBakePaused(page);
    await landNeedleAndTakeOut(page, MARGHERITA_BAKE);
    await cutThreeLines(page);
    await expect(page.locator(".pizza-cut-mark")).toHaveCount(3);

    const client = await page.context().newCDPSession(page);
    await client.send("Performance.enable");
    await client.send("Emulation.setCPUThrottlingRate", { rate: 6 });

    const taskMs = async () => {
      const { metrics } = await client.send("Performance.getMetrics");
      const get = (n: string) => metrics.find((m) => m.name === n)?.value ?? 0;
      return (get("TaskDuration") + 0) * 1000;
    };
    /** Mean main-thread task time per frame while the piece group is invalidated every frame. */
    const measure = async () => {
      const before = await taskMs();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const el = document.querySelector<HTMLElement>(".pizza-pieces")!;
            let n = 0;
            const tick = () => {
              el.style.opacity = n % 2 ? "0.999" : "1";
              if (++n < 60) requestAnimationFrame(tick);
              else resolve();
            };
            requestAnimationFrame(tick);
          }),
      );
      return ((await taskMs()) - before) / 60;
    };

    await measure(); // warm-up
    const withLayers = await measure();
    await page.addStyleTag({
      content: `.pizza-bake-overlay--sauce, .pizza-bake-overlay--crust { display: none !important }
        .pizza-cheese--meltable::before, .pizza-cheese--meltable::after { display: none !important }`,
    });
    const withoutLayers = await measure();
    await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    const description = `with ${withLayers.toFixed(2)} ms/frame vs without ${withoutLayers.toFixed(2)} ms/frame (6x throttle, ${await page.locator(".pizza-piece").count()} pieces)`;
    testInfo.annotations.push({ type: "repaint-cost", description });
    console.log(`[#421] ${testInfo.project.name}: ${description}`);
    expect(withLayers).toBeLessThan(40);
  });
});
