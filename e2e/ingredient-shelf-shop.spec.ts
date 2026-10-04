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

const MAJOR = "材料の大分類";
const FAMILY = "具材の分類";
const row = (page: Page, label: string) => page.getByRole("group", { name: label });
const chipTexts = (page: Page, label = MAJOR) => row(page, label).locator(".shelf-chip").allTextContents();
const tapIn = (page: Page, label: string, name: string) => row(page, label).getByRole("button", { name, exact: true }).click();

async function chipRowFacts(page: Page, label = MAJOR) {
  return page.evaluate((groupLabel) => {
    const row = document.querySelector<HTMLElement>(`.shelf-chips[aria-label="${groupLabel}"]`)!;
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
  }, label);
}

test.describe("Shop shelf tabs (two tiers)", () => {
  test("A. early Shop: only listed majors (具材), one row, 44px, no overflow; the family row is under 具材 only", async ({ page }) => {
    await openShop(page, save(["egg", "ham"]));
    expect(await chipTexts(page)).toEqual(["すべて", "具材"]);
    await expect(row(page, FAMILY)).toHaveCount(0);
    await tapIn(page, MAJOR, "具材");
    expect(await chipTexts(page, FAMILY)).toEqual(["すべて", "肉系", "ちょっと変わった材料"]);
    const f = await chipRowFacts(page, FAMILY);
    expect(f.oneRow).toBe(true);
    expect(f.minHeight).toBeGreaterThanOrEqual(44);
    expect(f.fontPx).toBeGreaterThanOrEqual(14);
    expect(f.pageOverflow).toBe(false);
    expect(f.clipped).toBe(false);
    expect(await page.getByText("トッピング").count()).toBe(0);
  });

  test("B/C. many families: the 4 major chips fit; the family row scrolls by itself, never wraps, labels are readable", async ({ page }) => {
    await openShop(page, save(FINITE));
    expect(await chipTexts(page)).toEqual(["すべて", "ソース", "チーズ", "具材"]);
    expect((await chipRowFacts(page)).scrollable).toBe(false);
    await tapIn(page, MAJOR, "具材");
    expect(await chipTexts(page, FAMILY)).toEqual([
      "すべて", "肉系", "魚介系", "野菜・きのこ系", "果物系", "ハーブ・香味系", "スパイス・薬味系", "ちょっと変わった材料",
    ]);
    const f = await chipRowFacts(page, FAMILY);
    expect(f.wrap).toBe("nowrap");
    // A long list below must not squash the row (the overlay body is a column flexbox).
    expect(f.rowHeight).toBeGreaterThanOrEqual(44);
    expect(f.chipsInsideRow).toBe(true);
    expect(f.oneRow).toBe(true);
    expect(f.minHeight).toBeGreaterThanOrEqual(44);
    expect(f.scrollable).toBe(true);
    expect(f.pageOverflow).toBe(false);
    expect(f.clipped).toBe(false);
    expect((await chipRowFacts(page, MAJOR)).rowHeight).toBeGreaterThanOrEqual(44);
    // Some chip straddles the row's right edge: the row visibly continues to the right.
    const straddles = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>('.shelf-chips[aria-label="具材の分類"]')!;
      const rr = row.getBoundingClientRect();
      return [...row.querySelectorAll<HTMLElement>(".shelf-chip")].some((c) => {
        const r = c.getBoundingClientRect();
        return r.left < rr.right - 1 && r.right > rr.right + 1;
      });
    });
    expect(straddles).toBe(true);
  });

  test("D. scroll the row, pick a late shelf: it becomes active and stays inside the row; the page does not scroll", async ({ page }) => {
    await openShop(page, save(FINITE));
    const body = page.locator(".dex-overlay__body");
    const bodyTopBefore = await body.evaluate((el) => el.scrollTop);
    await tapIn(page, MAJOR, "具材");
    await row(page, FAMILY).evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await tapIn(page, FAMILY, "スパイス・薬味系");
    await expect(row(page, FAMILY).getByRole("button", { name: "スパイス・薬味系" })).toHaveAttribute("aria-pressed", "true");
    const chip = await row(page, FAMILY).getByRole("button", { name: "スパイス・薬味系" }).boundingBox();
    const vp = page.viewportSize()!;
    expect(chip!.x).toBeGreaterThanOrEqual(0);
    expect(chip!.x + chip!.width).toBeLessThanOrEqual(vp.width + 1);
    await expect(page.locator(".shop-item")).toHaveCount(1);
    await expect(page.locator('.shop-item[data-ingredient-id="capers"]')).toHaveCount(1);
    expect(await body.evaluate((el) => el.scrollTop)).toBe(bodyTopBefore);
    expect((await chipRowFacts(page, FAMILY)).pageOverflow).toBe(false);
  });

  test("E/F. buy under a shelf: same semantics; close and reopen leaves the save consistent", async ({ page }) => {
    await openShop(page, save(["mushroom", "ham"], []));
    const listedBefore = await page.locator(".shop-item").count();
    await tapIn(page, MAJOR, "具材");
    await tapIn(page, FAMILY, "野菜・きのこ系");
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
    await expect(row(page, MAJOR).getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    await expect(row(page, FAMILY)).toHaveCount(0);
    await expect(page.locator(".shop-item")).toHaveCount(listedBefore);
  });
});
