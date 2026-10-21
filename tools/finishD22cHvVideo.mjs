#!/usr/bin/env node
/**
 * FINISH F-2 (#594) Human Verification video driver (dev/test only): one walkthrough per viewport on e2e/harness/finish-hv.html -- the post-bake
 * pieces on a cut pizza. Captions are written into the harness's order-card. Videos are NOT committed (HV Policy §6).
 *
 *   node tools/finishD22cHvVideo.mjs <baseUrl> <outDir>      -> <outDir>/finish-f2-<w>x<h>.webm (convert to MP4/H.264 with ffmpeg)
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) throw new Error("usage: finishD22cHvVideo.mjs <baseUrl> <outDir>");
fs.mkdirSync(outDir, { recursive: true });
const url = (q) => `${base}e2e/harness/finish-hv.html?${q}`;

const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [360, 800]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, recordVideo: { dir: `${outDir}/raw-${w}x${h}`, size: { width: w, height: h } } });
  const page = await context.newPage();
  const open = async (q) => { await page.goto(url(q)); await page.waitForSelector(".pizza-dough"); await page.waitForTimeout(600); };
  const cap = async (t, hold = 2400) => { await page.evaluate((c) => window.__hv.setCaption(c), t); await page.waitForTimeout(hold); };
  const press = (label) => page.getByRole("button", { name: label, exact: true }).click();
  const cut = async (deg) => {
    const b = await page.locator(".pizza-dough").first().boundingBox(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2, r = Math.min(b.width, b.height) / 2;
    const a = (deg * Math.PI) / 180; const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    await page.mouse.move(cx - dx, cy - dy); await page.mouse.down(); await page.mouse.move(cx + dx, cy + dy, { steps: 16 }); await page.mouse.up();
    await page.waitForTimeout(500);
  };

  await open("step=TOPPING&bake=none&post=1&onguide=1");
  await cap("① カット前: 上段=後乗せ / 下段=焼成前。焼き加減を切り替える", 1600);
  for (const b of ["生焼け", "ジャスト", "焦げ"]) { await press(b); await cap(`① ${b}: 後乗せは変色しない / 焼成前は変わる`, 2600); }
  await press("CUT へ");
  await cap("② CUT 工程（焦げ）。まだ線は引いていない", 2600);
  await cut(0); await cap("③ 1 本目: カット後も後乗せの色は変わらない（従来は変色）", 3600);
  await cut(60); await cap("③ 2 本目", 3000);
  await cut(120); await cap("③ 3 本目（6 ピース）。線に跨る後乗せは両ピースに分割", 3600);
  await press("生焼け"); await cap("④ カット後に 生焼け に切り替え: 後乗せは同じ色", 3000);
  await press("ジャスト"); await cap("④ ジャスト", 2600);
  await press("焼成なし"); await cap("④ 焼成なし（基準）: 後乗せの色は上の 3 状態と同じ", 3000);
  await press("焦げ"); await cap("④ 焦げ", 2600);
  await press("切り直し"); await cap("⑤ 切り直し: カット前の表示に戻る", 2600);

  await open("step=CUT&bake=burnt&post=0");
  await cap("⑥ 後乗せなしの通常 CUT（回帰確認）", 2000);
  await cut(0); await cut(60); await cut(120); await cap("⑥ 後乗せなし: 3 本カット（従来どおり）", 3200);

  await open("step=TOPPING&bake=burnt&post=1&pan=square");
  await cap("⑦ 四角天板 + 後乗せ（カット前）", 2600);
  await press("CUT へ"); await cap("⑦ 四角天板の CUT 工程", 2600);
  await context.close();
  const files = fs.readdirSync(`${outDir}/raw-${w}x${h}`).filter((f) => f.endsWith(".webm"));
  fs.renameSync(`${outDir}/raw-${w}x${h}/${files[0]}`, `${outDir}/finish-f2-${w}x${h}.webm`);
  fs.rmdirSync(`${outDir}/raw-${w}x${h}`);
}
await browser.close();
