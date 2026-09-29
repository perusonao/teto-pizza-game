import { test, expect, type Page } from "@playwright/test";

/**
 * Ingredient Category Tabs 1.0 Phase 3 (Shop): the shelf chip row through real layout at
 * 390x844 and 360x800 (Chromium and WebKit projects). One scrolling row, 44px targets, no page
 * overflow, chips only for listed rows, and a purchase under a shelf works as before.
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

async function openShop(page: Page, data: unknown) {
  await page.goto("icons/icon-16.png");
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [SAVE_KEY, JSON.stringify(data)] as const);
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await page.getByRole("button", { name: /ショップ/ }).click();
  await page.waitForSelector(".shop-overlay__body");
}

const chips = (page: Page) => page.locator(".shelf-chips .shelf-chip");
const chipTexts = (page: Page) => chips(page).allTextContents();

async function chipRowFacts(page: Page) {
  return page.evaluate(() => {
    const row = document.querySelector<HTMLElement>(".shelf-chips")!;
    const rects = [...row.querySelectorAll<HTMLElement>(".shelf-chip")].map((c) => c.getBoundingClientRect());
    const rr = row.getBoundingClientRect();
    return {
      oneRow: new Set(rects.map((r) => Math.round(r.top))).size === 1,
      minHeight: Math.min(...rects.map((r) => r.height)),
      scrollable: row.scrollWidth > row.clientWidth + 1,
      rowLeft: rr.left,
      rowRight: rr.right,
      viewport: window.innerWidth,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
      clipped: [...row.querySelectorAll<HTMLElement>(".shelf-chip")].some((c) => c.scrollWidth > c.clientWidth + 1),
      fontPx: parseFloat(getComputedStyle(row.querySelector(".shelf-chip")!).fontSize),
      wrap: getComputedStyle(row).flexWrap,
      rowHeight: rr.height,
      chipsInsideRow: rects.every((r) => r.top >= rr.top - 0.5 && r.bottom <= rr.bottom + 0.5),
    };
  });
}

test.describe("Shop shelf chips", () => {
  test("A. early Shop: only listed shelves, one row, 44px, no overflow", async ({ page }) => {
    await openShop(page, save(["egg", "ham"]));
    expect(await chipTexts(page)).toEqual(["すべて", "肉", "その他"]);
    const f = await chipRowFacts(page);
    expect(f.oneRow).toBe(true);
    expect(f.minHeight).toBeGreaterThanOrEqual(44);
    expect(f.fontPx).toBeGreaterThanOrEqual(14);
    expect(f.pageOverflow).toBe(false);
    expect(f.clipped).toBe(false);
    expect(await page.getByText("トッピング").count()).toBe(0);
  });

  test("B/C. many shelves: the row scrolls by itself, never wraps, labels are readable", async ({ page }) => {
    await openShop(page, save(FINITE));
    expect(await chipTexts(page)).toEqual([
      "すべて", "ソース", "チーズ", "肉", "魚介", "野菜・きのこ", "果物", "ハーブ・香味", "スパイス・薬味", "その他",
    ]);
    const f = await chipRowFacts(page);
    expect(f.wrap).toBe("nowrap");
    // A long list below must not squash the row (the overlay body is a column flexbox).
    expect(f.rowHeight).toBeGreaterThanOrEqual(44);
    expect(f.chipsInsideRow).toBe(true);
    expect(f.oneRow).toBe(true);
    expect(f.minHeight).toBeGreaterThanOrEqual(44);
    expect(f.scrollable).toBe(true);
    expect(f.pageOverflow).toBe(false);
    expect(f.clipped).toBe(false);
    // Some chip straddles the row's right edge: the row visibly continues to the right.
    const straddles = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>(".shelf-chips")!.getBoundingClientRect();
      return [...document.querySelectorAll<HTMLElement>(".shelf-chip")].some((c) => {
        const r = c.getBoundingClientRect();
        return r.left < row.right - 4 && r.right > row.right + 4;
      });
    });
    expect(straddles).toBe(true);
  });

  test("D. scroll the row, pick a late shelf: it becomes active and stays inside the row; the page does not scroll", async ({ page }) => {
    await openShop(page, save(FINITE));
    const body = page.locator(".dex-overlay__body");
    const bodyTopBefore = await body.evaluate((el) => el.scrollTop);
    await page.locator(".shelf-chips").evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await page.getByRole("button", { name: "スパイス・薬味" }).click();
    await expect(page.getByRole("button", { name: "スパイス・薬味" })).toHaveAttribute("aria-pressed", "true");
    const chip = await page.getByRole("button", { name: "スパイス・薬味" }).boundingBox();
    const vp = page.viewportSize()!;
    expect(chip!.x).toBeGreaterThanOrEqual(0);
    expect(chip!.x + chip!.width).toBeLessThanOrEqual(vp.width + 1);
    await expect(page.locator(".shop-item")).toHaveCount(1);
    await expect(page.locator('.shop-item[data-ingredient-id="capers"]')).toHaveCount(1);
    expect(await body.evaluate((el) => el.scrollTop)).toBe(bodyTopBefore);
    expect((await chipRowFacts(page)).pageOverflow).toBe(false);
  });

  test("E/F. buy under a shelf: same semantics; close and reopen leaves the save consistent", async ({ page }) => {
    await openShop(page, save(["mushroom", "ham"], []));
    const listedBefore = await page.locator(".shop-item").count();
    await page.getByRole("button", { name: "野菜・きのこ" }).click();
    await expect(page.locator(".shop-item")).toHaveCount(1);
    await page.getByRole("button", { name: "仕入れる" }).click();
    await expect(page.locator(".shop-item__restock-button")).toHaveCount(1); // NEW -> OWNED row stays visible
    const after = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
    expect(after.ownedIngredientIds).toContain("mushroom");
    expect(after.ownedIngredientIds).not.toContain("ham");
    expect(after.pitzBalance).toBeLessThan(999);
    // Close and reopen: nothing changed by the filter; the filter itself starts fresh at すべて.
    await page.getByRole("button", { name: "閉じる" }).first().click();
    await page.getByRole("button", { name: /ショップ/ }).click();
    const reopened = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
    expect(reopened).toEqual(after);
    await expect(page.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".shop-item")).toHaveCount(listedBefore);
  });
});
