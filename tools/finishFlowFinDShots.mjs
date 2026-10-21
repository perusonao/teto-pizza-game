// FIN-D screenshots (dev only): BAKE -> FINISH -> RESULT on the real GameScreen through e2e/harness/finish-screen.html?start=bake. Needs `npm run dev` on 5183.
// node tools/finishFlowFinDShots.mjs <outDir>
import { chromium } from "@playwright/test";
const out = process.argv[2];
const base = "http://localhost:5183/teto-pizza-game/e2e/harness/finish-screen.html";
const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [360, 800]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const shot = (name) => page.screenshot({ path: `${out}/${w}x${h}-${name}.png` });
  const open = async (q) => { await page.goto(`${base}?start=bake&${q}`); await page.waitForSelector(".game-screen"); await page.waitForTimeout(500); };
  const bake = (v) => page.evaluate((n) => window.__confirmBake(n), v);
  const tap = async (fx, fy) => { const b = await page.locator(".pizza-dough").boundingBox(); await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy); await page.waitForTimeout(250); };
  await open("stock=3");
  await shot("1-bake");
  await bake(70); await page.waitForTimeout(600);
  await shot("2-finish-empty");
  await page.getByRole("button", { name: /パセリ/ }).click();
  await tap(0.4, 0.4); await tap(0.6, 0.55);
  await shot("3-finish-placed-2");
  await page.getByTestId("finish-complete").click(); await page.waitForTimeout(900);
  await shot("4-result-success");
  await open("stock=3");
  await bake(70); await page.waitForTimeout(500);
  await page.getByTestId("finish-complete").click(); await page.waitForTimeout(900);
  await shot("5-result-failed-zero-late");
  await open("stock=3");
  await bake(40); await page.waitForTimeout(900);
  await shot("6-bake-failed-skips-finish");
  await page.close();
}
await browser.close();
