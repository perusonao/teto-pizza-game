import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { INGREDIENTS } from "../../src/data/ingredients";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "../../e2e/gestures";
import { startTargetlessFreeCook } from "../../e2e/support/startFreeCook";

/**
 * Ingredient Pantry / Category Tabs geometry harness (measurement only; manual, NOT part of CI or `npm run test:e2e`):
 *   GEOMETRY_OUT=docs/reports/data/<file>.json npx playwright test -c tools/ingredient-category-tabs/playwright.pantry-family-geometry.config.ts
 *
 * Measures, at the four Owner viewports (390x844, 360x800, 390x664, 360x640), real layout of
 *  - the pantry sheet on the SAUCE step and on the 具材 step (normal), and on the 具材 step with a SIMULATED soft keyboard
 *    (Chromium cannot show one: `window.visualViewport` is replaced by a stand-in whose height is innerHeight - K, the same
 *    technique as e2e/large-catalog-pantry-search.spec.ts; K = 338 is the shrink measured on a real iPhone in the LC-R5-b
 *    Discovery, 300 / 380 are sensitivity),
 *  - the Inventory screen: すべて / 具材 / 具材 + one family.
 * It runs unchanged against `main` (before) and the branch (after): selectors that only exist after the change are optional.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const VIEWPORTS = [
  { id: "390x844", width: 390, height: 844 },
  { id: "360x800", width: 360, height: 800 },
  { id: "390x664", width: 390, height: 664 },
  { id: "360x640", width: 360, height: 640 },
] as const;
const KEYBOARDS = [300, 338, 380] as const;

const FAKE_VV = () => {
  class FakeViewport extends EventTarget {
    get width() { return window.innerWidth; }
    get height() { return (window as unknown as { __vvH?: number }).__vvH ?? window.innerHeight; }
    get offsetTop() { return 0; }
    get pageTop() { return 0; }
    get scale() { return 1; }
  }
  const vv = new FakeViewport();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
  (window as unknown as { __setVv: (h: number | null) => void }).__setVv = (h) => {
    (window as unknown as { __vvH?: number }).__vvH = h ?? undefined;
    vv.dispatchEvent(new Event("resize"));
  };
};

async function load(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("icons/icon-16.png");
  const save = {
    schemaVersion: 2,
    dex: [],
    pitzBalance: 0,
    ownedIngredientIds: INGREDIENTS.map((i) => i.id),
    missionBest: {},
    inventory: Object.fromEntries(INGREDIENTS.map((i) => [i.id, 9])),
    starterGrantClaimedRecipeIds: [],
  };
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(save)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function toSauce(page: Page) {
  await startTargetlessFreeCook(page); // needs a dev server with TETO_TEST_HOOKS=1 (the config below sets it)
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.waitForSelector(".ingredient-chip");
}
async function sauceToTopping(page: Page) {
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /モッツァレラ/ }).click();
  await tapDoughPercent(page, 40, 50);
  await tapDoughPercent(page, 60, 50);
  await tapDoughPercent(page, 50, 30);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.waitForSelector(".ingredient-chip");
}

/** Everything is read from the live layout: nothing is injected or assumed. */
const facts = (page: Page) =>
  page.evaluate(() => {
    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { y: +b.y.toFixed(1), h: +b.height.toFixed(1), b: +b.bottom.toFixed(1) };
    };
    const sheet = document.querySelector(".pantry-sheet");
    const list = document.querySelector<HTMLElement>(".pantry-sheet__list");
    const lr = list?.getBoundingClientRect();
    const tiles = [...document.querySelectorAll<HTMLElement>(".pantry-tile")].map((t) => t.getBoundingClientRect());
    // tile rows = tiles sharing a top (the grid is 3 columns); a row is "full" when it lies inside the list's visible box
    const rowTops = [...new Set(tiles.map((t) => Math.round(t.top - (lr?.top ?? 0) + (list?.scrollTop ?? 0))))];
    const fullRows = lr ? tiles.filter((t, i) => i % 3 === 0 && t.top >= lr.top - 0.5 && t.bottom <= lr.bottom + 0.5).length : 0;
    const rowHeights = tiles.filter((_, i) => i % 3 === 0).map((t, i) => Math.max(...tiles.slice(i * 3, i * 3 + 3).map((x) => x.height)));
    const family = [...document.querySelectorAll<HTMLElement>(".pantry-tile .family-tag")];
    return {
      sheet: r(sheet),
      subtitle: r(document.querySelector(".pantry-sheet__subtitle")),
      search: r(document.querySelector(".pantry-sheet__search")),
      chips: r(document.querySelector(".pantry-sheet__shelves")),
      list: r(list),
      tileRows: rowTops.length,
      firstRowH: rowHeights[0] ?? null,
      maxRowH: rowHeights.length ? Math.max(...rowHeights) : null,
      minRowH: rowHeights.length ? Math.min(...rowHeights) : null,
      fullRows,
      familyTagH: family.length ? Math.max(...family.map((f) => f.getBoundingClientRect().height)) : null,
      tilesOverflowX: tiles.some((t) => t.right > window.innerWidth + 0.5),
      docOverflowX: document.documentElement.scrollWidth > window.innerWidth,
      fit: sheet?.classList.contains("pantry-sheet--fit") ?? false,
    };
  });

const inventoryFacts = (page: Page) =>
  page.evaluate(() => {
    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { y: +b.y.toFixed(1), h: +b.height.toFixed(1), b: +b.bottom.toFixed(1) };
    };
    const list = document.querySelector<HTMLElement>(".inventory-overlay__list");
    const lr = list?.getBoundingClientRect();
    const cards = [...document.querySelectorAll<HTMLElement>(".inventory-card")].map((c) => c.getBoundingClientRect());
    const fullRows = lr ? cards.filter((c, i) => i % 3 === 0 && c.top >= lr.top - 0.5 && c.bottom <= lr.bottom + 0.5).length : 0;
    return {
      panel: r(document.querySelector(".inventory-overlay__panel")),
      tabs: r(document.querySelector(".inventory-overlay__shelves")),
      list: r(list),
      cardH: cards.length ? Math.max(...cards.map((c) => c.height)) : null,
      fullRows,
      docOverflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

test("pantry family geometry: pantry (sauce / 具材 / keyboard) and Inventory at four viewports", async ({ page }) => {
  test.setTimeout(900_000);
  await page.addInitScript(FAKE_VV);
  const out: Record<string, unknown> = { generatedBy: "tools/ingredient-category-tabs/pantry-family-geometry.measure.spec.ts", keyboardsPx: KEYBOARDS, viewports: {} };
  for (const vp of VIEWPORTS) {
    const perVp: Record<string, unknown> = {};
    // ---- Inventory (before: one chip row; after: two tiers)
    await load(page, vp.width, vp.height);
    await page.getByRole("button", { name: /材料/ }).click();
    await page.waitForSelector(".inventory-grid");
    perVp.inventoryAll = await inventoryFacts(page);
    if (await page.getByRole("group", { name: "材料の大分類" }).count()) {
      await page.getByRole("group", { name: "材料の大分類" }).getByRole("button", { name: "具材", exact: true }).click();
      perVp.inventoryTopping = await inventoryFacts(page);
      await page.getByRole("group", { name: "具材の分類" }).getByRole("button", { name: "肉系", exact: true }).click();
      perVp.inventoryToppingMeat = await inventoryFacts(page);
    }
    // ---- Pantry: sauce step, then 具材 step
    await load(page, vp.width, vp.height);
    await toSauce(page);
    await page.getByRole("button", { name: /食材庫/ }).click();
    await page.waitForSelector(".pantry-sheet__list");
    perVp.pantrySauce = await facts(page);
    await page.keyboard.press("Escape");
    await sauceToTopping(page);
    await page.getByRole("button", { name: /食材庫/ }).click();
    await page.waitForSelector(".pantry-sheet__search-input");
    perVp.pantryTopping = await facts(page);
    // the tallest tile (the long 「ちょっと変わった材料」 label may wrap) -- scroll it into the list's box and read it
    perVp.pantryToppingOtherTileH = await page.evaluate(() => {
      const t = [...document.querySelectorAll<HTMLElement>(".pantry-tile")].find((x) => /たまご|卵/.test(x.textContent ?? ""));
      return t ? +t.getBoundingClientRect().height.toFixed(1) : null;
    });
    await page.locator(".pantry-sheet__search-input").focus();
    for (const k of KEYBOARDS) {
      await page.evaluate((h) => (window as unknown as { __setVv: (h: number) => void }).__setVv(h), vp.height - k);
      await page.waitForFunction(() => document.querySelector(".pantry-sheet")?.classList.contains("pantry-sheet--fit"));
      await page.waitForTimeout(80);
      perVp[`pantryToppingKeyboard${k}`] = await facts(page);
    }
    await page.evaluate(() => (window as unknown as { __setVv: (h: number | null) => void }).__setVv(null));
    (out.viewports as Record<string, unknown>)[vp.id] = perVp;
  }
  const file = resolve(process.cwd(), process.env.GEOMETRY_OUT ?? "docs/reports/data/TETO_INGREDIENT-PANTRY-CATEGORY-TABS_GEOMETRY.json");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
});
