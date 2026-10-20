// FIN-A screenshots (dev only): the real GameScreen at FINISH through e2e/harness/finish-screen.html. Needs `npm run dev` on 5183.
import { chromium } from "@playwright/test";
const out = process.argv[2];
const base = "http://localhost:5183/teto-pizza-game/e2e/harness/finish-screen.html";
const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [360, 800]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const [name, q] of [["perfect-post0", "bake=perfect&post=0"], ["perfect-post3", "bake=perfect&post=3"], ["raw-post3", "bake=raw&post=3"], ["burnt-post3", "bake=burnt&post=3"], ["cut-after-finish", "cut=1&bake=perfect&post=2"]]) {
    await page.goto(`${base}?${q}`);
    await page.waitForSelector(".pizza-dough");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${w}x${h}-${name}.png` });
  }
  await page.close();
}
await browser.close();
