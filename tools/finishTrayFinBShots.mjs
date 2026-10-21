// FIN-B screenshots (dev only): the FINISH tray on the real GameScreen through e2e/harness/finish-screen.html. Needs `npm run dev` on 5183.
// node tools/finishTrayFinBShots.mjs <outDir>   (the FIN-A shots in docs/reports/screenshots/fin-a-finish-screen/ are the "before")
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
  await shot("after-tray-post0");
  await page.getByRole("button", { name: /パセリ/ }).click();
  await page.waitForTimeout(250);
  await shot("after-selected");
  await tap(0.4, 0.4); await tap(0.6, 0.55);
  await shot("after-placed-2");
  await tap(0.5, 0.7);
  await shot("after-stock-limit");
  await open("bake=perfect&late=3&stock=3");
  await shot("after-tray-3-chips");
  await open("bake=raw&stock=3&post=2");
  await shot("after-raw-post2");
  await page.close();
}
await browser.close();
