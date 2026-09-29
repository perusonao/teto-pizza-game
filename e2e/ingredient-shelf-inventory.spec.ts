import { test, expect, type Page } from "@playwright/test";

/**
 * Ingredient Category Tabs 1.0 Phase 4 (Ingredients): the shelf chip row on the Ingredients
 * (Inventory) screen through real layout at 390x844 and 360x800 (Chromium and WebKit projects),
 * plus the cross-screen contract: unlock != ownership; purchase -> ownership -> shelf chip.
 */

const SAVE_KEY = "teto-pizza-save-v1";
const FINITE = [
  "olive-oil", "pesto", "gorgonzola", "parmigiano", "fontina", "garlic", "oregano", "cherry-tomato",
  "egg", "mushroom", "onion", "sausage", "pepperoni", "anchovy", "tuna", "rosemary", "bacon", "ham",
  "black-olive", "capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato",
];
const STARTERS = ["tomato-sauce", "mozzarella", "basil"];

function save(unlocked: string[], owned: string[] = []) {
  return {
    schemaVersion: 2,
    dex: [{ recipeId: "margherita", discovered: true, bestScore: 72, bestStars: 3, timesMade: 2 }],
    pitzBalance: 999,
    ownedIngredientIds: [...STARTERS, ...owned],
    missionBest: {},
    inventory: Object.fromEntries(owned.map((id) => [id, 9])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: unlocked,
  };
}

async function load(page: Page, data: unknown) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [SAVE_KEY, JSON.stringify(data)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
}
const openIngredients = async (page: Page) => {
  await page.getByRole("button", { name: /材料/ }).click();
  await page.waitForSelector(".inventory-grid");
};
const openShop = async (page: Page) => {
  await page.getByRole("button", { name: /ショップ/ }).click();
  await page.waitForSelector(".shop-overlay__body");
};
const close = (page: Page) => page.getByRole("button", { name: "閉じる" }).first().click();
const chipTexts = (page: Page) => page.locator(".shelf-chips .shelf-chip").allTextContents();
const cards = (page: Page) => page.locator(".inventory-card__name").allTextContents();

async function facts(page: Page) {
  return page.evaluate(() => {
    const row = document.querySelector<HTMLElement>(".shelf-chips")!;
    const chips = [...row.querySelectorAll<HTMLElement>(".shelf-chip")].map((c) => c.getBoundingClientRect());
    const rr = row.getBoundingClientRect();
    return {
      rowHeight: rr.height,
      minChipHeight: Math.min(...chips.map((r) => r.height)),
      chipsInsideRow: chips.every((r) => r.top >= rr.top - 0.5 && r.bottom <= rr.bottom + 0.5),
      oneRow: new Set(chips.map((r) => Math.round(r.top))).size === 1,
      scrollable: row.scrollWidth > row.clientWidth + 1,
      wrap: getComputedStyle(row).flexWrap,
      fontPx: parseFloat(getComputedStyle(row.querySelector(".shelf-chip")!).fontSize),
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
      clipped: [...row.querySelectorAll<HTMLElement>(".shelf-chip")].some((c) => c.scrollWidth > c.clientWidth + 1),
      tabs: document.querySelectorAll("[role=tab], [role=tablist]").length,
      straddles: chips.some((r) => r.left < rr.right - 4 && r.right > rr.right + 4),
    };
  });
}

test.describe("Ingredients shelf chips", () => {
  test("A. starters only: exactly 4 chips, one row, 44px, no overflow", async ({ page }) => {
    await load(page, save(["egg", "ham"]));
    await openIngredients(page);
    expect(await chipTexts(page)).toEqual(["すべて", "ソース", "チーズ", "ハーブ・香味"]);
    const f = await facts(page);
    expect(f.oneRow).toBe(true);
    expect(f.rowHeight).toBeGreaterThanOrEqual(44);
    expect(f.minChipHeight).toBeGreaterThanOrEqual(44);
    expect(f.fontPx).toBeGreaterThanOrEqual(14);
    expect(f.pageOverflow).toBe(false);
    expect(f.clipped).toBe(false);
    expect(f.tabs).toBe(0);
  });

  test("C/E. full ownership: 10 chips scroll inside the row, never wrap, never squashed by the long list", async ({ page }) => {
    await load(page, save(FINITE, FINITE));
    await openIngredients(page);
    expect(await chipTexts(page)).toEqual([
      "すべて", "ソース", "チーズ", "肉", "魚介", "野菜・きのこ", "果物", "ハーブ・香味", "スパイス・薬味", "その他",
    ]);
    const f = await facts(page);
    expect(f.wrap).toBe("nowrap");
    expect(f.oneRow).toBe(true);
    // Regression pin (Shop's 2px collapse): the row keeps its height with 29 cards below.
    expect(f.rowHeight).toBeGreaterThanOrEqual(44);
    expect(f.minChipHeight).toBeGreaterThanOrEqual(44);
    expect(f.chipsInsideRow).toBe(true);
    expect(f.scrollable).toBe(true);
    expect(f.straddles).toBe(true);
    expect(f.pageOverflow).toBe(false);
    expect(f.clipped).toBe(false);
  });

  test("F. scroll the row, pick a late shelf: correct filter, chip stays inside the row, body does not jump", async ({ page }) => {
    await load(page, save(FINITE, FINITE));
    await openIngredients(page);
    const body = page.locator(".dex-overlay__body");
    const top = await body.evaluate((el) => el.scrollTop);
    await page.locator(".shelf-chips").evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await page.getByRole("button", { name: "スパイス・薬味" }).click();
    await expect(page.getByRole("button", { name: "スパイス・薬味" })).toHaveAttribute("aria-pressed", "true");
    expect(await cards(page)).toEqual(["ケッパー"]);
    const box = await page.getByRole("button", { name: "スパイス・薬味" }).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    expect(await body.evaluate((el) => el.scrollTop)).toBe(top);
    expect((await facts(page)).pageOverflow).toBe(false);
  });

  test("B/C. Shop purchase -> ownership -> Ingredients: an unbought NEW material adds no chip; buying it does", async ({ page }) => {
    await load(page, save(["mushroom", "ham"]));
    // B: mushroom is a Shop NEW row (entitled, unbought) -> Ingredients must not show its shelf.
    await openIngredients(page);
    expect(await chipTexts(page)).toEqual(["すべて", "ソース", "チーズ", "ハーブ・香味"]);
    expect(await page.locator("body").innerText()).not.toContain("野菜・きのこ");
    await close(page);
    // Buy it in the Shop.
    await openShop(page);
    await page.getByRole("button", { name: "野菜・きのこ" }).click();
    await page.getByRole("button", { name: "仕入れる" }).click();
    const afterBuy = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
    expect(afterBuy.ownedIngredientIds).toContain("mushroom");
    expect(afterBuy.ownedIngredientIds).not.toContain("ham");
    await close(page);
    // C: Ingredients now shows the material and, for the first time, its shelf chip.
    await openIngredients(page);
    expect(await chipTexts(page)).toEqual(["すべて", "ソース", "チーズ", "野菜・きのこ", "ハーブ・香味"]);
    expect(await cards(page)).toContain("マッシュルーム");
    await page.getByRole("button", { name: "野菜・きのこ" }).click();
    expect(await cards(page)).toEqual(["マッシュルーム"]);
    // The unbought ham is still not owned and adds no 肉 chip.
    expect(await chipTexts(page)).not.toContain("肉");
    // G: filtering and closing/reopening leave the save untouched.
    const beforeClose = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
    await close(page);
    await openIngredients(page);
    const reopened = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
    expect(reopened).toEqual(beforeClose);
    expect(reopened).toEqual(afterBuy);
    await expect(page.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
  });
});
