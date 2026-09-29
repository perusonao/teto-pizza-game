import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { INGREDIENTS } from "../../src/data/ingredients";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "../../e2e/gestures";

/**
 * LC-R2 Human Feel harness: what would the FREE Cooking TOPPING tray look like if the hand held 9 vs 12
 * ingredients? No production change is needed: the tray already shows exactly the OWNED ingredients of the
 * step's category, so seeding the save with the first N toppings (catalog order = the empty-session hand fill)
 * reproduces the tray a hand of N would produce. N = 22 is today's production tray (no hand, 4 pages).
 *
 * Output: docs/reports/data/TETO_LARGE-CATALOG-UX_HAND-CAPACITY-COMPARISON.json (numbers only; the Owner's
 * 9 / 12 choice still needs a real-device thumb check, see the LC-R2 Result Report).
 */

const SAVE_KEY = "teto-pizza-save-v1";
const VIEWPORTS = [
  { id: "390x844", width: 390, height: 844 },
  { id: "360x800", width: 360, height: 800 },
  { id: "390x664", width: 390, height: 664 },
  { id: "360x640", width: 360, height: 640 },
] as const;
const HAND_SIZES = [9, 12, 22] as const;
const toppingIds = INGREDIENTS.filter((i) => i.category === "topping").map((i) => i.id);
const nonTopping = INGREDIENTS.filter((i) => i.category !== "topping").map((i) => i.id);

async function toToppingStep(page: Page, toppings: number, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("icons/icon-16.png");
  const save = {
    schemaVersion: 2,
    dex: [],
    pitzBalance: 0,
    ownedIngredientIds: [...nonTopping, ...toppingIds.slice(0, toppings)],
    missionBest: {},
  };
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [SAVE_KEY, JSON.stringify(save)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /フリークッキング/ }).click();
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
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

async function measure(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
    };
    const chips = [...document.querySelectorAll(".ingredient-chip")];
    const nav = document.querySelector(".ingredient-page-nav:not(.ingredient-page-nav--placeholder)");
    const bar = document.querySelector(".prepare-bake-bar");
    const label = nav?.querySelector(".ingredient-page-nav__label")?.textContent ?? null;
    const dough = box(document.querySelector(".pizza-dough"));
    const panel = box(document.querySelector(".ingredient-panel"));
    const chip0 = chips[0] ? box(chips[0]) : null;
    return {
      doughDiameter: dough?.w ?? null,
      dockHeight: box(document.querySelector(".prepare-dock"))?.h ?? null,
      panelHeight: panel?.h ?? null,
      chipsOnPage: chips.length,
      chipSize: chip0 ? { w: chip0.w, h: chip0.h } : null,
      chipRows: new Set(chips.map((c) => Math.round(c.getBoundingClientRect().y))).size,
      pagerVisible: nav !== null,
      pagerLabel: label,
      pagerHeight: box(nav)?.h ?? null,
      lowestChipBottom: chips.length ? Math.max(...chips.map((c) => c.getBoundingClientRect().bottom)) : null,
      bakeBarTop: bar ? bar.getBoundingClientRect().y : null,
      gameScreenScrolls: (() => {
        const el = document.querySelector(".game-screen");
        return el ? el.scrollHeight > el.clientHeight : null;
      })(),
    };
  });
}

test("LC-R2 hand capacity comparison (9 vs 12 vs today's 22)", async ({ page }) => {
  test.setTimeout(240_000);
  const out: Record<string, Record<string, unknown>> = {};
  for (const vp of VIEWPORTS) {
    out[vp.id] = {};
    for (const n of HAND_SIZES) {
      await toToppingStep(page, n, vp.width, vp.height);
      const first = await measure(page);
      let second: Awaited<ReturnType<typeof measure>> | null = null;
      if (first.pagerVisible) {
        await page.getByRole("button", { name: "次のページ" }).click();
        second = await measure(page);
      }
      out[vp.id][`hand${n}`] = { page1: first, page2: second };
    }
  }
  const file = join(process.cwd(), "docs/reports/data/TETO_LARGE-CATALOG-UX_HAND-CAPACITY-COMPARISON.json");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify(
      {
        generatedBy: "tools/large-catalog-ux/hand-capacity.measure.spec.ts",
        note: "Toppings step of FREE Cooking with the first N toppings owned (= the tray a hand of N would show). hand22 = today's production tray. Chromium desktop emulation at the four Owner viewports; no safe-area inset.",
        viewports: out,
      },
      null,
      2,
    ) + "\n",
  );
});
