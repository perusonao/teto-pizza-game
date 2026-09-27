import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Large Catalog UX — Owner Decision Gate measurements (LC-OD-12 Pizza Select columns).
 *
 * Read-only against the unchanged production UI. The 3-column variants are PROTOTYPES: a style tag
 * injected into this test page only (page.addStyleTag), never a change to src/App.css. They exist
 * so the Owner can compare 2 vs 3 columns on real layout before any CSS is written.
 *
 *   npx playwright test -c tools/large-catalog-ux/playwright.measure.config.ts gate.measure
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_JSON = join(ROOT, "docs/reports/data/TETO_LARGE-CATALOG-UX_GATE-MEASUREMENTS.json");
const SHOT_DIR = join(ROOT, "docs/reports/screenshots/large-catalog-ux/gate");
const SAVE_KEY = "teto-pizza-save-v1";

const VIEWPORTS = [
  { id: "390x844", width: 390, height: 844 },
  { id: "360x800", width: 360, height: 800 },
  { id: "390x664", width: 390, height: 664 },
  { id: "360x640", width: 360, height: 640 },
];

const ALL_RECIPES = [
  "margherita", "marinara", "quattro-formaggi", "genovese", "bismarck", "funghi", "fugazza",
  "salsiccia", "pepperoni", "napoletana", "tonno-e-cipolla", "pizza-bianca", "breakfast-pizza",
  "capricciosa", "meat-lovers", "melanzane-pizza", "parmigiana-pizza", "bambino", "hawaiian",
  "pizza-portuguesa", "pesto-tonno", "new-haven-apizza", "pesto-caprese", "pesto-patate",
  "puttanesca-pizza",
];
const FINITE = [
  "olive-oil", "pesto", "gorgonzola", "parmigiano", "fontina", "garlic", "oregano", "cherry-tomato",
  "egg", "mushroom", "onion", "sausage", "pepperoni", "anchovy", "tuna", "rosemary", "bacon", "ham",
  "black-olive", "capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato",
];

const SAVE = {
  schemaVersion: 2,
  dex: ALL_RECIPES.map((recipeId) => ({ recipeId, discovered: true, bestScore: 72, bestStars: 3, timesMade: 2 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...FINITE],
  missionBest: {},
  inventory: Object.fromEntries(FINITE.map((id) => [id, 9])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: FINITE,
};

/** Prototype variants (test page only). */
const VARIANTS: Record<string, string | null> = {
  "2col-current": null,
  "3col-thumb64": `
    .pizza-select-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px !important; }
    .pizza-select-grid-card { min-height: 0 !important; padding: 10px 4px 8px !important; gap: 4px !important; }
    .pizza-select-grid-card .pizza-thumbnail { width: 64px !important; height: 64px !important; }
  `,
  "3col-thumb76": `
    .pizza-select-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px !important; }
    .pizza-select-grid-card { min-height: 0 !important; padding: 10px 4px 8px !important; gap: 4px !important; }
  `,
};

async function open(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(
    ([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    },
    [SAVE_KEY, JSON.stringify(SAVE)] as const,
  );
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

const results: Record<string, Record<string, unknown>> = {};

for (const vp of VIEWPORTS) {
  for (const [variant, css] of Object.entries(VARIANTS)) {
    test(`pizza select ${variant} ${vp.id}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await open(page);
      await page.getByRole("button", { name: /ピザを作る/ }).first().click();
      await page.waitForSelector(".pizza-select-grid-card");
      if (css) await page.addStyleTag({ content: css });
      await page.waitForTimeout(100);
      const m = await page.evaluate(() => {
        const body = document.querySelector<HTMLElement>(".pizza-select-body")!;
        const bodyRect = body.getBoundingClientRect();
        const cards = [...document.querySelectorAll<HTMLElement>(".pizza-select-grid-card")];
        const per = cards.map((card) => {
          const r = card.getBoundingClientRect();
          const name = card.querySelector<HTMLElement>(".pizza-select-card__name")!;
          const cs = getComputedStyle(name);
          const fontSize = parseFloat(cs.fontSize);
          const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.2;
          const thumb = card.querySelector<HTMLElement>(".pizza-thumbnail")!.getBoundingClientRect();
          return {
            name: name.textContent ?? "",
            w: r.width,
            h: r.height,
            top: r.top,
            bottom: r.bottom,
            fontSize,
            lines: Math.round(name.getBoundingClientRect().height / lineHeight),
            overflowX: name.scrollWidth > name.clientWidth + 1,
            thumb: thumb.width,
          };
        });
        const tops = per.map((p) => Math.round(p.top));
        const columns = Math.max(...tops.map((t) => tops.filter((u) => u === t).length));
        const firstScreen = per.filter((p) => p.top >= bodyRect.top && p.bottom <= bodyRect.bottom).length;
        const fonts = per.map((p) => p.fontSize);
        const lines = per.map((p) => p.lines);
        return {
          columns,
          cardWidth: Math.round(per[0].w),
          cardHeightMin: Math.round(Math.min(...per.map((p) => p.h))),
          cardHeightMax: Math.round(Math.max(...per.map((p) => p.h))),
          thumbnail: Math.round(per[0].thumb),
          nameFontMin: Math.min(...fonts),
          nameFontMax: Math.max(...fonts),
          nameTwoLineCount: lines.filter((l) => l >= 2).length,
          nameThreePlusLineCount: lines.filter((l) => l >= 3).length,
          nameOverflowCount: per.filter((p) => p.overflowX).length,
          longestName: per.reduce((a, b) => ([...b.name].length > [...a.name].length ? b : a)).name,
          fullyVisibleCardsFirstScreen: firstScreen,
          scrollHeight: body.scrollHeight,
          clientHeight: body.clientHeight,
          cards: per.length,
        };
      });
      mkdirSync(SHOT_DIR, { recursive: true });
      await page.screenshot({ path: join(SHOT_DIR, `${vp.id}_pizza-select_${variant}.png`) });
      (results[vp.id] ??= {})[variant] = m;
    });
  }
}

test.afterAll(() => {
  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        generatedBy: "tools/large-catalog-ux/gate.measure.spec.ts",
        note:
          "Pizza Select with all 25 recipes discovered. 3-column variants are test-page-only CSS prototypes " +
          "(page.addStyleTag), not production CSS.",
        variants: Object.keys(VARIANTS),
        viewports: results,
      },
      null,
      2,
    ) + "\n",
  );
});
