// FIN-A Human Verification video driver (dev only; the video is NOT committed -- Policy §6). Needs `npm run dev` on 5183.
// node tools/finishScreenFinAVideo.mjs <outDir> [width height]
import { chromium } from "@playwright/test";
const [out, w = "390", h = "844"] = process.argv.slice(2);
const W = Number(w), H = Number(h);
const base = "http://localhost:5183/teto-pizza-game/e2e/harness/finish-screen.html";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: out, size: { width: W, height: H } } });
const page = await ctx.newPage();
async function scene(query, caption, ms = 2400) {
  await page.goto(`${base}?${query}`);
  await page.waitForSelector(".pizza-dough");
  await page.evaluate((c) => {
    const d = document.createElement("div");
    d.textContent = c;
    d.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:#000c;color:#fff;font:600 13px sans-serif;padding:8px 10px;border-radius:8px;pointer-events:none";
    document.body.appendChild(d);
  }, caption);
  await page.waitForTimeout(ms);
}
await scene("bake=perfect&post=0", "FINISH: 仕上げタブが選択中。Mito のヒントが後乗せ食材を示す（ジャスト焼き・後乗せ 0）");
await scene("bake=perfect&post=1", "後乗せ 1 個。ヒントは変わらず（あと 1 個）");
await scene("bake=perfect&post=3", "後乗せ 3 個。ヒントが「仕上げはここまで！」に変わる");
await scene("bake=raw&post=3", "生焼け: 後乗せのパセリは焼成フィルターで変色しない");
await scene("bake=burnt&post=3", "焦げ: 同上");
await scene("cut=1&bake=perfect&post=2", "FINISH の次の「カット」タブは押せない（FIN-A は完了操作なし）");
await scene("round=LUNCH_RUSH&post=2", "Lunch Rush: FINISH を持つプロファイルでも仕上げ画面は出ない");
await scene("round=DINNER&post=2", "Dinner: 同上");
await scene("round=FREE_COOK&post=2", "Free Cooking: 同上");
await ctx.close();
await browser.close();
