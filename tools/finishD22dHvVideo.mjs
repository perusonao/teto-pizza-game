#!/usr/bin/env node
/**
 * FINISH F-3 (#597) Human Verification video driver (dev/test only): one walkthrough per viewport on e2e/harness/finish-hv.html -- the CUT drawing
 * (guide, preview line, knife, grooves) over the post-bake pieces. Captions are written into the harness's order-card. Videos are NOT committed (HV Policy §6).
 *
 *   node tools/finishD22dHvVideo.mjs <baseUrl> <outDir>      -> <outDir>/finish-f3-<w>x<h>.webm (convert to MP4/H.264 with ffmpeg)
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) throw new Error("usage: finishD22dHvVideo.mjs <baseUrl> <outDir>");
fs.mkdirSync(outDir, { recursive: true });
const url = (q) => `${base}e2e/harness/finish-hv.html?${q}`;

const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [360, 800]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, recordVideo: { dir: `${outDir}/raw-${w}x${h}`, size: { width: w, height: h } } });
  const page = await context.newPage();
  const open = async (q) => { await page.goto(url(q)); await page.waitForSelector(".pizza-dough"); await page.waitForTimeout(600); };
  const cap = async (t, hold = 2400) => { await page.evaluate((c) => window.__hv.setCaption(c), t); await page.waitForTimeout(hold); };
  const press = (label) => page.getByRole("button", { name: label, exact: true }).click();
  const box = async () => { const b = await page.locator(".pizza-dough").first().boundingBox(); return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, r: Math.min(b.width, b.height) / 2 }; };
  const cut = async (deg) => {
    const { cx, cy, r } = await box(); const a = (deg * Math.PI) / 180; const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    await page.mouse.move(cx - dx, cy - dy); await page.mouse.down(); await page.mouse.move(cx + dx, cy + dy, { steps: 16 }); await page.mouse.up();
    await page.waitForTimeout(500);
  };
  /** a drag held half-way (pointer down) so the preview line and the knife stay on screen */
  const hold = async (deg, upTo, ms) => {
    const { cx, cy, r } = await box(); const a = (deg * Math.PI) / 180;
    await page.mouse.move(cx - Math.cos(a) * r, cy - Math.sin(a) * r); await page.mouse.down();
    await page.mouse.move(cx + Math.cos(a) * r * upTo, cy + Math.sin(a) * r * upTo, { steps: 24 });
    await page.waitForTimeout(ms);
  };

  await open("step=CUT&bake=none&post=1&onguide=1");
  await cap("① CUT 開始（焼成なし）: ガイド線が後乗せ（上段 3 個 + 線上 3 個）の上に見える", 3000);
  for (const [label, name] of [["生焼け", "生焼け"], ["ジャスト", "ジャスト"], ["焦げ", "焦げ"]]) { await press(label); await cap(`① ${name}: ガイド線は後乗せの上のまま（従来は後乗せの下に隠れた）`, 2600); }
  await hold(0, 0.35, 0); await cap("② ドラッグ中（焦げ）: プレビュー線とナイフが後乗せの上に見える", 3200);
  await page.mouse.up(); await page.waitForTimeout(400);
  await cap("③ 途中で離した部分カットの溝: 後乗せの上に残る（ガイドも継続）", 3200);
  await press("ジャスト"); await cap("③ ジャスト: 溝は同じ見え方", 2400);
  await press("生焼け"); await cap("③ 生焼け: 溝は同じ見え方", 2400);
  await press("切り直し"); await cap("③ 切り直し: 溝が消える", 2000);
  await press("焦げ");
  await hold(60, 0.2, 0); await cap("④ 連続ドラッグ 1: 続けてドラッグしても届く", 2200);
  await page.mouse.up(); await page.waitForTimeout(300);
  await press("切り直し");
  await cut(0); await cap("④ 貫通カット 1 本目（焦げ）: 後乗せは色が変わらず、離れる", 3200);
  await hold(60, 0.5, 0); await cap("④ 2 本目のドラッグ中: プレビュー線とナイフが後乗せの上に見える", 3200);
  await page.mouse.up(); await page.waitForTimeout(500); await cap("④ 2 本目を離す", 2400);
  await cut(120); await cap("④ 3 本目（6 ピース）。後乗せは分割され、色は不変", 3600);
  await press("生焼け"); await cap("⑤ カット後に 生焼け: 後乗せは同じ色", 2600);
  await press("ジャスト"); await cap("⑤ ジャスト", 2400);
  await press("焼成なし"); await cap("⑤ 焼成なし", 2400);
  await press("焦げ");
  await press("TOPPING へ"); await cap("⑥ CUT を出る（RESULT 相当）: 確定したカットはそのまま、ガイドとナイフは消える", 3200);

  await open("step=CUT&bake=burnt&post=1&onguide=1");
  await hold(0, 0.3, 0); await page.mouse.up(); await page.waitForTimeout(400);
  await press("TOPPING へ"); await cap("⑥ 部分カットの溝は CUT 後も後乗せの上に残る", 3200);

  await open("step=CUT&bake=burnt&post=0");
  await cap("⑦ 後乗せなしの通常 CUT（回帰確認）", 2000);
  await hold(0, 0.4, 600); await page.mouse.up(); await page.waitForTimeout(300);
  await cut(60); await cut(120); await cap("⑦ 後乗せなし: カットは従来どおり", 3000);

  await open("step=TOPPING&bake=burnt&post=1&onguide=1&pan=square");
  await press("CUT へ"); await cap("⑧ 四角天板 + 後乗せ: ガイドが後乗せの上", 2800);
  await hold(0, 0.4, 0); await cap("⑧ 四角天板: ドラッグ中のプレビュー線とナイフ", 3000);
  await page.mouse.up(); await page.waitForTimeout(400); await cap("⑧ 離すと溝が残る", 2600);
  await context.close();
  const files = fs.readdirSync(`${outDir}/raw-${w}x${h}`).filter((f) => f.endsWith(".webm"));
  fs.renameSync(`${outDir}/raw-${w}x${h}/${files[0]}`, `${outDir}/finish-f3-${w}x${h}.webm`);
  fs.rmdirSync(`${outDir}/raw-${w}x${h}`);
}
await browser.close();
