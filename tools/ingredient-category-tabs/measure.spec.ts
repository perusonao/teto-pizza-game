import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { completeDoughStep } from "../../e2e/gestures";

/** Ingredient Category Tabs 1.0 Phase 0 -- measures the unchanged production UI (see config). */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_JSON = join(ROOT, "docs/reports/data/TETO_INGREDIENT-CATEGORY-TABS_UI-MEASUREMENTS.json");
const SAVE_KEY = "teto-pizza-save-v1";
const VIEWPORTS = [
  { id: "360x800", width: 360, height: 800 },
  { id: "390x844", width: 390, height: 844 },
];
const FINITE = [
  "olive-oil", "pesto", "gorgonzola", "parmigiano", "fontina", "garlic", "oregano", "cherry-tomato",
  "egg", "mushroom", "onion", "sausage", "pepperoni", "anchovy", "tuna", "rosemary", "bacon", "ham",
  "black-olive", "capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato",
];
const DEX11 = [
  "margherita", "bismarck", "breakfast-pizza", "funghi", "melanzane-pizza", "parmigiana-pizza",
  "pepperoni", "salsiccia", "meat-lovers", "bambino", "hawaiian",
];
const save = () => ({
  schemaVersion: 2,
  dex: DEX11.map((recipeId) => ({ recipeId, discovered: true, bestScore: 72, bestStars: 3, timesMade: 2 })),
  pitzBalance: 999,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...FINITE],
  missionBest: {},
  inventory: Object.fromEntries(FINITE.map((id) => [id, 9])),
  starterGrantClaimedRecipeIds: [],
  unlockedForShopIngredientIds: FINITE,
});

async function openWith(page: Page) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [SAVE_KEY, JSON.stringify(save())] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}
const rect = async (page: Page, sel: string) => {
  const b = await page.locator(sel).first().boundingBox();
  return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
};
/** Row facts for a set of tab buttons: heights, wrapped row count, overflow past the viewport. */
const tabFacts = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const els = [...document.querySelectorAll<HTMLElement>(s)];
    const r = els.map((e) => e.getBoundingClientRect());
    const parent = els[0]?.parentElement;
    return {
      count: els.length,
      heightMin: Math.round(Math.min(...r.map((x) => x.height))),
      widthMin: Math.round(Math.min(...r.map((x) => x.width))),
      rows: new Set(r.map((x) => Math.round(x.top))).size,
      rowHeightTotal: parent ? Math.round(parent.getBoundingClientRect().height) : null,
      fontPx: getComputedStyle(els[0]).fontSize,
      pageOverflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  }, sel);
/** What a horizontal chip row of the candidate labels would need at a given chip font/padding. */
const chipRowWidth = (page: Page, labels: string[], fontPx: number, padX: number, gap: number) =>
  page.evaluate(([ls, f, p, g]) => {
    const c = document.createElement("canvas").getContext("2d")!;
    c.font = `${f}px system-ui, sans-serif`;
    const w = (ls as string[]).map((l) => Math.ceil(c.measureText(l).width) + 2 * (p as number));
    return { total: w.reduce((a, b) => a + b, 0) + (g as number) * (w.length - 1), each: w };
  }, [labels, fontPx, padX, gap] as const);

const out: Record<string, unknown> = {};
for (const vp of VIEWPORTS) {
  test(`measure ${vp.id}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(vp);
    const r: Record<string, unknown> = { viewport: vp };
    await openWith(page);
    await page.getByRole("button", { name: /フリークッキング/ }).first().click();
    await page.waitForSelector(".pizza-stage");
    await completeDoughStep(page);
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.getByRole("button", { name: /次へ/ }).click();
    await page.waitForSelector(".ingredient-chip");
    r.builderTopping = {
      stage: await rect(page, ".pizza-stage"),
      tray: await rect(page, ".ingredient-tray"),
      pager: await rect(page, ".ingredient-page-nav"),
      bakeBar: await rect(page, ".prepare-bake-bar"),
      stepTabs: await rect(page, "[role=tablist]"),
      pagerLabel: (await page.locator(".ingredient-page-nav__label").first().textContent())?.trim(),
      chip: await rect(page, ".ingredient-chip"),
      gameScreenFits: await page.evaluate(() => {
        const e = document.querySelector<HTMLElement>(".game-screen")!;
        return e.scrollHeight <= e.clientHeight + 1;
      }),
    };
    const stepTab = await page.locator("[role=tablist] [role=tab]").first();
    r.builderStepTabRole = {
      tablistCount: await page.locator("[role=tablist]").count(),
      tabs: await page.locator("[role=tablist] [role=tab]").allTextContents(),
      firstTabH: Math.round((await stepTab.boundingBox())?.height ?? 0),
    };

    await openWith(page);
    await page.getByRole("button", { name: /ショップ/ }).click();
    await page.waitForSelector(".shop-overlay__body");
    r.shopTabs = { ...(await tabFacts(page, ".shop-filter-tab")), rect: await rect(page, ".shop-filter-tabs"), firstItem: await rect(page, ".shop-item") };
    await page.getByRole("button", { name: "閉じる" }).first().click();
    await page.getByRole("button", { name: /材料/ }).click();
    await page.waitForSelector(".inventory-grid");
    r.inventoryTabs = { ...(await tabFacts(page, ".inventory-tab")), rect: await rect(page, ".inventory-tabs"), grid: await rect(page, ".inventory-grid") };

    // Candidate chip rows: labels = すべて + 7 DH4 families (and + ソース/チーズ for Shop / Ingredients).
    const fam = ["すべて", "肉", "魚介", "野菜・きのこ", "果物", "ハーブ・香味", "スパイス・薬味", "その他"];
    const full = ["すべて", "ソース", "チーズ", "肉", "魚介", "野菜・きのこ", "果物", "ハーブ・香味", "スパイス・薬味", "その他"];
    r.candidateRowWidth = {
      viewportContentWidth: vp.width - 32,
      builder8_at14px: await chipRowWidth(page, fam, 14, 12, 8),
      shop10_at14px: await chipRowWidth(page, full, 14, 12, 8),
      shop10_at12px_current: await chipRowWidth(page, full, 12, 12, 8),
    };
    out[vp.id] = r;
  });
}
test.afterAll(() => {
  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify({ generatedBy: "tools/ingredient-category-tabs/measure.spec.ts", viewports: out }, null, 2) + "\n");
});
