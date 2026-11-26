import { test, expect, type Page } from "@playwright/test";

/**
 * B案 Phase 3a (Issue #901): the curated 60 (`MENU_CATALOG`, 5 stages x 12) are the shop model's catalog. Under
 * `?progression=shop` (DEV / Preview) the Dex, HOME's Dex pill and Pizza Select count and show only those 60, grouped by
 * the Owner's stages; a recipe the catalog does not adopt stays in the game data but is not part of the shop's Dex.
 * Legacy (no parameter) is checked to be unchanged: every recipe, at its legacy chapter.
 */

/** A recipe that exists in `RECIPES` but is not one of the curated 60 (src/data/menuCatalog.ts). */
const NOT_ADOPTED = "pizza-salad";

const SAVE = {
  schemaVersion: 2,
  dex: [
    { recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 },
    { recipeId: "capricciosa", discovered: true, bestScore: 70, bestStars: 2, timesMade: 1 },
    { recipeId: NOT_ADOPTED, discovered: true, bestScore: 70, bestStars: 2, timesMade: 1 },
  ],
  pitzBalance: 100,
  ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil"],
  missionBest: {},
  shopProgress: { reputation: 45, grantedMenuRecipeIds: [] },
};

async function open(page: Page, query: string) {
  await page.goto("/");
  await page.evaluate((text) => {
    localStorage.clear();
    localStorage.setItem("teto-pizza-save-v1", text);
  }, JSON.stringify(SAVE));
  await page.goto(`/${query}`);
  await page.waitForSelector(".app-frame");
}

async function dexPillCounts(page: Page): Promise<[number, number]> {
  const text = (await page.locator(".app-header__dex-pill").textContent()) ?? "";
  const m = /(\d+)\/(\d+)/.exec(text);
  if (!m) throw new Error(`no count in the Dex pill: ${text}`);
  return [Number(m[1]), Number(m[2])];
}

async function openDex(page: Page) {
  await page.getByRole("button", { name: /ピザ図鑑/ }).click();
  await expect(page.locator(".dex-overlay__chapter").first()).toBeVisible();
}

test.describe("B案 Phase 3a: the curated 60 are the shop's Dex (shop model)", () => {
  test("legacy (no parameter): HOME's Dex pill and the Dex still count every recipe", async ({ page }) => {
    await open(page, "");
    const [found, total] = await dexPillCounts(page);
    expect(found).toBe(3);
    expect(total).toBeGreaterThan(60);
    await openDex(page);
    const titles = (await page.locator(".dex-overlay__chapter-title").allTextContents()).filter((t) => /^第\d+章/.test(t));
    const sum = titles.map((t) => Number(/\/(\d+)/.exec(t)?.[1] ?? 0)).reduce((a, b) => a + b, 0);
    expect(sum).toBe(total);
    expect(titles.length).toBeLessThan(5);
  });

  test("shop: HOME's pill reads x/60, counting only adopted recipes", async ({ page }) => {
    await open(page, "?progression=shop");
    expect(await dexPillCounts(page)).toEqual([2, 60]);
    await expect(page.locator(".app-header__dex-pill")).toHaveAttribute("aria-label", "レシピ図鑑 開発数 2 / 60");
  });

  test("shop: the Dex lists the 60 in five stages of 12", async ({ page }) => {
    await open(page, "?progression=shop");
    await openDex(page);
    // The Dex's recipe chapters (the 🍳 technique section above them is a separate section without a count).
    const titles = (await page.locator(".dex-overlay__chapter-title").allTextContents()).filter((t) => /^第\d+章/.test(t));
    expect(titles).toEqual(["第1章1/12", "第2章1/12", "第3章0/12", "第4章0/12", "第5章0/12"]);
    await expect(page.locator(".dex-overlay__chapter .dex-card:not(.dex-card--technique)")).toHaveCount(60);
  });

  test("shop: Pizza Select (practice) shows the menu by stage, counting x/12", async ({ page }) => {
    await open(page, "?progression=shop");
    await page.getByRole("button", { name: /メニューから選んで練習する/ }).click();
    await expect(page.getByRole("heading", { name: "練習するピザを選ぼう！" })).toBeVisible();
    const headings = await page.locator(".pizza-select-section").allTextContents();
    expect(headings.length).toBe(5);
    for (const h of headings) expect(h).toMatch(/開発 \d+\/12/);
  });
});
