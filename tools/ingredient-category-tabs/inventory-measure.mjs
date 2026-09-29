#!/usr/bin/env node
/**
 * Ingredient Category Tabs 1.0 Phase 4 Fresh Audit: measures the CURRENT Ingredients (Inventory)
 * overlay and a DOM-injected prototype of the Phase 3 shelf chip row (no source change, nothing
 * written to the app). Needs a served production build:
 *   npm run build && npx vite preview --port 4173 --strictPort
 *   PW_CHROMIUM=<chromium> node tools/ingredient-category-tabs/inventory-measure.mjs [baseUrl]
 */
import { chromium } from "@playwright/test";
const BASE = process.argv[2] ?? "http://localhost:4173/teto-pizza-game/";
const KEY = "teto-pizza-save-v1";
const FINITE = ["olive-oil","pesto","gorgonzola","parmigiano","fontina","garlic","oregano","cherry-tomato","egg","mushroom","onion","sausage","pepperoni","anchovy","tuna","rosemary","bacon","ham","black-olive","capers","clam","corn","eggplant","fresh-tomato","pineapple","potato"];
const S = ["tomato-sauce", "mozzarella", "basil"];
const save = (owned) => ({ schemaVersion: 2, dex: [{ recipeId: "margherita", discovered: true, bestScore: 72, bestStars: 3, timesMade: 2 }], pitzBalance: 100, ownedIngredientIds: [...S, ...owned], missionBest: {}, inventory: Object.fromEntries(owned.map((i) => [i, 9])), starterGrantClaimedRecipeIds: [], unlockedForShopIngredientIds: owned });
const LABELS = ["すべて","ソース","チーズ","肉","魚介","野菜・きのこ","果物","ハーブ・香味","スパイス・薬味","その他"];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const out = {};
for (const [W, H] of [[390, 844], [360, 800]]) {
  const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
  const r = {};
  for (const [name, owned] of [["startersOnly", []], ["fullOwnership", FINITE]]) {
    await page.goto(BASE + "icons/icon-16.png");
    await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [KEY, JSON.stringify(save(owned))]);
    await page.goto(BASE); await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /材料/ }).click();
    await page.waitForSelector(".inventory-grid");
    const rect = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { y: Math.round(b.y), h: Math.round(b.height), w: Math.round(b.width) }; }, sel);
    const cur = {
      cards: await page.locator(".inventory-card").count(),
      summary: await rect(".inventory-overlay__summary"),
      tabs: await rect(".inventory-tabs"),
      tabMinH: await page.evaluate(() => Math.min(...[...document.querySelectorAll(".inventory-tab")].map((t) => t.getBoundingClientRect().height))),
      tabFontPx: await page.evaluate(() => getComputedStyle(document.querySelector(".inventory-tab")).fontSize),
      tabRoles: await page.evaluate(() => ({ tablist: document.querySelectorAll("[role=tablist]").length, tab: document.querySelectorAll("[role=tab]").length })),
      grid: await rect(".inventory-grid"),
      card: await rect(".inventory-card"),
      body: await page.evaluate(() => { const b = document.querySelector(".dex-overlay__body"); const cs = getComputedStyle(b); return { display: cs.display, flexDirection: cs.flexDirection, clientH: b.clientHeight, scrollH: b.scrollHeight, overflowY: cs.overflowY }; }),
      cardCategoryLabels: await page.evaluate(() => [...new Set([...document.querySelectorAll(".inventory-card__category")].map((e) => e.textContent))]),
    };
    // Prototype: replace .inventory-tabs with the Phase 3 chip row markup (CSS .shelf-chips ships in main).
    const proto = await page.evaluate((labels) => {
      const tabs = document.querySelector(".inventory-tabs");
      const row = document.createElement("div");
      row.className = "shelf-chips"; row.setAttribute("role", "group");
      for (const l of labels) { const b = document.createElement("button"); b.className = "shelf-chip"; b.textContent = l; row.appendChild(b); }
      row.style.marginBottom = "12px";
      tabs.replaceWith(row);
      const rr = row.getBoundingClientRect();
      const cs = [...row.children].map((c) => c.getBoundingClientRect());
      const grid = document.querySelector(".inventory-grid").getBoundingClientRect();
      const body = document.querySelector(".dex-overlay__body");
      return { rowH: Math.round(rr.height), minChipH: Math.round(Math.min(...cs.map((c) => c.height))), chipsInsideRow: cs.every((c) => c.top >= rr.top - 0.5 && c.bottom <= rr.bottom + 0.5), oneRow: new Set(cs.map((c) => Math.round(c.top))).size === 1, scrollable: row.scrollWidth > row.clientWidth + 1, pageOverflow: document.documentElement.scrollWidth > innerWidth, gridTop: Math.round(grid.top), bodyScrollH: body.scrollHeight };
    }, LABELS);
    r[name] = { current: cur, prototype: proto, deltaGridTop: proto.gridTop - (cur.grid?.y ?? 0) };
  }
  out[`${W}x${H}`] = r;
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
