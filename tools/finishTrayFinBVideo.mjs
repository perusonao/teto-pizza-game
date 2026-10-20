// FIN-B Human Verification video driver (dev only; the video is NOT committed -- Policy §6). Needs `npm run dev` on 5183.
// node tools/finishTrayFinBVideo.mjs <outDir> [width height]
import { chromium } from "@playwright/test";
const [out, w = "390", h = "844"] = process.argv.slice(2);
const W = Number(w), H = Number(h);
const base = "http://localhost:5183/teto-pizza-game/e2e/harness/finish-screen.html";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: out, size: { width: W, height: H } } });
const page = await ctx.newPage();
async function caption(c) {
  await page.evaluate((c) => {
    document.getElementById("hv-cap")?.remove();
    const d = document.createElement("div");
    d.id = "hv-cap";
    d.textContent = c;
    d.style.cssText = "position:fixed;left:8px;right:8px;top:8px;z-index:99999;background:#000c;color:#fff;font:600 12px sans-serif;padding:6px 10px;border-radius:8px;pointer-events:none";
    document.body.appendChild(d);
  }, c);
}
async function scene(query, c, ms = 2200) {
  await page.goto(`${base}?${query}`);
  await page.waitForSelector(".pizza-dough");
  await caption(c);
  await page.waitForTimeout(ms);
}
const tap = async (fx, fy) => { const b = await page.locator(".pizza-dough").boundingBox(); await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy); };
await scene("bake=perfect&stock=3", "FINISH: 仕上げタブ + トレイ（後乗せ食材のパセリだけ）。あと3/3");
await caption("パセリを選ぶ（選択中の表示）");
await page.getByRole("button", { name: /パセリ/ }).click();
await page.waitForTimeout(1600);
await caption("ピザをタップ → 後乗せで配置。あと2/3");
await tap(0.4, 0.4); await page.waitForTimeout(1800);
await caption("もう1回タップ。あと1/3");
await tap(0.62, 0.55); await page.waitForTimeout(1800);
await caption("3個目。あと0/3 でパセリは選べなくなる");
await tap(0.5, 0.72); await page.waitForTimeout(2200);
await caption("在庫を超える配置はできない（もう1回タップしても増えない）");
await tap(0.5, 0.3); await page.waitForTimeout(2000);
await scene("bake=perfect&stock=3", "ヒント: 「パセリをあと2個、仕上げにのせてね。」", 800);
await page.getByRole("button", { name: "ヒント" }).click();
await caption("ヒントボタン → buildFinishHintLine の文言（あと2個）");
await page.waitForTimeout(2200);
await scene("bake=perfect&late=3&stock=3", "後乗せ食材が3種類のとき: トレイ3つ。下部UIと重ならない");
await scene("bake=raw&stock=3&post=2", "生焼け: 後乗せのパセリは焼成フィルターで変色しない");
await scene("round=LUNCH_RUSH&post=2", "Lunch Rush: 仕上げ画面もトレイも出ない", 1600);
await scene("round=DINNER&post=2", "Dinner: 同上", 1600);
await scene("round=FREE_COOK&post=2", "Free Cooking: 同上", 1600);
await ctx.close();
await browser.close();
