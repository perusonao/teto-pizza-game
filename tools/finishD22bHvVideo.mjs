#!/usr/bin/env node
/**
 * FINISH D2-2b Human Verification video driver (dev/test only): records one walkthrough per viewport on e2e/harness/finish-hv.html
 * (the real PizzaStage in the real cooking skeleton; captions are written into the harness's order-card). Videos are NOT committed
 * (TETO_HUMAN-VERIFICATION-POLICY §6): they go to the user directly.
 *
 *   node tools/finishD22bHvVideo.mjs <baseUrl> <outDir>      -> <outDir>/finish-d22b-<w>x<h>.webm (convert to MP4/H.264 with ffmpeg)
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) throw new Error("usage: finishD22bHvVideo.mjs <baseUrl> <outDir>");
fs.mkdirSync(outDir, { recursive: true });
const url = (q) => `${base}e2e/harness/finish-hv.html?${q}`;
const HOLD = 2200;

const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [360, 800]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, recordVideo: { dir: `${outDir}/raw-${w}x${h}`, size: { width: w, height: h } } });
  const page = await context.newPage();
  const open = async (q) => { await page.goto(url(q)); await page.waitForSelector(".pizza-dough"); await page.waitForTimeout(600); };
  const cap = async (t, hold = HOLD) => { await page.evaluate((c) => window.__hv.setCaption(c), t); await page.waitForTimeout(hold); };
  const press = (label) => page.getByRole("button", { name: label, exact: true }).click();
  const dough = async () => (await page.locator(".pizza-dough").first().boundingBox());
  const cut = async (deg) => {
    const b = await dough(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2, r = Math.min(b.width, b.height) / 2;
    const a = (deg * Math.PI) / 180; const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    await page.mouse.move(cx - dx, cy - dy); await page.mouse.down(); await page.mouse.move(cx + dx, cy + dy, { steps: 14 }); await page.mouse.up();
  };

  await open("step=TOPPING&bake=none&post=0");
  await cap("① 後乗せなしの通常画面。焼き加減を 生焼け→ジャスト→焦げ", 1500);
  for (const b of ["生焼け", "ジャスト", "焦げ"]) { await press(b); await cap(`① 後乗せなし / ${b}`, HOLD); }
  await press("焼成なし");
  await press("後乗せ: なし"); // -> on
  await cap("② 後乗せあり。上段=後乗せ(焼成後に置く) / 下段=焼成前", 2600);
  for (const b of ["生焼け", "ジャスト", "焦げ"]) { await press(b); await cap(`② ${b}: 上段(後乗せ)は変色しない / 下段は焼き色が変わる`, 3000); }
  const first = await page.locator('[data-topping-stage="post"]').first().boundingBox();
  await cap("③ 後乗せの上をタップ → 下の生地に届く(カウンタが増える)", 1200);
  await page.mouse.click(first.x + first.width / 2, first.y + first.height / 2);
  await page.waitForTimeout(1800);

  await open("step=CUT&bake=burnt&post=1&onguide=1");
  await cap("④ CUT(線を引く前): ガイド線と後乗せの重なり。ガイド線は後乗せの下に隠れる", 3500);
  await cut(0);
  await cap("⑤ 1 本切る → 後乗せが piece 内描画に戻り、焼成フィルターが再び掛かる", 3200);
  await press("焼成なし");
  await cap("⑤ 焼成なしに戻すと後乗せは元の色(上段の後乗せ色が変わる=既知の穴)", 3200);
  await press("焦げ");
  await cap("⑤ 焦げに戻すと後乗せがまた変色", 3000);

  await open("step=TOPPING&bake=none&post=1&pan=square");
  await cap("⑥ 四角天板 + 後乗せ(観察)", 2000);
  for (const b of ["生焼け", "焦げ"]) { await press(b); await cap(`⑥ 四角天板 / ${b}`, 2200); }

  await context.close(); // finalizes the video
  const files = fs.readdirSync(`${outDir}/raw-${w}x${h}`).filter((f) => f.endsWith(".webm"));
  fs.renameSync(`${outDir}/raw-${w}x${h}/${files[0]}`, `${outDir}/finish-d22b-${w}x${h}.webm`);
  fs.rmdirSync(`${outDir}/raw-${w}x${h}`);
}
await browser.close();
