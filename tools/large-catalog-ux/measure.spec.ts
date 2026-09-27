import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { completeDoughStep } from "../../e2e/gestures";

/**
 * Large Catalog UX Fresh Design -- read-only measurement of the CURRENT UI (no src change).
 * See playwright.measure.config.ts. Every number is measured from real Chromium layout; the
 * 100+/172 projection lives in tools/large_catalog_ux_scale_model.py, which reads this output.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_JSON = join(ROOT, "docs/reports/data/TETO_LARGE-CATALOG-UX_UI-MEASUREMENTS.json");
const SHOT_DIR = join(ROOT, "docs/reports/screenshots/large-catalog-ux");
const SAVE_KEY = "teto-pizza-save-v1";

const VIEWPORTS = [
  { id: "360x640", width: 360, height: 640 },
  { id: "360x800", width: 360, height: 800 },
  { id: "390x844", width: 390, height: 844 },
];

// Every runtime ingredient (29). The three onboarding starters are unlimited; the rest get stock.
const FINITE = [
  "olive-oil", "pesto", "gorgonzola", "parmigiano", "fontina", "garlic", "oregano", "cherry-tomato",
  "egg", "mushroom", "onion", "sausage", "pepperoni", "anchovy", "tuna", "rosemary", "bacon", "ham",
  "black-olive", "capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato",
];
const DEX11 = [
  "margherita", "bismarck", "breakfast-pizza", "funghi", "melanzane-pizza", "parmigiana-pizza",
  "pepperoni", "salsiccia", "meat-lovers", "bambino", "hawaiian",
];

function save(discovered: readonly string[]) {
  return {
    schemaVersion: 2,
    dex: discovered.map((recipeId) => ({ recipeId, discovered: true, bestScore: 72, bestStars: 3, timesMade: 2 })),
    pitzBalance: 999,
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...FINITE],
    missionBest: {},
    // A few 0-stock rows so the disabled-chip state is visible in the measurement.
    inventory: Object.fromEntries(FINITE.map((id, i) => [id, i % 7 === 3 ? 0 : 9])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: FINITE,
  };
}

async function openWith(page: Page, data: unknown) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(
    ([key, value]) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    },
    [SAVE_KEY, JSON.stringify(data)] as const,
  );
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}

async function shot(page: Page, name: string) {
  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: join(SHOT_DIR, `${name}.png`) });
}

/** Scroll facts of the first matching element (the element that actually scrolls). */
async function scrollBox(page: Page, selectors: string[]) {
  return page.evaluate((sels) => {
    for (const sel of sels) {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) continue;
      if (el.scrollHeight > el.clientHeight + 1 || sel === sels[sels.length - 1]) {
        return { selector: sel, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
      }
    }
    const d = document.scrollingElement!;
    return { selector: "document", scrollHeight: d.scrollHeight, clientHeight: d.clientHeight };
  }, selectors);
}

async function boxes(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const list = [...document.querySelectorAll<HTMLElement>(sel)].map((el) => el.getBoundingClientRect());
    if (list.length === 0) return { count: 0 };
    const heights = list.map((r) => r.height);
    // Most elements sharing one row top = the column count.
    const tops = list.map((r) => Math.round(r.top));
    const columns = Math.max(...tops.map((t) => tops.filter((u) => u === t).length));
    return {
      count: list.length,
      width: Math.round(list[0].width),
      heightMin: Math.round(Math.min(...heights)),
      heightMax: Math.round(Math.max(...heights)),
      columns,
    };
  }, selector);
}

async function rect(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  return b ? { y: Math.round(b.y), height: Math.round(b.height), width: Math.round(b.width) } : null;
}

const results: Record<string, unknown> = {};

for (const vp of VIEWPORTS) {
  test(`measure ${vp.id}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const r: Record<string, unknown> = { viewport: vp };

    // --- Free Cooking tray (all 29 owned) ---------------------------------------------------
    await openWith(page, save(DEX11));
    await page.getByRole("button", { name: /フリークッキング/ }).first().click();
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();
    const tray: Record<string, unknown> = {};
    for (const step of ["SAUCE", "CHEESE", "TOPPING"]) {
      if (step !== "SAUCE") await page.getByRole("button", { name: /次へ/ }).click();
      await page.waitForSelector(".ingredient-chip");
      const pager = await page.locator(".ingredient-page-nav__label").first().textContent().catch(() => null);
      tray[step] = {
        chips: await boxes(page, ".ingredient-chip"),
        pagerLabel: pager?.trim() ?? null,
        pagerVisible: (await page.locator(".ingredient-page-nav:not(.ingredient-page-nav--placeholder)").count()) > 0,
        trayRect: await rect(page, ".ingredient-tray"),
        pagerRect: await rect(page, ".ingredient-page-nav"),
        stageRect: await rect(page, ".pizza-stage"),
        bakeBarRect: await rect(page, ".prepare-bake-bar"),
        gameScreen: await scrollBox(page, [".game-screen"]),
      };
      await shot(page, `${vp.id}_free-cook_${step.toLowerCase()}`);
    }
    r.freeCookTray = tray;

    // Hint sheet on top of the TOPPING step (DEX11 save has a DISCOVERABLE target).
    const hintButton = page.getByRole("button", { name: /^.*ヒント$/ }).first();
    if (await hintButton.count()) {
      await hintButton.click();
      await page.waitForSelector(".hint-sheet", { timeout: 5_000 }).catch(() => undefined);
      r.hintSheet = {
        sheetRect: await rect(page, ".hint-sheet"),
        body: await scrollBox(page, [".hint-sheet__body", ".hint-sheet"]),
      };
      await shot(page, `${vp.id}_hint-sheet`);
    }

    // --- Recipe Dex / Pizza Select / Shop / Inventory ---------------------------------------
    for (const [label, discovered] of [
      ["dex11", DEX11],
      ["dex0", ["margherita"]],
    ] as const) {
      await openWith(page, save(discovered));
      await page.getByRole("button", { name: /ピザ図鑑/ }).click();
      await page.waitForSelector(".dex-overlay__body");
      r[`dex_${label}`] = {
        body: await scrollBox(page, [".dex-overlay__body"]),
        lockedCard: await boxes(page, ".dex-card--locked"),
        discoveredCard: await boxes(page, ".dex-card:not(.dex-card--locked)"),
        taggedCard: await boxes(page, ".dex-card--tagged"),
        chapterTitle: await boxes(page, ".dex-overlay__chapter-title"),
        progressRect: await rect(page, ".dex-overlay__progress"),
        domElements: await page.evaluate(() => document.querySelectorAll(".dex-overlay *").length),
      };
      await shot(page, `${vp.id}_dex_${label}`);
      await page.getByRole("button", { name: "閉じる" }).first().click();

      await page.getByRole("button", { name: /ピザを作る/ }).first().click();
      await page.waitForSelector(".pizza-select-screen");
      r[`pizzaSelect_${label}`] = {
        body: await scrollBox(page, [".pizza-select-body", ".pizza-select-screen", ".app-frame"]),
        gridCard: await boxes(page, ".pizza-select-grid-card"),
        sectionTitle: await boxes(page, ".pizza-select-section__title"),
        prompt: await rect(page, ".pizza-select-prompt"),
        domElements: await page.evaluate(() => document.querySelectorAll(".pizza-select-screen *").length),
      };
      await shot(page, `${vp.id}_pizza-select_${label}`);
    }

    await openWith(page, save(DEX11));
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__body");
    r.shop = {
      body: await scrollBox(page, [".shop-overlay__body"]),
      row: await boxes(page, ".shop-item"),
      tabs: await boxes(page, ".shop-filter-tab"),
      listTop: await rect(page, ".shop-overlay__list"),
      domElements: await page.evaluate(() => document.querySelectorAll(".dex-overlay *").length),
    };
    await shot(page, `${vp.id}_shop`);
    await page.getByRole("button", { name: "閉じる" }).first().click();

    await page.getByRole("button", { name: /材料/ }).click();
    await page.waitForSelector(".inventory-grid");
    r.inventory = {
      body: await scrollBox(page, [".inventory-overlay__panel .dex-overlay__body"]),
      card: await boxes(page, ".inventory-card"),
      gridTop: await rect(page, ".inventory-grid"),
    };
    await shot(page, `${vp.id}_inventory`);

    results[vp.id] = r;
  });
}

test.afterAll(() => {
  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        generatedBy: "tools/large-catalog-ux/measure.spec.ts",
        note: "Measured on the unchanged production UI (Chromium). Runtime catalog: 25 recipes / 29 ingredients.",
        saves: { dex11: DEX11, dex0: ["margherita"], ownedIngredientCount: 29 },
        viewports: results,
      },
      null,
      2,
    ) + "\n",
  );
});
