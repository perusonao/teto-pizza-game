#!/usr/bin/env node
/**
 * FINISH D2-2c F-3 (#597) Human Verification video driver (dev/test only): one walkthrough per viewport on e2e/harness/finish-hv.html -- the CUT
 * drawing (guide, drag preview + knife, partial groove, flash, committed cuts) in front of post-bake pieces. Captions go into the harness's order-card.
 * Videos are NOT committed (HV Policy §6).
 *
 *   node tools/finishD22cF3Video.mjs <baseUrl> <outDir>      -> <outDir>/finish-f3-<w>x<h>.webm (convert to MP4 / H.264 with ffmpeg)
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) throw new Error("usage: finishD22cF3Video.mjs <baseUrl> <outDir>");
fs.mkdirSync(outDir, { recursive: true });
const url = (q) => `${base}e2e/harness/finish-hv.html?${q}`;

const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [360, 800]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, recordVideo: { dir: `${outDir}/raw-${w}x${h}`, size: { width: w, height: h } } });
  const page = await context.newPage();
  const open = async (q) => { await page.goto(url(q)); await page.waitForSelector(".pizza-dough"); await page.waitForTimeout(600); };
  const cap = async (t, hold = 2200) => { await page.evaluate((c) => window.__hv.setCaption(c), t); await page.waitForTimeout(hold); };
  const press = (label) => page.getByRole("button", { name: label, exact: true }).click();
  /** a slow drag along `deg` through the centre, from `a` to `b` (fractions of the radius); `hold` ms with the button down at the end */
  const drag = async (deg, a, b, { hold = 0, release = true } = {}) => {
    const d = await page.locator(".pizza-dough").first().boundingBox();
    const cx = d.x + d.width / 2, cy = d.y + d.height / 2, r = Math.min(d.width, d.height) / 2, t = (deg * Math.PI) / 180;
    await page.mouse.move(cx + Math.cos(t) * r * a, cy + Math.sin(t) * r * a);
    await page.mouse.down();
    await page.mouse.move(cx + Math.cos(t) * r * b, cy + Math.sin(t) * r * b, { steps: 40 });
    if (hold) await page.waitForTimeout(hold);
    if (release) await page.mouse.up();
  };
  const bakes = async (prefix, hold = 1500) => { for (const b of ["生焼け", "ジャスト", "焦げ"]) { await press(b); await cap(`${prefix} ${b}`, hold); } };

  await open("step=CUT&bake=none&post=1&onguide=1");
  await cap("① CUT 前。上=後乗せ。ガイド線・中心マーカーが後乗せの上に見える", 1800);
  await bakes("① ガイド線は後乗せの前面:");
  await press("焼成なし");
  await cap("② ドラッグ中: プレビュー線とナイフが後乗せの上に出る", 800);
  await drag(60, -0.95, 0.2, { hold: 1800 });
  await cap("② (指を離すと途中までの溝=部分カット)", 2000);
  await press("切り直し");
  await cap("③ 貫通カット: 一瞬の光(flash)も後乗せの上", 600);
  await drag(60, -1.05, 1.05);
  await page.waitForTimeout(1600);
  await cap("③ 2 本目・3 本目(後乗せの上を通る)", 600);
  await drag(120, -1.05, 1.05);
  await page.waitForTimeout(700);
  await drag(0, -1.05, 1.05);
  await cap("③ 3 本: 後乗せは線をまたぐ所で両側に分かれ、飛ばない", 2400);
  await bakes("④ 切った後も後乗せの色は変わらない:");
  await press("焼成なし");
  await press("切り直し");
  await cap("⑤ 切り直し: 後乗せは元の位置・色", 1800);
  await drag(30, -0.9, 0.4, { hold: 900 });
  await cap("⑤ 部分カットの溝も後乗せの前面", 2000);

  await open("step=RESULT&cuts=3&bake=raw&post=1&onguide=1");
  await cap("⑥ RESULT(3 本カット済み): 切れ目は後乗せの前面、ナイフなし", 2600);
  await open("step=RESULT&cuts=3&bake=burnt&post=1&onguide=1");
  await cap("⑥ RESULT / 焦げ", 2200);

  await open("step=CUT&bake=none&post=1&pan=square");
  await cap("⑦ 四角天板 + 後乗せ + CUT(観察)", 1500);
  await drag(60, -1.05, 1.05);
  await bakes("⑦ 四角天板 1 本:");

  await context.close();
  const files = fs.readdirSync(`${outDir}/raw-${w}x${h}`).filter((f) => f.endsWith(".webm"));
  fs.renameSync(`${outDir}/raw-${w}x${h}/${files[0]}`, `${outDir}/finish-f3-${w}x${h}.webm`);
  fs.rmdirSync(`${outDir}/raw-${w}x${h}`);
}
await browser.close();
