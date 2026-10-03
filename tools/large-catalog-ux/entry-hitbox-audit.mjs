#!/usr/bin/env node
/**
 * LC-R3 entry hit-box audit (manual): samples elementFromPoint on a 0.5px grid around the 食材庫 entry and the
 * chip row above it, at the four Owner viewports, on the SAUCE / CHEESE / TOPPING steps. Reports how many CSS px of
 * an ingredient chip's own box resolve to the entry ("stolen"), the deepest such intrusion, and whether the visible
 * chip content (emoji / name / stock) is ever affected. Output: docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R3_ENTRY-HITBOX-AUDIT.json
 *   npm run dev -- --port 5183 --strictPort   # in another shell
 *   node tools/large-catalog-ux/entry-hitbox-audit.mjs
 */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:5183/teto-pizza-game/";
const IDS = [
  "tomato-sauce", "olive-oil", "pesto", "mozzarella", "gorgonzola", "parmigiano", "fontina", "basil", "garlic", "oregano",
  "cherry-tomato", "egg", "mushroom", "onion", "sausage", "pepperoni", "anchovy", "tuna", "rosemary", "bacon", "ham",
  "black-olive", "capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato",
];
const SAVE = { schemaVersion: 2, dex: [], pitzBalance: 0, ownedIngredientIds: IDS, missionBest: {}, inventory: Object.fromEntries(IDS.map((i) => [i, 9])), starterGrantClaimedRecipeIds: [] };
const VIEWPORTS = [[390, 844], [360, 800], [390, 664], [360, 640]];

async function tap(page, xp, yp) {
  const b = await page.locator(".pizza-dough").boundingBox();
  await page.mouse.move(b.x + (xp / 100) * b.width, b.y + (yp / 100) * b.height);
  await page.mouse.down();
  await page.mouse.up();
}

async function audit(page) {
  return page.evaluate(() => {
    const entry = document.querySelector(".pantry-entry");
    if (!entry) return null;
    const er = entry.getBoundingClientRect();
    const chips = [...document.querySelectorAll(".ingredient-chip")];
    const chipRects = chips.map((c) => c.getBoundingClientRect());
    const bar = document.querySelector(".prepare-bake-bar")?.getBoundingClientRect() ?? null;
    const cs = getComputedStyle(entry, "::after");
    const x0 = Math.floor(er.left - 12);
    const x1 = Math.ceil(er.right + 12);
    const lowestChip = Math.max(...chipRects.map((r) => r.bottom));
    const y0 = Math.floor(lowestChip - 6);
    const y1 = Math.ceil((bar?.top ?? er.bottom + 12) + 2);
    let stolen = 0;
    let maxDepth = 0;
    let entryPoints = 0;
    let barPoints = 0;
    let stolenOverContent = 0;
    const step = 0.5;
    for (let y = y0; y <= y1; y += step) {
      for (let x = x0; x <= x1; x += step) {
        const top = document.elementFromPoint(x, y);
        const isEntry = !!top?.closest(".pantry-entry");
        const inChip = chipRects.findIndex((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
        if (isEntry) entryPoints += 1;
        if (top?.closest(".prepare-bake-bar") && y >= er.bottom - 1) barPoints += 1;
        if (isEntry && inChip >= 0) {
          stolen += 1;
          maxDepth = Math.max(maxDepth, chipRects[inChip].bottom - y);
          // is the stolen point on text/emoji/stock content of that chip?
          const chip = chips[inChip];
          const content = [...chip.querySelectorAll(".ingredient-chip__emoji, .ingredient-chip__name, .ingredient-chip__stock, .ingredient-chip__cheese-slot")]
            .some((n) => { const r = n.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
          if (content) stolenOverContent += 1;
        }
      }
    }
    const chipStyle = getComputedStyle(chips[0]);
    return {
      entryRect: { x: er.x, y: er.y, w: er.width, h: er.height, r: er.right, b: er.bottom },
      lowestChipBottom: lowestChip,
      barTop: bar?.top ?? null,
      afterInset: { top: cs.top, right: cs.right, bottom: cs.bottom, left: cs.left },
      entryZ: getComputedStyle(entry).zIndex,
      entryPosition: getComputedStyle(entry).position,
      chipPosition: chipStyle.position,
      chipBorderBottomWidth: chipStyle.borderBottomWidth,
      chipPaddingBottom: chipStyle.paddingBottom,
      sampledStepPx: step,
      entryHitPointsSampled: entryPoints,
      barPointsBelowEntry: barPoints,
      stolenChipAreaCssPx2: stolen * step * step,
      maxIntrusionIntoChipPx: maxDepth,
      stolenPointsOverChipContent: stolenOverContent,
      hitHeightPx: null,
    };
  });
}

const browser = await chromium.launch();
const out = {};
try {
  for (const [w, h] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE + "icons/icon-16.png");
    await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, ["teto-pizza-save-v1", JSON.stringify(SAVE)]);
    await page.goto(BASE);
    await page.waitForSelector(".app-frame");
    await page.getByRole("button", { name: /レシピ発見/ }).click();
    await page.waitForSelector(".pizza-stage");
    const dough = await page.locator(".pizza-dough").boundingBox();
    for (let i = 0; i < 8; i += 1) { const a = (i / 8) * Math.PI * 2; await page.mouse.move(dough.x + dough.width / 2 + Math.cos(a) * dough.width * 0.466, dough.y + dough.height / 2 + Math.sin(a) * dough.width * 0.466); await page.mouse.down(); await page.mouse.up(); }
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.waitForSelector(".ingredient-chip");
    const r = { sauce: await audit(page) };
    await page.getByRole("button", { name: /トマトソース/ }).click();
    for (let i = 0; i < 16; i += 1) { const a = (i / 16) * Math.PI * 2; await tap(page, 50 + Math.cos(a) * 25, 50 + Math.sin(a) * 25); }
    await page.getByRole("button", { name: /次へ/ }).click();
    r.cheese = await audit(page);
    await page.getByRole("button", { name: /モッツァレラ/ }).click();
    await tap(page, 40, 50); await tap(page, 60, 50); await tap(page, 50, 30);
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.waitForSelector(".ingredient-chip");
    r.topping = await audit(page);
    // behavioural probes on the topping step: (1) a tap at the deepest stolen point, (2) taps inside the chip
    // content and on the chip's bottom edge outside the entry column still select the chip.
    const t = r.topping;
    // The chip row that sits directly above the entry is the BOTTOM row; its first chip is the 4th chip.
    const chipBox = await page.locator(".ingredient-chip").nth(3).boundingBox();
    const entryCx = t.entryRect.x + t.entryRect.w / 2;
    const probe = async (x, y) => page.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px, py);
      return el?.closest(".pantry-entry") ? "entry" : el?.closest(".ingredient-chip") ? "chip" : (el?.className || el?.tagName);
    }, [x, y]);
    r.probes = {
      bottomRowFirstChipCenter: await probe(chipBox.x + chipBox.width / 2, chipBox.y + chipBox.height / 2),
      bottomRowFirstChip_bottomMinus1_underEntryColumn: await probe(entryCx, chipBox.y + chipBox.height - 1),
      bottomRowFirstChip_bottomMinus2_5_underEntryColumn: await probe(entryCx, chipBox.y + chipBox.height - 2.5),
      bottomRowFirstChip_bottomMinus3_underEntryColumn: await probe(entryCx, chipBox.y + chipBox.height - 3),
      bottomRowFirstChip_bottomMinus1_rightOfEntryColumn: await probe(chipBox.x + chipBox.width - 6, chipBox.y + chipBox.height - 1),
      bottomRowSecondChip_bottomMinus1: await probe(chipBox.x + chipBox.width + 8 + 30, chipBox.y + chipBox.height - 1),
    };
    r.hitHeightPx = 28 + 8 + 8;
    out[`${w}x${h}`] = r;
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync("docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R3_ENTRY-HITBOX-AUDIT.json", JSON.stringify(out, null, 2) + "\n");
for (const [vp, r] of Object.entries(out)) {
  for (const step of ["sauce", "cheese", "topping"]) {
    const a = r[step];
    console.log(vp, step, a ? `stolen=${a.stolenChipAreaCssPx2}px² maxDepth=${a.maxIntrusionIntoChipPx}px overContent=${a.stolenPointsOverChipContent} entryPts=${a.entryHitPointsSampled} chipBottom=${a.lowestChipBottom} entry=${a.entryRect.y}..${a.entryRect.b} bar=${a.barTop}` : "no entry");
  }
  console.log(vp, "probes", JSON.stringify(r.probes));
}
