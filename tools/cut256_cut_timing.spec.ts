import { expect, test, type Page } from "@playwright/test";
import {
  completeDoughStep,
  enterBakePaused,
  landNeedleAndTakeOut,
  paintSauceRing,
  startFreshMargherita,
  startLunchRushMission,
  tapDoughPercent,
} from "./gestures";

/**
 * Issue #256 Implementation Gate: CUT timing + applicability measurement (read-only tool; not part
 * of the suite). Copy to e2e/ of a main checkout (51e0923 or later) and run:
 *   CUT256_OUT=<file.jsonl> npx playwright test e2e/cut256_cut_timing.spec.ts --project=iphone-390x844
 *
 * For Guided and Lunch Rush margherita (bakeTarget 60-80, Completion Gate band 50-90) it bakes at
 *   3 (UNDERBAKED), 55 (badge 生焼け but PASS), 70 (perfect), 85 (badge 焦げ but PASS), 98 (OVERBAKED)
 * and records whether CUT appears and how long the CUT step takes end to end:
 *   - "auto": the E2E gesture speed (3 drags, 5 mouse steps each) = the UI floor;
 *   - "paced": 450 ms per drag, 650 ms between drags, 350 ms before 切り終わる (a fixed,
 *     human-like pacing; an assumption, not a human measurement).
 * Wall times are Chromium on this container; they bound the UI's own latency, not a player.
 */

const OUT = process.env.CUT256_OUT ?? "cut256-cut-timing.jsonl";
const BAKES = [
  { label: "UNDERBAKED", value: 3 },
  { label: "badge-raw-PASS", value: 55 },
  { label: "perfect", value: 70 },
  { label: "badge-burnt-PASS", value: 85 },
  { label: "OVERBAKED", value: 98 },
] as const;
const PACINGS = {
  auto: { dragMs: 0, gapMs: 0, confirmMs: 0 },
  paced: { dragMs: 450, gapMs: 650, confirmMs: 350 },
} as const;

async function prepareMargherita(page: Page) {
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
  await page.getByRole("button", { name: /バジル/ }).click();
  await tapDoughPercent(page, 45, 55);
  await tapDoughPercent(page, 55, 45);
}

async function cutPaced(page: Page, pacing: (typeof PACINGS)[keyof typeof PACINGS]) {
  const box = await page.locator('[data-pizza-drop-target="true"]').boundingBox();
  if (!box) throw new Error("dough missing");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = box.width * 0.46;
  for (const [i, deg] of [0, 60, 120].entries()) {
    if (i > 0 && pacing.gapMs) await page.waitForTimeout(pacing.gapMs);
    const a = (deg * Math.PI) / 180;
    await page.mouse.move(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
    await page.mouse.down();
    const steps = pacing.dragMs ? 15 : 5;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      await page.mouse.move(cx - Math.cos(a) * r + 2 * Math.cos(a) * r * t, cy - Math.sin(a) * r + 2 * Math.sin(a) * r * t);
      if (pacing.dragMs) await page.waitForTimeout(pacing.dragMs / steps);
    }
    await page.mouse.up();
  }
  if (pacing.confirmMs) await page.waitForTimeout(pacing.confirmMs);
}

for (const mode of ["GUIDED", "LUNCH_RUSH"] as const) {
  for (const bake of BAKES) {
    for (const pacingName of Object.keys(PACINGS) as (keyof typeof PACINGS)[]) {
      test(`${mode} ${bake.label} ${pacingName}`, async ({ page }) => {
        test.setTimeout(90_000);
        if (mode === "GUIDED") await startFreshMargherita(page);
        else await startLunchRushMission(page, 900);
        await prepareMargherita(page);
        await enterBakePaused(page);
        await landNeedleAndTakeOut(page, { start: bake.value, end: bake.value });
        const t0 = Date.now();
        const cutButton = page.getByRole("button", { name: /切り終わる/ });
        const resultLocator = mode === "GUIDED" ? page.locator(".result-panel") : page.locator(".mission-serve-panel");
        await expect(cutButton.or(resultLocator).first()).toBeVisible();
        const cutShown = await cutButton.isVisible();
        let cutEnterMs: number | null = null;
        let cutGestureMs: number | null = null;
        let confirmToResultMs: number | null = null;
        if (cutShown) {
          cutEnterMs = Date.now() - t0;
          const g0 = Date.now();
          await cutPaced(page, PACINGS[pacingName]);
          cutGestureMs = Date.now() - g0;
          await expect(cutButton).toBeEnabled();
          const c0 = Date.now();
          await cutButton.click();
          await expect(resultLocator).toBeVisible();
          confirmToResultMs = Date.now() - c0;
        }
        await expect(resultLocator).toBeVisible();
        const failed =
          mode === "GUIDED"
            ? await page.locator(".result-panel--failed").count()
            : await page.locator(".mission-serve-panel--failed").count();
        const record = {
          mode,
          bake: bake.label,
          bakeValue: bake.value,
          pacing: pacingName,
          cutShown,
          completion: failed ? "FAILED" : "PASS",
          cutEnterMs,
          cutGestureMs,
          confirmToResultMs,
          cutStepTotalMs: cutShown ? (cutGestureMs ?? 0) + (confirmToResultMs ?? 0) : 0,
          viewport: page.viewportSize(),
        };
        const fs = await import("node:fs");
        fs.appendFileSync(OUT, `${JSON.stringify(record)}\n`);
      });
    }
  }
}
