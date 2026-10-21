// FIN-C Human Verification video driver (dev only; the video is NOT committed -- Policy §6). Needs `npm run dev` on 5183.
// node tools/finishBarFinCVideo.mjs <outDir> [width height]
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
await scene("bake=perfect&stock=3", "FINISH: トレイ / ↩ / 完成 / ヒント。後乗せ0個なので ↩ は無効（焼成前の食材は戻せない）");
await caption("パセリを選んでピザをタップ → 後乗せ配置。↩ が有効になる");
await page.getByRole("button", { name: /パセリ/ }).click(); await page.waitForTimeout(900);
await tap(0.4, 0.4); await page.waitForTimeout(1500);
await caption("2個目を配置。あと1/3");
await tap(0.62, 0.55); await page.waitForTimeout(1800);
await caption("↩ 1回目: 直近の1個だけ取り消す（あと2/3）");
await page.getByTestId("finish-undo").click(); await page.waitForTimeout(2000);
await caption("↩ 2回目（連続Undo）: 後乗せ0個に戻り ↩ は無効");
await page.getByTestId("finish-undo").click(); await page.waitForTimeout(2000);
await caption("Undo後の再配置: パセリを選んで配置できる");
await page.getByRole("button", { name: /パセリ/ }).click(); await page.waitForTimeout(700);
await tap(0.5, 0.45); await page.waitForTimeout(1800);
await scene("bake=perfect&stock=1", "在庫1: 配置するとパセリは選択解除・無効（選択状態が残らない）", 600);
await page.getByRole("button", { name: /パセリ/ }).click(); await page.waitForTimeout(700);
await tap(0.5, 0.5); await page.waitForTimeout(2200);
await caption("在庫0でもう一度タップしても増えない");
await tap(0.3, 0.6); await page.waitForTimeout(1800);
await scene("owned=none", "後乗せ食材を持っていない: トレイに説明文。完成は押せる", 2400);
await scene("bake=perfect&late=3&stock=3&post=1", "後乗せ食材3種: トレイ・↩・完成・ヒントが重ならない", 2400);
await scene("bake=perfect&stock=3", "後乗せ0個で「完成」→ 確認ダイアログなしで RESULT（失敗）", 1500);
await page.getByTestId("finish-complete").click(); await page.waitForTimeout(2600);
await scene("bake=perfect&stock=3", "後乗せ2個を置いて「完成」→ RESULT（成功）。連打しても在庫は1回だけ消費", 600);
await page.getByRole("button", { name: /パセリ/ }).click(); await page.waitForTimeout(600);
await tap(0.4, 0.4); await page.waitForTimeout(900); await tap(0.62, 0.55); await page.waitForTimeout(1200);
await page.getByTestId("finish-complete").dblclick({ delay: 0 }); await page.waitForTimeout(2800);
await scene("cut=1&stock=2", "CUT付きプロファイル: 完成 → CUT（CUTの表示・操作は変更なし）", 600);
await page.getByRole("button", { name: /パセリ/ }).click(); await page.waitForTimeout(600);
await tap(0.5, 0.5); await page.waitForTimeout(900);
await page.getByTestId("finish-complete").click(); await page.waitForTimeout(2600);
await scene("round=LUNCH_RUSH&post=2", "Lunch Rush: 仕上げ画面・↩・完成は出ない", 1600);
await scene("round=DINNER&post=2", "Dinner: 同上", 1600);
await scene("round=FREE_COOK&post=2", "Free Cooking: 同上", 1600);
await ctx.close();
await browser.close();
