// FIN-D Human Verification video driver (dev only; the video is NOT committed -- Policy §6). Needs `npm run dev` on 5183.
// node tools/finishFlowFinDVideo.mjs <outDir> [width height]
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
  await page.goto(`${base}?start=bake&${query}`);
  await page.waitForSelector(".game-screen");
  await caption(c);
  await page.waitForTimeout(ms);
}
const bake = (v) => page.evaluate((n) => window.__confirmBake(n), v);
const tap = async (fx, fy) => { const b = await page.locator(".pizza-dough").boundingBox(); await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy); };
const parsley = async () => { await page.getByRole("button", { name: /パセリ/ }).click(); await page.waitForTimeout(700); };

await scene("stock=3", "正常完成 ①: BAKE（取り出す！）。ここではまだ後乗せは置けない", 2400);
await bake(70); await caption("② 取り出す → FINISH（仕上げ）。後乗せの在庫は消費されていない（あと3/3）"); await page.waitForTimeout(2600);
await parsley(); await caption("③ パセリを選んで2個配置（在庫はまだ減らない表示は残数のみ）");
await tap(0.4, 0.4); await page.waitForTimeout(1200); await tap(0.6, 0.55); await page.waitForTimeout(1800);
await caption("④ 完成（連打）→ RESULT（成功）。在庫の消費・スコア確定・登録は1回だけ");
await page.getByTestId("finish-complete").dblclick({ delay: 0 }); await page.waitForTimeout(3200);

await scene("stock=3", "後乗せ0個の FAILED: BAKE → FINISH", 1200);
await bake(70); await page.waitForTimeout(1800);
await caption("完成 → 確認ダイアログなしで RESULT（失敗）。在庫は減らない");
await page.getByTestId("finish-complete").click(); await page.waitForTimeout(3000);

await scene("stock=3", "連続Undoと再配置: FINISH で3個配置", 1000);
await bake(70); await page.waitForTimeout(1000);
await parsley();
for (const [x, y] of [[0.35, 0.4], [0.5, 0.62], [0.65, 0.4]]) { await tap(x, y); await page.waitForTimeout(900); }
await caption("↩ を3回: 直近から1個ずつ。後乗せ0個で ↩ は無効（焼成前の食材は戻らない）");
for (let i = 0; i < 3; i += 1) { await page.getByTestId("finish-undo").click(); await page.waitForTimeout(1100); }
await caption("再配置 → 完成 → RESULT");
await parsley(); await tap(0.45, 0.45); await page.waitForTimeout(900); await tap(0.58, 0.55); await page.waitForTimeout(1200);
await page.getByTestId("finish-complete").click(); await page.waitForTimeout(3000);

await scene("stock=1", "在庫不足: 在庫1で2個目を置こうとしても増えない", 1000);
await bake(70); await page.waitForTimeout(1000);
await parsley(); await tap(0.4, 0.4); await page.waitForTimeout(1500);
await caption("在庫0・選択解除。追加タップは無効");
await tap(0.6, 0.6); await page.waitForTimeout(1800);
await page.getByTestId("finish-complete").click(); await page.waitForTimeout(2800);

await scene("stock=3", "焼成失敗（生焼け）: FINISH を飛ばして RESULT（失敗）。後乗せ在庫は無傷", 1000);
await bake(40); await page.waitForTimeout(3000);

await scene("cut=1&stock=2", "CUT付き: 完成 → CUT（CUTは変更なし）", 1000);
await bake(70); await page.waitForTimeout(900);
await parsley(); await tap(0.5, 0.5); await page.waitForTimeout(900);
await page.getByTestId("finish-complete").click(); await page.waitForTimeout(2800);

await scene("round=LUNCH_RUSH&post=2", "Lunch Rush: 仕上げ画面は出ない", 1600);
await scene("round=DINNER&post=2", "Dinner: 同上", 1600);
await scene("round=FREE_COOK&post=2", "Free Cooking: 同上", 1600);
await ctx.close();
await browser.close();
