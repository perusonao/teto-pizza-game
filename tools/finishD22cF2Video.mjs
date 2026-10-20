#!/usr/bin/env node
/**
 * FINISH D2-2c F-2 (#594) Human Verification video driver (dev/test only): one walkthrough at 390x844 on e2e/harness/finish-hv.html
 * (the real PizzaStage in the real cooking skeleton; captions go into the harness's order-card). Videos are NOT committed
 * (TETO_HUMAN-VERIFICATION-POLICY §6): they go to the user directly.
 *
 *   node tools/finishD22cF2Video.mjs <baseUrl> <outDir>      -> <outDir>/finish-d22c-f2-390x844.webm (convert to MP4 / H.264 with ffmpeg)
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) throw new Error("usage: finishD22cF2Video.mjs <baseUrl> <outDir>");
fs.mkdirSync(outDir, { recursive: true });
const url = (q) => `${base}e2e/harness/finish-hv.html?${q}`;
const HOLD = 2200;
const [w, h] = [390, 844];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: w, height: h }, recordVideo: { dir: `${outDir}/raw`, size: { width: w, height: h } } });
const page = await context.newPage();
const open = async (q) => { await page.goto(url(q)); await page.waitForSelector(".pizza-dough"); await page.waitForTimeout(600); };
const cap = async (t, hold = HOLD) => { await page.evaluate((c) => window.__hv.setCaption(c), t); await page.waitForTimeout(hold); };
const press = (label) => page.getByRole("button", { name: label, exact: true }).click();
const cut = async (deg) => {
  const b = await page.locator(".pizza-dough").first().boundingBox();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2, r = Math.min(b.width, b.height) / 2;
  const a = (deg * Math.PI) / 180;
  await page.mouse.move(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
  await page.mouse.down();
  await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r, { steps: 22 });
  await page.mouse.up();
};
const bakes = async (prefix) => { for (const b of ["生焼け", "ジャスト", "焦げ"]) { await press(b); await cap(`${prefix} ${b}`, HOLD); } };

await open("step=CUT&bake=none&post=1&onguide=1");
await cap("① CUT 前。上=後乗せ(焼成後に置く) 下=焼成前。焼き加減を切替", 1800);
await bakes("① 切る前 / 後乗せは変色しない:");
await press("焼成なし");
await cap("② 1 本切る → 後乗せは同じ色のまま、生地と一緒に割れる", 1200);
await cut(0);
await cap("② 切った後も後乗せの色は同じ。焼き加減を切替", 1500);
await bakes("② 1 本 / 後乗せ不変:");
await press("焼成なし");
await cap("③ さらに 2 本切る(後乗せの上を通る線あり)", 1200);
await cut(60);
await cut(120);
await cap("③ 3 本(6 ピース)。後乗せが線をまたぐ所は両側に分かれる", 2000);
await bakes("③ 3 本 / 後乗せ不変:");
await cap("④ 後乗せの上からも切れる(タップ・ドラッグは生地に届く)。切り直し", 1500);
await press("切り直し");
await cap("④ 切り直し後も後乗せは元の位置・色", 2200);
await cut(30);
await cap("④ 後乗せの上を通る線をもう一度", 2200);

await open("step=CUT&bake=none&post=1&pan=square");
await cap("⑤ 四角天板 + 後乗せ + CUT(観察)", 1600);
await cut(0);
await bakes("⑤ 四角天板 1 本:");

await context.close(); // finalizes the video
const files = fs.readdirSync(`${outDir}/raw`).filter((f) => f.endsWith(".webm"));
fs.renameSync(`${outDir}/raw/${files[0]}`, `${outDir}/finish-d22c-f2-${w}x${h}.webm`);
fs.rmdirSync(`${outDir}/raw`);
await browser.close();
