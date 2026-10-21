// FIN-C screenshots (dev only): the FINISH ↩ / 完成 bar on the real GameScreen through e2e/harness/finish-screen.html. Needs `npm run dev` on 5183.
// node tools/finishBarFinCShots.mjs <outDir>   (the FIN-B shots in docs/reports/screenshots/fin-b-finish-tray/ are the "before": tray + ヒント only)
import { chromium } from "@playwright/test";
const out = process.argv[2];
const base = "http://localhost:5183/teto-pizza-game/e2e/harness/finish-screen.html";
const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [360, 800]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const shot = (name) => page.screenshot({ path: `${out}/${w}x${h}-${name}.png` });
  const open = async (q) => { await page.goto(`${base}?${q}`); await page.waitForSelector(".pizza-dough"); await page.waitForTimeout(500); };
  const tap = async (fx, fy) => { const b = await page.locator(".pizza-dough").boundingBox(); await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy); await page.waitForTimeout(250); };
  await open("bake=perfect&stock=3");
  await shot("after-bar-undo-disabled");
  await page.getByRole("button", { name: /パセリ/ }).click();
  await tap(0.4, 0.4); await tap(0.6, 0.55);
  await shot("after-bar-undo-enabled");
  await page.getByTestId("finish-undo").click(); await page.waitForTimeout(250);
  await shot("after-undo-once");
  await open("bake=perfect&stock=1");
  await page.getByRole("button", { name: /パセリ/ }).click();
  await tap(0.5, 0.5);
  await shot("after-stock0-selection-released");
  await open("bake=perfect&late=3&stock=3&post=1");
  await shot("after-bar-3-chips");
  await open("owned=none");
  await shot("after-empty-tray-note");
  await open("bake=perfect&stock=3");
  await page.getByTestId("finish-complete").click(); await page.waitForTimeout(800);
  await shot("after-complete-zero-failed-result");
  await page.close();
}
await browser.close();
