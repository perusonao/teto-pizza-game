import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { cutThreeLines, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * #421 S2-B performance capture (NOT a regression test): main-thread cost and frame times of the same Margherita round in M1 and the two Canvas
 * mozzarella modes, at 1x and 4x CPU throttle (a rough stand-in for a phone), in real time. Skipped unless CHEESE_PERF_OUT is set.
 */
const OUT = process.env.CHEESE_PERF_OUT;
const MODES = ["m1", "c64", "c96"] as const;
const REPS = Number(process.env.CHEESE_PERF_REPS ?? 3);

async function prepareToBake(page: Page, mode: string) {
  await page.addInitScript(() => {
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify({
      schemaVersion: 1,
      dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }],
      pitzBalance: 0,
      ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
      missionBest: {},
    }));
  });
  await page.goto(`/?cheese=${mode}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ピザを作る/ }).click();
  await page.getByRole("button", { name: /マルゲリータ、/ }).click();
  await page.getByRole("button", { name: /このピザを作る/ }).click();
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  for (const [x, y] of [[40, 50], [60, 50], [50, 30]]) await tapDoughPercent(page, x, y);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /バジル/ }).click();
  for (const [x, y] of [[45, 55], [55, 45]]) await tapDoughPercent(page, x, y);
  await page.waitForTimeout(600);
}

const SAMPLER = () => {
  const w = window as unknown as { __frames: number[]; __stop: boolean };
  w.__frames = [];
  w.__stop = false;
  let last = performance.now();
  const tick = (t: number) => {
    w.__frames.push(t - last);
    last = t;
    if (!w.__stop) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

test.describe("S2-B perf capture", () => {
  test.skip(!OUT, "set CHEESE_PERF_OUT");
  test.describe.configure({ mode: "serial" });
  const results: Array<Record<string, unknown>> = [];
  for (const throttle of [1, 4]) {
    for (const mode of MODES) {
      test(`perf ${mode} x${throttle}`, async ({ page, browser }) => {
        test.setTimeout(180_000);
        for (let rep = 0; rep < REPS; rep += 1) {
          await prepareToBake(page, mode);
          const cdp = await page.context().newCDPSession(page);
          await cdp.send("Performance.enable");
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
          const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
          await browser.startTracing(page, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "cc", "gpu", "viz"] });
          await page.evaluate(SAMPLER);
          const m0 = await metrics();
          await page.getByRole("button", { name: /焼く/ }).click();
          await page.waitForSelector(".bake-gauge__needle");
          // BAKE in real time: take out as the needle enters the target window (60-80)
          await page.waitForFunction(() => Number.parseFloat((document.querySelector(".bake-gauge__needle") as HTMLElement | null)?.style.left ?? "0") >= 66, undefined, { polling: "raf" });
          await page.getByRole("button", { name: "取り出す！" }).click();
          const m1 = await metrics();
          const bakeFrames = await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames.slice());
          await page.evaluate(() => { (window as unknown as { __frames: number[] }).__frames = []; });
          const t0 = Date.now();
          await cutThreeLines(page);
          await page.getByRole("button", { name: /切り終わる/ }).click();
          await expect(page.locator(".result-panel")).toBeVisible();
          const cutMs = Date.now() - t0;
          await page.waitForTimeout(400);
          const m2 = await metrics();
          await page.waitForTimeout(2000); // RESULT standing still
          const m3 = await metrics();
          const cutFrames = await page.evaluate(() => { const w = window as unknown as { __frames: number[]; __stop: boolean }; w.__stop = true; return w.__frames.slice(); });
          const trace = JSON.parse((await browser.stopTracing()).toString()) as { traceEvents: Array<{ name: string; ph: string; dur?: number; tid: number; pid: number }> };
          const sums: Record<string, number> = {};
          for (const e of trace.traceEvents) {
            if (e.ph !== "X" || e.dur === undefined) continue;
            if (["Paint", "PrePaint", "Layerize", "UpdateLayoutTree", "Layout", "RasterTask", "ImageDecodeTask", "FunctionCall", "UpdateLayer", "Commit", "CompositeLayers", "HitTest", "EvaluateScript"].includes(e.name)) sums[e.name] = (sums[e.name] ?? 0) + e.dur / 1000;
          }
          const stat = (xs: number[]) => {
            const s = [...xs].sort((a, b) => a - b);
            return { n: s.length, mean: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length), p50: s[Math.floor(s.length * 0.5)], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1], over25: s.filter((x) => x > 25).length };
          };
          const d = (a: Record<string, number>, b: Record<string, number>, k: string) => (b[k] - a[k]) * 1000;
          results.push({
            mode, throttle, rep, cutMs,
            bake: { frames: stat(bakeFrames.slice(2)), taskMs: d(m0, m1, "TaskDuration"), scriptMs: d(m0, m1, "ScriptDuration"), layoutMs: d(m0, m1, "LayoutDuration"), styleMs: d(m0, m1, "RecalcStyleDuration") },
            cut: { frames: stat(cutFrames), taskMs: d(m1, m2, "TaskDuration"), scriptMs: d(m1, m2, "ScriptDuration"), layoutMs: d(m1, m2, "LayoutDuration"), styleMs: d(m1, m2, "RecalcStyleDuration") },
            resultIdleTaskMs: d(m2, m3, "TaskDuration"),
            traceMs: sums,
          });
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        }
        writeFileSync(OUT!, JSON.stringify(results));
      });
    }
  }

  test("cold generation in the browser (first pool of a seed: geometry + first render), 1x and 4x CPU throttle", async ({ page }) => {
    test.setTimeout(180_000);
    const cold: Record<string, unknown> = {};
    await page.goto("/");
    const cdp = await page.context().newCDPSession(page);
    for (const throttle of [1, 4]) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
      cold[`x${throttle}`] = await page.evaluate(async () => {
        const mod = await import("/teto-pizza-game/src/logic/cheesePool.ts");
        const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))];
        const out: Record<string, { first: number[]; geo: number[]; draw: number[] }> = {};
        for (const grid of [64, 96] as const) {
          for (let i = 0; i < 30; i += 1) { mod.clearCheesePoolCaches(); mod.renderCheesePool(`w${i}`, 1, 0.5, 0, { grid }); }
          const first: number[] = [], geo: number[] = [], draw: number[] = [];
          for (let i = 0; i < 200; i += 1) {
            mod.clearCheesePoolCaches();
            const seed = `mozzarella:${i}:${(i * 7) % 100}`;
            let t = performance.now();
            mod.getCheesePoolGeometry(seed, grid);
            geo.push(performance.now() - t);
            t = performance.now();
            mod.renderCheesePool(seed, 0.8, 0.4, 0, { grid });
            draw.push(performance.now() - t);
            first.push(geo[geo.length - 1] + draw[draw.length - 1]);
          }
          out[`g${grid}`] = { first: [q(first, 0.5), q(first, 0.95), Math.max(...first)], geo: [q(geo, 0.5), q(geo, 0.95), Math.max(...geo)], draw: [q(draw, 0.5), q(draw, 0.95), Math.max(...draw)] } as never;
        }
        return out;
      });
    }
    writeFileSync(`${OUT}.cold.json`, JSON.stringify(cold));
  });
});
