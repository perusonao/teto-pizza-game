#!/usr/bin/env node
/**
 * FINISH D2-2c F-3 (#597) measurement (dev/test only): how much of the CUT drawing (guide lines / centre marker, drag preview line + knife,
 * partial-cut groove, the one-shot flash, committed cuts) is visible ON a post-bake piece, per bake state. On e2e/harness/finish-hv.html
 * (the real PizzaStage in the real cooking skeleton), with `onguide=1` (post pieces sitting on the 0 / 60 / 120 degree guide lines and the centre).
 *
 *   node tools/finishD22cF3Measure.mjs <baseUrl> <tag> <outDir>      -> <outDir>/<tag>-measure.json (+ prints it)
 *
 * Per scenario: `onPost` = pixels that (a) differ between the screen with and without the cut drawing (.pizza-cut-layer / .pizza-cut-tool-layer
 * hidden) and (b) are covered by a post piece (post pieces alone, on white). `cutPx` = all pixels the cut drawing changes. When the cut
 * drawing is under the post pieces `onPost` is ~0; in front of them it equals the cut drawing's own footprint on the pieces.
 */
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import fs from "node:fs";

const [base, tag, outDir] = process.argv.slice(2);
if (!base || !tag || !outDir) throw new Error("usage: finishD22cF3Measure.mjs <baseUrl> <tag> <outDir>");
fs.mkdirSync(outDir, { recursive: true });
const sharp = createRequire(import.meta.url)("sharp");
const HIDE_CUT = ".pizza-cut-layer,.pizza-cut-tool-layer{visibility:hidden!important}";
const FREEZE = "*{animation-play-state:paused!important}";
const POST_ONLY = `${HIDE_CUT} .pizza-dough{visibility:hidden!important} *{animation:none!important;transition:none!important} html,body,.app-frame,.game-screen{background:#fff!important}
  .app-header,.making-step-tabs,.order-card,.cut-progress-readout,.action-row{visibility:hidden!important}`;
const raw = (png) => sharp(png).removeAlpha().raw().toBuffer();
const VIEWPORTS = [[390, 844], [360, 800]];
const BAKES = ["none", "raw", "perfect", "burnt"];

const browser = await chromium.launch();
const out = {};
for (const [w, h] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const R = (out[`${w}x${h}`] = {});
  const doughBox = () => page.locator(".pizza-dough").first().boundingBox();
  const line = async (deg, a, b) => {
    const d = await doughBox();
    const cx = d.x + d.width / 2, cy = d.y + d.height / 2, r = Math.min(d.width, d.height) / 2, t = (deg * Math.PI) / 180;
    return [[cx + Math.cos(t) * r * a, cy + Math.sin(t) * r * a], [cx + Math.cos(t) * r * b, cy + Math.sin(t) * r * b]];
  };
  const drag = async (deg, a, b, { release = true, steps = 10, to = b } = {}) => {
    const [p0] = await line(deg, a, b);
    const [, p1] = await line(deg, a, to);
    await page.mouse.move(p0[0], p0[1]);
    await page.mouse.down();
    await page.mouse.move(p1[0], p1[1], { steps });
    if (release) await page.mouse.up();
  };
  /** shot of the whole screen with / without the cut drawing, and the post-only mask */
  const measure = async () => {
    const clip = await page.locator(".pizza-dough").first().boundingBox();
    const pad = { x: clip.x - 24, y: clip.y - 24, width: clip.width + 48, height: clip.height + 48 };
    const withCut = await raw(await page.screenshot({ clip: pad }));
    const s1 = await page.addStyleTag({ content: HIDE_CUT });
    const noCut = await raw(await page.screenshot({ clip: pad }));
    const s2 = await page.addStyleTag({ content: POST_ONLY });
    const mask = await raw(await page.screenshot({ clip: pad }));
    await s2.evaluate((e) => e.remove());
    await s1.evaluate((e) => e.remove());
    let cutPx = 0, onPost = 0, onPostSolid = 0;
    for (let i = 0; i < withCut.length; i += 3) {
      const diff = Math.abs(withCut[i] - noCut[i]) + Math.abs(withCut[i + 1] - noCut[i + 1]) + Math.abs(withCut[i + 2] - noCut[i + 2]);
      if (diff < 6) continue; // below visibility
      cutPx++;
      const post = !(mask[i] > 250 && mask[i + 1] > 250 && mask[i + 2] > 250);
      if (post) { onPost++; if (diff > 60) onPostSolid++; }
    }
    return { cutPx, onPost, onPostVisible: onPostSolid };
  };
  const open = async (bake) => {
    await page.goto(`${base}e2e/harness/finish-hv.html?step=CUT&bake=${bake}&post=1&onguide=1`);
    await page.waitForSelector(".pizza-dough");
    await page.waitForTimeout(500);
    await page.addStyleTag({ content: FREEZE });
  };
  for (const bake of BAKES) {
    const B = (R[bake] = {});
    // 1. guide lines + centre marker (no cut yet)
    await open(bake);
    B.guide = await measure();
    // 2. drag preview line + knife (button held, mid-drag across the 60 degree line and its post piece)
    await open(bake);
    await drag(60, -0.95, 0.95, { release: false, to: 0.2 });
    B.previewAndKnife = await measure();
    await page.mouse.up();
    // 3. a partial cut (stops inside the pizza) across the post pieces on the 120 degree line
    await open(bake);
    await drag(120, -0.5, 0.5);
    B.partialGroove = await measure();
    // 4. a through cut: right after release (flash) -- animation paused by FREEZE keeps the newest cut's flash at its first frame
    await open(bake);
    await page.addStyleTag({ content: "*{animation-play-state:paused!important}" });
    await drag(60, -1.05, 1.05);
    B.throughFlash = await measure();
    // 5. three committed cuts, flash over
    await open(bake);
    for (const d of [0, 60, 120]) await drag(d, -1.05, 1.05);
    await page.waitForTimeout(600);
    B.threeCuts = await measure();
  }
  await page.close();
}
await browser.close();
fs.writeFileSync(`${outDir}/${tag}-measure.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
