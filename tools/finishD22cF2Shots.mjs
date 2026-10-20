#!/usr/bin/env node
/**
 * FINISH D2-2c F-2 (#594) before / after screenshots (dev/test only): the CUT screen with post-bake pieces at raw / perfect / burnt,
 * after 0 / 1 / 3 cuts, on e2e/harness/finish-hv.html (the real PizzaStage in the real cooking skeleton).
 *
 *   node tools/finishD22cF2Shots.mjs <baseUrl> <tag> <outDir>      (run once on main -> tag "before", once on this branch -> "after")
 *
 * Writes <tag>-<w>x<h>-<bake>-cuts<N>.png (the dough area) and <tag>-...-postonly.png (the post layer alone), then
 * side-by-side before|after pairs when both tags exist: node tools/finishD22cF2Shots.mjs pair <dir>
 */
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import fs from "node:fs";

const sharp = createRequire(import.meta.url)("sharp");
if (process.argv[2] === "pair") {
  const dir = process.argv[3];
  for (const f of fs.readdirSync(dir).filter((n) => n.startsWith("before-") && n.endsWith(".png"))) {
    const g = f.replace("before-", "after-");
    if (!fs.existsSync(`${dir}/${g}`)) continue;
    const a = sharp(`${dir}/${f}`);
    const { width, height } = await a.metadata();
    await sharp({ create: { width: width * 2 + 8, height, channels: 3, background: "#ffffff" } })
      .composite([{ input: `${dir}/${f}`, left: 0, top: 0 }, { input: `${dir}/${g}`, left: width + 8, top: 0 }])
      .png().toFile(`${dir}/compare-${f.replace("before-", "")}`);
  }
  process.exit(0);
}
const [base, tag, outDir] = process.argv.slice(2);
if (!base || !tag || !outDir) throw new Error("usage: finishD22cF2Shots.mjs <baseUrl> <tag> <outDir> | pair <dir>");
fs.mkdirSync(outDir, { recursive: true });
const ISOLATE = `.pizza-dough{visibility:hidden!important} *{animation:none!important;transition:none!important} html,body,.app-frame,.game-screen{background:#fff!important}
  .app-header,.making-step-tabs,.order-card,.cut-progress-readout,.action-row{visibility:hidden!important}`;
/** a build without the cut layer (main before F-2): the post pieces are inside the dough's pieces, so hide everything else instead */
const ISOLATE_IN_DOUGH = `.pizza-dough{background:none!important;border-color:transparent!important;box-shadow:none!important}
  .pizza-dough-shape,.pizza-dough-square,.pizza-bake-overlay,.pizza-char-spots,.pizza-smoke-wrap,.pizza-perfect-glow,.pizza-sauce-heatmap,.pizza-cut-layer,.pizza-piece-body>*:not(.pizza-topping):not(.pizza-topping-half){display:none!important}
  .pizza-topping:not([data-topping-stage="post"]),.pizza-topping-half:not([data-topping-stage="post"]){display:none!important}
  *{animation:none!important;transition:none!important} html,body,.app-frame,.game-screen{background:#fff!important}
  .app-header,.making-step-tabs,.order-card,.cut-progress-readout,.action-row{visibility:hidden!important}`;
const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [360, 800]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${base}e2e/harness/finish-hv.html?step=CUT&bake=none&post=1&onguide=1`);
  await page.waitForSelector(".pizza-dough");
  await page.waitForTimeout(600);
  const cut = async (deg) => {
    const b = await page.locator(".pizza-dough").first().boundingBox();
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2, r = Math.min(b.width, b.height) / 2;
    const a = (deg * Math.PI) / 180;
    await page.mouse.move(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
    await page.mouse.down();
    await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  };
  const shoot = async (cuts) => {
    for (const bake of ["raw", "perfect", "burnt"]) {
      await page.evaluate((b) => window.__hv.setBake(b), bake);
      await page.waitForTimeout(400);
      const box = await page.locator(".pizza-dough").first().boundingBox();
      await page.screenshot({ path: `${outDir}/${tag}-${w}x${h}-${bake}-cuts${cuts}.png`, clip: { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8 } });
      const hasLayer = (await page.locator(".pizza-post-layer").count()) > 0;
      const st = await page.addStyleTag({ content: hasLayer ? ISOLATE : ISOLATE_IN_DOUGH });
      const layer = await page.locator(hasLayer ? ".pizza-post-layer" : ".pizza-dough").first().boundingBox();
      await page.screenshot({ path: `${outDir}/${tag}-${w}x${h}-${bake}-cuts${cuts}-postonly.png`, clip: { x: layer.x - 4, y: layer.y - 4, width: layer.width + 8, height: layer.height + 8 } });
      await st.evaluate((e) => e.remove());
    }
  };
  await shoot(0);
  await cut(0);
  await shoot(1);
  await cut(60);
  await cut(120);
  await shoot(3);
  await page.close();
}
await browser.close();
