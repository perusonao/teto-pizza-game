#!/usr/bin/env node
/**
 * FINISH D2-2c F-3 (#597) before / after screenshots (dev/test only), on e2e/harness/finish-hv.html with `onguide=1` (post pieces on the guide lines):
 * guide, drag preview + knife, partial-cut groove, the one-shot flash (animation paused at its first frame), three cuts, RESULT with three cuts --
 * at raw and burnt (bake=none was already in front), 390x844 and 360x800.
 *
 *   node tools/finishD22cF3Shots.mjs <baseUrl> <tag> <outDir>      (once on main -> "before", once on this branch -> "after")
 *   node tools/finishD22cF3Shots.mjs pair <dir>                    (side-by-side before | after -> compare-*.png, then the singles are deleted)
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
    const { width, height } = await sharp(`${dir}/${f}`).metadata();
    await sharp({ create: { width: width * 2 + 8, height, channels: 3, background: "#ffffff" } })
      .composite([{ input: `${dir}/${f}`, left: 0, top: 0 }, { input: `${dir}/${g}`, left: width + 8, top: 0 }])
      .png().toFile(`${dir}/compare-${f.replace("before-", "")}`);
    fs.unlinkSync(`${dir}/${f}`);
    fs.unlinkSync(`${dir}/${g}`);
  }
  process.exit(0);
}
const [base, tag, outDir] = process.argv.slice(2);
if (!base || !tag || !outDir) throw new Error("usage: finishD22cF3Shots.mjs <baseUrl> <tag> <outDir> | pair <dir>");
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [360, 800]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const open = async (q) => {
    await page.goto(`${base}e2e/harness/finish-hv.html?${q}`);
    await page.waitForSelector(".pizza-dough");
    await page.waitForTimeout(500);
  };
  const drag = async (deg, a, b, release = true) => {
    const d = await page.locator(".pizza-dough").first().boundingBox();
    const cx = d.x + d.width / 2, cy = d.y + d.height / 2, r = Math.min(d.width, d.height) / 2, t = (deg * Math.PI) / 180;
    await page.mouse.move(cx + Math.cos(t) * r * a.from, cy + Math.sin(t) * r * a.from);
    await page.mouse.down();
    await page.mouse.move(cx + Math.cos(t) * r * a.to, cy + Math.sin(t) * r * a.to, { steps: 10 });
    if (release) await page.mouse.up();
  };
  const shot = async (name) => {
    const b = await page.locator(".pizza-dough").first().boundingBox();
    await page.screenshot({ path: `${outDir}/${tag}-${w}x${h}-${name}.png`, clip: { x: b.x - 6, y: b.y - 6, width: b.width + 12, height: b.height + 12 } });
  };
  const freeze = () => page.addStyleTag({ content: "*{animation-play-state:paused!important}" });
  for (const bake of ["raw", "burnt"]) {
    await open(`step=CUT&bake=${bake}&post=1&onguide=1`); await freeze(); await shot(`${bake}-1-guide`);
    await open(`step=CUT&bake=${bake}&post=1&onguide=1`); await freeze();
    await drag(60, { from: -0.95, to: 0.2 }, null, false); await shot(`${bake}-2-preview-knife`); await page.mouse.up();
    await open(`step=CUT&bake=${bake}&post=1&onguide=1`); await freeze();
    await drag(120, { from: -0.5, to: 0.5 }); await shot(`${bake}-3-partial-groove`);
    await open(`step=CUT&bake=${bake}&post=1&onguide=1`); await freeze();
    await drag(60, { from: -1.05, to: 1.05 }); await shot(`${bake}-4-through-flash`);
    await open(`step=CUT&bake=${bake}&post=1&onguide=1`);
    for (const d of [0, 60, 120]) await drag(d, { from: -1.05, to: 1.05 });
    await page.waitForTimeout(600); await shot(`${bake}-5-three-cuts`);
    await open(`step=RESULT&cuts=3&bake=${bake}&post=1&onguide=1`); await shot(`${bake}-6-result`);
  }
  await page.close();
}
await browser.close();
