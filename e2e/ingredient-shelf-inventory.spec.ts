import { test, expect, type Page } from "@playwright/test";
import { INGREDIENTS } from "../src/data/ingredients";

/**
 * Ingredient Category Tabs 1.0 Phase 4 (Ingredients), two-tier since Pantry / Category Tabs (OD-1 / OD-8): the shelf tabs on the Ingredients
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
const MAJOR = "材料の大分類";
const FAMILY = "具材の分類";
const row = (page: Page, label: string) => page.getByRole("group", { name: label });
const chipTexts = (page: Page, label = MAJOR) => row(page, label).locator(".shelf-chip").allTextContents();
const tapIn = (page: Page, label: string, name: string) => row(page, label).getByRole("button", { name, exact: true }).click();
const cards = (page: Page) => page.locator(".inventory-card__name").allTextContents();

async function facts(page: Page, label = MAJOR) {
  return page.evaluate((groupLabel) => {
    const row = document.querySelector<HTMLElement>(`.shelf-chips[aria-label="${groupLabel}"]`)!;
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
      straddles: chips.some((r) => r.left < rr.right - 1 && r.right > rr.right + 1),
    };
  }, label);
}

test.describe("Ingredients shelf tabs (two tiers)", () => {
  test("A. starters only: exactly 4 major chips, no family row, one row, 44px, no overflow", async ({ page }) => {
    await load(page, save(["egg", "ham"]));
    await openIngredients(page);
    expect(await chipTexts(page)).toEqual(["すべて", "ソース", "チーズ", "具材"]);
    await expect(row(page, FAMILY)).toHaveCount(0);
    const f = await facts(page);
    expect(f.oneRow).toBe(true);
    expect(f.rowHeight).toBeGreaterThanOrEqual(44);
    expect(f.minChipHeight).toBeGreaterThanOrEqual(44);
    expect(f.fontPx).toBeGreaterThanOrEqual(14);
    expect(f.pageOverflow).toBe(false);
    expect(f.clipped).toBe(false);
    expect(f.tabs).toBe(0);
  });

  test("C/E. full ownership: the 4 major chips fit; under 具材 the 8 family chips scroll inside their own row, never wrap, never squashed by the long list", async ({ page }) => {
    await load(page, save(FINITE, FINITE));
    await openIngredients(page);
    expect(await chipTexts(page)).toEqual(["すべて", "ソース", "チーズ", "具材"]);
    const major = await facts(page);
    expect(major.scrollable).toBe(false);
    expect(major.oneRow).toBe(true);
    expect(major.minChipHeight).toBeGreaterThanOrEqual(44);
    await tapIn(page, MAJOR, "具材");
    expect(await chipTexts(page, FAMILY)).toEqual([
      "すべて", "肉系", "魚介系", "野菜・きのこ系", "果物系", "ハーブ・香味系", "スパイス・薬味系", "ちょっと変わった材料",
    ]);
    const f = await facts(page, FAMILY);
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
    expect((await facts(page, MAJOR)).rowHeight).toBeGreaterThanOrEqual(44);
  });

  test("F. scroll the family row, pick a late family: correct filter, chip stays inside the row, body does not jump", async ({ page }) => {
    await load(page, save(FINITE, FINITE));
    await openIngredients(page);
    await tapIn(page, MAJOR, "具材");
    const body = page.locator(".dex-overlay__body");
    const top = await body.evaluate((el) => el.scrollTop);
    await row(page, FAMILY).evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await tapIn(page, FAMILY, "スパイス・薬味系");
    await expect(row(page, FAMILY).getByRole("button", { name: "スパイス・薬味系" })).toHaveAttribute("aria-pressed", "true");
    expect(await cards(page)).toEqual(["ケッパー"]);
    const box = await row(page, FAMILY).getByRole("button", { name: "スパイス・薬味系" }).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    expect(await body.evaluate((el) => el.scrollTop)).toBe(top);
    expect((await facts(page, FAMILY)).pageOverflow).toBe(false);
  });

  test("G. the family tag is on every 具材 card (also under a family filter) and on no sauce / cheese card", async ({ page }) => {
    await load(page, save(FINITE, FINITE));
    await openIngredients(page);
    const tags = await page.locator(".inventory-card").evaluateAll((els) =>
      els.map((e) => [e.querySelector(".inventory-card__name")!.textContent, e.querySelector(".family-tag")?.textContent ?? null]),
    );
    for (const [name, tag] of tags) {
      const sauceOrCheese = INGREDIENTS.find((i) => i.nameJa === name)!.category !== "topping";
      expect(tag === null, String(name)).toBe(sauceOrCheese);
    }
    await tapIn(page, MAJOR, "具材");
    await tapIn(page, FAMILY, "肉系");
    const meat = await page.locator(".inventory-card .family-tag").allTextContents();
    expect(meat.length).toBeGreaterThan(0);
    for (const t of meat) expect(t).toContain("肉系");
  });

  test("B/C. Shop purchase -> ownership -> Ingredients: an unbought NEW material adds no family chip; buying it does", async ({ page }) => {
    await load(page, save(["mushroom", "ham"]));
    // B: mushroom is a Shop NEW row (entitled, unbought) -> Ingredients must not show its shelf.
    await openIngredients(page);
    await tapIn(page, MAJOR, "具材");
    expect(await chipTexts(page, FAMILY)).toEqual(["すべて", "ハーブ・香味系"]);
    expect(await page.locator("body").innerText()).not.toContain("野菜・きのこ");
    await close(page);
    // Buy it in the Shop.
    await openShop(page);
    await tapIn(page, MAJOR, "具材");
    await tapIn(page, FAMILY, "野菜・きのこ系");
    await page.getByRole("button", { name: "仕入れる" }).click();
    const afterBuy = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
    expect(afterBuy.ownedIngredientIds).toContain("mushroom");
    expect(afterBuy.ownedIngredientIds).not.toContain("ham");
    await close(page);
    // C: Ingredients now shows the material and, for the first time, its shelf chip.
    await openIngredients(page);
    expect(await cards(page)).toContain("マッシュルーム");
    await tapIn(page, MAJOR, "具材");
    expect(await chipTexts(page, FAMILY)).toEqual(["すべて", "野菜・きのこ系", "ハーブ・香味系"]);
    await tapIn(page, FAMILY, "野菜・きのこ系");
    expect(await cards(page)).toEqual(["マッシュルーム"]);
    // The unbought ham is still not owned and adds no 肉系 chip.
    expect(await chipTexts(page, FAMILY)).not.toContain("肉系");
    // G: filtering and closing/reopening leave the save untouched.
    const beforeClose = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
    await close(page);
    await openIngredients(page);
    const reopened = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
    expect(reopened).toEqual(beforeClose);
    expect(reopened).toEqual(afterBuy);
    await expect(row(page, MAJOR).getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
  });
});
