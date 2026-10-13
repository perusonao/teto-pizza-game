import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { cutThreeLines, completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";

/**
 * #421 S2-B2 CUT-cost isolation (NOT a regression test): the CUT -> RESULT phase of the same Margherita round in M1 and the Canvas mozzarella, each with
 * the pieces' SVG relief filter on and off, split into (1) the three cut drags, (2) finishing to RESULT, (3) RESULT standing still. Skipped unless
 * CHEESE_CUT_OUT is set.
 */
const OUT = process.env.CHEESE_CUT_OUT;
const REPS = Number(process.env.CHEESE_CUT_REPS ?? 5);
const VARIANTS = [
  { id: "m1", query: "m1", css: "" },
  { id: "m1-again", query: "m1", css: "" }, // the same as m1: the spread between the two is the run-to-run noise (and drift) of this environment
  { id: "m1-nofilter", query: "m1", css: ".pizza-pieces{filter:none !important}" },
  { id: "c64", query: "c64", css: "" },
  { id: "c64-nofilter", query: "c64", css: ".pizza-pieces{filter:none !important}" },
  { id: "c64-hidden", query: "c64", css: ".pizza-cheese-canvas{visibility:hidden !important}" },
  { id: "c64-nofilter-hidden", query: "c64", css: ".pizza-pieces{filter:none !important}.pizza-cheese-canvas{visibility:hidden !important}" },
] as const;

async function toBake(page: Page, query: string, css: string) {
  await page.addInitScript(() => {
    localStorage.setItem("teto-pizza-save-v1", JSON.stringify({ schemaVersion: 1, dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }], pitzBalance: 0, ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"], missionBest: {} }));
  });
  await page.goto(`/?cheese=${query}&cheesePx=62`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".app-frame");
  if (css) await page.addStyleTag({ content: css });
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
  await page.getByRole("button", { name: /焼く/ }).click();
  await page.waitForSelector(".bake-gauge__needle");
  await page.waitForFunction(() => Number.parseFloat((document.querySelector(".bake-gauge__needle") as HTMLElement | null)?.style.left ?? "0") >= 66, undefined, { polling: "raf" });
  await page.getByRole("button", { name: "取り出す！" }).click();
}

const WANTED = ["Paint", "PrePaint", "Layerize", "UpdateLayoutTree", "Layout", "RasterTask", "ImageDecodeTask", "UpdateLayer", "Commit", "CompositeLayers", "FunctionCall", "GPUTask", "DrawFrame"];

test.describe("S2-B2 CUT isolation", () => {
  test.skip(!OUT, "set CHEESE_CUT_OUT");
  test.describe.configure({ mode: "serial" });
  const results: Array<Record<string, unknown>> = [];
  for (const throttle of [1, 4]) {
    {
      test(`interleaved x${throttle}`, async ({ page, browser }) => {
        test.setTimeout(1_800_000);
        for (let rep = 0; rep < REPS; rep += 1) {
         for (const variant of VARIANTS) {
          await toBake(page, variant.query, variant.css);
          const cdp = await page.context().newCDPSession(page);
          await cdp.send("Performance.enable");
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
          const metric = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
          const phase = async (run: () => Promise<void>) => {
            await browser.startTracing(page, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "cc", "gpu", "viz"] });
            const a = await metric();
            const t0 = Date.now();
            await run();
            const b = await metric();
            const wall = Date.now() - t0;
            const trace = JSON.parse((await browser.stopTracing()).toString()) as { traceEvents: Array<{ name: string; ph: string; dur?: number }> };
            const sums: Record<string, number> = {};
            for (const e of trace.traceEvents) if (e.ph === "X" && e.dur !== undefined && WANTED.includes(e.name)) sums[e.name] = (sums[e.name] ?? 0) + e.dur / 1000;
            return { wall, task: (b.TaskDuration - a.TaskDuration) * 1000, script: (b.ScriptDuration - a.ScriptDuration) * 1000, layout: (b.LayoutDuration - a.LayoutDuration) * 1000, style: (b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000, sums };
          };
          const drags = await phase(async () => { await cutThreeLines(page); });
          const finish = await phase(async () => { await page.getByRole("button", { name: /切り終わる/ }).click(); await expect(page.locator(".result-panel")).toBeVisible(); });
          const idle = await phase(async () => { await page.waitForTimeout(2000); });
          const canvases = await page.locator(".pizza-cheese-canvas").count();
          results.push({ variant: variant.id, throttle, rep, canvases, drags, finish, idle });
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
          writeFileSync(OUT!, JSON.stringify(results));
         }
        }
      });
    }
  }
});
